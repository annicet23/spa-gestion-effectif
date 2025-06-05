const express = require('express');
const router = express.Router();
// Assurez-vous que les modèles sont correctement importés
const { User, MiseAJour, HistoriqueStatsJournalieresCadres, Cadre } = require('../models');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
// Importez les fonctions utilitaires de date nécessaires
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');
const Sequelize = require('sequelize');
const moment = require('moment-timezone'); // Pour les logs de débogage clairs
const APP_TIMEZONE = 'Indian/Antananarivo'; // Assurez-vous que c'est bien défini ou importez-le depuis votre config

// Middleware d'authentification appliqué à ce routeur
router.use(authenticateJWT);

// ✅ AJOUT - DEBUG LOGGING POUR TOUTES LES REQUÊTES
router.use((req, res, next) => {
    console.log(`[statusRoutes] ====== REQUÊTE REÇUE ======`);
    console.log(`[statusRoutes] Méthode: ${req.method}`);
    console.log(`[statusRoutes] URL complète: ${req.originalUrl}`);
    console.log(`[statusRoutes] Path: ${req.path}`);
    console.log(`[statusRoutes] Paramètres:`, req.params);
    console.log(`[statusRoutes] Query:`, req.query);
    console.log(`[statusRoutes] User:`, req.user ? `${req.user.id} (${req.user.username})` : 'NON AUTHENTIFIÉ');
    console.log(`[statusRoutes] Headers Authorization:`, req.headers.authorization ? 'PRÉSENT' : 'ABSENT');
    console.log(`[statusRoutes] ===========================`);
    next();
});

// Cette route retourne la liste des cadres qui ont effectué leur mise à jour
// pour la période historique en cours (16h J-1 à 15h59 J), et ceux qui sont encore en attente.
router.get('/daily-updates', async (req, res) => {
    console.log(`[statusRoutes] === ROUTE /daily-updates APPELÉE ===`);
    try {
        const now = new Date();
        // Détermine la date historique ('AAAA-MM-JJ') pour la période actuelle (ex: '2025-05-20' si nous sommes le 19 mai après 16h)
        const currentHistoricalDateLabel = getHistoricalDate(now);

        // Calcule les bornes précises de la période historique en cours (avec l'heure et le fuseau horaire EAT)
        const periodStart = getHistoricalDayStartTime(currentHistoricalDateLabel);
        const periodEnd = getHistoricalDayEndTime(currentHistoricalDateLabel);

        console.log(`[statusRoutes] Période de recherche pour /daily-updates :`);
        console.log(`  Début (UTC) : ${periodStart.toISOString()}`);
        console.log(`  Fin (UTC)   : ${periodEnd.toISOString()}`);
        console.log(`  Début (${APP_TIMEZONE}) : ${moment(periodStart).tz(APP_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`  Fin (${APP_TIMEZONE})   : ${moment(periodEnd).tz(APP_TIMEZONE).format('YYYY-MM-DD HH:mm:ss')}`);

        // Récupère les mises à jour validées pour la période historique actuelle.
        const userDailySubmissions = await MiseAJour.findAll({
            where: {
                created_at: {
                    [Op.between]: [periodStart, periodEnd]
                },
                status: 'Validée' // Ne considérez que les soumissions "Validée" pour les terminés
            },
            attributes: [
                [Sequelize.col('SubmittedBy.id'), 'id'],
                [Sequelize.col('SubmittedBy.username'), 'username'],
                // Compte le nombre de soumissions par utilisateur pour la période
                [Sequelize.fn('COUNT', '*'), 'dailySubmissionCount'],
                // Récupère le timestamp de la dernière soumission pour l'affichage
                [Sequelize.fn('MAX', Sequelize.col('MiseAJour.created_at')), 'updatedAt'],
            ],
            include: [{
                model: User,
                as: 'SubmittedBy',
                attributes: [], // Pas besoin de sélectionner des attributs ici s'ils sont déjà dans le `attributes` principal
                where: {
                    status: 'Active',
                    role: 'Standard'
                },
                required: true // Assure un INNER JOIN pour n'inclure que les mises à jour liées à un User existant
            }],
            group: [ // Regroupe par les identifiants de l'utilisateur pour agréger les soumissions
                'SubmittedBy.id',
                'SubmittedBy.username',
            ],
            order: [
                // Trie les résultats par la date de la dernière soumission, la plus récente en premier
                [Sequelize.fn('MAX', Sequelize.col('MiseAJour.created_at')), 'DESC']
            ],
            raw: true, // Retourne des objets JSON plats, plus faciles à manipuler
        });

        // Les utilisateurs "Terminés" sont ceux trouvés dans la requête ci-dessus
        const completedUsers = userDailySubmissions;
        console.log(`[statusRoutes] Cadres "Terminés" (IDs): ${completedUsers.map(u => u.id).join(', ')}`);

        // Récupère tous les utilisateurs Standard/Active
        const allStandardActiveUsers = await User.findAll({
            attributes: ['id', 'username'],
            where: {
                status: 'Active',
                role: 'Standard'
            }
        });

        // Identifie les IDs des utilisateurs déjà "Terminés"
        const usersWhoSubmittedIds = completedUsers.map(u => u.id);

        // Filtre la liste complète pour trouver ceux qui n'ont PAS encore soumis
        const pendingUsers = allStandardActiveUsers.filter(user =>
            !usersWhoSubmittedIds.includes(user.id)
        );

        // Trie les utilisateurs "En attente" par ordre alphabétique de username
        pendingUsers.sort((a, b) => a.username.localeCompare(b.username));
        console.log(`[statusRoutes] Cadres "En attente" (IDs): ${pendingUsers.map(u => u.id).join(', ')}`);

        // Renvoie les deux listes au client
        res.json({
            completed: completedUsers,
            pending: pendingUsers.map(u => ({ id: u.id, username: u.username })) // Projette les objets en attente
        });

    } catch (error) {
        console.error('Erreur lors de la récupération des statuts quotidiens (filtrés par Validée):', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des statuts.' });
    }
});

// ✅ VERSION MODIFIÉE - GET /users/:userId/submissions avec support des nouvelles données
router.get('/users/:userId/submissions', async (req, res) => {
    console.log(`[statusRoutes] === ROUTE /users/:userId/submissions APPELÉE ===`);
    try {
        const { userId } = req.params;

        console.log(`[statusRoutes] GET /users/:userId/submissions - Récupération des soumissions pour User ID: ${userId}`);
        console.log(`[statusRoutes] Type de userId: ${typeof userId}, Valeur: "${userId}"`);

        // ✅ SIMPLE - Récupérer TOUTES les soumissions des dernières 24h
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        console.log(`[statusRoutes] Recherche depuis: ${last24Hours.toISOString()}`);
        console.log(`[statusRoutes] Jusqu'à maintenant: ${new Date().toISOString()}`);

        // Vérification des permissions
        const requestingUser = req.user;
        const isAdmin = requestingUser.role === 'Admin';
        const isConsultant = requestingUser.role === 'Consultant'; // ✅ AJOUTÉ
        const isOwnData = requestingUser.id === parseInt(userId);

        console.log(`[statusRoutes] Vérification permissions:`);
        console.log(`  - User connecté: ${requestingUser.id} (${requestingUser.username})`);
        console.log(`  - Role: ${requestingUser.role}`);
        console.log(`  - Est Admin: ${isAdmin}`);
        console.log(`  - Est Consultant: ${isConsultant}`); // ✅ AJOUTÉ
        console.log(`  - Est ses propres données: ${isOwnData}`);
        console.log(`  - Comparaison: ${requestingUser.id} === ${parseInt(userId)} = ${requestingUser.id === parseInt(userId)}`);

        if (!isAdmin && !isConsultant && !isOwnData) { // ✅ MODIFIÉ - Ajout du consultant
            console.log(`[statusRoutes] ACCÈS REFUSÉ pour userId ${userId}`);
            return res.status(403).json({
                message: 'Accès refusé : vous ne pouvez voir que vos propres soumissions.'
            });
        }

        console.log(`[statusRoutes] ACCÈS AUTORISÉ pour userId ${userId}`);

        // ✅ REQUÊTE SIMPLE - dernières 24h avec nouvelles inclusions
        console.log(`[statusRoutes] Exécution de la requête MiseAJour.findAll...`);

        const submissions = await MiseAJour.findAll({
            where: {
                submitted_by_id: userId,
                created_at: {
                    [Op.gte]: last24Hours // Depuis les dernières 24h
                }
            },
            include: [
                {
                    model: User,
                    as: 'SubmittedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    include: [{
                        model: Cadre,
                        as: 'cadre',
                        attributes: ['id', 'service', 'fonction']
                    }]
                },
                {
                    model: User,
                    as: 'ValidatedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    required: false
                },
                // ✅ AJOUT - Include pour l'utilisateur qui a réellement fait la mise à jour
                {
                    model: User,
                    as: 'ActualUpdater',
                    attributes: ['id', 'username', 'nom', 'prenom', 'grade'],
                    required: false
                },
                // ✅ AJOUT - Include pour le cadre concerné
                {
                    model: Cadre,
                    as: 'Cadre',
                    attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service', 'fonction'],
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        console.log(`[statusRoutes] ✅ REQUÊTE TERMINÉE - Trouvé ${submissions.length} soumissions pour l'utilisateur ${userId}`);

        // ✅ DEBUG DÉTAILLÉ
        if (submissions.length > 0) {
            console.log(`[statusRoutes] Liste des soumissions trouvées:`);
            submissions.forEach((sub, index) => {
                console.log(`  ${index + 1}. ID: ${sub.id}, Créé: ${sub.created_at}, Status: ${sub.status}, Fait par responsable: ${sub.is_updated_by_responsible}`);
            });
        } else {
            console.log(`[statusRoutes] ❌ AUCUNE SOUMISSION TROUVÉE`);
            console.log(`[statusRoutes] Critères de recherche:`);
            console.log(`  - submitted_by_id: ${userId}`);
            console.log(`  - created_at >= ${last24Hours.toISOString()}`);

            // Test: vérification de toutes les soumissions récentes sans filtre utilisateur
            console.log(`[statusRoutes] Test: Recherche de TOUTES les soumissions récentes...`);
            const allRecentSubmissions = await MiseAJour.findAll({
                where: {
                    created_at: {
                        [Op.gte]: last24Hours
                    }
                },
                attributes: ['id', 'submitted_by_id', 'created_at', 'status'],
                order: [['created_at', 'DESC']],
                limit: 10
            });

            console.log(`[statusRoutes] Trouvé ${allRecentSubmissions.length} soumissions récentes (tous utilisateurs):`);
            allRecentSubmissions.forEach((sub, index) => {
                console.log(`  ${index + 1}. ID: ${sub.id}, User: ${sub.submitted_by_id}, Créé: ${sub.created_at}, Status: ${sub.status}`);
            });
        }

        console.log(`[statusRoutes] Envoi de la réponse JSON...`);
        res.json(submissions);

    } catch (error) {
        console.error('[statusRoutes] ❌ ERREUR lors de la récupération des soumissions utilisateur:', error);
        console.error('[statusRoutes] Stack trace:', error.stack);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération des soumissions.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Route existante pour le résumé des cadres
router.get('/cadres/summary', async (req, res) => {
    console.log(`[statusRoutes] === ROUTE /cadres/summary APPELÉE ===`);
    // TODO: Ajouter la logique de permission (seuls les Admins ou Cadres avec certaines responsabilités peuvent voir ?)
    console.log(`[statusRoutes] TODO: Vérifier les permissions pour la route /cadres/summary pour l'utilisateur ${req.user ? req.user.username : 'non authentifié'}.`);

    try {
        const date = req.query.date; // La date est passée en paramètre de requête (ex: ?date=2025-05-19)

        if (!date) {
            return res.status(400).json({ message: 'Le paramètre "date" est requis.' });
        }

        // Recherche la ligne dans la table HistoriqueStatsJournalieresCadres pour la date spécifiée
        const stats = await HistoriqueStatsJournalieresCadres.findOne({
            where: { date_snapshot: date }
        });

        if (!stats) {
            return res.status(404).json({ message: 'Aucune statistique trouvée pour cette date.' });
        }

        res.json(stats);
    } catch (error) {
        console.error('Erreur lors de la récupération du résumé des cadres:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du résumé des cadres.' });
    }
});

module.exports = router;