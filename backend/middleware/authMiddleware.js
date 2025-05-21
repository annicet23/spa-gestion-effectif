// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

// Récupérer la clé secrète pour JWT depuis les variables d'environnement.
// C'est CRUCIAL que cette clé soit la MÊME que celle utilisée pour signer les tokens dans authRoutes.js.
// Définissez JWT_SECRET dans votre fichier .env à la racine du projet.
// La valeur par défaut ne doit être utilisée qu'en dernier recours (et JAMAIS une clé faible en production).
const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_tres_longue_et_aleatoire'; // <-- Clé par défaut harmonisée

// Middleware pour vérifier la validité du JWT
const authenticateJWT = (req, res, next) => {
    // Récupérer l'en-tête Authorization
    const authHeader = req.headers.authorization;

    if (authHeader) {
        // L'en-tête est généralement au format "Bearer TOKEN"
        const token = authHeader.split(' ')[1]; // Extraire le token après "Bearer "

        // Vérifier le token
        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                // Si le token est invalide (expiré, signature incorrecte, etc.)
                // err.name peut être 'TokenExpiredError', 'JsonWebTokenError', etc.
                console.error('Erreur de validation JWT:', err.message);
                // Renvoyer 403 Forbidden si le token est présent mais invalide
                // Le message "invalid signature" ou "jwt expired" sera visible dans les logs serveur.
                return res.sendStatus(403);
            }

            // Si le token est valide, 'user' contient le payload du token
            // Attacher les informations de l'utilisateur à l'objet request
            // Ces informations incluent l'id, username, role, cadre_id, eleve_id (si inclus dans le payload lors de la connexion)
            req.user = user;
            // Passer au middleware ou au gestionnaire de route suivant
            next();
        });
    } else {
        // Si l'en-tête Authorization ou le token est manquant
        // Renvoyer 401 Unauthorized car l'authentification est requise
        res.sendStatus(401);
    }
};

// Middleware pour vérifier si l'utilisateur authentifié a le rôle 'Admin'
const isAdmin = (req, res, next) => {
    // authenticateJWT doit être exécuté AVANT isAdmin pour que req.user existe
    // Vérifier si l'utilisateur est authentifié (si req.user existe)
    // et si son rôle est 'Admin'
    if (req.user && req.user.role === 'Admin') {
        // Si l'utilisateur est Admin, passer au middleware ou routeur suivant
        next();
    } else {
        // Si l'utilisateur n'est pas Admin ou n'est pas authentifié
        // Renvoyer 403 Forbidden car l'accès est réservé aux Admins
        res.sendStatus(403);
    }
};

// Nouveau: Middleware pour autoriser des rôles spécifiques
const authorizeRoles = (allowedRoles) => {
    return (req, res, next) => {
        // Vérifie si l'utilisateur est authentifié et si son rôle est inclus dans les rôles autorisés
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Accès refusé. Rôle insuffisant.' });
        }
        next();
    };
};

// Exporter les middlewares pour pouvoir les utiliser ailleurs
module.exports = {
    authenticateJWT,
    isAdmin,
    authorizeRoles // <-- AJOUTEZ CECI ici pour l'exporter !
};