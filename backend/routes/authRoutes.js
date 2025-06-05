'use strict';
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User, Cadre } = require('../models');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_principale_et_tres_longue_pour_les_tokens_normaux';
const TEMP_JWT_SECRET = process.env.TEMP_JWT_SECRET || 'votre_cle_secrete_temporaire_longue_et_unique_pour_consultants_en_attente';

// Helper function to get the date of the most recent Friday at 6 AM (including the current Friday if before 6 AM)
const getPreviousOrCurrentFridaySixAM = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday

    let daysToFriday = 0;
    if (day === 5) { // If it's Friday
        if (d.getHours() < 6) {
            // It's Friday before 6 AM, so this Friday 6 AM is the target
            daysToFriday = 0;
        } else {
            // It's Friday after 6 AM, target is next Friday 6 AM, so previous Friday was 7 days ago
            daysToFriday = -7;
        }
    } else if (day < 5) { // If it's Mon-Thu, target is previous Friday
        daysToFriday = -(day + 2); // (day from Sunday + 2 to get to Friday)
    } else { // If it's Sat-Sun, target is previous Friday
        daysToFriday = -(day - 5);
    }

    const fridaySixAM = new Date(d);
    fridaySixAM.setDate(d.getDate() + daysToFriday);
    fridaySixAM.setHours(6, 0, 0, 0); // Set to 6 AM (06:00:00.000)
    return fridaySixAM;
};

// ✅ NOUVELLE FONCTION - Vérifier si rotation hebdomadaire requise
const isWeeklyRotationRequired = (user) => {
    if (user.role !== 'Consultant') return false;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Dimanche, 5 = Vendredi

    // Pour les tests, décommentez la ligne suivante pour forcer la rotation
    // return true;

    // Vérifier si c'est vendredi
    if (dayOfWeek !== 5) return false;

    // Vérifier si la rotation n'a pas déjà été faite cette semaine
    const lastFridaySixAM = getPreviousOrCurrentFridaySixAM(now);

    // Si last_rotation_date n'existe pas ou est antérieure au dernier vendredi 6h
    if (!user.last_rotation_date || user.last_rotation_date < lastFridaySixAM) {
        return true;
    }

    return false;
};

// POST /api/auth/login - MODIFIÉ AVEC DÉTECTION DE ROTATION
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe sont requis.' });
    }

    try {
        const user = await User.findOne({
            where: { username: username.trim() },
            attributes: [
                'id', 'username', 'role', 'password', 'status', 'cadre_id',
                'matricule', 'nom', 'prenom', 'grade', 'service',
                'password_needs_reset', 'last_password_change', 'last_rotation_date' // ✅ Ajouté
            ]
        });

        if (!user) {
            console.log(`Tentative de connexion échouée pour l'utilisateur "${username}" : Utilisateur non trouvé.`);
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        const isPasswordValid = await user.validPassword(password);
        if (!isPasswordValid) {
            console.log(`Comparaison de mot de passe pour l'utilisateur "${username}" : ÉCHEC.`);
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // --- Logique Spécifique au Consultant nécessitant une mise à jour ---
        if (user.role === 'Consultant') {
            const needsMatriculeUpdate = user.matricule === null || user.matricule.trim() === '' || user.cadre_id === null;
            let needsPasswordReset = user.password_needs_reset === true; // Keep existing reset flag if true

            // NOUVELLE LOGIQUE : Le mot de passe expire chaque vendredi à 6h.
            const now = new Date();
            const lastFridaySixAM = getPreviousOrCurrentFridaySixAM(now);

            // Le mot de passe a expiré si :
            // 1. last_password_change est null (premier login/après migration sans initialisation)
            // 2. Ou si last_password_change est antérieur au dernier vendredi 6h du matin
            if (!user.last_password_change || user.last_password_change < lastFridaySixAM) {
                needsPasswordReset = true;
                console.log(`Consultant "${username}" doit changer son mot de passe (expiration fixée au vendredi 6h).`);
            }

            if (needsMatriculeUpdate || needsPasswordReset) {
                const tempTokenPayload = {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                    requiresUpdate: true,
                    matricule: user.matricule || ''
                };
                const tempToken = jwt.sign(tempTokenPayload, TEMP_JWT_SECRET, { expiresIn: '15m' });

                let message = 'Votre profil nécessite une mise à jour.';
                let requiresMatriculePrompt = false;
                let requiresPasswordUpdate = false;

                if (needsMatriculeUpdate && !needsPasswordReset) {
                    message = 'Veuillez saisir votre matricule pour continuer.';
                    requiresMatriculePrompt = true;
                    console.log(`Consultant "${username}" nécessite la saisie de son matricule.`);
                } else if (needsPasswordReset && !needsMatriculeUpdate) {
                    message = 'Votre mot de passe a expiré et doit être changé.';
                    requiresPasswordUpdate = true;
                    console.log(`Consultant "${username}" doit changer son mot de passe (expiration ou reset flag).`);
                } else if (needsMatriculeUpdate && needsPasswordReset) {
                    message = 'Votre profil (mot de passe et matricule) doit être mis à jour.';
                    requiresPasswordUpdate = true;
                    console.log(`Consultant "${username}" doit changer son mot de passe ET compléter son matricule.`);
                }

                return res.status(401).json({
                    message: message,
                    tempToken: tempToken,
                    requiresMatriculePrompt: requiresMatriculePrompt,
                    requiresPasswordUpdate: requiresPasswordUpdate,
                    user: {
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        matricule: user.matricule || '',
                        nom: user.nom,
                        prenom: user.prenom,
                        grade: user.grade,
                        service: user.service,
                    }
                });
            }
        }
        // --- FIN Logique Spécifique au Consultant ---

        if (user.status !== 'Active') {
            console.log(`Tentative de connexion échouée pour l'utilisateur "${username}" : Compte inactif.`);
            return res.status(403).json({ message: 'Votre compte n\'est pas actif. Veuillez contacter l\'administrateur.' });
        }

        // ✅ VÉRIFICATION DE ROTATION HEBDOMADAIRE
        const needsWeeklyRotation = isWeeklyRotationRequired(user);
        console.log(`🔍 Vérification rotation pour ${username}: ${needsWeeklyRotation ? 'REQUISE' : 'NON REQUISE'}`);

        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            cadre_id: user.cadre_id,
            matricule: user.matricule,
            nom: user.nom,
            prenom: user.prenom,
            grade: user.grade,
            service: user.service,
        };

        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

        const userResponse = user.toJSON();
        delete userResponse.password;

        // ✅ AJOUTER LE FLAG DE ROTATION DANS LA RÉPONSE
        userResponse.needsWeeklyRotation = needsWeeklyRotation;

        console.log(`Connexion réussie pour l'utilisateur "${username}". Token généré.`);
        return res.status(200).json({
            message: 'Connexion réussie',
            token: token,
            user: userResponse
        });

    } catch (error) {
        console.error('Erreur serveur lors de la connexion :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la connexion.', error: error.message });
    }
});

// ✅ NOUVELLE ROUTE - Rotation des comptes consultants
router.post('/rotate-consultant', async (req, res) => {
    const { currentPassword, newUsername, newPassword, newCadreId, newMatricule } = req.body;

    console.log('🔄 [ROTATION] Début du processus de rotation consultant');

    // Vérification des champs requis
    if (!currentPassword || !newUsername || !newPassword || !newCadreId || !newMatricule) {
        return res.status(400).json({
            message: 'Tous les champs sont requis pour la rotation.'
        });
    }

    // Vérification du token JWT
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ message: 'Token d\'authentification requis.' });
    }

    try {
        // Décoder le token pour obtenir l'ID utilisateur
        const decoded = jwt.verify(token, JWT_SECRET);
        const userId = decoded.id;

        console.log(`🔄 [ROTATION] Utilisateur ID: ${userId}`);

        // Récupérer l'utilisateur actuel
        const currentUser = await User.findByPk(userId);
        if (!currentUser) {
            return res.status(404).json({ message: 'Utilisateur non trouvé.' });
        }

        // Vérifier que c'est bien un consultant
        if (currentUser.role !== 'Consultant') {
            return res.status(403).json({
                message: 'La rotation n\'est autorisée que pour les comptes consultants.'
            });
        }

        // Vérifier le mot de passe actuel
        const isCurrentPasswordValid = await currentUser.validPassword(currentPassword);
        if (!isCurrentPasswordValid) {
            console.log(`🔄 [ROTATION] Mot de passe actuel incorrect pour ${currentUser.username}`);
            return res.status(401).json({
                message: 'Mot de passe actuel incorrect.'
            });
        }

        // Vérifier que le nouveau cadre existe
        const newCadre = await Cadre.findByPk(newCadreId);
        if (!newCadre) {
            return res.status(404).json({
                message: 'Cadre responsable non trouvé.'
            });
        }

        // Vérifier que le matricule correspond au cadre
        if (newCadre.matricule !== newMatricule) {
            return res.status(400).json({
                message: 'Le matricule ne correspond pas au cadre sélectionné.'
            });
        }

        // Vérifier que le nouveau nom d'utilisateur n'existe pas déjà
        const existingUser = await User.findOne({
            where: { username: newUsername.trim() }
        });

        if (existingUser && existingUser.id !== userId) {
            return res.status(409).json({
                message: 'Ce nom d\'utilisateur existe déjà.'
            });
        }

        // Hasher le nouveau mot de passe
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);

        // Mettre à jour l'utilisateur
        await currentUser.update({
            username: newUsername.trim(),
            password: hashedNewPassword,
            cadre_id: newCadreId,
            matricule: newMatricule,
            nom: newCadre.nom,
            prenom: newCadre.prenom,
            grade: newCadre.grade,
            service: newCadre.service,
            password_needs_reset: false,
            last_password_change: new Date(),
            last_rotation_date: new Date() // ✅ Marquer la rotation comme effectuée
        });

        // Générer un nouveau token avec les nouvelles informations
        const newPayload = {
            id: currentUser.id,
            username: newUsername.trim(),
            role: currentUser.role,
            cadre_id: newCadreId,
            matricule: newMatricule,
            nom: newCadre.nom,
            prenom: newCadre.prenom,
            grade: newCadre.grade,
            service: newCadre.service,
        };

        const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: '24h' });

        // Préparer la réponse utilisateur (sans mot de passe)
        const updatedUser = await User.findByPk(userId, {
            attributes: { exclude: ['password'] }
        });

        console.log(`🔄 [ROTATION] ✅ Rotation réussie pour ${currentUser.username} -> ${newUsername}`);
        console.log(`🔄 [ROTATION] Nouveau responsable: ${newCadre.grade} ${newCadre.nom} ${newCadre.prenom}`);

        return res.status(200).json({
            message: 'Rotation effectuée avec succès.',
            token: newToken,
            user: updatedUser,
            newResponsible: {
                id: newCadre.id,
                nom: newCadre.nom,
                prenom: newCadre.prenom,
                grade: newCadre.grade,
                matricule: newCadre.matricule,
                entite: newCadre.entite,
                service: newCadre.service
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Token invalide.' });
        }

        console.error('🔄 [ROTATION] ❌ Erreur lors de la rotation:', error);
        return res.status(500).json({
            message: 'Erreur serveur lors de la rotation.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;