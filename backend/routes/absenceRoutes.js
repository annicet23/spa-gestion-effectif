// routes/absenceRoutes.js
const express = require('express');
const router = express.Router();
// Importez les modèles nécessaires (Absence, Cadre, Eleve, User)
const { Absence, Cadre, Eleve, User } = require('../models'); // Assurez-vous que tous les modèles nécessaires sont importés
// Importez vos middlewares d'authentification et d'autorisation
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
// Importez Op si vous utilisez des opérateurs Sequelize avancés (comme Op.in, Op.gte, Op.lte)
const { Op } = require('sequelize');

// --- ROUTES POUR LA GESTION DES ABSENCES ---

// POST /api/absences
// Enregistrer une nouvelle absence ou indisponibilité
// Accessible à tous les utilisateurs authentifiés (Standard ou Admin)
router.post('/', authenticateJWT, async (req, res) => {
  // Les données attendues dans le corps de la requête
  const { cadre_id, eleve_id, type, start_date, end_date, justification } = req.body;

  // Validation basique
  if (!type || !start_date) {
     return res.status(400).json({ message: 'Le type et la date de début sont requis.' });
  }
  // Validation : L'absence doit être liée à un cadre OU un élève, mais pas les deux, et au moins à un.
   if ((!cadre_id && !eleve_id) || (cadre_id && eleve_id)) {
       return res.status(400).json({ message: 'Une absence doit être liée soit à un cadre (cadre_id), soit à un élève (eleve_id), mais pas aux deux.' });
   }

   // TODO: Logique de permission plus fine :
   // - Si req.user.role est 'Standard': Vérifier que le cadre_id ou eleve_id soumis correspond
   //   à la personne (Cadre/Élève) liée au compte de l'utilisateur Standard (via user.cadre_id ou user.eleve_id s'il existe).
   //   Un utilisateur Standard peut soumettre une absence que pour lui-même (s'il est Cadre)
   //   ou potentiellement pour les personnes dont il a la responsabilité (si cette logique est dans votre plan et modélisée).
   // - Si req.user.role est 'Admin': L'Admin peut soumettre une absence pour n'importe quel cadre ou élève.
    console.log(`TODO: Implémenter la vérification si l'utilisateur ${req.user.username} (${req.user.role}) a le droit de soumettre une absence pour cadre_id ${cadre_id} ou eleve_id ${eleve_id}.`);
    // Pour l'instant, on continue si l'utilisateur est authentifié.


  try {
    // Créer le nouvel enregistrement d'absence
    // Le statut par défaut sera 'Soumise' selon le modèle
    const nouvelleAbsence = await Absence.create({
      cadre_id,
      eleve_id,
      type,
      start_date,
      end_date, // Peut être nulle
      justification // Peut être nulle
      // submitted_by_id: req.user.id // Si vous avez ajouté ce champ au modèle et à la migration
    });

    // Réponse succès
    // Inclure les données du cadre/élève associé pour une meilleure réponse
    const absenceAvecPersonne = await Absence.findByPk(nouvelleAbsence.id, {
      include: [
        { model: Cadre, attributes: ['id', 'matricule', 'nom', 'prenom'], required: false }, // required: false pour ne pas échouer si cadre_id est null
        { model: Eleve, attributes: ['id', 'incorporation', 'nom', 'prenom'], required: false } // required: false pour ne pas échouer si eleve_id est null
      ]
    });

    return res.status(201).json({ message: 'Absence enregistrée avec succès', absence: absenceAvecPersonne });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'absence :', error);
     // Gérer les erreurs de validation Sequelize (ex: ENUM invalide)
     if (error.name === 'SequelizeValidationError') {
         return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
     }
     // Gérer l'erreur de la validation custom checkOnlyOnePersonId (si vous l'avez implémentée au niveau du modèle)
     // if (error.message === 'Une absence doit être liée soit à un cadre, soit à un élève, mais pas aux deux.') {
     //      return res.status(400).json({ message: error.message });
     // }
    return res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement de l\'absence.' });
  }
});

// GET /api/absences
// Obtenir la liste de toutes les absences (avec filtres)
// Accessible à tous les utilisateurs authentifiés
router.get('/', authenticateJWT, async (req, res) => {
    // TODO: Logique de permission plus fine :
    // - Si req.user.role est 'Admin': Récupérer toutes les absences (éventuellement avec filtres de requête).
    // - Si req.user.role est 'Standard': Récupérer uniquement les absences liées à la personne (Cadre/Élève)
    //   correspondant à l'utilisateur Standard, ou les personnes dont il est responsable (si modélisé).
     console.log(`TODO: Implémenter le filtrage des absences basé sur l'utilisateur ${req.user.username} (${req.user.role}) et les paramètres de requête (date range, type, etc.).`);

    // TODO: Implémenter les filtres basés sur req.query (ex: ?startDate=...&endDate=...&type=...)
    const whereClause = {}; // Initialiser l'objet de filtre
    // Exemple de filtre par date de début :
    // if (req.query.startDate) {
    //     whereClause.start_date = { [Op.gte]: new Date(req.query.startDate) };
    // }
    // Exemple de filtre par date de fin :
    // if (req.query.endDate) {
    //      whereClause.end_date = { [Op.lte]: new Date(req.query.endDate) };
    // }
    // Exemple de filtre par type :
    // if (req.query.type) {
    //      whereClause.type = req.query.type; // Assurez-vous que le type fourni est valide
    // }
    // Exemple de filtre par ID personne (pour Admin listant les absences d'une personne spécifique)
    // if (req.query.cadreId && req.user.role === 'Admin') { whereClause.cadre_id = req.query.cadreId; }
    // if (req.query.eleveId && req.user.role === 'Admin') { whereClause.eleve_id = req.query.eleveId; }


  try {
    // Récupérer les absences avec les informations du cadre ou de l'élève associé
    const absences = await Absence.findAll({
       where: whereClause, // Appliquer les filtres si définis
       include: [
         { model: Cadre, attributes: ['id', 'matricule', 'nom', 'prenom'], required: false },
         { model: Eleve, attributes: ['id', 'incorporation', 'nom', 'prenom'], required: false }
         // Inclure l'utilisateur qui a soumis/validé si ces champs existent et relations sont définies
         // { model: User, as: 'SubmittedBy', attributes: ['id', 'username'], required: false },
         // { model: User, as: 'ValidatedBy', attributes: ['id', 'username'], required: false },
       ],
       order: [['start_date', 'DESC']] // Trier par date de début (du plus récent au plus ancien)
       // Pagination si besoin : limit, offset
    });

    return res.status(200).json(absences);
  } catch (error) {
    console.error('Erreur lors de la récupération des absences :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération des absences.' });
  }
});

// GET /api/absences/:id
// Obtenir les détails d'une absence spécifique par son ID
// Accessible à tous les utilisateurs authentifiés (avec vérification de permission)
router.get('/:id', authenticateJWT, async (req, res) => {
  try {
    const absenceId = req.params.id;

    // Rechercher l'absence par sa clé primaire (ID)
    const absence = await Absence.findByPk(absenceId, {
       include: [ // Inclure les infos liées
         { model: Cadre, attributes: ['id', 'matricule', 'nom', 'prenom'], required: false },
         { model: Eleve, attributes: ['id', 'incorporation', 'nom', 'prenom'], required: false }
         // Inclure l'utilisateur qui a soumis/validé si ces champs existent et relations sont définies
         // { model: User, as: 'SubmittedBy', attributes: ['id', 'username'], required: false },
         // { model: User, as: 'ValidatedBy', attributes: ['id', 'username'], required: false },
       ]
    });

    if (!absence) {
      return res.status(404).json({ message: 'Absence non trouvée.' });
    }

    // TODO: Logique de permission :
    // - Si req.user.role est 'Standard': Vérifier si l'absence est liée à la personne
    //   correspondant à l'utilisateur Standard, ou aux personnes dont il est responsable.
    //   Si non autorisé, renvoyer 403.
     console.log(`TODO: Implémenter la vérification si l'utilisateur ${req.user.username} (${req.user.role}) a le droit de voir l'absence ${absenceId}.`);
     // Exemple basique (si Standard ne voit que ses absences, et si user.cadre_id existe et correspond)
     // if (req.user.role === 'Standard' && req.user.cadre_id && absence.cadre_id !== req.user.cadre_id) {
     //    // Vous devriez avoir une logique plus complexe pour les élèves ou les responsabilités multiples
     //    return res.sendStatus(403); // Forbidden
     // }


    return res.status(200).json(absence);
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'absence :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'absence.' });
  }
});


// PUT /api/absences/:id
// Mettre à jour un enregistrement d'absence
// Accessible aux utilisateurs authentifiés (avec vérification de permission et statut)
router.put('/:id', authenticateJWT, async (req, res) => {
   const absenceId = req.params.id;
   // Champs potentiellement modifiables (le statut ne devrait changer que via validation par Admin)
   const { type, start_date, end_date, justification } = req.body;

   // TODO: Logique de permission et statut :
   // - Si req.user.role est 'Admin': L'Admin peut tout modifier.
   // - Si req.user.role est 'Standard': Peut-être ne peut modifier que si submitted_by_id est lui-même
   //   ET si le statut de l'absence est 'Soumise' (pas encore validée/rejetée).
    console.log(`TODO: Implémenter la vérification si l'utilisateur ${req.user.username} (${req.user.role}) a le droit de modifier l'absence ${absenceId} et si son statut (${req.body.status} si fourni, ou absence.status) permet la modification.`);


   try {
       // 1. Rechercher l'absence à mettre à jour
       const absence = await Absence.findByPk(absenceId);

       if (!absence) {
         return res.status(404).json({ message: 'Absence non trouvée.' });
       }

        // TODO: Appliquer la logique de permission ici avant de modifier :
        // if (req.user.role !== 'Admin' && absence.status !== 'Soumise') {
        //     return res.status(403).json({ message: 'Seul un Admin peut modifier une absence non soumise.' });
        // }
        // if (req.user.role !== 'Admin' && absence.submitted_by_id !== req.user.id) {
        //     return res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres soumissions.' });
        // }
        // Attention: Si l'Admin modifie le statut, cela ne devrait pas passer par cette route,
        // mais plutôt par une route de validation dédiée. Cette route PUT est pour les corrections.

       // 2. Mettre à jour les champs (ne pas permettre de changer cadre_id, eleve_id, status, submitted_by_id via cette route PUT)
       absence.type = type !== undefined ? type : absence.type;
       absence.start_date = start_date !== undefined ? start_date : absence.start_date;
       absence.end_date = end_date !== undefined ? end_date : absence.end_date; // Peut être nulle
       absence.justification = justification !== undefined ? justification : absence.justification; // Peut être nulle

       // 3. Sauvegarder les changements
       await absence.save();

       // Recharger avec les relations pour la réponse si besoin
       const absenceMiseAJour = await Absence.findByPk(absence.id, {
         include: [
            { model: Cadre, attributes: ['id', 'matricule', 'nom', 'prenom'], required: false },
            { model: Eleve, attributes: ['id', 'incorporation', 'nom', 'prenom'], required: false }
         ]
       });


       return res.status(200).json({ message: 'Absence mise à jour avec succès', absence: absenceMiseAJour });

   } catch (error) {
       console.error('Erreur lors de la mise à jour de l\'absence :', error);
       // Gérer les erreurs de validation Sequelize (ex: ENUM invalide)
       if (error.name === 'SequelizeValidationError') {
           return res.status(400).json({ message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', ') });
       }
       return res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'absence.' });
   }
});


// DELETE /api/absences/:id
// Supprimer un enregistrement d'absence
// Accessible aux utilisateurs authentifiés (avec vérification de permission et statut)
router.delete('/:id', authenticateJWT, async (req, res) => {
   const absenceId = req.params.id;

    // TODO: Logique de permission et statut :
    // - Si req.user.role est 'Admin': L'Admin peut tout supprimer.
    // - Si req.user.role est 'Standard': Peut-être ne peut supprimer que si submitted_by_id est lui-même
    //   ET si le statut de l'absence est 'Soumise'.
     console.log(`TODO: Implémenter la vérification si l'utilisateur ${req.user.username} (${req.user.role}) a le droit de supprimer l'absence ${absenceId} et si son statut permet la suppression.`);


   try {
       // 1. Rechercher l'absence à supprimer (pour vérifier permission/statut si nécessaire)
       const absence = await Absence.findByPk(absenceId);

       if (!absence) {
         return res.status(404).json({ message: 'Absence non trouvée.' });
       }

        // TODO: Appliquer la logique de permission ici avant de supprimer :
        // if (req.user.role !== 'Admin' && absence.status !== 'Soumise') {
        //     return res.status(403).json({ message: 'Seul un Admin peut supprimer une absence non soumise.' });
        // }
        // if (req.user.role !== 'Admin' && absence.submitted_by_id !== req.user.id) {
        //     return res.status(403).json({ message: 'Vous ne pouvez supprimer que vos propres soumissions.' });
        // }


       // 2. Supprimer l'absence
       await absence.destroy();

       return res.status(200).json({ message: 'Absence supprimée avec succès' });

   } catch (error) {
       console.error('Erreur lors de la suppression de l\'absence :', error);
       return res.status(500).json({ message: 'Erreur serveur lors de la suppression de l\'absence.' });
   }
});


module.exports = router; // Exporter le routeur
