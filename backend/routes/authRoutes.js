// routes/authRoutes.js
const express = require('express');
const router = express.Router();
// Importez le modèle User et potentiellement d'autres si nécessaire pour les relations
const { User } = require('../models'); // Assurez-vous que votre index des modèles exporte 'User'
const jwt = require('jsonwebtoken'); // Importer jsonwebtoken
// bcryptjs est nécessaire si vous comparez les mots de passe directement ici,
// mais votre modèle User semble avoir une méthode validPassword, ce qui est mieux.
// const bcrypt = require('bcryptjs');

// Si vous utilisez des variables d'environnement (recommandé), assurez-vous que dotenv est configuré dans server.js
// require('dotenv').config(); // Pas nécessaire ici si déjà fait dans server.js

// Récupérer la clé secrète pour JWT depuis les variables d'environnement.
// C'est CRUCIAL que cette clé soit la MÊME que celle utilisée pour vérifier les tokens dans authMiddleware.js.
// Définissez JWT_SECRET dans votre fichier .env à la racine du projet.
// La valeur par défaut ne doit être utilisée qu'en dernier recours (et JAMAIS une clé faible en production).
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_tres_longue_et_aleatoire'; // <-- Utilisez la MÊME valeur que dans authMiddleware.js et votre .env

// TODO: Assurez-vous que votre modèle User :
// - A un champ 'password' pour stocker le mot de passe HACHÉ.
// - A une méthode 'validPassword(password)' qui utilise bcrypt.compare pour comparer le mot de passe fourni avec le hash stocké.
// - Utilise des hooks (beforeCreate, beforeUpdate) pour hacher le mot de passe avant de le sauvegarder.
// - A un champ 'status' (ex: ENUM('Active', 'Inactive')) et une logique pour le gérer.
// - A des champs 'cadre_id' et 'eleve_id' si un utilisateur est lié à un cadre ou un élève.


// POST /api/auth/login
// Route pour la connexion d'un utilisateur existant
router.post('/login', async (req, res) => {
    // Les données attendues : nom d'utilisateur et mot de passe
    const { username, password } = req.body;

    // 1. Validation des entrées
    if (!username || !password) {
        return res.status(400).json({ message: 'Nom d\'utilisateur et mot de passe sont requis.' });
    }

    try {
        // 2. Rechercher l'utilisateur par username
        // Inclure les champs cadre_id et eleve_id si vous les utilisez pour les lier à l'utilisateur
        const user = await User.findOne({
            where: { username: username },
            // Sélectionner explicitement les champs nécessaires (y compris les IDs liés)
            attributes: ['id', 'username', 'role', 'password', 'status', 'cadre_id', 'eleve_id']
        });

        // 3. Vérifier si l'utilisateur existe
        if (!user) {
            // Note de sécurité : Il est préférable de renvoyer un message générique
            // pour ne pas indiquer si c'est l'utilisateur ou le mot de passe qui est incorrect.
            console.log(`Tentative de connexion échouée pour l'utilisateur "${username}" : Utilisateur non trouvé.`);
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // 4. Vérifier si le compte est actif (selon votre champ status dans le modèle User)
        if (user.status !== 'Active') { // Assurez-vous que 'Active' est la bonne valeur dans votre ENUM/champ
             console.log(`Tentative de connexion échouée pour l'utilisateur "${username}" : Compte inactif.`);
             return res.status(401).json({ message: 'Votre compte n\'est pas actif.' });
        }


        // 5. Comparer le mot de passe fourni avec le mot de passe haché stocké
        // Cette méthode 'validPassword' doit être définie dans votre modèle User et utiliser bcrypt.compare
        const isPasswordValid = await user.validPassword(password);

        // --- LOG DE DÉBOGAGE ---
        console.log(`Comparaison de mot de passe pour l'utilisateur "${username}" : ${isPasswordValid ? 'SUCCÈS' : 'ÉCHEC'}`);
        // -----------------------


        // 6. Vérifier si le mot de passe est valide
        if (!isPasswordValid) {
            // Message générique pour la sécurité
            return res.status(401).json({ message: 'Identifiants invalides.' });
        }

        // 7. Si l'authentification réussit, générer un JWT
        // Le payload du token contient des informations sur l'utilisateur (non sensibles)
        // qui seront accessibles via req.user après le middleware authenticateJWT
        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
            // Inclure les IDs liés si l'utilisateur est lié à un cadre ou un élève
            cadre_id: user.cadre_id, // Ajouté au payload
            eleve_id: user.eleve_id  // Ajouté au payload
            // TODO: Inclure d'autres informations non sensibles pertinentes si nécessaire (ex: matricule si pertinent pour le frontend)
            // matricule: user.matricule // Si matricule est dans le modèle User et pertinent pour le payload
        };

        // Définir l'expiration du token (ex: 24 heures)
        const tokenOptions = {
            expiresIn: '24h' // Le token expire après 24 heures
            // TODO: Ajustez la durée de vie du token selon vos besoins de sécurité et d'expérience utilisateur
        };

        const token = jwt.sign(payload, JWT_SECRET, tokenOptions);

        // 8. Renvoyer le token et les informations de l'utilisateur (sauf le mot de passe)
        // On crée une copie de l'objet user et on supprime le champ password avant de l'envoyer
         const userResponse = user.toJSON(); // Convertit l'instance Sequelize en objet JSON
         delete userResponse.password; // Supprime le mot de passe

         // Inclure les IDs liés dans l'objet user renvoyé aussi
         // userResponse.cadre_id = user.cadre_id; // Déjà inclus via toJSON si le champ existe
         // userResponse.eleve_id = user.eleve_id; // Déjà inclus via toJSON si le champ existe

        console.log(`Connexion réussie pour l'utilisateur "${username}". Token généré.`);
        return res.status(200).json({
            message: 'Connexion réussie',
            token: token,
            user: userResponse // Informations sur l'utilisateur connecté (sans le mot de passe)
        });

    } catch (error) {
        console.error('Erreur serveur lors de la connexion :', error);
        // En cas d'erreur serveur inattendue
        return res.status(500).json({ message: 'Erreur serveur lors de la connexion.', error: error.message });
    }
});

// TODO: Ajouter d'autres routes d'authentification si nécessaire (ex: /register, /refresh-token, /logout)


module.exports = router; // Exporter le routeur
