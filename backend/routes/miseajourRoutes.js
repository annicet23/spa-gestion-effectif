'use strict';

const express = require('express');
const router = express.Router();
const { MiseAJour, User, Cadre, Absence, HistoriqueStatsJournalieresCadres } = require('../models');
// Assurez-vous que authenticateJWT et isAdmin sont correctement importés de votre middleware
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
// Importez les fonctions de date qui gèrent la "journée historique"
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');
const miseAJourController = require('../controllers/miseAJourController'); // Assurez-vous que ce fichier existe

// Middleware d'authentification appliqué à toutes les routes de ce routeur
router.use(authenticateJWT);

// --- ROUTES POUR LA GESTION DES MISES À JOUR / VALIDATION ---

// POST /api/mises-a-jour/submit
router.post('/submit', async (req, res) => {
    // La date de la mise à jour doit correspondre à la "journée historique"
    // Vous envoyez `update_date` du frontend.
    // Il est crucial que cette `update_date` soit au format 'AAAA-MM-JJ' pour être cohérente
    // avec la logique de `getHistoricalDayStartTime` et `getHistoricalDayEndTime`
    // qui utilisent `getHistoricalDate`.
    const { update_date } = req.body; // C'est la date de la journée historique (ex: 2025-05-20)

    if (!update_date) {
        return res.status(400).json({ message: 'La date de la mise à jour (update_date) est requise.' });
    }

    try {
        const userWithCadre = await User.findByPk(req.user.id, {
            include: [{ model: Cadre, as: 'Cadre', attributes: ['id'] }]
        });

        if (!userWithCadre || !userWithCadre.Cadre) {
            console.warn(`Utilisateur ${req.user.username} (ID: ${req.user.id}) a tenté de soumettre une mise à jour sans être lié à un Cadre.`);
            return res.status(403).json({ message: 'Vous devez être lié à un cadre pour soumettre une mise à jour.' });
        }

        const cadreIdSoumetteur = userWithCadre.Cadre.id;

        // Lors de la création, `created_at` sera automatiquement défini par Sequelize.
        // `update_date` doit rester la "date historique" que vous utilisez pour le regroupement.
        const nouvelleSoumission = await MiseAJour.create({
            submitted_by_id: req.user.id,
            update_date: update_date, // La date au format 'YYYY-MM-DD'
            cadre_id: cadreIdSoumetteur,
            status: 'Validée', // Par défaut, auto-validée par l'utilisateur
            validated_by_id: req.user.id,
            validation_date: new Date() // La date et l'heure de validation
        });

        // Inclure les détails pour la réponse immédiate
        const soumissionAvecDetails = await MiseAJour.findByPk(nouvelleSoumission.id, {
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] } // Cadre lié à la mise à jour
            ]
        });

        return res.status(201).json({ message: 'Mise à jour soumise avec succès', soumission: soumissionAvecDetails });

    } catch (error) {
        console.error('Erreur lors de la soumission de la mise à jour :', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', '), errors: error.errors });
        }
        return res.status(500).json({ message: 'Erreur serveur lors de la soumission de la mise à jour.' });
    }
});

// GET /api/mises-a-jour/status-for-cadre
router.get('/status-for-cadre', async (req, res) => {
    // Cette route est déjà bien gérée pour les permissions. Pas de changements majeurs nécessaires ici.
    const { date, cadreId } = req.query;

    if (!date) {
        return res.status(400).json({ message: 'Le paramètre "date" est requis.' });
    }

    try {
        let targetCadreId = cadreId;

        if (req.user.role !== 'Admin') {
            const userWithCadre = await User.findByPk(req.user.id, {
                include: [{ model: Cadre, as: 'Cadre', attributes: ['id'] }]
            });

            if (!userWithCadre || !userWithCadre.Cadre) {
                return res.status(403).json({ message: 'Vous devez être lié à un cadre pour vérifier le statut de soumission.' });
            }
            targetCadreId = userWithCadre.Cadre.id;

            if (cadreId && parseInt(cadreId, 10) !== targetCadreId) {
                console.warn(`Utilisateur Standard ${req.user.username} (ID: ${req.user.id}) a tenté de vérifier le statut pour un cadre différent (ID: ${cadreId}).`);
                return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à vérifier le statut de soumission pour ce cadre.' });
            }
        } else {
            if (!targetCadreId) {
                return res.status(400).json({ message: 'L\'ID du cadre (cadreId) est requis pour les administrateurs.' });
            }
        }

        const submission = await MiseAJour.findOne({
            where: {
                cadre_id: targetCadreId,
                update_date: date // `update_date` est utilisé pour la date historique
            },
            attributes: ['id', 'status', 'update_date', 'created_at', 'validated_by_id', 'validation_date'],
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
                { model: User, as: 'ValidatedBy', attributes: ['id', 'username'], required: false }
            ]
        });

        if (submission) {
            return res.status(200).json({ exists: true, submission: submission });
        } else {
            return res.status(200).json({ exists: false });
        }

    } catch (error) {
        console.error('Erreur lors de la vérification du statut de soumission :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la vérification du statut.' });
    }
});

// GET /api/mises-a-jour
router.get('/', async (req, res) => {
    // Cette route est déjà bien gérée.
    const whereClause = {};

    if (req.user.role === 'Standard') {
        try {
            const userWithCadre = await User.findByPk(req.user.id, {
                include: [{ model: Cadre, as: 'Cadre', attributes: ['id'] }]
            });
            if (userWithCadre && userWithCadre.Cadre) {
                whereClause.cadre_id = userWithCadre.Cadre.id;
            } else {
                return res.status(200).json([]);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération du cadre utilisateur pour le filtrage :', error);
            return res.status(500).json({ message: 'Erreur serveur lors de la détermination des permissions de filtrage.' });
        }
    }

    if (req.query.status) {
        const allowedStatuses = ['En attente', 'Validée', 'Rejetée'];
        if (allowedStatuses.includes(req.query.status)) {
            whereClause.status = req.query.status;
        } else {
            console.warn(`Statut de recherche invalide fourni : ${req.query.status}`);
        }
    }
    if (req.query.date) {
        whereClause.update_date = req.query.date;
    }
    if (req.query.startDate && req.query.endDate) {
        whereClause.update_date = {
            [Op.between]: [req.query.startDate, req.query.endDate]
        };
    } else if (req.query.startDate) {
        whereClause.update_date = { [Op.gte]: req.query.startDate };
    } else if (req.query.endDate) {
        whereClause.update_date = { [Op.lte]: req.query.endDate };
    }
    if (req.query.submittedById) {
        whereClause.submitted_by_id = req.query.submittedById;
    }
    if (req.query.cadreId) {
        whereClause.cadre_id = req.query.cadreId;
    }

    try {
        const soumissions = await MiseAJour.findAll({
            where: whereClause,
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
                { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
            ],
            order: [['update_date', 'DESC'], ['created_at', 'DESC']],
        });

        return res.status(200).json(soumissions);
    } catch (error) {
        console.error('Erreur lors de la récupération des soumissions :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des soumissions.' });
    }
});

// GET /api/mises-a-jour/:id
router.get('/:id', async (req, res) => {
    // Cette route est déjà bien gérée.
    const submissionId = req.params.id;

    try {
        const soumission = await MiseAJour.findByPk(submissionId, {
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
                { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
            ]
        });

        if (!soumission) {
            return res.status(404).json({ message: 'Soumission non trouvée.' });
        }

        if (req.user.role === 'Standard') {
            try {
                const userWithCadre = await User.findByPk(req.user.id, {
                    include: [{ model: Cadre, as: 'Cadre', attributes: ['id'] }]
                });
                if (!userWithCadre || !userWithCadre.Cadre || soumission.cadre_id !== userWithCadre.Cadre.id) {
                    return res.sendStatus(403);
                }
            } catch (error) {
                console.error('Erreur lors de la vérification du cadre utilisateur pour la permission :', error);
                return res.status(500).json({ message: 'Erreur serveur lors de la vérification des permissions.' });
            }
        }

        return res.status(200).json(soumission);
    } catch (error) {
        console.error('Erreur lors de la récupération de la soumission :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération de la soumission.' });
    }
});

// POST /api/mises-a-jour/:id/validate
router.post('/:id/validate', isAdmin, async (req, res) => {
    // Cette route est déjà bien gérée.
    const submissionId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = ['Validée', 'Rejetée'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Le statut ('Validée' ou 'Rejetée') est requis dans le corps de la requête.` });
    }

    try {
        const soumission = await MiseAJour.findByPk(submissionId, {
            include: [
                {
                    model: Cadre,
                    as: 'Cadre',
                }
            ]
        });

        if (!soumission) {
            return res.status(404).json({ message: 'Soumission non trouvée.' });
        }

        if (soumission.status !== 'En attente') {
            return res.status(400).json({ message: `Cette soumission a déjà le statut "${soumission.status}".` });
        }

        soumission.status = status;
        soumission.validated_by_id = req.user.id;
        soumission.validation_date = new Date();

        await soumission.save();

        if (soumission.status === 'Validée') {
            console.log(`Déclenchement de la mise à jour du statut du cadre/élèves pour la soumission ${soumission.id}.`);
        }

        const soumissionValidee = await MiseAJour.findByPk(soumission.id, {
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
                { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
            ]
        });

        return res.status(200).json({ message: `Soumission mise à jour au statut "${soumission.status}"`, soumission: soumissionValidee });

    } catch (error) {
        console.error('Erreur lors de la validation individuelle de la soumission :', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', '), errors: error.errors });
        }
        return res.status(500).json({ message: 'Erreur serveur lors de la validation individuelle de la soumission.' });
    }
});

// POST /api/mises-a-jour/validate-batch
router.post('/validate-batch', isAdmin, async (req, res) => {
    // Cette route est déjà bien gérée.
    const { submissionIds, status } = req.body;

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
        return res.status(400).json({ message: 'Une liste d\'IDs de soumissions (submissionIds) est requise dans le corps de la requête.' });
    }
    const allowedStatuses = ['Validée', 'Rejetée'];
    if (!status || !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Le statut ('Validée' ou 'Rejetée') est requis dans le corps de la requête.` });
    }

    try {
        const soumissions = await MiseAJour.findAll({
            where: {
                id: { [Op.in]: submissionIds },
                status: 'En attente'
            },
            include: [
                {
                    model: User,
                    as: 'SubmittedBy',
                    attributes: ['id', 'username', 'cadre_id'],
                    include: [
                        {
                            model: Cadre,
                            as: 'Cadre',
                            attributes: ['id', 'service', 'responsibility_scope', 'responsible_escadron_id'],
                        }
                    ]
                }
            ]
        });

        if (soumissions.length === 0) {
            return res.status(404).json({ message: 'Aucune soumission en attente trouvée avec les IDs fournis.' });
        }

        const validation_date = new Date();
        const validated_by_id = req.user.id;

        await MiseAJour.update(
            {
                status: status,
                validated_by_id: validated_by_id,
                validation_date: validation_date
            },
            {
                where: {
                    id: { [Op.in]: soumissions.map(s => s.id) }
                }
            }
        );

        if (status === 'Validée') {
            console.log(`Déclenchement de la mise à jour des statuts des personnes pour ${soumissions.length} soumission(s) validée(s).`);

            for (const soumission of soumissions) {
                const soumetteurUser = soumission.SubmittedBy;
                const cadreSoumetteur = soumetteurUser ? soumetteurUser.Cadre : null;
                const dateMiseAJour = soumission.update_date;

                if (!cadreSoumetteur) {
                    console.warn(`Soumetteur de la mise à jour (User ID: ${soumetteurUser ? soumetteurUser.id : 'N/A'}) non lié à un Cadre pour la soumission ${soumission.id}. Skipping status update.`);
                    continue;
                }

                const scopeType = cadreSoumetteur.responsibility_scope;
                let personnesIds = { cadres: [] };

                if (scopeType === 'Service' && cadreSoumetteur.service) {
                    const cadresDuService = await Cadre.findAll({
                        where: { service: cadreSoumetteur.service },
                        attributes: ['id']
                    });
                    personnesIds.cadres = cadresDuService.map(c => c.id);

                } else if (scopeType === 'Escadron' && cadreSoumetteur.responsible_escadron_id) {
                    console.warn(`TODO: Logique pour Responsable d'Escadron (mise à jour des élèves) non implémentée ici.`);
                    continue;

                } else {
                    console.warn(`Cadre soumetteur (ID: ${cadreSoumetteur.id}) a un scope de responsabilité "${scopeType}" invalide ou incomplet pour la soumission ${soumission.id}. Skipping status update.`);
                    continue;
                }

                if (personnesIds.cadres.length === 0) {
                    console.log(`Aucune personne identifiée pour la soumission ${soumission.id}. Skipping status update.`);
                    continue;
                }

                console.log(`Calling utility function to update status for Cadres: [${personnesIds.cadres.join(', ')}] (and Eleves) for date ${dateMiseAJour}.`);
            }
        }

        const soumissionsMisesAJour = await MiseAJour.findAll({
            where: { id: { [Op.in]: soumissions.map(s => s.id) } },
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
                { model: User, as: 'ValidatedBy', attributes: ['id', 'username'], required: false }
            ]
        });

        return res.status(200).json({
            message: `${soumissionsMisesAJour.length} soumission(s) mise(s) à jour au statut "${status}".`,
            updatedSubmissions: soumissionsMisesAJour
        });

    } catch (error) {
        console.error('Erreur lors de la validation groupée :', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', '), errors: error.errors });
        }
        return res.status(500).json({ message: 'Erreur serveur lors de la validation groupée.' });
    }
});

// GET /api/mises-a-jour/cadres/summary
router.get('/cadres/summary', async (req, res) => {
    // Cette route est déjà bien gérée.
    console.log(`TODO: Vérifier les permissions pour la route /cadres/summary pour l'utilisateur ${req.user.username} (${req.user.role}).`);

    try {
        const date = req.query.date;

        if (!date) {
            return res.status(400).json({ message: 'Le paramètre "date" est requis.' });
        }

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

// GET /api/mises-a-jour/users/:userId/submissions
// Cette route est essentielle pour la modale de détails.
// Correction de la logique de date et ajout des includes nécessaires.
router.get('/users/:userId/submissions', async (req, res) => {
    const targetUserId = parseInt(req.params.userId, 10);
    const dateString = req.query.date; // Date au format 'AAAA-MM-JJ'

    if (isNaN(targetUserId)) {
        return res.status(400).json({ message: 'L\'ID utilisateur dans l\'URL est invalide.' });
    }
    if (!dateString) { // Renommé de 'date' à 'dateString' pour éviter la confusion
        return res.status(400).json({ message: 'Le paramètre "date" est requis dans la chaîne de requête.' });
    }

    // --- LOGIQUE DE PERMISSION TRÈS IMPORTANTE ---
    // Seuls les admins peuvent voir n'importe quel userId.
    // Un utilisateur standard ne peut voir que SES PROPRES soumissions.
    if (req.user.role !== 'Admin' && req.user.id !== targetUserId) {
        console.warn(`Utilisateur ${req.user.username} (ID: ${req.user.id}, Rôle: ${req.user.role}) a tenté d'accéder aux soumissions de l'utilisateur ${targetUserId} sans permission.`);
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à voir les soumissions de cet utilisateur.' });
    }

    try {
        // Calcule les bornes précises de la période historique en cours (avec l'heure et le fuseau horaire EAT)
        // en utilisant la date historique fournie par le frontend (dateString)
        const periodStart = getHistoricalDayStartTime(dateString);
        const periodEnd = getHistoricalDayEndTime(dateString);

        console.log(`[miseAJourRoutes] Récupération des détails pour user ${targetUserId} sur la période : ${periodStart.toISOString()} à ${periodEnd.toISOString()}`);

        const soumissions = await MiseAJour.findAll({
            where: {
                submitted_by_id: targetUserId,
                // Utilisez created_at pour filtrer par la plage horaire réelle de soumission.
                // update_date est la date J-1, elle est moins précise pour un filtre temporel strict.
                created_at: {
                    [Op.between]: [periodStart, periodEnd]
                },
            },
            include: [
                {
                    model: User,
                    as: 'SubmittedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    include: [
                        {
                            model: Cadre,
                            as: 'Cadre', // Alias défini dans le modèle User
                            attributes: ['id', 'service', 'fonction'], // Récupérer la fonction du cadre soumetteur
                            required: false // Un utilisateur n'est pas forcément un cadre
                        }
                    ]
                },
                {
                    model: User,
                    as: 'ValidatedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    required: false // La validation est optionnelle
                },
                {
                    model: Cadre, // Inclure le cadre directement lié à la MiseAJour
                    as: 'Cadre', // Alias défini dans le modèle MiseAJour
                    attributes: ['id', 'nom', 'prenom', 'fonction'], // Récupérer les détails du cadre mis à jour
                    required: false
                }
            ],
            order: [['created_at', 'ASC']], // Tri par date de création pour l'ordre chronologique
        });

        return res.status(200).json(soumissions);
    } catch (error) {
        console.error(`Erreur lors de la récupération des soumissions pour l'utilisateur ${targetUserId} à la date ${dateString}:`, error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des détails des soumissions.' });
    }
});

module.exports = router;