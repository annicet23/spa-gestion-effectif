// src/controllers/miseAJourController.js
const { MiseAJour, User, Cadre } = require('../models'); // Assurez-vous d'importer Cadre
const { Op } = require('sequelize');
const { getHistoricalDayStartTime, getHistoricalDayEndTime, getHistoricalDate } = require('../utils/date');

// Fonction pour récupérer les détails des soumissions d'un utilisateur
async function getUserSubmissionsDetails(req, res) {
    try {
        const userId = req.params.userId; // L'ID de l'utilisateur dont on veut les détails
        const dateString = req.query.date; // Date optionnelle au format 'AAAA-MM-JJ' pour filtrer

        const now = new Date();
        const historicalDateLabel = dateString || getHistoricalDate(now);
        const periodStart = getHistoricalDayStartTime(historicalDateLabel);
        const periodEnd = getHistoricalDayEndTime(historicalDateLabel);

        console.log(`[miseAJourController] Récupération des détails pour user ${userId} sur la période : ${periodStart.toISOString()} à ${periodEnd.toISOString()}`);

        const submissions = await MiseAJour.findAll({
            where: {
                submitted_by_id: userId,
                created_at: { // Utilisez 'created_at' car c'est le nom de la colonne dans la DB
                    [Op.between]: [periodStart, periodEnd]
                }
            },
            include: [
                {
                    model: User,
                    as: 'SubmittedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    include: [{
                        model: Cadre,
                        as: 'Cadre', // L'alias défini dans le modèle User.js
                        attributes: ['fonction'], // Incluez la fonction du cadre
                        required: false // LEFT JOIN: un utilisateur n'est pas forcément un cadre
                    }]
                },
                {
                    model: User,
                    as: 'ValidatedBy',
                    attributes: ['id', 'username', 'nom', 'prenom'],
                    required: false // LEFT JOIN: la validation est optionnelle
                },
                 {
                    model: Cadre, // Incluez directement le modèle Cadre lié à la MiseAJour
                    as: 'Cadre', // L'alias défini dans le modèle MiseAJour.js
                    attributes: ['nom_complet', 'fonction'], // Incluez le nom complet et la fonction du cadre mis à jour
                    required: false // LEFT JOIN
                }
            ],
            order: [['created_at', 'DESC']]
        });

        if (!submissions || submissions.length === 0) {
            return res.status(404).json({ message: 'Aucune soumission trouvée pour cet utilisateur à cette date.' });
        }

        res.json(submissions);
    } catch (error) {
        console.error('Erreur lors de la récupération des soumissions de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
}

module.exports = {
    getUserSubmissionsDetails
};