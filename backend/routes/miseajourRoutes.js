'use strict';

const express = require('express');
const router = express.Router();
const { MiseAJour, User, Cadre, Absence, HistoriqueStatsJournalieresCadres, Eleve } = require('../models');
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');
const miseAJourController = require('../controllers/miseAJourController');
const Sequelize = require('sequelize');

// Importez la fonction de calcul des statistiques depuis historicalTasks.js
const { calculateCurrentAggregateStats } = require('../tasks/historicalTasks');

// Middleware d'authentification appliqué à toutes les routes de ce routeur
router.use(authenticateJWT);

// **FONCTION UTILITAIRE POUR LA MISE À JOUR DES STATUTS**
async function updateCadreStatuses(cadreSoumetteur, dateMiseAJour, logPrefix = '') {
  if (!cadreSoumetteur) {
    console.warn(`${logPrefix} - Cadre soumetteur manquant, skip de la mise à jour des statuts.`);
    return { updated: 0, message: 'Cadre soumetteur manquant' };
  }

  const scopeType = cadreSoumetteur.responsibility_scope;
  let cadresToUpdate = [];

  console.log(`${logPrefix} - Scope de responsabilité du cadre: ${scopeType}`);

  try {
    if (scopeType === 'Service' && cadreSoumetteur.service) {
      console.log(`${logPrefix} - Recherche de cadres pour le service: ${cadreSoumetteur.service}`);
      cadresToUpdate = await Cadre.findAll({
        where: {
          service: cadreSoumetteur.service,
          // Ne mettre à jour que les cadres qui n'ont pas d'absence active
          statut_absence: { [Op.or]: ['Présent', null] }
        },
        attributes: ['id']
      });
      console.log(`${logPrefix} - Trouvé ${cadresToUpdate.length} cadres éligibles dans le service.`);

    } else if (scopeType === 'Escadron' && cadreSoumetteur.responsible_escadron_id) {
      console.log(`${logPrefix} - Recherche de cadres pour l'escadron: ${cadreSoumetteur.responsible_escadron_id}`);
      cadresToUpdate = await Cadre.findAll({
        where: {
          responsible_escadron_id: cadreSoumetteur.responsible_escadron_id,
          // Ne mettre à jour que les cadres qui n'ont pas d'absence active
          statut_absence: { [Op.or]: ['Présent', null] }
        },
        attributes: ['id']
      });
      console.log(`${logPrefix} - Trouvé ${cadresToUpdate.length} cadres éligibles dans l'escadron.`);

    } else {
      console.warn(`${logPrefix} - Scope de responsabilité "${scopeType}" invalide ou incomplet. Skip de la mise à jour.`);
      return { updated: 0, message: `Scope invalide: ${scopeType}` };
    }

    if (cadresToUpdate.length > 0) {
      const cadreIds = cadresToUpdate.map(c => c.id);
      console.log(`${logPrefix} - Mise à jour des statuts pour les cadres IDs: ${cadreIds.join(', ')}`);

      const [updatedCount] = await Cadre.update(
        {
          statut_absence: 'Présent',
          date_debut_absence: null,
          motif_absence: null,
          motif_details: null,
          timestamp_derniere_maj_statut: new Date()
        },
        {
          where: { id: { [Op.in]: cadreIds } },
          fields: ['statut_absence', 'date_debut_absence', 'motif_absence', 'motif_details', 'timestamp_derniere_maj_statut']
        }
      );

      console.log(`${logPrefix} - ${updatedCount} cadres mis à jour à 'Présent' pour l'entité ${scopeType} (${cadreSoumetteur.service || cadreSoumetteur.responsible_escadron_id}) à la date ${dateMiseAJour}.`);
      return { updated: updatedCount, message: `${updatedCount} cadres mis à jour` };
    }

    return { updated: 0, message: 'Aucun cadre éligible trouvé' };

  } catch (error) {
    console.error(`${logPrefix} - Erreur lors de la mise à jour des statuts:`, error);
    throw error;
  }
}

// **FONCTION UTILITAIRE POUR RÉCUPÉRER ET VALIDER UN CADRE UTILISATEUR**
async function getUserCadre(userId, logContext = '') {
  try {
    const userWithCadre = await User.findByPk(userId, {
      include: [{
        model: Cadre,
        as: 'cadre',
        attributes: ['id', 'service', 'responsibility_scope', 'responsible_escadron_id']
      }]
    });

    if (!userWithCadre?.cadre) {
      console.warn(`${logContext} - Utilisateur ID ${userId} n'est pas lié à un cadre valide.`);
      return { success: false, error: 'Utilisateur non lié à un cadre valide', cadre: null };
    }

    return { success: true, cadre: userWithCadre.cadre, user: userWithCadre };
  } catch (error) {
    console.error(`${logContext} - Erreur lors de la récupération du cadre utilisateur:`, error);
    return { success: false, error: 'Erreur de base de données', cadre: null };
  }
}

// --- ROUTES POUR LA GESTION DES MISES À JOUR / VALIDATION ---

// POST /api/mises-a-jour/submit
router.post('/submit', async (req, res) => {
  console.log('[MiseAJourRoutes] POST /submit - Début de la soumission de la mise à jour.');
  const { update_date } = req.body;

  if (!update_date) {
    console.warn('[MiseAJourRoutes] POST /submit - Erreur: update_date est manquant.');
    return res.status(400).json({ message: 'La date de la mise à jour (update_date) est requise.' });
  }

  try {
    console.log(`[MiseAJourRoutes] POST /submit - Recherche de l'utilisateur avec cadre pour User ID: ${req.user.id}`);

    const userCadreResult = await getUserCadre(req.user.id, '[MiseAJourRoutes] POST /submit');
    if (!userCadreResult.success) {
      return res.status(403).json({ message: userCadreResult.error });
    }

    const cadreIdSoumetteur = userCadreResult.cadre.id;
    console.log(`[MiseAJourRoutes] POST /submit - Cadre Soumetteur ID: ${cadreIdSoumetteur}, Date de mise à jour: ${update_date}`);

    const nouvelleSoumission = await MiseAJour.create({
      submitted_by_id: req.user.id,
      update_date: update_date,
      cadre_id: cadreIdSoumetteur,
      status: 'Validée',
      validated_by_id: req.user.id,
      validation_date: new Date()
    });
    console.log(`[MiseAJourRoutes] POST /submit - Nouvelle soumission créée avec succès. ID: ${nouvelleSoumission.id}, Statut: ${nouvelleSoumission.status}`);

    const soumissionAvecDetails = await MiseAJour.findByPk(nouvelleSoumission.id, {
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
        { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction', 'responsibility_scope', 'responsible_escadron_id'] }
      ]
    });
    console.log(`[MiseAJourRoutes] POST /submit - Détails de la soumission récupérés pour ID: ${soumissionAvecDetails.id}`);

    if (nouvelleSoumission.status === 'Validée') {
      console.log(`[MiseAJourRoutes] POST /submit - La soumission est "Validée". Déclenchement de la mise à jour des statuts des personnes.`);
      const cadreSoumetteur = soumissionAvecDetails.Cadre;
      const dateMiseAJour = nouvelleSoumission.update_date;

      try {
        const updateResult = await updateCadreStatuses(cadreSoumetteur, dateMiseAJour, '[MiseAJourRoutes] POST /submit');
        console.log(`[MiseAJourRoutes] POST /submit - Résultat de la mise à jour: ${updateResult.message}`);
      } catch (updateError) {
        console.error('[MiseAJourRoutes] POST /submit - Erreur lors de la mise à jour des statuts:', updateError);
        // Ne pas faire échouer la soumission si la mise à jour des statuts échoue
      }
    }

    console.log('[MiseAJourRoutes] POST /submit - Fin de la soumission de la mise à jour avec succès.');
    return res.status(201).json({
      message: 'Mise à jour soumise avec succès',
      soumission: soumissionAvecDetails
    });

  } catch (error) {
    console.error('[MiseAJourRoutes] POST /submit - Erreur lors de la soumission de la mise à jour :', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', '),
        errors: error.errors
      });
    }
    return res.status(500).json({ message: 'Erreur serveur lors de la soumission de la mise à jour.' });
  }
});

// GET /api/mises-a-jour/status-for-cadre
router.get('/status-for-cadre', async (req, res) => {
  console.log('[MiseAJourRoutes] GET /status-for-cadre - Vérification du statut de soumission.');
  const { date, cadreId } = req.query;

  if (!date) {
    console.warn('[MiseAJourRoutes] GET /status-for-cadre - Erreur: Le paramètre "date" est manquant.');
    return res.status(400).json({ message: 'Le paramètre "date" est requis.' });
  }

  try {
    let targetCadreId = cadreId;
    console.log(`[MiseAJourRoutes] GET /status-for-cadre - Date demandée: ${date}, Cadre ID fourni: ${cadreId || 'N/A'}`);

    if (req.user.role !== 'Admin') {
      console.log(`[MiseAJourRoutes] GET /status-for-cadre - Utilisateur non-Admin (Rôle: ${req.user.role}). Récupération du cadre de l'utilisateur.`);

      const userCadreResult = await getUserCadre(req.user.id, '[MiseAJourRoutes] GET /status-for-cadre');
      if (!userCadreResult.success) {
        return res.status(403).json({ message: userCadreResult.error });
      }

      targetCadreId = userCadreResult.cadre.id;
      console.log(`[MiseAJourRoutes] GET /status-for-cadre - Cadre de l'utilisateur (ID: ${req.user.id}): ${targetCadreId}`);

      if (cadreId && parseInt(cadreId, 10) !== targetCadreId) {
        console.warn(`[MiseAJourRoutes] GET /status-for-cadre - Utilisateur Standard ${req.user.username} (ID: ${req.user.id}) a tenté de vérifier le statut pour un cadre différent (ID: ${cadreId}).`);
        return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à vérifier le statut de soumission pour ce cadre.' });
      }
    } else {
      if (!targetCadreId) {
        console.warn('[MiseAJourRoutes] GET /status-for-cadre - Erreur: Pour un administrateur, cadreId est requis si non lié à un cadre spécifique.');
        return res.status(400).json({ message: 'Pour un administrateur, le paramètre "cadreId" est requis.' });
      }
    }

    const soumissionExistante = await MiseAJour.findOne({
      where: {
        cadre_id: targetCadreId,
        update_date: date,
        status: 'Validée'
      }
    });

    const isSubmitted = !!soumissionExistante;
    console.log(`[MiseAJourRoutes] GET /status-for-cadre - Statut de soumission pour cadre ${targetCadreId} à la date ${date}: ${isSubmitted ? 'Soumis' : 'Non Soumis'}`);
    return res.status(200).json({ submitted: isSubmitted });

  } catch (error) {
    console.error('[MiseAJourRoutes] GET /status-for-cadre - Erreur lors de la vérification du statut de soumission :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la vérification du statut de soumission.' });
  }
});

// GET /api/mises-a-jour/daily-updates
router.get('/daily-updates', async (req, res) => {
  console.log('[MiseAJourRoutes] GET /daily-updates - Récupération des mises à jour quotidiennes.');
  const { date } = req.query;

  const today = new Date();
  const targetDate = date ? new Date(date) : today;

  const startOfDayUTC = getHistoricalDayStartTime(targetDate);
  const endOfDayUTC = getHistoricalDayEndTime(targetDate);

  console.log(`[MiseAJourRoutes] GET /daily-updates - Période de recherche (UTC): ${startOfDayUTC.toISOString()} à ${endOfDayUTC.toISOString()}`);

  try {
    const whereClause = {
      created_at: {
        [Op.between]: [startOfDayUTC, endOfDayUTC]
      }
    };

    if (req.user.role === 'Standard') {
      const userCadreResult = await getUserCadre(req.user.id, '[MiseAJourRoutes] GET /daily-updates');
      if (!userCadreResult.success) {
        return res.status(403).json({ message: userCadreResult.error });
      }
      whereClause.cadre_id = userCadreResult.cadre.id;
      console.log(`[MiseAJourRoutes] GET /daily-updates - Filtrage pour utilisateur Standard, cadre ID: ${userCadreResult.cadre.id}`);
    }

    const soumissions = await MiseAJour.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
        { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
        { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
      ],
      order: [['created_at', 'DESC']],
    });

    const response = {
      date: targetDate.toISOString().split('T')[0],
      completed: soumissions.filter(s => s.status === 'Validée'),
      pending: soumissions.filter(s => s.status === 'En attente'),
      rejected: soumissions.filter(s => s.status === 'Rejetée'),
      total: soumissions.length
    };

    console.log(`[MiseAJourRoutes] GET /daily-updates - Retour de ${response.completed.length} soumissions complétées et ${response.pending.length} en attente.`);
    res.status(200).json(response);

  } catch (error) {
    console.error('[MiseAJourRoutes] GET /daily-updates - Erreur lors de la récupération des mises à jour quotidiennes :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des mises à jour quotidiennes.' });
  }
});

// GET /api/mises-a-jour/daily-stats
router.get('/daily-stats', async (req, res) => {
  console.log('[MiseAJourRoutes] GET /daily-stats - Récupération des statistiques journalières.');
  try {
    const { date } = req.query;
    if (!date) {
      console.warn('[MiseAJourRoutes] GET /daily-stats - Erreur: Le paramètre "date" est requis.');
      return res.status(400).json({ message: 'Le paramètre "date" est requis.' });
    }

    const stats = await HistoriqueStatsJournalieresCadres.findOne({
      where: { date: date }
    });
    console.log(`[MiseAJourRoutes] GET /daily-stats - Statistiques pour la date ${date}: ${stats ? 'Trouvées' : 'Non trouvées'}.`);

    if (!stats) {
      return res.status(404).json({ message: 'Statistiques non trouvées pour cette date.' });
    }

    res.status(200).json(stats);
  } catch (error) {
    console.error('[MiseAJourRoutes] GET /daily-stats - Erreur lors de la récupération des statistiques journalières :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques journalières.' });
  }
});

// POST /api/mises-a-jour/recalculate-stats
router.post('/recalculate-stats', isAdmin, async (req, res) => {
  console.log('[MiseAJourRoutes] POST /recalculate-stats - Déclenchement du recalcul des statistiques.');
  try {
    const { date } = req.body;
    if (!date) {
      console.warn('[MiseAJourRoutes] POST /recalculate-stats - Erreur: Le paramètre "date" est requis.');
      return res.status(400).json({ message: 'Le paramètre "date" est requis pour recalculer les statistiques.' });
    }
    console.log(`[MiseAJourRoutes] POST /recalculate-stats - Recalcul des statistiques pour la date: ${date}.`);
    await calculateCurrentAggregateStats(date);
    console.log(`[MiseAJourRoutes] POST /recalculate-stats - Statistiques agrégées recalculées avec succès pour la date ${date}.`);
    res.status(200).json({ message: `Statistiques agrégées recalculées pour la date ${date}.` });
  } catch (error) {
    console.error('[MiseAJourRoutes] POST /recalculate-stats - Erreur lors du recalcul des statistiques agrégées :', error);
    res.status(500).json({ message: 'Erreur lors du recalcul des statistiques agrégées.' });
  }
});

// GET /api/mises-a-jour
router.get('/', async (req, res) => {
  console.log(`[MiseAJourRoutes] GET / - Récupération de toutes les soumissions pour l'utilisateur ${req.user.username} (Rôle: ${req.user.role}).`);
  const whereClause = {};

  if (req.user.role === 'Standard') {
    try {
      const userCadreResult = await getUserCadre(req.user.id, '[MiseAJourRoutes] GET /');
      if (!userCadreResult.success) {
        console.warn(`[MiseAJourRoutes] GET / - Utilisateur Standard ${req.user.username} sans cadre lié, retournant un tableau vide.`);
        return res.status(200).json([]);
      }
      whereClause.cadre_id = userCadreResult.cadre.id;
      console.log(`[MiseAJourRoutes] GET / - Utilisateur Standard, filtrage par cadre_id: ${whereClause.cadre_id}.`);
    } catch (error) {
      console.error('[MiseAJourRoutes] GET / - Erreur lors de la récupération du cadre utilisateur pour le filtrage :', error);
      return res.status(500).json({ message: 'Erreur serveur lors de la détermination des permissions de filtrage.' });
    }
  }

  // Gestion des filtres de requête
  const allowedStatuses = ['En attente', 'Validée', 'Rejetée'];
  if (req.query.status && allowedStatuses.includes(req.query.status)) {
    whereClause.status = req.query.status;
    console.log(`[MiseAJourRoutes] GET / - Filtrage par statut: ${req.query.status}.`);
  } else if (req.query.status) {
    console.warn(`[MiseAJourRoutes] GET / - Statut de recherche invalide fourni : ${req.query.status}. Ignoré.`);
  }

  if (req.query.date) {
    whereClause.update_date = req.query.date;
    console.log(`[MiseAJourRoutes] GET / - Filtrage par date de mise à jour: ${req.query.date}.`);
  }

  if (req.query.startDate && req.query.endDate) {
    whereClause.update_date = {
      [Op.between]: [req.query.startDate, req.query.endDate]
    };
    console.log(`[MiseAJourRoutes] GET / - Filtrage par plage de dates: ${req.query.startDate} à ${req.query.endDate}.`);
  } else if (req.query.startDate) {
    whereClause.update_date = { [Op.gte]: req.query.startDate };
    console.log(`[MiseAJourRoutes] GET / - Filtrage par date de début: ${req.query.startDate}.`);
  } else if (req.query.endDate) {
    whereClause.update_date = { [Op.lte]: req.query.endDate };
    console.log(`[MiseAJourRoutes] GET / - Filtrage par date de fin: ${req.query.endDate}.`);
  }

  if (req.query.submittedById) {
    whereClause.submitted_by_id = req.query.submittedById;
    console.log(`[MiseAJourRoutes] GET / - Filtrage par ID du soumetteur: ${req.query.submittedById}.`);
  }

  if (req.query.cadreId) {
    whereClause.cadre_id = req.query.cadreId;
    console.log(`[MiseAJourRoutes] GET / - Filtrage par ID du cadre: ${req.query.cadreId}.`);
  }

  try {
    const soumissions = await MiseAJour.findAll({
      where: whereClause,
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
        { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
        { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
      ],
      order: [['update_date', 'DESC'], ['created_at', 'DESC']],
    });
    console.log(`[MiseAJourRoutes] GET / - Récupération de ${soumissions.length} soumissions avec succès.`);
    return res.status(200).json(soumissions);
  } catch (error) {
    console.error('[MiseAJourRoutes] GET / - Erreur lors de la récupération des soumissions :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération des soumissions.' });
  }
});

// GET /api/mises-a-jour/:id
router.get('/:id', async (req, res) => {
  const submissionId = req.params.id;
  console.log(`[MiseAJourRoutes] GET /:id - Récupération de la soumission ID: ${submissionId}.`);

  try {
    const soumission = await MiseAJour.findByPk(submissionId, {
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
        { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
        { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
      ]
    });

    if (!soumission) {
      console.warn(`[MiseAJourRoutes] GET /:id - Soumission ID: ${submissionId} non trouvée.`);
      return res.status(404).json({ message: 'Soumission non trouvée.' });
    }

    if (req.user.role === 'Standard') {
      console.log(`[MiseAJourRoutes] GET /:id - Utilisateur Standard, vérification des permissions pour soumission ID: ${submissionId}.`);

      const userCadreResult = await getUserCadre(req.user.id, '[MiseAJourRoutes] GET /:id');
      if (!userCadreResult.success || soumission.cadre_id !== userCadreResult.cadre.id) {
        console.warn(`[MiseAJourRoutes] GET /:id - Accès non autorisé pour l'utilisateur ${req.user.username} (ID: ${req.user.id}) à la soumission ID: ${submissionId}.`);
        return res.sendStatus(403);
      }
      console.log(`[MiseAJourRoutes] GET /:id - Accès autorisé pour l'utilisateur ${req.user.username} (ID: ${req.user.id}) à la soumission ID: ${submissionId}.`);
    }

    console.log(`[MiseAJourRoutes] GET /:id - Soumission ID: ${submissionId} récupérée avec succès.`);
    return res.status(200).json(soumission);
  } catch (error) {
    console.error('[MiseAJourRoutes] GET /:id - Erreur lors de la récupération de la soumission :', error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération de la soumission.' });
  }
});

// POST /api/mises-a-jour/:id/validate
router.post('/:id/validate', isAdmin, async (req, res) => {
  const submissionId = req.params.id;
  const { status } = req.body;
  console.log(`[MiseAJourRoutes] POST /:id/validate - Tente de valider/rejeter la soumission ID: ${submissionId} avec le statut: ${status}.`);

  const allowedStatuses = ['Validée', 'Rejetée'];
  if (!status || !allowedStatuses.includes(status)) {
    console.warn(`[MiseAJourRoutes] POST /:id/validate - Statut invalide fourni: "${status}".`);
    return res.status(400).json({ message: `Le statut ('Validée' ou 'Rejetée') est requis dans le corps de la requête.` });
  }

  try {
    const soumission = await MiseAJour.findByPk(submissionId, {
      include: [
        {
          model: Cadre,
          as: 'Cadre',
        }
      ]
    });

    if (!soumission) {
      console.warn(`[MiseAJourRoutes] POST /:id/validate - Soumission ID: ${submissionId} non trouvée.`);
      return res.status(404).json({ message: 'Soumission non trouvée.' });
    }

    if (soumission.status !== 'En attente') {
      console.warn(`[MiseAJourRoutes] POST /:id/validate - Soumission ID: ${submissionId} a déjà le statut "${soumission.status}".`);
      return res.status(400).json({ message: `Cette soumission a déjà le statut "${soumission.status}".` });
    }

    soumission.status = status;
    soumission.validated_by_id = req.user.id;
    soumission.validation_date = new Date();

    await soumission.save();
    console.log(`[MiseAJourRoutes] POST /:id/validate - Soumission ID: ${submissionId} mise à jour au statut "${status}".`);

    if (soumission.status === 'Validée') {
      console.log(`[MiseAJourRoutes] POST /:id/validate - La soumission est "Validée". Déclenchement de la mise à jour des statuts des personnes.`);
      const cadreSoumetteur = soumission.Cadre;
      const dateMiseAJour = soumission.update_date;

      try {
        const updateResult = await updateCadreStatuses(cadreSoumetteur, dateMiseAJour, '[MiseAJourRoutes] POST /:id/validate');
        console.log(`[MiseAJourRoutes] POST /:id/validate - Résultat de la mise à jour: ${updateResult.message}`);
      } catch (updateError) {
        console.error('[MiseAJourRoutes] POST /:id/validate - Erreur lors de la mise à jour des statuts:', updateError);
        // Ne pas faire échouer la validation si la mise à jour des statuts échoue
      }
    }

    const soumissionValidee = await MiseAJour.findByPk(soumission.id, {
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'username', 'nom', 'prenom'] },
        { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction'] },
        { model: User, as: 'ValidatedBy', attributes: ['id', 'username', 'nom', 'prenom'], required: false }
      ]
    });
    console.log(`[MiseAJourRoutes] POST /:id/validate - Réponse finale pour soumission ID: ${submissionId}.`);
    return res.status(200).json({
      message: `Soumission mise à jour au statut "${soumission.status}"`,
      soumission: soumissionValidee
    });

  } catch (error) {
    console.error('[MiseAJourRoutes] POST /:id/validate - Erreur lors de la validation individuelle de la soumission :', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', '),
        errors: error.errors
      });
    }
    return res.status(500).json({ message: 'Erreur serveur lors de la validation individuelle de la soumission.' });
  }
});

// POST /api/mises-a-jour/validate-batch
router.post('/validate-batch', isAdmin, async (req, res) => {
  const { submissionIds, status } = req.body;
  console.log(`[MiseAJourRoutes] POST /validate-batch - Tente de valider/rejeter par lot les soumissions IDs: [${submissionIds?.join(', ') || 'undefined'}] avec le statut: ${status}.`);

  if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
    console.warn('[MiseAJourRoutes] POST /validate-batch - Erreur: Liste d\'IDs de soumissions manquante ou vide.');
    return res.status(400).json({ message: 'Une liste d\'IDs de soumissions (submissionIds) est requise dans le corps de la requête.' });
  }

  const allowedStatuses = ['Validée', 'Rejetée'];
  if (!status || !allowedStatuses.includes(status)) {
    console.warn(`[MiseAJourRoutes] POST /validate-batch - Statut invalide fourni: "${status}".`);
    return res.status(400).json({ message: `Le statut ('Validée' ou 'Rejetée') est requis dans le corps de la requête.` });
  }

  try {
    const soumissions = await MiseAJour.findAll({
      where: {
        id: { [Op.in]: submissionIds },
        status: 'En attente'
      },
      include: [
        {
          model: User,
          as: 'SubmittedBy',
          attributes: ['id', 'username', 'cadre_id'],
          include: [
            {
              model: Cadre,
              as: 'cadre',
              attributes: ['id', 'service', 'responsibility_scope', 'responsible_escadron_id'],
            }
          ]
        }
      ]
    });
    console.log(`[MiseAJourRoutes] POST /validate-batch - Trouvé ${soumissions.length} soumissions en attente parmi celles fournies.`);

    if (soumissions.length === 0) {
      return res.status(404).json({ message: 'Aucune soumission en attente trouvée avec les IDs fournis.' });
    }

    const validation_date = new Date();
    const validated_by_id = req.user.id;

    const [updatedCount] = await MiseAJour.update(
      {
        status: status,
        validated_by_id: validated_by_id,
        validation_date: validation_date
      },
      {
        where: {
          id: { [Op.in]: soumissions.map(s => s.id) }
        }
      }
    );
    console.log(`[MiseAJourRoutes] POST /validate-batch - ${updatedCount} soumissions mises à jour au statut "${status}".`);

    if (status === 'Validée') {
      console.log(`[MiseAJourRoutes] POST /validate-batch - Déclenchement de la mise à jour des statuts des personnes pour les soumissions validées.`);

      const updateResults = [];
      for (const soumission of soumissions) {
        const soumetteurUser = soumission.SubmittedBy;
        const cadreSoumetteur = soumetteurUser?.cadre;
        const dateMiseAJour = soumission.update_date;

        if (!cadreSoumetteur) {
          console.warn(`[MiseAJourRoutes] POST /validate-batch - Soumetteur de la mise à jour (User ID: ${soumetteurUser?.id || 'N/A'}) non lié à un Cadre pour la soumission ${soumission.id}. Skipping status update.`);
          updateResults.push({ soumissionId: soumission.id, success: false, message: 'Cadre soumetteur non trouvé' });
          continue;
        }

        try {
          const updateResult = await updateCadreStatuses(cadreSoumetteur, dateMiseAJour, `[MiseAJourRoutes] POST /validate-batch - Soumission ${soumission.id}`);
          updateResults.push({ soumissionId: soumission.id, success: true, ...updateResult });
        } catch (updateError) {
          console.error(`[MiseAJourRoutes] POST /validate-batch - Erreur lors de la mise à jour des statuts pour la soumission ${soumission.id}:`, updateError);
          updateResults.push({ soumissionId: soumission.id, success: false, message: updateError.message });
        }
      }

      console.log(`[MiseAJourRoutes] POST /validate-batch - Résultats des mises à jour: ${updateResults.filter(r => r.success).length} succès, ${updateResults.filter(r => !r.success).length} échecs.`);
    }

    const soumissionsMisesAJour = await MiseAJour.findAll({
      where: { id: { [Op.in]: soumissions.map(s => s.id) } },
      include: [
        { model: User, as: 'SubmittedBy', attributes: ['id', 'username'] },
        { model: Cadre, as: 'Cadre', attributes: ['id', 'service', 'fonction', 'responsibility_scope', 'responsible_escadron_id'] },
        { model: User, as: 'ValidatedBy', attributes: ['id', 'username'], required: false }
      ]
    });
    console.log(`[MiseAJourRoutes] POST /validate-batch - Opération par lot terminée. Retour de ${soumissionsMisesAJour.length} soumissions mises à jour.`);
    return res.status(200).json({
      message: `${soumissionsMisesAJour.length} soumission(s) mise(s) à jour au statut "${status}".`,
      updatedSubmissions: soumissionsMisesAJour
    });

  } catch (error) {
    console.error('[MiseAJourRoutes] POST /validate-batch - Erreur lors de la validation groupée :', error);
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        message: 'Erreur de validation : ' + error.errors.map(e => e.message).join(', '),
        errors: error.errors
      });
    }
    return res.status(500).json({ message: 'Erreur serveur lors de la validation groupée.' });
  }
});

// GET /api/mises-a-jour/cadres/summary
router.get('/cadres/summary', async (req, res) => {
  console.log(`[MiseAJourRoutes] GET /cadres/summary - Vérification des permissions pour l'utilisateur ${req.user.username} (Rôle: ${req.user.role}).`);

  try {
    const date = req.query.date;
    if (!date) {
      console.warn('[MiseAJourRoutes] GET /cadres/summary - Erreur: Le paramètre de date est requis.');
      return res.status(400).json({ message: 'Le paramètre de date est requis.' });
    }

    const now = new Date();
    const currentHistoricalDateLabel = getHistoricalDate(now);

    console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Date demandée par frontend (req.query.date): ${req.query.date}`);
    console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Journée historique actuelle (calculée par API via getHistoricalDate): ${currentHistoricalDateLabel}`);
    console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Comparaison: "${req.query.date}" === "${currentHistoricalDateLabel}" ? ${req.query.date === currentHistoricalDateLabel}`);

    let stats;

    if (date === currentHistoricalDateLabel) {
      console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Condition VRAIE: Requête pour la journée historique actuelle (${date}). Calcul des stats en temps réel.`);
      const realTimeStats = await calculateCurrentAggregateStats();
      stats = {
        total_cadres: realTimeStats.total,
        absents_cadres: realTimeStats.absent,
        presents_cadres: realTimeStats.present,
        indisponibles_cadres: realTimeStats.indisponible,
        sur_le_rang_cadres: realTimeStats.surLeRang,
        date_snapshot: date
      };
      console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Stats en temps réel calculées: Total=${stats.total_cadres}, Absent=${stats.absents_cadres}, Indisponible=${stats.indisponibles_cadres}, Présent=${stats.presents_cadres}, Sur le rang=${stats.sur_le_rang_cadres}`);

    } else {
      console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Condition FAUSSE: Requête pour une journée historique passée (${date}). Récupération des stats du snapshot.`);
      stats = await HistoriqueStatsJournalieresCadres.findOne({
        where: { date_snapshot: date }
      });
      console.log(`[MiseAJourRoutes] [DEBUG_SUMMARY] Stats Historique trouvées: ${stats ? `Total=${stats.total_cadres}, Absent=${stats.absents_cadres}, Indisponible=${stats.indisponibles_cadres}` : 'Aucune.'}`);
    }

    if (!stats) {
      console.warn(`[MiseAJourRoutes] [DEBUG_SUMMARY] Aucune statistique trouvée pour la date ${date}. Retourne des zéros.`);
      return res.status(200).json({
        message: 'Aucune statistique trouvée pour cette date.',
        total_cadres: 0,
        absents_cadres: 0,
        presents_cadres: 0,
        indisponibles_cadres: 0,
        sur_le_rang_cadres: 0,
        date_snapshot: date
      });
    }

    console.log(`[MiseAJourRoutes] GET /cadres/summary - Retour des statistiques pour la date ${date}.`);
    return res.json(stats);

  } catch (error) {
    console.error('[MiseAJourRoutes] [ERROR_SUMMARY] Erreur lors de la récupération du résumé des cadres :', error);
    return res.status(500).json({ message: 'Erreur serveur interne.' });
  }
});

// GET /api/mises-a-jour/users/:userId/submissions
router.get('/users/:userId/submissions', async (req, res) => {
  const targetUserId = parseInt(req.params.userId, 10);
  const dateString = req.query.date;
  console.log(`[MiseAJourRoutes] GET /users/:userId/submissions - Récupération des soumissions pour User ID: ${targetUserId} à la date: ${dateString}.`);

  if (isNaN(targetUserId)) {
    console.warn('[MiseAJourRoutes] GET /users/:userId/submissions - Erreur: L\'ID utilisateur dans l\'URL est invalide.');
    return res.status(400).json({ message: 'L\'ID utilisateur dans l\'URL est invalide.' });
  }
  if (!dateString) {
    console.warn('[MiseAJourRoutes] GET /users/:userId/submissions - Erreur: Le paramètre "date" est manquant.');
    return res.status(400).json({ message: 'Le paramètre "date" est requis dans la chaîne de requête.' });
  }

  if (req.user.role !== 'Admin' && req.user.id !== targetUserId) {
    console.warn(`[MiseAJourRoutes] GET /users/:userId/submissions - Utilisateur ${req.user.username} (ID: ${req.user.id}, Rôle: ${req.user.role}) a tenté d'accéder aux soumissions de l'utilisateur ${targetUserId} sans permission.`);
    return res.status(403).json({ message: 'Vous n\'êtes pas autorisé à voir les soumissions de cet utilisateur.' });
  }

  try {
    const periodStart = getHistoricalDayStartTime(dateString);
    const periodEnd = getHistoricalDayEndTime(dateString);

    console.log(`[MiseAJourRoutes] GET /users/:userId/submissions - Période de recherche (UTC): ${periodStart.toISOString()} à ${periodEnd.toISOString()}`);

    const soumissions = await MiseAJour.findAll({
      where: {
        submitted_by_id: targetUserId,
        created_at: {
          [Op.between]: [periodStart, periodEnd]
        },
      },
      include: [
        {
          model: User,
          as: 'SubmittedBy',
          attributes: ['id', 'username', 'nom', 'prenom'],
          include: [
            {
              model: Cadre,
              as: 'cadre',
              attributes: ['id', 'service', 'fonction'],
              required: false
            }
          ]
        },
        {
          model: User,
          as: 'ValidatedBy',
          attributes: ['id', 'username', 'nom', 'prenom'],
          required: false
        },
      ],
      order: [['created_at', 'ASC']],
    });
    console.log(`[MiseAJourRoutes] GET /users/:userId/submissions - Récupéré ${soumissions.length} soumissions pour l'utilisateur ${targetUserId}.`);
    return res.status(200).json(soumissions);
  } catch (error) {
    console.error(`[MiseAJourRoutes] GET /users/:userId/submissions - Erreur lors de la récupération des soumissions pour l'utilisateur ${targetUserId} à la date ${dateString}:`, error);
    return res.status(500).json({ message: 'Erreur serveur lors de la récupération des détails des soumissions.' });
  }
});

module.exports = router;