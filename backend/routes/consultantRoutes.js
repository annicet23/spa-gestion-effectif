'use strict';
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, Cadre } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs'); // N'oubliez pas d'importer bcryptjs si vous l'utilisez pour comparer les mots de passe

// Assurez-vous que le secret temporaire ici correspond à celui utilisé dans authRoutes.js
const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET || 'votre_cle_secrete_temporaire_longue_et_unique_pour_consultants_en_attente';
// Assurez-vous que le secret principal ici correspond à celui utilisé dans authRoutes.js
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_principale_et_tres_longue_pour_les_tokens_normaux';

// --- MIDDLEWARE SPÉCIFIQUE POUR LES TOKENS TEMPORAIRES ---
const verifyTempToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const tempToken = authHeader && authHeader.split(' ')[1];

    if (!tempToken) {
        return res.status(401).json({ message: 'Accès non autorisé : Aucun token temporaire fourni.', requiresLogin: true });
    }

    try {
        const decoded = jwt.verify(tempToken, TEMP_JWT_SECRET);
        if (!decoded.requiresUpdate) {
            return res.status(403).json({ message: 'Token temporaire invalide ou non destiné à la mise à jour de profil.', requiresLogin: true });
        }
        req.user = decoded;
        next();
    } catch (error) {
        console.error('Erreur de vérification du token temporaire:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Votre session de mise à jour de profil a expiré. Veuillez vous reconnecter.', requiresLogin: true });
        }
        return res.status(403).json({ message: 'Token temporaire invalide ou corrompu. Veuillez vous reconnecter.', requiresLogin: true });
    }
};

// POST /api/consultant/update-profile
router.post('/update-profile', verifyTempToken, async (req, res) => {
    const { oldPassword, newPassword, confirmNewPassword, matricule } = req.body;
    const userId = req.user.id;

    // Récupérer l'utilisateur actuel pour déterminer s'il a besoin d'une mise à jour de matricule ou de mot de passe
    let consultantUser;
    try {
        consultantUser = await User.findByPk(userId);
        if (!consultantUser || consultantUser.role !== 'Consultant') {
            return res.status(403).json({ message: 'Accès refusé. Ce compte n\'est pas un consultant en attente de mise à jour de profil.', requiresLogin: true });
        }
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'utilisateur:', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la vérification de l\'utilisateur.', error: error.message });
    }

    // Vérifier les besoins de mise à jour initiaux pour les messages d'erreur détaillés
    const initialNeedsMatriculeUpdate = consultantUser.matricule === null || consultantUser.matricule.trim() === '' || consultantUser.cadre_id === null;
    const initialNeedsPasswordReset = consultantUser.password_needs_reset === true; // On garde le flag si déjà vrai

    // Validation des entrées
    if (!oldPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({
            message: 'Ancien mot de passe, nouveau mot de passe et confirmation sont requis.',
            requiresPasswordUpdate: true,
            requiresMatriculePrompt: initialNeedsMatriculeUpdate // Maintenir le flag si le matricule est aussi requis
        });
    }

    if (!matricule || matricule.trim() === '') {
        return res.status(400).json({
            message: 'Le champ Matricule est requis.',
            requiresMatriculePrompt: true,
            requiresPasswordUpdate: initialNeedsPasswordReset // Maintenir le flag si le mot de passe est aussi requis
        });
    }

    if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
            message: 'Les nouveaux mots de passe ne correspondent pas.',
            requiresPasswordUpdate: true,
            requiresMatriculePrompt: initialNeedsMatriculeUpdate
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            message: 'Le nouveau mot de passe doit contenir au moins 6 caractères.',
            requiresPasswordUpdate: true,
            requiresMatriculePrompt: initialNeedsMatriculeUpdate
        });
    }

    try {
        const isOldPasswordValid = await consultantUser.validPassword(oldPassword);
        if (!isOldPasswordValid) {
            return res.status(401).json({
                message: 'L\'ancien mot de passe est incorrect.',
                requiresPasswordUpdate: true,
                requiresMatriculePrompt: initialNeedsMatriculeUpdate
            });
        }

        const newCadre = await Cadre.findOne({ where: { matricule: matricule.trim() } });
        if (!newCadre) {
            return res.status(404).json({
                message: `Aucun cadre trouvé avec le matricule : "${matricule}". Veuillez vérifier et réessayer.`,
                requiresMatriculePrompt: true,
                requiresPasswordUpdate: initialNeedsPasswordReset
            });
        }

        const existingUserWithNewCadre = await User.findOne({
            where: {
                cadre_id: newCadre.id,
                id: { [Op.ne]: userId } // S'assurer que ce n'est pas le même utilisateur
            }
        });
        if (existingUserWithNewCadre) {
            return res.status(409).json({
                message: `Le matricule "${matricule}" est déjà associé à un autre compte.`,
                requiresMatriculePrompt: true,
                requiresPasswordUpdate: initialNeedsPasswordReset
            });
        }

        // --- DÉBUT DES MODIFICATIONS CLÉS ---

        // Mise à jour des informations de l'utilisateur Consultant
        // Le hook `beforeSave` du modèle User gérera le hachage du nouveau mot de passe
        // et la mise à jour de `last_password_change` ainsi que le reset de `password_needs_reset`.
        consultantUser.password = newPassword; // Le hook `beforeSave` de User va hasher ce mot de passe
        // consultantUser.password_needs_reset sera mis à jour à false par le hook `beforeSave`

        consultantUser.cadre_id = newCadre.id;
        consultantUser.username = newCadre.matricule; // Généralement, le username du consultant sera son matricule
        consultantUser.matricule = newCadre.matricule;
        consultantUser.nom = newCadre.nom;
        consultantUser.prenom = newCadre.prenom;
        consultantUser.grade = newCadre.grade;
        consultantUser.service = newCadre.service;
        // consultantUser.fonction = newCadre.fonction; // S'assurer que 'fonction' existe dans le modèle User si vous l'utilisez

        // La ligne suivante est SUPPRIMÉE pour maintenir le rôle 'Consultant'
        // consultantUser.role = 'Standard'; // <-- SUPPRIMÉ

        consultantUser.status = 'Active'; // S'assurer que le compte est actif après la mise à jour

        await consultantUser.save(); // Sauvegarde l'utilisateur avec les nouvelles infos (le hook s'exécutera ici)

        // --- FIN DES MODIFICATIONS CLÉS ---

        // Générer un nouveau token JWT complet pour l'accès normal à l'application
        const newTokenPayload = {
            id: consultantUser.id,
            username: consultantUser.username,
            role: consultantUser.role, // Le rôle est toujours 'Consultant'
            cadre_id: consultantUser.cadre_id,
            matricule: consultantUser.matricule,
            nom: consultantUser.nom,
            prenom: consultantUser.prenom,
            grade: consultantUser.grade,
            service: consultantUser.service,
            fonction: newCadre.fonction // Utilise la fonction du Cadre pour le token
        };

        const newToken = jwt.sign(newTokenPayload, JWT_SECRET, { expiresIn: '24h' });

        console.log(`Profil Consultant pour l'utilisateur "${consultantUser.username}" mis à jour avec le matricule "${matricule}". Rôle maintenu: "${consultantUser.role}".`);
        return res.status(200).json({
            message: 'Profil Consultant mis à jour avec succès.',
            token: newToken,
            user: {
                id: consultantUser.id,
                username: consultantUser.username,
                role: consultantUser.role, // Confirmer le rôle dans la réponse
                nom: consultantUser.nom,
                prenom: consultantUser.prenom,
                matricule: consultantUser.matricule,
                grade: consultantUser.grade,
                service: consultantUser.service,
                fonction: newCadre.fonction
            }
        });

    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil Consultant :', error);
        // Les messages d'erreur doivent aussi renvoyer les flags corrects pour le frontend
        const requiresMatriculePrompt = consultantUser.matricule === null || consultantUser.matricule.trim() === '' || consultantUser.cadre_id === null;
        const requiresPasswordUpdate = consultantUser.password_needs_reset === true;

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Une contrainte d\'unicité a été violée. Ce matricule pourrait déjà être utilisé ou une autre donnée est en conflit.',
                requiresPasswordUpdate: requiresPasswordUpdate,
                requiresMatriculePrompt: requiresMatriculePrompt // Conserver l'état
            });
        }
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation des données : ' + error.errors.map(e => e.message).join(', '),
                requiresPasswordUpdate: requiresPasswordUpdate,
                requiresMatriculePrompt: requiresMatriculePrompt // Conserver l'état
            });
        }
        return res.status(500).json({
            message: 'Erreur serveur lors de la mise à jour du profil Consultant.',
            error: error.message,
            requiresPasswordUpdate: requiresPasswordUpdate,
            requiresMatriculePrompt: requiresMatriculePrompt // Conserver l'état
        });
    }
});

module.exports = router;