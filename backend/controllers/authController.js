// controllers/authController.js (Fonction de connexion mise à jour)
const { User, Cadre } = require('../models');
const bcrypt = require('bcryptjs'); // Assurez-vous d'utiliser bcryptjs
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize'); // Importez Op pour les opérations Sequelize

const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_tres_longue_et_aleatoire'; // Assurez-vous que c'est la même clé que partout

exports.login = async (req, res) => {
    const { username, password, matricule } = req.body; // `matricule` peut être présent ou non

    try {
        const user = await User.findOne({ where: { username } });

        if (!user || !(await bcrypt.compare(password, user.password))) { // Utilisez bcrypt.compare directement
            return res.status(401).json({ message: 'Nom d\'utilisateur ou mot de passe incorrect.' });
        }

        if (user.status === 'Inactive') {
            return res.status(403).json({ message: 'Votre compte est inactif. Veuillez contacter l\'administrateur.' });
        }

        // --- Logique Spécifique au Rôle Consultant ---
        if (user.role === 'Consultant') {
            // SCÉNARIO 1: Le consultant se connecte et a besoin de lier un matricule (ou de mettre à jour son profil)
            // Conditions pour "a besoin de lier/mettre à jour":
            // - Pas de matricule déjà associé OU
            // - Pas de cadre_id associé OU
            // - Un flag spécifique (ex: user.needsProfileUpdate) si vous en avez un dans votre modèle User
            // Pour simplifier, nous allons considérer qu'il doit compléter son profil si cadre_id est null ou matricule est null
            if (!user.cadre_id || !user.matricule) {
                // Si la requête NE contient PAS de matricule (première tentative de login pour un consultant non complété)
                if (!matricule) {
                    // Indiquer au frontend de demander le matricule
                    const tempToken = jwt.sign(
                        { id: user.id, role: user.role, needsMatricule: true }, // Ajoutez un flag pour le frontend
                        JWT_SECRET,
                        { expiresIn: '10m' } // Token temporaire de courte durée
                    );
                    return res.status(200).json({
                        requiresMatriculePrompt: true, // Le frontend va afficher la boîte de dialogue pour le matricule
                        tempToken: tempToken // Token pour la prochaine étape
                    });
                } else {
                    // Si la requête CONTIENT un matricule (le frontend l'a demandé et le renvoie)
                    // Tenter de lier le matricule
                    const cadre = await Cadre.findOne({ where: { matricule: matricule.trim() } });

                    if (!cadre) {
                        // Matricule non trouvé, demander le mot de passe et le nouveau mot de passe
                        const tempToken = jwt.sign(
                            { id: user.id, role: user.role, needsPasswordUpdate: true, attemptedMatricule: matricule.trim() },
                            JWT_SECRET,
                            { expiresIn: '10m' }
                        );
                        return res.status(200).json({
                            requiresPasswordUpdate: true, // Le frontend va afficher la boîte de dialogue pour les mots de passe
                            tempToken: tempToken,
                            message: 'Matricule non trouvé. Veuillez définir un nouveau mot de passe.'
                        });
                    }

                    // Vérifier si ce matricule est déjà associé à un autre utilisateur (sauf lui-même)
                    const existingUserWithMatricule = await User.findOne({
                        where: {
                            cadre_id: cadre.id,
                            id: { [Op.ne]: user.id } // Exclure l'utilisateur actuel
                        }
                    });

                    if (existingUserWithMatricule) {
                        // Matricule déjà pris, demander le mot de passe et le nouveau mot de passe
                        const tempToken = jwt.sign(
                            { id: user.id, role: user.role, needsPasswordUpdate: true, attemptedMatricule: matricule.trim() },
                            JWT_SECRET,
                            { expiresIn: '10m' }
                        );
                        return res.status(200).json({
                            requiresPasswordUpdate: true,
                            tempToken: tempToken,
                            message: 'Ce matricule est déjà utilisé. Veuillez définir un nouveau mot de passe.'
                        });
                    }

                    // Si le matricule est valide et non pris, lier le cadre à l'utilisateur
                    user.cadre_id = cadre.id;
                    user.matricule = cadre.matricule;
                    user.nom = cadre.nom;
                    user.prenom = cadre.prenom;
                    user.grade = cadre.grade;
                    user.service = cadre.service;
                    user.fonction = cadre.fonction;
                    user.status = 'Active'; // Marquer comme actif une fois le profil complété

                    await user.save(); // Sauvegarde les modifications

                    // Générer le token complet pour l'utilisateur maintenant complété
                    const fullToken = jwt.sign(
                        { id: user.id, username: user.username, role: user.role, status: user.status, matricule: user.matricule },
                        JWT_SECRET,
                        { expiresIn: '24h' }
                    );

                    return res.status(200).json({
                        message: 'Connexion réussie! Profil mis à jour.',
                        token: fullToken,
                        user: {
                            id: user.id, username: user.username, role: user.role, status: user.status,
                            matricule: user.matricule, nom: user.nom, prenom: user.prenom,
                            grade: user.grade, service: user.service, fonction: user.fonction
                        }
                    });
                }
            }
        }

        // SCÉNARIO FINAL: Utilisateur non consultant OU Consultant dont le profil est déjà complet
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, status: user.status, matricule: user.matricule },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: 'Connexion réussie!',
            token,
            user: {
                id: user.id, username: user.username, role: user.role, status: user.status,
                matricule: user.matricule, nom: user.nom, prenom: user.prenom,
                grade: user.grade, service: user.service, fonction: user.fonction
            }
        });

    } catch (error) {
        console.error('Erreur de connexion:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
};