'use strict';
const { Cadre, User, Escadron } = require('../models');
const express = require('express');
const router = express.Router();
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');

// Applique authenticateJWT à toutes les routes de ce routeur
router.use(authenticateJWT);

// POST /api/cadres - Créer un nouveau cadre (Admin ou utilisateur Standard de service spécifique)
// La logique d'autorisation est maintenant gérée à l'intérieur de cette route.
router.post('/', async (req, res) => {
    // MODIFICATION: Renommé 'cours' en 'responsible_escadron_id' ici pour la cohérence
    const { grade, nom, prenom, matricule, service, numero_telephone, fonction, entite, responsible_escadron_id, sexe } = req.body;
    const currentUser = req.user; // L'utilisateur authentifié est disponible via req.user

    // --- Validation générale des champs requis ---
    if (!grade || !nom || !prenom || !matricule || !entite || !sexe) {
        return res.status(400).json({ message: 'Champs requis manquants: grade, nom, prenom, matricule, entite, sexe.' });
    }
    if (entite === 'Service' && !service) {
        return res.status(400).json({ message: "Le service est requis pour l'entité 'Service'." });
    }
    // MODIFICATION: Validation pour responsible_escadron_id au lieu de cours
    if (entite === 'Escadron' && !responsible_escadron_id) {
        return res.status(400).json({ message: "L'ID de l'Escadron est requis pour l'entité 'Escadron'." });
    }
    if (!['Service', 'Escadron', 'None'].includes(entite)) {
        return res.status(400).json({ message: 'Valeur d\'entité invalide. Doit être Service, Escadron ou None.' });
    }
    if (!['Masculin', 'Féminin', 'Autre'].includes(sexe)) {
        return res.status(400).json({ message: 'Valeur de sexe invalide. Doit être Masculin, Féminin ou Autre.' });
    }

    // --- Logique d'autorisation basée sur le rôle ---
    try {
        if (currentUser.role === 'Admin') {
            // L'administrateur peut créer n'importe quel cadre, pas de restriction de service
            // Pas de validation spécifique pour l'admin ici, il peut choisir n'importe quel service/escadron.
        } else if (currentUser.role === 'Standard') {
            // L'utilisateur Standard ne peut créer que des cadres pour son propre service
            if (entite !== 'Service') {
                return res.status(403).json({ message: 'Les utilisateurs standards ne peuvent créer des cadres que pour un "Service".' });
            }

            // Récupérer les informations du cadre associé à l'utilisateur connecté
            // C'est important pour vérifier le service auquel l'utilisateur est lui-même rattaché.
            const userCadre = await Cadre.findByPk(currentUser.cadre_id);
            if (!userCadre || userCadre.entite !== 'Service' || !userCadre.service) {
                return res.status(403).json({ message: 'Accès refusé : Votre compte standard n\'est pas correctement associé à un service valide.' });
            }

            // Condition clé : le service sélectionné dans le formulaire doit correspondre
            // au service de l'utilisateur standard ET au nom d'utilisateur.
            if (service !== userCadre.service) {
                return res.status(403).json({ message: `Accès refusé : Vous ne pouvez créer des cadres que pour le service "${userCadre.service}".` });
            }

            // Si toutes ces conditions sont remplies, l'utilisateur standard est autorisé
        } else {
            // Si le rôle n'est ni 'Admin' ni 'Standard', refuser l'accès
            return res.status(403).json({ message: 'Accès non autorisé pour la création de cadre. Rôle insuffisant.' });
        }

        // --- Vérification de l'existence du matricule (commune aux deux rôles) ---
        const existingCadre = await Cadre.findOne({ where: { matricule } });
        if (existingCadre) {
            return res.status(409).json({ message: `Un cadre avec le matricule ${matricule} existe déjà.` });
        }

        // --- Création du nouveau cadre ---
        const nouveauCadre = await Cadre.create({
            grade, nom, prenom, matricule,
            entite,
            service: entite === 'Service' ? service : null, // Assurez-vous que 'service' est null si entite n'est pas 'Service'
            // MODIFICATION: Assurez-vous que 'responsible_escadron_id' est null si entite n'est pas 'Escadron'
            responsible_escadron_id: entite === 'Escadron' ? responsible_escadron_id : null,
            sexe,
            numero_telephone: numero_telephone || null,
            fonction: fonction || null,
        });

        return res.status(201).json({
            message: 'Cadre créé avec succès',
            cadre: nouveauCadre.toJSON()
        });

    } catch (error) {
        console.error('Erreur lors de la création du cadre:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation: ' + error.errors.map(e => e.message).join(', ')
            });
        }
        return res.status(500).json({ message: 'Erreur serveur interne', error: error.message });
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
        required: false // Important pour ramener les cadres même si l'escadron lié n'existe pas ou est null
    }];

    try {
        // Filtrage par statut (commun aux rôles)
        if (query.statut) {
            const allowedStatuses = ['Présent', 'Absent', 'Indisponible'];
            if (allowedStatuses.includes(query.statut)) {
                whereClause.statut_absence = query.statut;
            } else {
                console.warn(`Statut invalide reçu pour le filtrage: ${query.statut}`);
            }
        }

        // Logique de filtrage basée sur le rôle de l'utilisateur
        if (user.role === 'Standard') {
            const userCadre = await Cadre.findByPk(user.cadre_id);

            // Initialiser une clause OR pour gérer les permissions par service OU escadron
            const scopeConditions = [];

            if (userCadre) {
                // Si l'utilisateur standard est rattaché à un service
                if (userCadre.entite === 'Service' && userCadre.service) {
                    scopeConditions.push({ entite: 'Service', service: userCadre.service });
                }
                // Si l'utilisateur standard est rattaché à un escadron
                if (userCadre.entite === 'Escadron' && userCadre.responsible_escadron_id) {
                    scopeConditions.push({ entite: 'Escadron', responsible_escadron_id: userCadre.responsible_escadron_id });
                }
            }

            if (scopeConditions.length === 0) {
                // Si l'utilisateur standard n'est associé ni à un service ni à un escadron valide,
                // il ne devrait voir aucun cadre.
                return res.status(200).json([]);
            }

            // Appliquer les conditions de portée avec l'opérateur OR
            // Cela signifie : "Afficher les cadres qui sont dans MON service OU dans MON escadron"
            whereClause[Op.or] = scopeConditions;

            // Appliquer les filtres de recherche supplémentaires sur les cadres visibles
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
                    'numero_telephone', 'fonction', 'entite',
                    'sexe', 'photo_url',
                    'statut_absence', 'date_debut_absence', 'motif_absence',
                    'motif_details', 'timestamp_derniere_maj_statut',
                    'responsible_escadron_id'
                ],
                include: includeClause,
                order: [['nom', 'ASC'], ['prenom', 'ASC']]
            });
            return res.status(200).json(cadres);

        } else if (user.role === 'Admin') {
            // Les administrateurs peuvent filtrer par toutes les entités et tous les services/cours
            if (query.entite) whereClause.entite = query.entite;
            if (query.service) whereClause.service = query.service;
            // Correction: Filtrer par responsible_escadron_id quand query.cours est utilisé
            if (query.cours) whereClause.responsible_escadron_id = query.cours;
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
                    'numero_telephone', 'fonction', 'entite',
                    'sexe', 'photo_url',
                    'statut_absence', 'date_debut_absence', 'motif_absence',
                    'motif_details', 'timestamp_derniere_maj_statut',
                    'responsible_escadron_id'
                ],
                include: includeClause,
                order: [['nom', 'ASC'], ['prenom', 'ASC']]
            });
            return res.status(200).json(cadres);

        } else {
            // Empêcher l'accès si le rôle n'est ni 'Standard' ni 'Admin'
            return res.sendStatus(403); // Forbidden
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
                'numero_telephone', 'fonction', 'entite',
                'sexe', 'photo_url',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'motif_details', 'timestamp_derniere_maj_statut',
                'responsible_escadron_id'
            ],
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }]
        });

        if (!cadre) return res.status(404).json({ message: 'Matricule non trouvé.' });

        // Logique d'autorisation pour GET par matricule
        if (req.user.role === 'Standard') {
            const userCadre = await Cadre.findByPk(req.user.cadre_id);
            // Si l'utilisateur n'est pas un admin, il ne peut voir que son propre cadre
            // ou un cadre du même service/escadron s'il est autorisé à gérer ce scope.
            // Pour simplifier, ici, on vérifie s'il est le même cadre ou du même service.
            // Si vous voulez étendre pour les escadrons, la logique serait similaire à la route GET /
            const isSameService = userCadre && userCadre.entite === 'Service' && userCadre.service === cadre.service;
            const isSameEscadron = userCadre && userCadre.entite === 'Escadron' && userCadre.responsible_escadron_id === cadre.responsible_escadron_id;
            const isSelf = userCadre && userCadre.id === cadre.id;

            if (!isSelf && !isSameService && !isSameEscadron) {
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

        // Logique d'autorisation pour la mise à jour
        if (req.user.role === 'Standard') {
            const userCadre = await Cadre.findByPk(req.user.cadre_id);
            const isSameService = userCadre && userCadre.entite === 'Service' && userCadre.service === cadre.service;
            const isSameEscadron = userCadre && userCadre.entite === 'Escadron' && userCadre.responsible_escadron_id === cadre.responsible_escadron_id;
            const isSelf = userCadre && userCadre.id === cadre.id;

            // Un utilisateur standard peut modifier son propre profil ou un cadre de son service/escadron
            if (!isSelf && !isSameService && !isSameEscadron) {
                return res.status(403).json({ message: 'Accès non autorisé.' });
            }
        }

        // MODIFICATION: Si l'entité devient 'Escadron', mettre à jour responsible_escadron_id
        // Si elle devient 'Service' ou 'None', s'assurer que responsible_escadron_id est null
        if (req.body.entite === 'Escadron') {
            // Assurez-vous que l'ID de l'escadron est fourni dans le corps de la requête
            if (req.body.responsible_escadron_id === undefined || req.body.responsible_escadron_id === null) {
                return res.status(400).json({ message: "L'ID de l'Escadron est requis pour l'entité 'Escadron'." });
            }
            // Assurez-vous que l'ID est un entier
            req.body.responsible_escadron_id = parseInt(req.body.responsible_escadron_id);
            if (isNaN(req.body.responsible_escadron_id)) {
                return res.status(400).json({ message: "L'ID de l'Escadron doit être un nombre entier valide." });
            }
            req.body.service = null; // S'assurer que 'service' est null si entite est 'Escadron'
        } else if (req.body.entite === 'Service') {
            req.body.responsible_escadron_id = null; // Si l'entité n'est pas 'Escadron', le mettre à null
            // Assurez-vous que le service est fourni si l'entité est 'Service'
            if (req.body.service === undefined || req.body.service === null || req.body.service.trim() === '') {
                return res.status(400).json({ message: "Le service est requis pour l'entité 'Service'." });
            }
        } else { // 'None' ou autre
            req.body.responsible_escadron_id = null;
            req.body.service = null;
        }

        // Mettre à jour le timestamp si le statut d'absence change
        if (req.body.statut_absence !== undefined && req.body.statut_absence !== cadre.statut_absence) {
            req.body.timestamp_derniere_maj_statut = new Date();
        }

        const updated = await cadre.update(req.body);

        // MODIFICATION: Re-récupérer le cadre avec l'Escadron Responsable pour s'assurer que la réponse est complète
        const updatedCadreWithEscadron = await Cadre.findByPk(updated.id, {
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite', 'sexe', 'photo_url',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'motif_details', 'timestamp_derniere_maj_statut',
                'responsible_escadron_id'
            ],
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }]
        });

        return res.status(200).json({
            message: 'Cadre mis à jour',
            cadre: updatedCadreWithEscadron // Renvoyer le cadre complet avec l'escadron peuplé
        });

    } catch (error) {
        console.error('Erreur mise à jour cadre:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation: ' + error.errors.map(e => e.message).join(', ')
            });
        }
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
