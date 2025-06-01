'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User, Cadre, Escadron } = require('../models');
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

router.use(authenticateJWT);

// POST /api/users - Créer un nouvel utilisateur
router.post('/', isAdmin, async (req, res) => {
    const { username, password, role, matricule, escadron_specification } = req.body;

    console.log('[DEBUG POST /api/users] Données reçues:', { username, role, matricule, escadron_specification });

    // === ÉTAPE 1: Validation du rôle ===
    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Nom d\'utilisateur, mot de passe et rôle sont requis.' });
    }

    const allowedRoles = ['Admin', 'Standard', 'Consultant'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Rôle invalide. Valeurs permises : ${allowedRoles.join(', ')}` });
    }

    // === ÉTAPE 2: Validation du matricule ===
    if (!matricule) {
        return res.status(400).json({ message: 'Le matricule du cadre est requis pour lier l\'utilisateur.' });
    }

    try {
        // Vérifier l'unicité du nom d'utilisateur
        const existingUser = await User.findOne({ where: { username: username } });
        if (existingUser) {
            return res.status(409).json({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
        }

        // === ÉTAPE 3: Rechercher le cadre par matricule ===
        const cadreDetails = await Cadre.findOne({
            where: { matricule: matricule },
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }]
        });

        if (!cadreDetails) {
            return res.status(400).json({ message: `Aucun cadre trouvé avec le matricule ${matricule}.` });
        }

        console.log('[DEBUG POST /api/users] Cadre trouvé:', {
            id: cadreDetails.id,
            matricule: cadreDetails.matricule,
            nom: cadreDetails.nom,
            prenom: cadreDetails.prenom,
            entite: cadreDetails.entite,
            service: cadreDetails.service,
            cours: cadreDetails.cours,
            escadron: cadreDetails.EscadronResponsable?.nom
        });

        // Vérifier si le cadre est déjà associé à un autre utilisateur
        const existingUserWithCadre = await User.findOne({
            where: { cadre_id: cadreDetails.id }
        });

        if (existingUserWithCadre) {
            return res.status(409).json({
                message: `Le cadre ${cadreDetails.nom} ${cadreDetails.prenom} (${matricule}) est déjà associé à l'utilisateur "${existingUserWithCadre.username}".`
            });
        }

        // === ÉTAPE 4: Gestion spéciale pour les escadrons ===
        let finalServiceInfo = null;
        let userSpecification = null;

        if (cadreDetails.entite === 'Escadron') {
            console.log('[DEBUG POST /api/users] Cadre de type Escadron détecté');

            // Pour les escadrons, demander une spécification (1er escadron, 2ème escadron, etc.)
            if (!escadron_specification) {
                return res.status(400).json({
                    message: `Ce cadre appartient à un escadron (${cadreDetails.EscadronResponsable?.nom || 'Escadron ID: ' + cadreDetails.cours}). Veuillez spécifier : 1er escadron, 2ème escadron, etc.`,
                    cadre_info: {
                        nom: cadreDetails.nom,
                        prenom: cadreDetails.prenom,
                        entite: cadreDetails.entite,
                        escadron: cadreDetails.EscadronResponsable?.nom || `Escadron ID: ${cadreDetails.cours}`
                    },
                    required_field: 'escadron_specification',
                    examples: ['1er escadron', '2ème escadron', '3ème escadron', '4ème escadron']
                });
            }

            // Valider la spécification d'escadron
            const validSpecifications = ['1er escadron', '2ème escadron', '3ème escadron', '4ème escadron'];
            if (!validSpecifications.includes(escadron_specification.toLowerCase())) {
                return res.status(400).json({
                    message: `Spécification d'escadron invalide. Valeurs acceptées : ${validSpecifications.join(', ')}`,
                    received: escadron_specification
                });
            }

            finalServiceInfo = `${cadreDetails.EscadronResponsable?.nom || 'Escadron'} - ${escadron_specification}`;
            userSpecification = escadron_specification;
            console.log('[DEBUG POST /api/users] Service final pour Escadron:', finalServiceInfo);

        } else if (cadreDetails.entite === 'Service') {
            // Pour les services, utiliser directement le service du cadre
            if (!cadreDetails.service) {
                return res.status(400).json({
                    message: `Ce cadre est de type Service mais n'a pas de service défini. Veuillez corriger les données du cadre.`,
                    cadre_info: {
                        nom: cadreDetails.nom,
                        prenom: cadreDetails.prenom,
                        entite: cadreDetails.entite
                    }
                });
            }

            finalServiceInfo = cadreDetails.service;
            console.log('[DEBUG POST /api/users] Service final pour Service:', finalServiceInfo);

        } else {
            // Pour les autres entités (None, etc.)
            finalServiceInfo = null;
            console.log('[DEBUG POST /api/users] Aucun service pour entité:', cadreDetails.entite);
        }

        // === ÉTAPE 5: Créer l'utilisateur ===
        const userData = {
            username,
            password: password, // Le hook 'beforeSave' le hachera automatiquement
            role,
            cadre_id: cadreDetails.id,

            // Copier les informations du cadre
            matricule: cadreDetails.matricule,
            nom: cadreDetails.nom,
            prenom: cadreDetails.prenom,
            grade: cadreDetails.grade,
            fonction: cadreDetails.fonction,

            // Service adapté selon l'entité
            service: finalServiceInfo,

            status: 'Active'
        };

        // Ajouter un champ spécial pour les escadrons si nécessaire
        if (userSpecification) {
            userData.escadron_specification = userSpecification;
        }

        console.log('[DEBUG POST /api/users] Données utilisateur à créer:', userData);

        const newUser = await User.create(userData);

        // Préparer la réponse (exclure le mot de passe)
        const userResponse = newUser.toJSON();
        delete userResponse.password;

        // Ajouter les infos du cadre dans la réponse
        userResponse.cadre_info = {
            id: cadreDetails.id,
            matricule: cadreDetails.matricule,
            nom: cadreDetails.nom,
            prenom: cadreDetails.prenom,
            entite: cadreDetails.entite,
            service_original: cadreDetails.service,
            cours: cadreDetails.cours,
            escadron: cadreDetails.EscadronResponsable?.nom
        };

        return res.status(201).json({
            message: 'Utilisateur créé avec succès et lié au cadre',
            user: userResponse
        });

    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur :', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
        }
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
        }

        return res.status(500).json({ message: 'Erreur serveur lors de la création de l\'utilisateur.', error: error.message });
    }
});

// GET /api/users - Lister tous les utilisateurs
router.get('/', isAdmin, async (req, res) => {
    const whereClause = {};

    try {
        const users = await User.findAll({
            where: whereClause,
            attributes: { exclude: ['password'] },
            include: [
                { model: Cadre, as: 'cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'service', 'fonction', 'grade'], required: false },
            ]
        });

        return res.status(200).json(users);
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
});

// GET /api/users/:id - Obtenir les détails d'un utilisateur spécifique
router.get('/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    if (req.user.role !== 'Admin' && req.user.id !== userId) {
        return res.sendStatus(403);
    }

    try {
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Cadre, as: 'cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'service', 'fonction', 'grade'], required: false },
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur par ID :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'utilisateur.' });
    }
});

// PUT /api/users/:id - Mettre à jour un utilisateur existant
router.put('/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    const updateData = req.body;
    const authenticatedUser = req.user;

    if (req.user.role !== 'Admin' && req.user.id !== userId) {
        return res.sendStatus(403);
    }

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        let allowedFields = ['username', 'password'];
        if (authenticatedUser.role === 'Admin') {
            allowedFields = ['username', 'password', 'role', 'status', 'cadre_id', 'matricule', 'nom', 'prenom', 'grade', 'service', 'fonction', 'escadron_specification'];
        }

        const finalUpdatePayload = {};
        allowedFields.forEach(field => {
            if (updateData.hasOwnProperty(field)) {
                finalUpdatePayload[field] = updateData[field];
            }
        });

        if (Object.keys(finalUpdatePayload).length === 0) {
            return res.status(400).json({ message: 'Aucune donnée de mise à jour valide ou autorisée fournie.' });
        }

        // Validation spécifique pour Admin
        if (authenticatedUser.role === 'Admin') {
            if (finalUpdatePayload.hasOwnProperty('cadre_id') && finalUpdatePayload.cadre_id !== null) {
                const cadre = await Cadre.findByPk(finalUpdatePayload.cadre_id);
                if (!cadre) {
                    return res.status(400).json({ message: `Le cadre avec l'ID ${finalUpdatePayload.cadre_id} n'existe pas.` });
                }

                const existingUserWithNewCadre = await User.findOne({
                    where: {
                        cadre_id: finalUpdatePayload.cadre_id,
                        id: { [Op.ne]: userId }
                    }
                });

                if (existingUserWithNewCadre) {
                    return res.status(409).json({ message: `Ce cadre est déjà associé à un autre utilisateur.` });
                }
            }

            if (finalUpdatePayload.hasOwnProperty('role')) {
                const allowedRoles = ['Admin', 'Standard', 'Consultant'];
                if (!allowedRoles.includes(finalUpdatePayload.role)) {
                    return res.status(400).json({ message: `Rôle invalide. Valeurs permises : ${allowedRoles.join(', ')}` });
                }
            }
        }

        await user.update(finalUpdatePayload);

        const updatedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password'] },
            include: [
                { model: Cadre, as: 'cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'service', 'fonction', 'grade'], required: false },
            ]
        });

        return res.status(200).json({
            message: 'Utilisateur mis à jour avec succès',
            user: updatedUser
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur :', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
        }
        return res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.', error: error.message });
    }
});

// DELETE /api/users/:id - Désactiver un utilisateur (au lieu de le supprimer)
router.delete('/:id', isAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    console.log(`[DELETE USER] Tentative de désactivation de l'utilisateur ID: ${userId}`);
    console.log(`[DELETE USER] Demandeur: ${req.user.username} (ID: ${req.user.id}, Role: ${req.user.role})`);

    try {
        // Vérifier que l'utilisateur existe
        const user = await User.findByPk(userId);
        if (!user) {
            console.log(`[DELETE USER] Utilisateur ID ${userId} non trouvé`);
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        console.log(`[DELETE USER] Utilisateur trouvé: ${user.username} (Status actuel: ${user.status})`);

        // Empêcher la désactivation de son propre compte
        if (req.user.id === userId) {
            console.log(`[DELETE USER] Tentative de désactivation de son propre compte refusée`);
            return res.status(400).json({ message: 'Vous ne pouvez pas désactiver votre propre compte.' });
        }

        // Vérifier si l'utilisateur est déjà désactivé
        if (user.status === 'Inactive') {
            console.log(`[DELETE USER] Utilisateur déjà désactivé`);
            return res.status(400).json({
                message: `L'utilisateur "${user.username}" est déjà désactivé.`,
                currentStatus: user.status
            });
        }

        // ✅ DÉSACTIVATION au lieu de suppression
        const originalUsername = user.username;
        const timestamp = Date.now();

        // Modifier le username pour éviter les conflits futurs
        const newUsername = `${originalUsername}_DELETED_${timestamp}`;

        await user.update({
            status: 'Inactive',
            username: newUsername,
            // Optionnel : ajouter une date de désactivation
            // deleted_at: new Date() // Si vous avez ce champ
        });

        console.log(`[DELETE USER] ✅ Utilisateur "${originalUsername}" désactivé avec succès`);
        console.log(`[DELETE USER] Nouveau username: ${newUsername}`);

        // Compter les données liées (pour information)
        const { MiseAJour } = require('../models');
        const submissionCount = await MiseAJour.count({
            where: { submitted_by_id: userId }
        });

        return res.status(200).json({
            message: `Utilisateur "${originalUsername}" désactivé avec succès.`,
            action: 'disabled',
            details: {
                originalUsername: originalUsername,
                newUsername: newUsername,
                newStatus: 'Inactive',
                preservedData: {
                    submissions: submissionCount,
                    messages: 'Conservés'
                }
            }
        });

    } catch (error) {
        console.error('[DELETE USER] ❌ Erreur lors de la désactivation:', error);
        console.error('[DELETE USER] Stack trace:', error.stack);

        return res.status(500).json({
            message: 'Erreur serveur lors de la désactivation de l\'utilisateur.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ✅ BONUS - Route pour réactiver un utilisateur désactivé
router.patch('/:id/reactivate', isAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    console.log(`[REACTIVATE USER] Tentative de réactivation de l'utilisateur ID: ${userId}`);

    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        if (user.status === 'Active') {
            return res.status(400).json({ message: 'L\'utilisateur est déjà actif.' });
        }

        // Restaurer le username original (enlever le suffixe _DELETED_timestamp)
        let originalUsername = user.username;
        if (originalUsername.includes('_DELETED_')) {
            originalUsername = originalUsername.split('_DELETED_')[0];
        }

        // Vérifier que le username original n'est pas déjà pris
        const existingUser = await User.findOne({
            where: {
                username: originalUsername,
                id: { [Op.ne]: userId }
            }
        });

        if (existingUser) {
            return res.status(400).json({
                message: `Impossible de réactiver : le username "${originalUsername}" est déjà utilisé.`,
                suggestion: 'Veuillez choisir un nouveau nom d\'utilisateur.'
            });
        }

        await user.update({
            status: 'Active',
            username: originalUsername
        });

        console.log(`[REACTIVATE USER] ✅ Utilisateur "${originalUsername}" réactivé avec succès`);

        return res.status(200).json({
            message: `Utilisateur "${originalUsername}" réactivé avec succès.`,
            action: 'reactivated',
            newStatus: 'Active'
        });

    } catch (error) {
        console.error('[REACTIVATE USER] ❌ Erreur lors de la réactivation:', error);
        return res.status(500).json({
            message: 'Erreur serveur lors de la réactivation de l\'utilisateur.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;