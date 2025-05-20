'use strict';
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); // Importé pour le hachage (utilisé dans le hook du modèle)
const { User, Cadre } = require('../models'); // Importez les modèles User et Cadre
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware'); // Importez vos middlewares d'authentification et d'autorisation
const { Op } = require('sequelize'); // Si nécessaire pour les requêtes complexes avec Sequelize

// Middleware d'authentification appliqué à toutes les routes de ce routeur
// (sauf les routes spécifiques comme /login si elle était définie ici plutôt que dans authRoutes)
router.use(authenticateJWT);

// POST /api/users
// Créer un nouvel utilisateur (Accessible UNIQUEMENT aux Admins)
router.post('/', isAdmin, async (req, res) => {
    // Les données attendues dans le corps de la requête : username, password, role, et potentiellement cadre_id
    const { username, password, role, cadre_id } = req.body;

    // Validation basique des champs requis
    if (!username || !password || !role) {
        return res.status(400).json({ message: 'Nom d\'utilisateur, mot de passe et rôle sont requis.' });
    }

    // Validation des rôles permis (basée sur votre ENUM ou liste définie)
    const allowedRoles = ['Admin', 'Standard'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Rôle invalide. Valeurs permises : ${allowedRoles.join(', ')}` });
    }

    // Un utilisateur Standard doit être lié à un cadre (cadre_id est requis pour les Standards)
     if (role === 'Standard' && !cadre_id) {
         return res.status(400).json({ message: 'Un utilisateur Standard doit être lié à un cadre (cadre_id requis).' });
     }
     // Optionnel: Si un Admin ne doit JAMAIS être lié à un cadre
     // if (role === 'Admin' && cadre_id) {
     //      return res.status(400).json({ message: 'Un utilisateur Admin ne peut pas être lié à un cadre.' });
     // }


    try {
        // Vérifier l'unicité du nom d'utilisateur avant de créer
        const existingUser = await User.findOne({ where: { username: username } });
        if (existingUser) {
            return res.status(409).json({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
        }

        let cadreDetails = null;
        // Si un cadre_id est fourni (obligatoire pour Standard, optionnel pour Admin)
        if (cadre_id) {
            // Vérifier l'existence du cadre correspondant dans la base de données
            cadreDetails = await Cadre.findByPk(cadre_id);
            if (!cadreDetails) {
                 return res.status(400).json({ message: `Le cadre avec l'ID ${cadre_id} n'existe pas.` });
            }
        }

        // Si le rôle est Standard, s'assurer qu'un cadre valide a été trouvé et est associé
        // Cette validation renforce le check initial !cadre_id pour les Standards
        if (role === 'Standard' && !cadreDetails) {
             return res.status(400).json({ message: 'Cadre non trouvé ou non associé pour l\'utilisateur Standard.' });
        }


        // Créer le nouvel utilisateur
        // Le hachage du mot de passe est géré automatiquement par le hook 'beforeSave' défini dans le modèle User
        const newUser = await User.create({
            username,
            password: password, // Le hook 'beforeSave' dans le modèle le hachera automatiquement
            role,
            cadre_id: (role === 'Standard' && cadre_id) ? cadre_id : null, // Lier au cadre UNIQUEMENT si rôle est Standard ET cadre_id fourni

            // --- POPULER LES CHAMPS DU MODÈLE USER AVEC LES DONNÉES DU CADRE POUR LES STANDARDS ---
            // Ces champs (matricule, nom, prenom, etc.) sont définis comme requis (allowNull: false) dans votre modèle User.
            // Pour un utilisateur Standard, ces informations proviennent du cadre lié.
            // Pour un Admin (non lié à un cadre), ces champs doivent être gérés différemment (potentiellement null si votre modèle le permet pour Admin, ou définis manuellement si l'Admin a aussi un profil "personnel" dans User).
            // Ici, on les prend du cadre si cadreDetails existe, sinon on met null (assurez-vous que votre modèle User permet null pour Admin si non lié).
            matricule: cadreDetails ? cadreDetails.matricule : null, // Prendre le matricule du cadre si cadreDetails existe
            nom: cadreDetails ? cadreDetails.nom : null, // Prendre le nom du cadre
            prenom: cadreDetails ? cadreDetails.prenom : null, // Prendre le prénom du cadre
            grade: cadreDetails ? cadreDetails.grade : null, // Prendre le grade du cadre (si votre modèle User a ce champ)
            service: cadreDetails ? cadreDetails.service : null, // Prendre le service du cadre (si votre modèle User a ce champ)
            // --- FIN POPULATION ---

            status: 'Active' // Statut par défaut pour le nouvel utilisateur
        });

        // Préparer la réponse succès (exclure le mot de passe haché pour la sécurité)
        const userResponse = newUser.toJSON();
        delete userResponse.password;

        return res.status(201).json({ message: 'Utilisateur créé avec succès', user: userResponse });

    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur :', error);
        // Gérer les erreurs spécifiques de Sequelize
        if (error.name === 'SequelizeUniqueConstraintError') {
            // Erreur si le champ 'username' (ou 'matricule' si unique) est déjà utilisé
            return res.status(409).json({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
        }
        if (error.name === 'SequelizeValidationError') {
            // Erreur si les validations du modèle échouent (ex: champ allowNull: false non fourni, ENUM invalide)
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
        }
        if (error.name === 'SequelizeForeignKeyConstraintError') {
             // Erreur si le cadre_id fourni ne correspond à aucun ID dans la table 'cadres'
             return res.status(400).json({ message: "Erreur de liaison: L'ID du cadre spécifié n'existe pas." });
        }
        // Gérer les autres erreurs serveur non spécifiques
        return res.status(500).json({ message: 'Erreur serveur lors de la création de l\'utilisateur.', error: error.message });
    }
});

// GET /api/users
// Lister tous les utilisateurs (Accessible UNIQUEMENT aux Admins)
router.get('/', isAdmin, async (req, res) => {
    const whereClause = {};
    // Ajoutez des filtres si nécessaire (par rôle, par nom d'utilisateur, par cadre_id, etc.) via req.query
    // if (req.query.role) { whereClause.role = req.query.role; }
    // if (req.query.username) { whereClause.username = { [Op.like]: `%${req.query.username}%` }; }
    // if (req.query.cadre_id) { whereClause.cadre_id = req.query.cadre_id; }


    try {
        // Récupérer tous les utilisateurs avec les filtres appliqués
        const users = await User.findAll({
            where: whereClause,
            attributes: { exclude: ['password'] }, // Exclure le mot de passe haché pour la sécurité
            // Inclure la relation avec Cadre si pertinent (pour obtenir les détails du cadre lié)
            include: [
                // IMPORTANT : Utiliser l'alias 'Cadre' comme défini dans models/user.js
                { model: Cadre, as: 'Cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'service', 'fonction'], required: false }, // required: false pour inclure les Users même sans Cadre lié (ex: Admins)
            ]
        });

        return res.status(200).json(users); // Renvoyer la liste des utilisateurs
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
});

// GET /api/users/:id
// Obtenir les détails d'un utilisateur spécifique (Accessible aux Admins ou à l'utilisateur lui-même)
router.get('/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10); // Convertir l'ID du paramètre en nombre entier

    // Logique de permission :
    // Un Admin peut voir les détails de n'importe quel utilisateur.
    // Un utilisateur Standard ne peut voir QUE les détails de son propre compte (identifié par req.user.id).
    if (req.user.role !== 'Admin' && req.user.id !== userId) {
        // Si l'utilisateur n'est pas Admin ET que l'ID demandé n'est pas son propre ID
        return res.sendStatus(403); // Renvoyer 403 Forbidden (Interdit)
    }

    try {
        // Rechercher l'utilisateur par son ID (clé primaire)
        const user = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }, // Exclure le mot de passe haché
            // Inclure la relation avec Cadre pour obtenir les détails du cadre lié si l'utilisateur en a un
            include: [
                // IMPORTANT : Utiliser l'alias 'Cadre'
                { model: Cadre, as: 'Cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'service', 'fonction'], required: false },
            ]
        });

        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        return res.status(200).json(user); // Renvoyer les détails de l'utilisateur trouvé
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur par ID :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'utilisateur.' });
    }
});

// PUT /api/users/:id
// Mettre à jour un utilisateur existant (Accessible aux Admins ou à l'utilisateur lui-même pour certains champs)
router.put('/:id', async (req, res) => {
    const userId = parseInt(req.params.id, 10); // Convertir l'ID du paramètre en nombre entier
    const updateData = req.body; // Les données envoyées dans le corps de la requête pour la mise à jour
    const authenticatedUser = req.user; // Utilisateur authentifié via JWT

    // Logique de permission :
    // Un Admin peut modifier n'importe quel utilisateur.
    // Un utilisateur Standard ne peut modifier QUE son propre compte (req.user.id).
    if (req.user.role !== 'Admin' && req.user.id !== userId) {
        return res.sendStatus(403); // Renvoyer 403 Forbidden (Interdit)
    }

    try {
        // 1. Rechercher l'utilisateur à mettre à jour dans la base de données
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        // Définir les champs autorisés à modifier en fonction du rôle de l'utilisateur authentifié
        // Le champ 'password' est géré par le hook 'beforeSave' si sa valeur change
        let allowedFields = ['username', 'password']; // Champs qu'un utilisateur Standard peut modifier lui-même
        if (authenticatedUser.role === 'Admin') {
            // Un Admin peut modifier plus de champs, y compris le rôle et le lien cadre/élève
            allowedFields = ['username', 'password', 'role', 'status', 'cadre_id', 'matricule', 'nom', 'prenom', 'grade', 'service']; // Ajout des champs du cadre pour Admin
        }

        // Filtrer les données entrantes du corps de la requête pour n'appliquer que les champs autorisés
        const finalUpdatePayload = {};
        allowedFields.forEach(field => {
            if (updateData.hasOwnProperty(field)) {
                finalUpdatePayload[field] = updateData[field];
            }
        });

        // Si le payload de mise à jour est vide (aucune donnée valide/autorisée n'a été envoyée)
        if (Object.keys(finalUpdatePayload).length === 0) {
             if (Object.keys(updateData).length > 0) {
                   // Des données ont été envoyées, mais aucune n'est autorisée ou valide pour cet utilisateur/rôle
                   return res.status(400).json({ message: 'Aucune donnée de mise à jour valide ou autorisée fournie.' });
             } else {
                 // Aucune donnée n'a été envoyée dans le corps de la requête
                 return res.status(400).json({ message: 'Aucune donnée de mise à jour fournie.' });
             }
        }


        // Validation spécifique pour Admin si le rôle ou le cadre_id est mis à jour
        if (authenticatedUser.role === 'Admin') {
             // Si cadre_id est mis à jour (et n'est pas null), vérifier son existence
             if (finalUpdatePayload.hasOwnProperty('cadre_id') && finalUpdatePayload.cadre_id !== null) {
                  const cadre = await Cadre.findByPk(finalUpdatePayload.cadre_id);
                  if (!cadre) {
                      return res.status(400).json({ message: `Le cadre avec l'ID ${finalUpdatePayload.cadre_id} n'existe pas et ne peut être lié.` });
                  }
                  // Si Admin change le rôle en Standard ET lie un cadre, s'assurer que le cadre_id est bien fourni
                  if (finalUpdatePayload.hasOwnProperty('role') && finalUpdatePayload.role === 'Standard' && !finalUpdatePayload.cadre_id) {
                       return res.status(400).json({ message: 'Un utilisateur Standard doit être lié à un cadre.' });
                  }
             }
             // Gérer le cas où Admin met explicitement cadre_id à null
              if (finalUpdatePayload.hasOwnProperty('cadre_id') && finalUpdatePayload.cadre_id === null) {
                   // Si Admin dé-lie le cadre, s'assurer que le rôle de l'utilisateur cible n'est PAS Standard (sauf si le rôle est aussi changé)
                   // Vérifier le rôle APRES la mise à jour potentielle du rôle dans finalUpdatePayload
                   const targetRoleAfterUpdate = finalUpdatePayload.hasOwnProperty('role') ? finalUpdatePayload.role : user.role;
                   if (targetRoleAfterUpdate === 'Standard') {
                        return res.status(400).json({ message: 'Un utilisateur Standard doit être lié à un cadre. Impossible de délier le cadre si le rôle reste Standard.' });
                   }
              }
             // Appliquer toutes les mises à jour autorisées pour Admin à l'instance de l'utilisateur
             await user.update(finalUpdatePayload);

         } else {
             // Pour les utilisateurs Standard, appliquer uniquement les champs autorisés (username, password)
             // Note: Le hook 'beforeSave' dans le modèle gérera le hachage si le champ 'password' est présent dans finalUpdatePayload
             await user.update(finalUpdatePayload);
         }


        // Recharger l'utilisateur mis à jour (sans le mot de passe haché) pour la réponse
        const userMisAJour = await User.findByPk(user.id, {
            attributes: { exclude: ['password'] }, // Exclure le mot de passe
            // Inclure la relation avec Cadre si pertinent
            include: [
                // IMPORTANT : Utiliser l'alias 'Cadre'
                { model: Cadre, as: 'Cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'service', 'fonction'], required: false },
            ]
        });


        return res.status(200).json({ message: 'Utilisateur mis à jour avec succès', user: userMisAJour });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'utilisateur :', error);
        // Gérer les erreurs spécifiques de Sequelize
        if (error.name === 'SequelizeUniqueConstraintError') {
            // Erreur si le champ 'username' (ou 'matricule' si unique) est déjà utilisé
            return res.status(409).json({ message: 'Ce nom d\'utilisateur est déjà utilisé.' });
        }
        if (error.name === 'SequelizeValidationError') {
            // Erreur si les validations du modèle échouent
            return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
        }
        if (error.name === 'SequelizeForeignKeyConstraintError') {
             // Erreur si le cadre_id fourni ne correspond à aucun ID dans la table 'cadres'
             return res.status(400).json({ message: "Erreur de liaison: L'ID du cadre spécifié n'existe pas." });
        }
        // Gérer les autres erreurs serveur non spécifiques
        return res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.', error: error.message });
    }
});

// DELETE /api/users/:id
// Supprimer un utilisateur (Accessible UNIQUEMENT aux Admins)
router.delete('/:id', isAdmin, async (req, res) => {
    const userId = parseInt(req.params.id, 10); // Convertir l'ID du paramètre en nombre entier

    try {
        // 1. Rechercher l'utilisateur à supprimer
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        // Logique de sécurité : Empêcher la suppression du dernier compte Admin
        if (user.role === 'Admin') {
            const adminCount = await User.count({ where: { role: 'Admin' } });
            if (adminCount <= 1) {
                return res.status(400).json({ message: 'Impossible de supprimer le dernier compte Admin.' });
            }
        }

        // 2. Supprimer l'utilisateur
        // Les dépendances (comme les Mises à Jour soumises par cet utilisateur)
        // devraient être gérées par les contraintes de clé étrangère (onDelete: SET NULL/CASCADE)
        // définies dans vos migrations ou modèles.
        await user.destroy();

        return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });

    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur :', error);
        // Gérer les erreurs de clé étrangère si l'utilisateur est référencé ailleurs et onDelete n'est pas géré correctement
         if (error.name === 'SequelizeForeignKeyConstraintError') {
              return res.status(400).json({ message: 'Impossible de supprimer cet utilisateur car il est référencé ailleurs (par exemple, par une mise à jour soumise).' });
         }
        return res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'utilisateur.' });
    }
});

// TODO: Ajouter d'autres routes si nécessaire (ex: GET /api/users/me pour obtenir/modifier son propre compte sans ID dans l'URL)

module.exports = router;
