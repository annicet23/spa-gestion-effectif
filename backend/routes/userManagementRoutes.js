// routes/userManagementRoutes.js
const express = require('express');
const router = express.Router();
const { User, Cadre } = require('../models'); // Importez le modèle User et Cadre pour l'inclusion
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware'); // Importez vos middlewares

// --- APPLIQUER LES MIDDLEWARES D'AUTHENTIFICATION ET D'ADMIN À TOUTES LES ROUTES DE CE ROUTEUR ---
// Toutes les routes définies ci-dessous nécessiteront un token JWT valide ET que l'utilisateur soit Admin
router.use(authenticateJWT, isAdmin);

// --- ROUTES POUR LA GESTION DES UTILISATEURS (ADMIN SEULEMENT) ---

// GET /api/users
// Obtenir la liste de tous les utilisateurs
// Accessible uniquement aux Admins
router.get('/', async (req, res) => {
  try {
    // Récupérer tous les utilisateurs
    const users = await User.findAll({
       attributes: ['id', 'matricule', 'username', 'role', 'status', 'nom', 'prenom', 'grade', 'service', 'cadre_id', 'createdAt', 'updatedAt'], // Exclure le mot de passe
       include: [ // Inclure les informations du Cadre lié si nécessaire
         { model: Cadre, as: 'Cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'grade', 'service'], required: false } // as: 'Cadre' doit correspondre à l'alias dans la méthode associate de User
       ],
       order: [['username', 'ASC']] // Exemple de tri par nom d'utilisateur
       // Vous pouvez ajouter des filtres basés sur req.query (role, status, etc.)
    });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
  }
});

// GET /api/users/:id
// Obtenir les détails d'un utilisateur spécifique par son ID
// Accessible uniquement aux Admins
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    // Rechercher l'utilisateur par sa clé primaire (ID)
    const user = await User.findByPk(userId, {
         attributes: ['id', 'matricule', 'username', 'role', 'status', 'nom', 'prenom', 'grade', 'service', 'cadre_id', 'createdAt', 'updatedAt'], // Exclure le mot de passe
          include: [ // Inclure les informations du Cadre lié
           { model: Cadre, as: 'Cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'grade', 'service'], required: false }
         ]
    });

    if (!user) {
      return res.status(404).json({ message: 'Utilisateur non trouvé.' });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'utilisateur.' });
  }
});


// PUT /api/users/:id
// Mettre à jour un compte utilisateur existant par son ID
// Accessible uniquement aux Admins
router.put('/:id', async (req, res) => {
   const userId = req.params.id;
    // Les champs qu'un Admin est autorisé à modifier
   const { role, status } = req.body;

   // Optionnel: Validation basique des champs soumis
    const allowedRoles = ['Admin', 'Standard'];
    if (role && !allowedRoles.includes(role)) {
        return res.status(400).json({ message: `Rôle invalide. Les valeurs permises sont : ${allowedRoles.join(', ')}` });
    }
     const allowedStatuses = ['Active', 'Inactive'];
    if (status && !allowedStatuses.includes(status)) {
        return res.status(400).json({ message: `Statut invalide. Les valeurs permises sont : ${allowedStatuses.join(', ')}` });
    }

   try {
       // 1. Rechercher l'utilisateur à mettre à jour
       const user = await User.findByPk(userId);

       if (!user) {
         return res.status(404).json({ message: 'Utilisateur non trouvé.' });
       }

        // TODO: Sécurité - Empêcher un Admin de se rétrograder ou de se désactiver lui-même si nécessaire
        if (req.user.id === userId && (role === 'Standard' || status === 'Inactive')) {
             // Cette logique peut varier selon les besoins, mais souvent un Admin ne peut pas désactiver ou déclasser le compte Admin qui le gère actuellement.
             // Vous pourriez ajouter une vérification ici.
             console.log(`TODO: Vérifier si l'Admin ${req.user.username} tente de modifier son propre compte d'une manière restrictive.`);
        }


       // 2. Mettre à jour les champs autorisés
       // Ne PAS permettre de changer le mot de passe, matricule, nom, prenom, etc. via cette route.
       // Uniquement les champs d'administration comme role et status.
       user.role = role !== undefined ? role : user.role;
       user.status = status !== undefined ? status : user.status;

       // 3. Sauvegarder les changements
       await user.save();

       // Répondre avec les infos utilisateur mises à jour (sans le mot de passe)
        const updatedUser = await User.findByPk(userId, {
            attributes: ['id', 'matricule', 'username', 'role', 'status', 'nom', 'prenom', 'grade', 'service', 'cadre_id', 'createdAt', 'updatedAt'],
             include: [
              { model: Cadre, as: 'Cadre', attributes: ['id', 'matricule', 'nom', 'prenom', 'grade', 'service'], required: false }
            ]
        });


       return res.status(200).json({ message: 'Utilisateur mis à jour avec succès', user: updatedUser });

   } catch (error) {
       console.error('Erreur lors de la mise à jour de l\'utilisateur :', error);
        // Gérer les erreurs de validation Sequelize (ex: ENUM invalide)
       if (error.name === 'SequelizeValidationError') {
           return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
       }
       return res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'utilisateur.' });
   }
});


// DELETE /api/users/:id
// Supprimer un compte utilisateur par son ID
// Accessible uniquement aux Admins
router.delete('/:id', async (req, res) => {
   const userId = req.params.id;

    // TODO: Sécurité - Empêcher un Admin de supprimer le dernier compte Admin, ou son propre compte
     if (req.user.id === userId) {
         // Un Admin ne peut généralement pas se supprimer lui-même.
         console.log(`TODO: Vérifier si l'Admin ${req.user.username} tente de supprimer son propre compte.`);
          return res.status(403).json({ message: 'Vous ne pouvez pas supprimer votre propre compte utilisateur.' });
     }
      // TODO: Vérifier si c'est le dernier Admin avant de supprimer
      // const adminCount = await User.count({ where: { role: 'Admin' } });
      // if (adminCount === 1) {
      //    // Ne pas supprimer le dernier Admin pour éviter de perdre l'accès admin
      //    return res.status(403).json({ message: 'Impossible de supprimer le dernier compte Admin.' });
      // }


   try {
       // 1. Rechercher l'utilisateur à supprimer (pour vérifier permission/statut si nécessaire)
       const user = await User.findByPk(userId);

       if (!user) {
         return res.status(404).json({ message: 'Utilisateur non trouvé.' });
       }

       // 2. Supprimer l'utilisateur
       await user.destroy();

       // Gérer les éventuelles conséquences sur les données liées (MisesAJour)
       // Sequelize gère les CASCADE/SET NULL définis dans les migrations (sur submitted_by_id, validated_by_id)

       return res.status(200).json({ message: 'Utilisateur supprimé avec succès' });

   } catch (error) {
       console.error('Erreur lors de la suppression de l\'utilisateur :', error);
       return res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'utilisateur.' });
   }
});


module.exports = router; // Exporter le routeur