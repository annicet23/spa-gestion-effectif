// src/routes/statusRoutes.js
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



// Cette route retourne la liste des cadres qui ont effectué leur mise à jour
// pour la période historique en cours (16h J-1 à 15h59 J), et ceux qui sont encore en attente.
router.get('/daily-updates', async (req, res) => {
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
                // *** CORRECTION ICI : Utilisez 'created_at' (snake_case), le nom exact de la colonne DB ***
                created_at: {
                    [Op.between]: [periodStart, periodEnd]
                },
                status: 'Validée' // Ne considérez que les soumissions "Validée" pour les terminés
            },
            attributes: [
                [Sequelize.col('SubmittedBy.id'), 'id'],
                [Sequelize.col('SubmittedBy.username'), 'username'],
                // Vous pouvez ajouter d'autres attributs de l'utilisateur SubmittedBy si nécessaire
                // [Sequelize.col('SubmittedBy.nom'), 'nom'],
                // [Sequelize.col('SubmittedBy.prenom'), 'prenom'],

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
                // 'SubmittedBy.nom',
                // 'SubmittedBy.prenom',
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


router.get('/cadres/summary', async (req, res) => {
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

        return res.json(stats);

    } catch (error) {
        console.error('Erreur récupération résumé cadres :', error);
        return res.status(500).json({ message: 'Erreur serveur.' });
    }
});

module.exports = router;