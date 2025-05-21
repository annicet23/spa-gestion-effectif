'use strict';

const express = require('express');
const router = express.Router();
const { MiseAJour, User, Cadre, Absence, HistoriqueStatsJournalieresCadres, Eleve } = require('../models'); // Assurez-vous d'ajouter Eleve si vous l'avez
// Assurez-vous que authenticateJWT et isAdmin sont correctement importés de votre middleware
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
// Importez les fonctions de date qui gèrent la "journée historique"
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');
const miseAJourController = require('../controllers/miseAJourController'); // Assurez-vous que ce fichier existe

// NOUVEAU : Importez la fonction de calcul des statistiques depuis historicalTasks.js
const { calculateCurrentAggregateStats } = require('../tasks/historicalTasks'); // <-- VÉRIFIEZ CE CHEMIN !

// Middleware d'authentification appliqué à toutes les routes de ce routeur
router.use(authenticateJWT);

// --- ROUTES POUR LA GESTION DES MISES À JOUR / VALIDATION ---

// POST /api/mises-a-jour/submit
router.post('/submit', async (req, res) => {
    const { update_date } = req.body;

    if (!update_date) {
        return res.status(400).json({ message: 'La date de la mise à jour (update_date) est requise.' });
    }

    try {
        const userWithCadre = await User.findByPk(req.user.id, {
            // Inclure responsibility_scope et responsible_escadron_id ici
            include: [{ model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'responsibility_scope', 'responsible_escadron_id'] }]
        });

        if (!userWithCadre || !userWithCadre.Cadre) {
            console.warn(`Utilisateur ${req.user.username} (ID: ${req.user.id}) a tenté de soumettre une mise à jour sans être lié à un Cadre.`);
            return res.status(403).json({ message: 'Vous devez être lié à un cadre pour soumettre une mise à jour.' });
        }

        const cadreIdSoumetteur = userWithCadre.Cadre.id;

        const nouvelleSoumission = await MiseAJour.create({
            submitted_by_id: req.user.id,
            update_date: update_date,
            cadre_id: cadreIdSoumetteur,
            status: 'Validée',
            validated_by_id: req.user.id,
            validation_date: new Date()
        });

        const soumissionAvecDetails = await MiseAJour.findByPk(nouvelleSoumission.id, {
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction', 'responsibility_scope', 'responsible_escadron_id'] } // Assurez-vous d'inclure les champs nécessaires ici
            ]
        });

        // Logique de mise à jour des statuts suite à la soumission directe "Validée"
        if (nouvelleSoumission.status === 'Validée') {
            const cadreSoumetteur = soumissionAvecDetails.Cadre;
            const dateMiseAJour = nouvelleSoumission.update_date;

            if (cadreSoumetteur) {
                const scopeType = cadreSoumetteur.responsibility_scope;
                let cadresToUpdate = [];
                let elevesToUpdate = []; // Si vous avez une table Eleve

                if (scopeType === 'Service' && cadreSoumetteur.service) {
                    cadresToUpdate = await Cadre.findAll({
                        where: { service: cadreSoumetteur.service },
                        attributes: ['id']
                    });
                } else if (scopeType === 'Escadron' && cadreSoumetteur.responsible_escadron_id) {
                    // Logique pour les cadres de l'escadron
                    cadresToUpdate = await Cadre.findAll({
                        where: { responsible_escadron_id: cadreSoumetteur.responsible_escadron_id },
                        attributes: ['id']
                    });
                    // SI VOUS AVEZ UNE TABLE ELEVE SÉPARÉE, DÉCOMMENTEZ ET AJUSTEZ CELA :
                    // elevesToUpdate = await Eleve.findAll({
                    //     where: { escadron_id: cadreSoumetteur.responsible_escadron_id },
                    //     attributes: ['id']
                    // });
                } else {
                    console.warn(`Cadre soumetteur (ID: ${cadreSoumetteur.id}) a un scope de responsabilité "${scopeType}" invalide ou incomplet pour la soumission ${nouvelleSoumission.id}. Skipping status update.`);
                }

                if (cadresToUpdate.length > 0) {
                    await Cadre.update(
                        {
                            statut_absence: 'Présent', // Ajustez ce statut selon la signification de la soumission
                            date_debut_absence: null,
                            motif_absence: null,
                            motif_details: null,
                            timestamp_derniere_maj_statut: new Date()
                        },
                        {
                            where: { id: { [Op.in]: cadresToUpdate.map(c => c.id) } }
                        }
                    );
                    console.log(`Mise à jour des statuts de ${cadresToUpdate.length} cadres pour l'entité ${scopeType} (${cadreSoumetteur.service || cadreSoumetteur.responsible_escadron_id}) à la date ${dateMiseAJour}.`);
                }

                // SI VOUS AVEZ UNE TABLE ELEVE SÉPARÉE, DÉCOMMENTEZ ET AJUSTEZ CELA :
                // if (elevesToUpdate.length > 0) {
                //     await Eleve.update(
                //         {
                //             statut_absence: 'Présent', // Ajustez ce statut
                //             date_debut_absence: null,
                //             motif_absence: null,
                //             motif_details: null,
                //             timestamp_derniere_maj_statut: new Date()
                //         },
                //         {
                //             where: { id: { [Op.in]: elevesToUpdate.map(e => e.id) } }
                //         }
                //     );
                //     console.log(`Mise à jour des statuts de ${elevesToUpdate.length} élèves pour l'escadron ${cadreSoumetteur.responsible_escadron_id} à la date ${dateMiseAJour}.`);
                // }
            }
        }

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
                update_date: date
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
            // NOTE: Votre logique pour la mise à jour réelle des statuts des cadres/élèves
            // n'est pas présente ici dans le code fourni pour la validation individuelle.
            // Assurez-vous que les fonctions nécessaires sont appelées si applicable.
            // Par exemple, si une validation de soumission individuelle change le statut d'un cadre.
            // Si la mise à jour du statut d'un cadre est gérée par une autre API ou une autre logique,
            // alors ce log est juste informatif.
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
                            // IMPORTANT: Assurez-vous d'inclure 'responsibility_scope' et 'responsible_escadron_id'
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
                let personnesIds = { cadres: [], eleves: [] }; // Initialiser également les élèves

                if (scopeType === 'Service' && cadreSoumetteur.service) {
                    const cadresDuService = await Cadre.findAll({
                        where: { service: cadreSoumetteur.service },
                        attributes: ['id']
                    });
                    personnesIds.cadres = cadresDuService.map(c => c.id);

                } else if (scopeType === 'Escadron' && cadreSoumetteur.responsible_escadron_id) {
                    // --- NOUVELLE LOGIQUE POUR LES ESCADRONS ---
                    console.log(`Traitement de la soumission pour l'Escadron ID: ${cadreSoumetteur.responsible_escadron_id}`);
                    const cadresDeLEscadron = await Cadre.findAll({
                        where: {
                            responsible_escadron_id: cadreSoumetteur.responsible_escadron_id
                        },
                        attributes: ['id']
                    });
                    personnesIds.cadres = cadresDeLEscadron.map(c => c.id);

                    // Si vous avez une table 'Eleve' et que les élèves sont aussi concernés par cette mise à jour:
                    // Ajoutez 'Eleve' à l'import en haut du fichier si ce n'est pas déjà fait.
                    // Exemple de requête pour les élèves :
                    // const elevesDeLEscadron = await Eleve.findAll({
                    //     where: { escadron_id: cadreSoumetteur.responsible_escadron_id }, // Assurez-vous du nom de colonne correct dans votre modèle Eleve
                    //     attributes: ['id']
                    // });
                    // personnesIds.eleves = elevesDeLEscadron.map(e => e.id);

                } else {
                    console.warn(`Cadre soumetteur (ID: ${cadreSoumetteur.id}) a un scope de responsabilité "${scopeType}" invalide ou incomplet pour la soumission ${soumission.id}. Skipping status update.`);
                    continue;
                }

                // Maintenant, mettez à jour les statuts des cadres concernés
                if (personnesIds.cadres.length > 0) {
                    // Supposons que la validation signifie que ces cadres sont maintenant "Présents"
                    // Ajustez 'Présent' et les autres champs si la validation implique un autre statut
                    await Cadre.update(
                        {
                            statut_absence: 'Présent', // Ou le statut qui convient après validation
                            date_debut_absence: null,
                            motif_absence: null,
                            motif_details: null,
                            timestamp_derniere_maj_statut: new Date()
                        },
                        {
                            where: { id: { [Op.in]: personnesIds.cadres } }
                        }
                    );
                    console.log(`Statuts des cadres mis à jour pour les IDs: ${personnesIds.cadres.join(', ')}`);
                }

                // Si vous avez des élèves et une logique de mise à jour distincte pour eux
                // if (personnesIds.eleves.length > 0) {
                //     await Eleve.update(
                //         {
                //             statut_absence: 'Présent', // Ajustez ce statut pour les élèves
                //             // ... autres champs à mettre à jour pour les élèves
                //         },
                //         {
                //             where: { id: { [Op.in]: personnesIds.eleves } }
                //         }
                //     );
                //     console.log(`Statuts des élèves mis à jour pour les IDs: ${personnesIds.eleves.join(', ')}`);
                // }
            }
        }

        const soumissionsMisesAJour = await MiseAJour.findAll({
            where: { id: { [Op.in]: soumissions.map(s => s.id) } },
            include: [
                { model: User, as: 'SubmittedBy', attributes: ['id', 'username'] },
                { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction', 'responsibility_scope', 'responsible_escadron_id'] },
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
    console.log(`Checking permissions for /cadres/summary for user ${req.user.username} (${req.user.role}).`); // Log de permission plus clair

    try {
        const date = req.query.date; // Date au format 'AAAA-MM-JJ'
        if (!date) {
            return res.status(400).json({ message: 'Le paramètre de date est requis.' });
        }

        // Déterminer la "journée historique actuelle" en fonction du fuseau horaire de l'application
        const now = new Date();
        const currentHistoricalDateLabel = getHistoricalDate(now); // Utilisation de votre utilitaire de date

        // --- DEBUT DES LOGS DE DEBUGGING POUR SUMMARY ---
        console.log(`[DEBUG_SUMMARY] Date demandée par frontend (req.query.date): ${req.query.date}`);
        console.log(`[DEBUG_SUMMARY] Journée historique actuelle (calculée par API via getHistoricalDate): ${currentHistoricalDateLabel}`);
        console.log(`[DEBUG_SUMMARY] Comparaison: ${req.query.date} === ${currentHistoricalDateLabel} ? ${req.query.date === currentHistoricalDateLabel}`);
        // --- FIN DES LOGS DE DEBUGGING POUR SUMMARY ---

        let stats;

        // Si la date demandée est la journée historique actuelle, calculer les stats en temps réel
        if (date === currentHistoricalDateLabel) {
            console.log(`[DEBUG_SUMMARY] Condition VRAIE: Requête pour la journée historique actuelle (${date}). Calcul des stats en temps réel.`);
            const realTimeStats = await calculateCurrentAggregateStats(); // Appel de la fonction de calcul en temps réel
            stats = {
                total_cadres: realTimeStats.total,
                absents_cadres: realTimeStats.absent,
                presents_cadres: realTimeStats.present,
                indisponibles_cadres: realTimeStats.indisponible,
                sur_le_rang_cadres: realTimeStats.surLeRang,
                date_snapshot: date // S'assurer que la date du snapshot est bien la date demandée
            };
            console.log(`[DEBUG_SUMMARY] Stats en temps réel calculées: Absent=${stats.absents_cadres}, Indisponible=${stats.indisponibles_cadres}`);

        } else {
            // Sinon, récupérer les stats de la table d'historique (snapshot)
            console.log(`[DEBUG_SUMMARY] Condition FAUSSE: Requête pour une journée historique passée (${date}). Récupération des stats du snapshot.`);
            stats = await HistoriqueStatsJournalieresCadres.findOne({
                where: { date_snapshot: date }
            });
            console.log(`[DEBUG_SUMMARY] Stats Historique trouvées: ${stats ? `Absent=${stats.absents_cadres}, Indisponible=${stats.indisponibles_cadres}` : 'Aucune.'}`);
        }

        if (!stats) {
            // Retourner des zéros si aucune statistique n'est trouvée pour la date
            console.warn(`[DEBUG_SUMMARY] Aucune statistique trouvée pour la date ${date}. Retourne des zéros.`);
            return res.status(200).json({
                message: 'Aucune statistique trouvée pour cette date.',
                total_cadres: 0,
                absents_cadres: 0,
                presents_cadres: 0,
                indisponibles_cadres: 0,
                sur_le_rang_cadres: 0,
                date_snapshot: date
            });
        }

        return res.json(stats);

    } catch (error) {
        console.error('[ERROR_SUMMARY] Erreur lors de la récupération du résumé des cadres :', error);
        return res.status(500).json({ message: 'Erreur serveur interne.' });
    }
});

// GET /api/mises-a-jour/users/:userId/submissions
router.get('/users/:userId/submissions', async (req, res) => {
    const targetUserId = parseInt(req.params.userId, 10);
    const dateString = req.query.date;

    if (isNaN(targetUserId)) {
        return res.status(400).json({ message: 'L\'ID utilisateur dans l\'URL est invalide.' });
    }
    if (!dateString) {
        return res.status(400).json({ message: 'Le paramètre "date" est requis dans la chaîne de requête.' });
    }

    if (req.user.role !== 'Admin' && req.user.id !== targetUserId) {
        console.warn(`Utilisateur ${req.user.username} (ID: ${req.user.id}, Rôle: ${req.user.role}) a tenté d'accéder aux soumissions de l'utilisateur ${targetUserId} sans permission.`);
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à voir les soumissions de cet utilisateur.' });
    }

    try {
        const periodStart = getHistoricalDayStartTime(dateString);
        const periodEnd = getHistoricalDayEndTime(dateString);

        console.log(`[miseAJourRoutes] Récupération des détails pour user ${targetUserId} sur la période : ${periodStart.toISOString()} à ${periodEnd.toISOString()}`);

        const soumissions = await MiseAJour.findAll({
            where: {
                submitted_by_id: targetUserId,
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
                            as: 'Cadre',
                            attributes: ['id', 'service', 'fonction'],
                            required: false
                        }
                    ]
                },
                {
                    model: User,
                    as: 'ValidatedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    required: false
                },
                {
                    model: Cadre,
                    as: 'Cadre',
                    attributes: ['id', 'nom', 'prenom', 'fonction'],
                    required: false
                }
            ],
            order: [['created_at', 'ASC']],
        });

        return res.status(200).json(soumissions);
    } catch (error) {
        console.error(`Erreur lors de la récupération des soumissions pour l'utilisateur ${targetUserId} à la date ${dateString}:`, error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des détails des soumissions.' });
    }
});

module.exports = router;