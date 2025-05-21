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


// POST /api/auth/login
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
                'password_needs_reset', 'last_password_change'
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

module.exports = router;