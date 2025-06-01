// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'votre_cle_secrete_tres_longue_et_aleatoire';

const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        const token = authHeader.split(' ')[1];

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('Erreur de validation JWT:', err.message);
                return res.sendStatus(403);
            }
            req.user = user;
            next();
        });
    } else {
        res.sendStatus(401);
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'Admin') {
        next();
    } else {
        res.sendStatus(403);
    }
};

// --- AJOUTEZ CE BLOC isStandard ICI ---
const isStandard = (req, res, next) => {
    // authenticateJWT doit être exécuté AVANT isStandard pour que req.user existe
    if (req.user && req.user.role === 'Standard') {
        next(); // L'utilisateur est un Standard, continuer
    } else {
        res.status(403).json({ message: 'Accès non autorisé. Rôle Standard requis.' });
    }
};
// --- FIN DU BLOC isStandard ---

// Exporter les middlewares pour pouvoir les utiliser ailleurs
module.exports = {
    authenticateJWT,
    isAdmin,
    isStandard, // <--- C'est la ligne CRUCIALE à ajouter/décommenter
    // Vous pourriez ajouter d'autres middlewares de rôle ici (ex: isCadre, isEleve, isResponsibleFor...)
};