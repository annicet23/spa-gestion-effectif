// src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../models');
const { authenticateJWT } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');

// --- Route pour obtenir la liste unique des services ---
router.get('/services-list', authenticateJWT, async (req, res) => {
  try {
    const services = await db.Cadre.findAll({
      attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('service')), 'service']],
      where: {
        service: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      order: [['service', 'ASC']]
    });

    const serviceNames = services.map(s => s.get('service')).filter(Boolean);
    res.json(serviceNames);
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des services :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des services.', error: error.message });
  }
});

// --- Route pour obtenir la liste des escadrons ---
router.get('/escadrons-list', authenticateJWT, async (req, res) => {
  try {
    const escadrons = await db.Escadron.findAll({
      attributes: ['id', 'nom', 'numero'],
      order: [['numero', 'ASC']]
    });

    res.json(escadrons);
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des escadrons :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des escadrons.', error: error.message });
  }
});

// --- FONCTION UTILITAIRE POUR CONSTRUIRE LES FILTRES ---
const buildFilterConditions = (service, escadron) => {
  let whereCadres = {};

  // Filtre par service
  if (service && service !== '' && service !== 'all') {
    whereCadres.service = service;
  }

  // Filtre par escadron
  if (escadron && escadron !== '' && escadron !== 'all') {
    whereCadres.responsible_escadron_id = parseInt(escadron);
  }

  return whereCadres;
};

// --- Route pour les statistiques avec filtres dynamiques ---
router.get('/dashboard/summary', authenticateJWT, async (req, res) => {
  try {
    const { service, escadron, date } = req.query;

    console.log(`Filtres reçus - Service: "${service}", Escadron: "${escadron}", Date: "${date}"`);

    // Calculer les bornes de la période de rapport
    const currentTime = date ? new Date(date) : new Date();
    const historicalEndDate = getHistoricalDate(currentTime);
    const startOfPeriod = getHistoricalDayStartTime(historicalEndDate);
    const endOfPeriod = getHistoricalDayEndTime(historicalEndDate);

    // Construire les conditions de base pour les filtres
    const baseConditions = buildFilterConditions(service, escadron);

    console.log('Conditions de base pour filtres:', baseConditions);
    console.log(`Période: ${startOfPeriod.toISOString()} à ${endOfPeriod.toISOString()}`);

    // ÉTAPE 1: Compter le TOTAL des cadres qui correspondent aux filtres
    const totalCadres = await db.Cadre.count({
      where: baseConditions
    });

    // ÉTAPE 2: Compter les ABSENTS parmi les cadres filtrés
    const absentCadres = await db.Cadre.count({
      where: {
        ...baseConditions, // Appliquer les filtres service/escadron
        statut_absence: 'Absent'
        // Note: On peut aussi ajouter le filtre de date si nécessaire
        // date_debut_absence: {
        //   [Op.between]: [startOfPeriod, endOfPeriod]
        // }
      }
    });

    // ÉTAPE 3: Compter les INDISPONIBLES parmi les cadres filtrés
    const indisponibleCadres = await db.Cadre.count({
      where: {
        ...baseConditions, // Appliquer les filtres service/escadron
        statut_absence: 'Indisponible'
        // Note: On peut aussi ajouter le filtre de date si nécessaire
        // date_debut_absence: {
        //   [Op.between]: [startOfPeriod, endOfPeriod]
        // }
      }
    });

    // ÉTAPE 4: Calculer les PRÉSENTS et SUR LE RANG
    // PRÉSENTS = TOTAL - ABSENTS
    const presentCadres = Math.max(0, totalCadres - absentCadres);

    // SUR LE RANG = PRÉSENTS - INDISPONIBLES
    const surLeRangCadres = Math.max(0, presentCadres - indisponibleCadres);

    // Créer l'objet de réponse
    const summaryStats = {
      total_cadres: totalCadres,
      absents_cadres: absentCadres,
      indisponibles_cadres: indisponibleCadres,
      presents_cadres: presentCadres,
      sur_le_rang_cadres: surLeRangCadres,
      filtres_appliques: {
        service: service || null,
        escadron: escadron || null,
        date: date || null
      }
    };

    console.log('=== STATISTIQUES CALCULÉES ===');
    console.log(`Service: ${service || 'TOUS'}`);
    console.log(`Escadron: ${escadron || 'TOUS'}`);
    console.log(`Total: ${totalCadres}`);
    console.log(`Absents: ${absentCadres}`);
    console.log(`Indisponibles: ${indisponibleCadres}`);
    console.log(`Présents: ${presentCadres}`);
    console.log(`Sur le rang: ${surLeRangCadres}`);
    console.log('================================');

    res.json(summaryStats);

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du tableau de bord :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques.', error: error.message });
  }
});

// --- Route pour la liste des cadres avec filtres ---
router.get('/cadres-filtered', authenticateJWT, async (req, res) => {
  try {
    const { statut, service, escadron, date } = req.query;

    // Construire les conditions de base
    const baseConditions = buildFilterConditions(service, escadron);

    // Ajouter le filtre de statut
    let whereCadres = { ...baseConditions };

    if (statut && statut !== 'all' && statut !== '') {
      whereCadres.statut_absence = statut;
    }

    // Ajouter le filtre de date si nécessaire
    if (date && (statut === 'Absent' || statut === 'Indisponible')) {
      const currentTime = new Date(date);
      const historicalEndDate = getHistoricalDate(currentTime);
      const startOfPeriod = getHistoricalDayStartTime(historicalEndDate);
      const endOfPeriod = getHistoricalDayEndTime(historicalEndDate);

      whereCadres.date_debut_absence = {
        [Op.between]: [startOfPeriod, endOfPeriod]
      };
    }

    console.log('Conditions WHERE pour liste cadres:', whereCadres);

    // Récupérer la liste des cadres avec les associations
    const cadres = await db.Cadre.findAll({
      where: whereCadres,
      include: [
        {
          model: db.Escadron,
          as: 'EscadronResponsable',
          required: false,
          attributes: ['id', 'nom', 'numero']
        }
      ],
      order: [['nom', 'ASC'], ['prenom', 'ASC']]
    });

    console.log(`Nombre de cadres trouvés: ${cadres.length} (Statut: ${statut || 'TOUS'})`);
    res.json(cadres);

  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des cadres filtrée :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération de la liste.', error: error.message });
  }
});

// --- Routes pour correspondre exactement aux appels du frontend ---

// Route pour les services (correspond à /api/cadres/services)
router.get('/cadres/services', authenticateJWT, async (req, res) => {
  try {
    const services = await db.Cadre.findAll({
      attributes: [[db.Sequelize.fn('DISTINCT', db.Sequelize.col('service')), 'service']],
      where: {
        service: {
          [Op.ne]: null,
          [Op.ne]: ''
        }
      },
      order: [['service', 'ASC']]
    });

    const serviceNames = services.map(s => s.get('service')).filter(Boolean);
    console.log('Services disponibles:', serviceNames);
    res.json(serviceNames);
  } catch (error) {
    console.error('Erreur lors de la récupération des services :', error);
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

// Route pour les escadrons (correspond à /api/escadrons)
router.get('/escadrons', authenticateJWT, async (req, res) => {
  try {
    const escadrons = await db.Escadron.findAll({
      attributes: ['id', 'nom', 'numero'],
      order: [['numero', 'ASC']]
    });

    console.log('Escadrons disponibles:', escadrons.map(e => `${e.nom} (ID: ${e.id})`));
    res.json(escadrons);
  } catch (error) {
    console.error('Erreur lors de la récupération des escadrons :', error);
    res.status(500).json({ message: 'Erreur serveur.', error: error.message });
  }
});

// Route principale pour les statistiques (correspond à /api/mises-a-jour/cadres/summary)
router.get('/mises-a-jour/cadres/summary', authenticateJWT, async (req, res) => {
  try {
    const { service, escadron, date } = req.query;

    console.log(`=== APPEL /api/mises-a-jour/cadres/summary ===`);
    console.log(`Paramètres reçus:`);
    console.log(`- Service: "${service}"`);
    console.log(`- Escadron: "${escadron}"`);
    console.log(`- Date: "${date}"`);

    // Calculer les bornes de la période
    const currentTime = date ? new Date(date) : new Date();
    const historicalEndDate = getHistoricalDate(currentTime);
    const startOfPeriod = getHistoricalDayStartTime(historicalEndDate);
    const endOfPeriod = getHistoricalDayEndTime(historicalEndDate);

    // Construire les conditions de filtrage
    const baseConditions = buildFilterConditions(service, escadron);

    console.log('Conditions de filtrage appliquées:', baseConditions);

    // Compter le total des cadres avec filtres
    const totalCadres = await db.Cadre.count({
      where: baseConditions
    });

    // Compter les absents avec filtres
    const absentCadres = await db.Cadre.count({
      where: {
        ...baseConditions,
        statut_absence: 'Absent'
      }
    });

    // Compter les indisponibles avec filtres
    const indisponibleCadres = await db.Cadre.count({
      where: {
        ...baseConditions,
        statut_absence: 'Indisponible'
      }
    });

    // Calculer présents et sur le rang
    const presentCadres = Math.max(0, totalCadres - absentCadres);
    const surLeRangCadres = Math.max(0, presentCadres - indisponibleCadres);

    const summaryStats = {
      total_cadres: totalCadres,
      absents_cadres: absentCadres,
      indisponibles_cadres: indisponibleCadres,
      presents_cadres: presentCadres,
      sur_le_rang_cadres: surLeRangCadres,
      filtres_appliques: {
        service: service || null,
        escadron: escadron || null,
        date: date || null
      }
    };

    console.log(`=== RÉSULTAT POUR LES FILTRES ===`);
    if (service && service !== 'all') {
      console.log(`📋 Service "${service}":`);
    } else {
      console.log(`📋 TOUS LES SERVICES:`);
    }

    if (escadron && escadron !== 'all') {
      console.log(`🎯 Escadron ID ${escadron}:`);
    } else {
      console.log(`🎯 TOUS LES ESCADRONS:`);
    }

    console.log(`   Total: ${totalCadres}`);
    console.log(`   Absents: ${absentCadres}`);
    console.log(`   Présents: ${presentCadres}`);
    console.log(`   Indisponibles: ${indisponibleCadres}`);
    console.log(`   Sur le rang: ${surLeRangCadres}`);
    console.log(`=====================================`);

    res.json(summaryStats);

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques.', error: error.message });
  }
});

// Route pour la liste des cadres (correspond à /api/cadres)
router.get('/cadres', authenticateJWT, async (req, res) => {
  try {
    const { statut, service, escadron, date } = req.query;

    console.log(`=== APPEL /api/cadres ===`);
    console.log(`Paramètres: statut="${statut}", service="${service}", escadron="${escadron}", date="${date}"`);

    // Construire les conditions de base
    const baseConditions = buildFilterConditions(service, escadron);

    // Ajouter le filtre de statut
    let whereCadres = { ...baseConditions };

    if (statut && statut !== 'all' && statut !== '') {
      whereCadres.statut_absence = statut;
    }

    console.log('Conditions finales pour /api/cadres:', whereCadres);

    // Récupérer la liste des cadres
    const cadres = await db.Cadre.findAll({
      where: whereCadres,
      include: [
        {
          model: db.Escadron,
          as: 'EscadronResponsable',
          required: false,
          attributes: ['id', 'nom', 'numero']
        }
      ],
      order: [['nom', 'ASC'], ['prenom', 'ASC']]
    });

    console.log(`✅ Trouvé ${cadres.length} cadres pour les critères donnés`);
    res.json(cadres);

  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des cadres :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération de la liste.', error: error.message });
  }
});

module.exports = router;