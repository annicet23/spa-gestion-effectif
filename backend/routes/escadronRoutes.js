// routes/escadronRoutes.js
const express = require('express');
const router = express.Router();
// Importez le modèle Escadron
const { Escadron } = require('../models'); // Assurez-vous que votre index des modèles exporte 'Escadron'
// Importez vos middlewares d'authentification et d'autorisation
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize'); // Nécessaire si vous utilisez des opérateurs Sequelize

// --- ROUTES POUR LA GESTION DES ESCADRONS ---

// POST /api/escadrons
// Créer un nouvel escadron
// Accessible UNIQUEMENT aux Admins
router.post('/', authenticateJWT, isAdmin, async (req, res) => {
    // Les données attendues dans le corps de la requête pour un nouvel escadron
    const { nom, numero, description } = req.body; // Adaptez les champs selon votre modèle Escadron

    // Validation basique des champs requis (ajustez selon votre modèle)
    if (!nom || !numero) {
        return res.status(400).json({ message: 'Les champs nom et numero sont requis pour un escadron.' });
    }
    // TODO: Validation supplémentaire :
    // - Vérifier que le numero est unique (si ce n'est pas déjà une contrainte DB)
    // - Vérifier le format du numero si nécessaire

    try {
        // Vérifier si un escadron avec le même numéro existe déjà
        const existingEscadron = await Escadron.findOne({ where: { numero: numero } });
        if (existingEscadron) {
            return res.status(409).json({ message: `Un escadron avec le numéro ${numero} existe déjà.` });
        }

        // Créer le nouvel enregistrement d'escadron
        const nouvelEscadron = await Escadron.create({
            nom,
            numero,
            description // Peut être null
        });

        // Réponse succès 201 Created
        return res.status(201).json({ message: 'Escadron créé avec succès', escadron: nouvelEscadron });

    } catch (error) {
        console.error('Erreur lors de la création de l\'escadron :', error);
        // Gérer les erreurs de validation Sequelize (ex: contrainte unique violée si non gérée ci-dessus)
         if (error.name === 'SequelizeValidationError') {
             return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
         }
         if (error.name === 'SequelizeUniqueConstraintError') {
             return res.status(409).json({ message: `Un escadron avec le numéro ${numero} existe déjà.` });
         }
        return res.status(500).json({ message: 'Erreur serveur lors de la création de l\'escadron.' });
    }
});

// GET /api/escadrons
// Obtenir la liste de tous les escadrons
// Accessible à tous les utilisateurs authentifiés
router.get('/', authenticateJWT, async (req, res) => {
    // TODO: Logique de permission et filtrage :
    // - Si req.user.role est 'Admin': Récupérer tous les escadrons (éventuellement avec filtres de requête)
    // - Si req.user.role est 'Standard' et est un responsable d'Escadron: Récupérer uniquement son escadron.
    // - Si req.user.role est 'Standard' et n'est pas responsable d'Escadron : Renvoyer une liste vide ou 403 ? (Dépend de votre plan)
     console.log(`TODO: Implémenter le filtrage des escadrons basé sur l'utilisateur ${req.user.username} (${req.user.role}) et les paramètres de requête.`);

     const whereClause = {}; // Initialiser l'objet de filtre

     if (req.user.role === 'Standard') {
         // TODO: Récupérer le cadre de l'utilisateur Standard
         // const cadreUtilisateur = await Cadre.findByPk(req.user.cadre_id, { attributes: ['responsibility_scope', 'responsible_escadron_id'] });
         // if (cadreUtilisateur && cadreUtilisateur.responsibility_scope === 'Escadron' && cadreUtilisateur.responsible_escadron_id) {
         //      whereClause.id = cadreUtilisateur.responsible_escadron_id; // Filtrer par l'escadron dont il est responsable
         // } else {
         //      // Si Standard mais pas responsable d'escadron, renvoyer une liste vide
         //      return res.status(200).json([]); // Ou 403 Forbidden si vous préférez
         // }
          // Pour l'instant, sans la logique ci-dessus, un Standard verra tous les escadrons (ce qui est probablement acceptable pour une liste)
          // Mettez en place la logique TODO ci-dessus si nécessaire !
     } else if (req.user.role === 'Admin') {
         // Pour un Admin, appliquer les filtres de requête si présents
          if (req.query.numero) { whereClause.numero = req.query.numero; }
          if (req.query.nom) { whereClause.nom = { [Op.like]: `%${req.query.nom}%` }; } // Exemple de recherche partielle
          // Ajouter d'autres filtres si nécessaire
     }


    try {
        // Récupérer la liste des escadrons avec les filtres appliqués
        const escadrons = await Escadron.findAll({
            where: whereClause, // Appliquer les filtres basés sur la permission et les query params
            attributes: ['id', 'nom', 'numero', 'description'], // Sélectionner les champs à afficher
            // TODO: Inclure les élèves ou les cadres liés si nécessaire (Escadron.hasMany(Eleve), Escadron.hasOne(Cadre, as: 'Responsable'))
            // include: [{ model: Eleve, as: 'Eleves' }],
            order: [['numero', 'ASC']] // Trier par numéro d'escadron
            // TODO: Ajouter la pagination si la liste peut être très longue
        });

        return res.status(200).json(escadrons); // Renvoyer la liste des escadrons
    } catch (error) {
        console.error('Erreur lors de la récupération des escadrons :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération des escadrons.' });
    }
});

// GET /api/escadrons/:id
// Obtenir les détails d'un escadron spécifique par son ID
// Accessible à tous les utilisateurs authentifiés (avec vérification de permission)
router.get('/:id', authenticateJWT, async (req, res) => {
    const escadronId = req.params.id; // Récupérer l'ID de l'escadron depuis l'URL

    // TODO: Logique de permission :
    // - Si req.user.role est 'Standard' et est un responsable d'Escadron: Vérifier si cet ID correspond à son escadron responsable.
    // - Sinon : Renvoyer 403 Forbidden.
    // - Si req.user.role est 'Admin': Peut voir n'importe quel escadron.
     console.log(`TODO: Implémenter la vérification si l'utilisateur ${req.user.username} (${req.user.role}) a le droit de voir l'escadron ID ${escadronId}.`);

     if (req.user.role === 'Standard') {
         let isAuthorized = false;
         // TODO: Récupérer le cadre de l'utilisateur Standard
         // const cadreUtilisateur = await Cadre.findByPk(req.user.cadre_id, { attributes: ['responsibility_scope', 'responsible_escadron_id'] });
         // if (cadreUtilisateur && cadreUtilisateur.responsibility_scope === 'Escadron' && cadreUtilisateur.responsible_escadron_id == escadronId) {
         //      isAuthorized = true; // L'utilisateur Standard est responsable de cet escadron
         // }

         if (!isAuthorized) {
             return res.sendStatus(403); // Forbidden si non autorisé
         }
     }
     // Si Admin, ou si Standard et autorisé, continuer.


    try {
        // Rechercher l'escadron par sa clé primaire (ID)
        const escadron = await Escadron.findByPk(escadronId, {
             attributes: ['id', 'nom', 'numero', 'description'], // Sélectionner les champs
             // TODO: Inclure les élèves ou les cadres liés si nécessaire
             // include: [{ model: Eleve, as: 'Eleves' }],
        });

        if (!escadron) {
            return res.status(404).json({ message: 'Escadron non trouvé.' });
        }

        return res.status(200).json(escadron); // Renvoyer les détails de l'escadron
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'escadron :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'escadron.' });
    }
});

// PUT /api/escadrons/:id
// Mettre à jour un escadron existant par son ID
// Accessible UNIQUEMENT aux Admins
router.put('/:id', authenticateJWT, isAdmin, async (req, res) => {
    const escadronId = req.params.id;
    // Les champs potentiellement mis à jour
    const { nom, numero, description } = req.body; // Adaptez les champs

    // TODO: Validation supplémentaire des champs mis à jour (ex: format numero)

    try {
        // 1. Rechercher l'escadron à mettre à jour
        const escadron = await Escadron.findByPk(escadronId);

        if (!escadron) {
            return res.status(404).json({ message: 'Escadron non trouvé.' });
        }

        // 2. Mettre à jour les champs de l'escadron trouvé
        // Attention : Si le numero est unique et modifiable, ajoutez une vérification d'unicité si il est fourni et différent.
        escadron.nom = nom !== undefined ? nom : escadron.nom;
        escadron.numero = numero !== undefined ? numero : escadron.numero; // Prudence si numero est unique
        escadron.description = description !== undefined ? description : escadron.description;

        // 3. Sauvegarder les changements
        await escadron.save();

        // Recharger avec les relations pour la réponse si besoin
        const escadronMisAJour = await Escadron.findByPk(escadron.id, {
             attributes: ['id', 'nom', 'numero', 'description'], // Sélectionner les champs pour la réponse
             // TODO: Inclure les relations si nécessaire
        });


        return res.status(200).json({ message: 'Escadron mis à jour avec succès', escadron: escadronMisAJour });

    } catch (error) {
        console.error('Erreur lors de la mise à jour de l\'escadron :', error);
         // Gérer l'erreur de contrainte unique si numero est modifiable et dupliqué
         if (error.name === 'SequelizeUniqueConstraintError') {
             return res.status(409).json({ message: `Un escadron avec le numéro ${numero} existe déjà.` });
         }
          // Gérer les erreurs de validation Sequelize
         if (error.name === 'SequelizeValidationError') {
             return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
         }
        return res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'escadron.' });
    }
});

// DELETE /api/escadrons/:id
// Supprimer un escadron par son ID
// Accessible UNIQUEMENT aux Admins
router.delete('/:id', authenticateJWT, isAdmin, async (req, res) => {
    const escadronId = req.params.id;

    try {
        // 1. Rechercher l'escadron à supprimer (optionnel)
        const escadron = await Escadron.findByPk(escadronId);

        if (!escadron) {
            return res.status(404).json({ message: 'Escadron non trouvé.' });
        }

        // TODO: Vérifier les dépendances (ex: élèves liés, cadres responsables liés).
        // Si vous avez défini onDelete: 'SET NULL' ou 'CASCADE' dans les migrations pour les FK
        // (par ex. Eleve.escadron_id, Cadre.responsible_escadron_id), Sequelize gérera automatiquement.
        // Sinon, vous devrez les gérer ici (ex: mettre eleve.escadron_id à null ou supprimer les élèves).
         console.log(`TODO: Gérer la suppression des élèves liés ou autres dépendances pour l'escadron ID ${escadronId}.`);


        // 2. Supprimer l'escadron
        await escadron.destroy(); // Supprime l'enregistrement

        // Gérer les éventuelles conséquences sur les données liées
        // Sequelize gère les CASCADE/SET NULL définis dans les migrations

        return res.status(200).json({ message: 'Escadron supprimé avec succès' });

    } catch (error) {
        console.error('Erreur lors de la suppression de l\'escadron :', error);
        return res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'escadron.' });
    }
});


// TODO: Ajouter d'autres routes si nécessaire, par exemple :
// - GET /api/escadrons/:id/eleves : Lister les élèves d'un escadron spécifique (accessible avec permission)


module.exports = router; // Exporter le routeur
