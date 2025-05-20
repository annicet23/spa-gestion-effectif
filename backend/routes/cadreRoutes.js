'use strict';
const { Cadre, User, Escadron } = require('../models');
const express = require('express');
const router = express.Router();
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');

router.use(authenticateJWT);

// POST /api/cadres - Créer un nouveau cadre (Admin seulement)
router.post('/', isAdmin, async (req, res) => {
    const { grade, nom, prenom, matricule, service, numero_telephone, fonction, entite, cours, sexe } = req.body;

    if (!grade || !nom || !prenom || !matricule || !entite || !sexe) {
        return res.status(400).json({ message: 'Champs requis manquants.' });
    }
    if (entite === 'Service' && !service) {
        return res.status(400).json({ message: "Le service est requis pour l'entité 'Service'." });
    }
    if (entite === 'Escadron' && !cours) {
        return res.status(400).json({ message: "L'Escadron est requis pour l'entité 'Escadron'." });
    }
    if (!['Service', 'Escadron', 'None'].includes(entite)) {
        return res.status(400).json({ message: 'Valeur d\'entité invalide.' });
    }
    if (!['Masculin', 'Féminin', 'Autre'].includes(sexe)) {
        return res.status(400).json({ message: 'Valeur de sexe invalide.' });
    }

    try {
        const existingCadre = await Cadre.findOne({ where: { matricule } });
        if (existingCadre) {
            return res.status(409).json({ message: `Un cadre avec le matricule ${matricule} existe déjà.` });
        }

        const nouveauCadre = await Cadre.create({
            grade, nom, prenom, matricule,
            entite,
            service: entite === 'Service' ? service : null,
            cours: entite === 'Escadron' ? cours : null,
            sexe,
            numero_telephone: numero_telephone || null,
            fonction: fonction || null,
        });

        return res.status(201).json({
            message: 'Cadre créé avec succès',
            cadre: nouveauCadre.toJSON()
        });

    } catch (error) {
        console.error('Erreur création cadre:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation: ' + error.errors.map(e => e.message).join(', ')
            });
        }
        return res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

// GET /api/cadres - Lister les cadres avec filtres
router.get('/', async (req, res) => {
    const { user, query } = req;
    const whereClause = {};
    const includeClause = [{
        model: Escadron,
        as: 'EscadronResponsable',
        attributes: ['id', 'nom', 'numero'],
        required: false
    }];

    try {
        if (query.statut) {
            const allowedStatuses = ['Présent', 'Absent', 'Indisponible'];
            if (allowedStatuses.includes(query.statut)) {
                whereClause.statut_absence = query.statut;
            } else {
                console.warn(`Statut invalide reçu pour le filtrage: ${query.statut}`);
            }
        }

        if (user.role === 'Standard') {
            const userCadre = await Cadre.findByPk(user.cadre_id);
            if (!userCadre || userCadre.entite !== 'Service' || !userCadre.service) {
                return res.status(200).json([]);
            }
            whereClause.service = userCadre.service;

            if (query.grade) whereClause.grade = query.grade;
            if (query.nom) whereClause.nom = { [Op.like]: `%${query.nom}%` };
            if (query.prenom) whereClause.prenom = { [Op.like]: `%${query.prenom}%` };
            if (query.matricule) whereClause.matricule = { [Op.like]: `%${query.matricule}%` };
            if (query.fonction) whereClause.fonction = { [Op.like]: `%${query.fonction}%` };
            if (query.sexe) whereClause.sexe = query.sexe;

            const cadres = await Cadre.findAll({
                where: whereClause,
                attributes: [
                    'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                    'numero_telephone', 'fonction', 'entite', 'cours', 'sexe',
                    'statut_absence', 'date_debut_absence', 'motif_absence',
                    'motif_details',
                    'photo_url',
                    'timestamp_derniere_maj_statut'
                ],
                include: includeClause,
                order: [['nom', 'ASC'], ['prenom', 'ASC']]
            });
            return res.status(200).json(cadres);

        } else if (user.role === 'Admin') {
            if (query.entite) whereClause.entite = query.entite;
            if (query.service) whereClause.service = query.service;
            if (query.cours) whereClause.cours = query.cours;
            if (query.grade) whereClause.grade = query.grade;
            if (query.nom) whereClause.nom = { [Op.like]: `%${query.nom}%` };
            if (query.prenom) whereClause.prenom = { [Op.like]: `%${query.prenom}%` };
            if (query.matricule) whereClause.matricule = { [Op.like]: `%${query.matricule}%` };
            if (query.fonction) whereClause.fonction = { [Op.like]: `%${query.fonction}%` };
            if (query.sexe) whereClause.sexe = query.sexe;

            const cadres = await Cadre.findAll({
                where: whereClause,
                attributes: [
                    'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                    'numero_telephone', 'fonction', 'entite', 'cours', 'sexe',
                    'statut_absence', 'date_debut_absence', 'motif_absence',
                    'motif_details',
                    'photo_url',
                    'timestamp_derniere_maj_statut'
                ],
                include: includeClause,
                order: [['nom', 'ASC'], ['prenom', 'ASC']]
            });
            return res.status(200).json(cadres);

        } else {
            return res.sendStatus(403);
        }

    } catch (error) {
        console.error('Erreur récupération cadres:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/cadres/matricule/:mat - Obtenir un cadre par matricule
router.get('/matricule/:mat', async (req, res) => {
    try {
        const cadre = await Cadre.findOne({
            where: { matricule: req.params.mat },
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite', 'cours', 'sexe',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'motif_details',
                'photo_url',
                'timestamp_derniere_maj_statut'
            ],
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }]
        });

        if (!cadre) return res.status(404).json({ message: 'Matricule non trouvé.' });

        if (req.user.role === 'Standard') {
            const userCadre = await Cadre.findByPk(req.user.cadre_id);
            if (!userCadre || userCadre.entite !== 'Service' || userCadre.service !== cadre.service) {
                return res.status(403).json({ message: 'Accès non autorisé.' });
            }
        }

        return res.status(200).json(cadre);

    } catch (error) {
        console.error('Erreur récupération cadre:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PUT /api/cadres/:id - Mettre à jour un cadre
router.put('/:id', async (req, res) => {
    try {
        const cadre = await Cadre.findByPk(req.params.id);
        if (!cadre) return res.status(404).json({ message: 'Cadre non trouvé.' });

        if (req.user.role === 'Standard') {
            const userCadre = await Cadre.findByPk(req.user.cadre_id);
            const isSameService = userCadre && userCadre.entite === 'Service' && userCadre.service === cadre.service;
            const isSelf = userCadre && userCadre.id === cadre.id;

            if (!isSameService && !isSelf) {
                return res.status(403).json({ message: 'Accès non autorisé.' });
            }
        }

        if (req.body.statut_absence !== undefined && req.body.statut_absence !== cadre.statut_absence) {
            req.body.timestamp_derniere_maj_statut = new Date();
        }

        const updated = await cadre.update(req.body);
        return res.status(200).json({
            message: 'Cadre mis à jour',
            cadre: updated
        });

    } catch (error) {
        console.error('Erreur mise à jour cadre:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// DELETE /api/cadres/:id - Supprimer un cadre (Admin seulement)
router.delete('/:id', isAdmin, async (req, res) => {
    try {
        const cadre = await Cadre.findByPk(req.params.id);
        if (!cadre) return res.status(404).json({ message: 'Cadre non trouvé.' });

        await cadre.destroy();
        return res.status(200).json({ message: 'Cadre supprimé' });

    } catch (error) {
        console.error('Erreur suppression cadre:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

module.exports = router;