// routes/history.js (Votre code précédemment fourni, légèrement adapté si besoin)
const express = require('express');
const router = express.Router();
// Assurez-vous que les modèles nécessaires sont importés via votre index
const { HistoriqueStatsJournalieresCadres, HistoriquePersonnesJournalieresCadres, Cadre, MiseAJour } = require('../models'); // Ajustez le chemin si nécessaire
const { authenticateJWT } = require('../middleware/authMiddleware'); // Ajustez le chemin si nécessaire
const { Op } = require('sequelize');
// Assurez-vous que getHistoricalDate n'est PAS nécessaire ici,
// car le frontend envoie déjà la date historique.
// const { getHistoricalDate } = require('../utils/date'); // Normalement PAS BESOIN ICI

// Route pour les statistiques quotidiennes des cadres (utilise la date historique fournie)
router.get('/cadres/summary', authenticateJWT, async (req, res) => {
    try {
        const { date } = req.query; // Cette date DOIT être la date historique ('YYYY-MM-DD')

        if (!date) {
            return res.status(400).json({ message: 'Le paramètre date est requis' });
        }

        // Recherche dans la table des stats agrégées par la date historique
        const stats = await HistoriqueStatsJournalieresCadres.findOne({
            where: { date_snapshot: date },
            attributes: [
                'total_cadres',
                'absents_cadres',
                'presents_cadres',
                'indisponibles_cadres',
                'sur_le_rang_cadres'
            ]
        });

        if (!stats) {
            // Si aucune donnée trouvée, c'est que le rapport n'existe pas pour cette date historique
            // Le frontend HistoriquePage gère déjà l'affichage d'un message si total est 0 ou si la réponse est vide/404
            return res.status(404).json({ message: 'Aucune donnée historique trouvée pour cette date.', total: 0, absent: 0, present: 0, indisponible: 0, surLeRang: 0 });
        }

        res.json({
            total: stats.total_cadres,
            absent: stats.absents_cadres,
            present: stats.presents_cadres,
            indisponible: stats.indisponibles_cadres,
            surLeRang: stats.sur_le_rang_cadres
        });

    } catch (error) {
        console.error('Erreur /api/history/cadres/summary:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération du résumé historique', error: error.message });
    }
});

// Route pour la liste détaillée des cadres (utilise la date historique fournie)
router.get('/cadres/liste', authenticateJWT, async (req, res) => {
    try {
        const { date, statut } = req.query; // 'date' est la date historique, 'statut' est 'Absent' ou 'Indisponible'

        if (!date || !statut) {
            return res.status(400).json({
                message: 'Les paramètres date et statut sont requis'
            });
        }

        // Recherche dans la table des personnes historiques par date et statut
        const liste = await HistoriquePersonnesJournalieresCadres.findAll({
            where: {
                date_snapshot: date, // Filtration par la date historique
                statut_snapshot: statut // Filtration par le statut demandé
            },
            include: {
                model: Cadre, // Inclure les infos du cadre
                as: 'Cadre',
                attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service']
            },
            order: [
                [{ model: Cadre, as: 'Cadre' }, 'nom', 'ASC'] // Tri par nom de cadre
            ]
        });

        res.json(liste); // Retourne la liste des cadres trouvés pour cette date et ce statut

    } catch (error) {
        console.error('Erreur /api/history/cadres/liste:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de la liste historique', error: error.message });
    }
});

// Route originale pour les élèves (inchangée par cette modification)
// router.get('/', authenticateJWT, async (req, res) => { ... });


module.exports = router;