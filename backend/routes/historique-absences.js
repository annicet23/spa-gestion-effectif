const express = require('express');
const router = express.Router();
const { HistoriqueMiseAJour, Eleve, Escadron, Cadre } = require('../models');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

// Route pour les statistiques quotidiennes des cadres
router.get('/cadres/summary', authenticateJWT, async (req, res) => {
    try {
        const { date } = req.query;
        
        if (!date) {
            return res.status(400).json({ message: 'Le paramètre date est requis' });
        }

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
            return res.status(404).json({ message: 'Aucune donnée trouvée pour cette date' });
        }

        res.json({
            total: stats.total_cadres,
            absent: stats.absents_cadres,
            present: stats.presents_cadres,
            indisponible: stats.indisponibles_cadres,
            surLeRang: stats.sur_le_rang_cadres
        });

    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

// Route pour la liste détaillée des cadres
router.get('/cadres/liste', authenticateJWT, async (req, res) => {
    try {
        const { date, statut } = req.query;
        
        if (!date || !statut) {
            return res.status(400).json({ 
                message: 'Les paramètres date et statut sont requis' 
            });
        }

        const liste = await HistoriquePersonnesJournalieresCadres.findAll({
            where: { 
                date_snapshot: date,
                statut_snapshot: statut 
            },
            include: {
                model: Cadre,
                as: 'Cadre',
                attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service']
            },
            order: [
                [{ model: Cadre, as: 'Cadre' }, 'nom', 'ASC']
            ]
        });

        res.json(liste);

    } catch (error) {
        console.error('Erreur:', error);
        res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

// Route originale pour les élèves (conservée pour compatibilité)
router.get('/', authenticateJWT, async (req, res) => {
    const { type, incorporation, escadron_id, peloton, date_debut, date_fin } = req.query;
    const whereClause = {};
    const eleveWhereClause = {};

    if (date_debut || date_fin) {
        whereClause.createdAt = {};
        if (date_debut) whereClause.createdAt[Op.gte] = new Date(date_debut + ' 00:00:00');
        if (date_fin) whereClause.createdAt[Op.lte] = new Date(date_fin + ' 23:59:59');
    }

    if (type === 'eleve' && incorporation) {
        eleveWhereClause.incorporation = incorporation;
    } else if (type !== 'eleve') {
        if (escadron_id) eleveWhereClause.escadron_id = parseInt(escadron_id, 10);
        if (peloton) eleveWhereClause.peloton = peloton;
    }

    try {
        const historique = await HistoriqueMiseAJour.findAll({
            where: whereClause,
            include: [
                {
                    model: Eleve,
                    as: 'eleve',
                    where: Object.keys(eleveWhereClause).length > 0 ? eleveWhereClause : null,
                    required: Object.keys(eleveWhereClause).length > 0,
                    attributes: ['id', 'incorporation', 'nom', 'prenom', 'peloton', 'escadron_id'],
                    include: [
                        {
                            model: Escadron,
                            as: 'escadron',
                            attributes: ['nom']
                        }
                    ]
                }
            ],
            order: [
                ['createdAt', 'DESC'],
                [{ model: Eleve, as: 'eleve' }, 'nom', 'ASC']
            ]
        });

        res.status(200).json(historique);
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ 
            message: 'Erreur serveur', 
            error: error.message 
        });
    }
});

module.exports = router;