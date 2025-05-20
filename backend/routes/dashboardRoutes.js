// src/routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../models'); // Assurez-vous que le chemin '../models' est correct
const { authenticateJWT } = require('../middleware/authMiddleware'); // Importez le nom correct !
const { Op } = require('sequelize'); // Nécessaire pour Op.between ou autres opérateurs
// Importez vos fonctions utilitaires de date
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date'); // <-- Importez ici

// Endpoint pour obtenir les statistiques globales du tableau de bord
// Utilise authenticateJWT comme middleware avant le gestionnaire de route
router.get('/dashboard/summary', authenticateJWT, async (req, res) => {
  try {
    // 1. Calculer les bornes de la période de rapport en cours (16h J-1 à 15h59 J)
    const currentTime = new Date(); // L'heure actuelle de la requête API
    // Utilisez getHistoricalDate pour obtenir la date calendaire de FIN de la période
    const historicalEndDate = getHistoricalDate(currentTime);
    // Utilisez les fonctions utilitaires pour obtenir les timestamps exacts
    const startOfPeriod = getHistoricalDayStartTime(historicalEndDate); // <-- 16h J-1
    const endOfPeriod = getHistoricalDayEndTime(historicalEndDate);     // <-- 15h59:59.999 J

    console.log(`Calculating summary for period: ${startOfPeriod.toISOString()} to ${endOfPeriod.toISOString()}`);


    // 2. Compter les Cadres et Élèves selon votre règle 16h-15h59

    // TOTAL : Le total reste le même, c'est le nombre total de personnes enregistrées.
    const totalCadres = await db.Cadre.count();
    const totalEleves = await db.Eleve.count();

    // ABSENTS / INDISPONIBLES :
    // Ici, nous devons compter les personnes *dont le statut est Absent/Indisponible*
    // ET *dont ce statut est actif et a débuté dans la période 16h-15h59*.
    // L'interprétation la plus simple basée sur votre modèle 'Cadre' (statut_absence, date_debut_absence)
    // est de compter ceux qui sont marqués Absent/Indisponible et dont la date_debut_absence
    // est dans la fenêtre.
    // NOTE IMPORTANTE : Si la date_debut_absence est réinitialisée à null par le cron job à minuit
    // même si l'absence a commencé avant 16h la veille, cette logique pourrait ne pas
    // capturer correctement les absences *continues* qui ont commencé avant 16h J-1
    // mais sont toujours actives dans la période 16h J-1 -> 15h59 J.
    // Si c'est le cas, il faudrait interroger la table 'Absence' elle-même et ses champs start_date/end_date.

    // Logique basée sur statut_absence et date_debut_absence dans la table Cadre
    const absentCadres = await db.Cadre.count({
      where: {
        statut_absence: 'Absent',
        date_debut_absence: { // Filtrer les absences qui ont débuté DANS la période
          [Op.between]: [startOfPeriod, endOfPeriod]
        }
      }
    });

    const indisponibleCadres = await db.Cadre.count({
      where: {
        statut_absence: 'Indisponible',
        date_debut_absence: { // Filtrer les indisponibilités qui ont débuté DANS la période
          [Op.between]: [startOfPeriod, endOfPeriod]
        }
      }
    });

    // Le comptage pour les Élèves nécessitera une logique similaire en fonction de leur modèle
    // et de la manière dont leurs statuts/absences sont gérés (probablement lié au modèle Absence).
    // Vous devrez peut-être joindre la table 'Absence' pour les élèves si leur statut
    // n'est pas stocké directement ou si date_debut_absence n'est pas fiable après le reset.
    // Exemple conceptuel si Eleve a un champ similaire ou si vous joignez Absence:
    const absentEleves = 0; // TODO: Implémenter la logique pour les élèves
    const indisponibleEleves = 0; // TODO: Implémenter la logique pour les élèves


    // PRÉSENT / SUR LE RANG : Calculé à partir du Total et des Absents/Indisponibles comptés pour la période
    const presentCadres = totalCadres - absentCadres ;
    const surLeRangCadres = presentCadres- indisponibleCadres; // Selon votre définition actuelle

    // TODO: Calculer presentEleves et surLeRangEleves

    // Construire l'objet de réponse selon la structure convenue
    const summaryStats = {
      cadres: {
        total: totalCadres,
        absent: absentCadres,
        indisponible: indisponibleCadres,
        present: presentCadres, // Ajouté ici car calculé
        surLeRang: surLeRangCadres // Ajouté ici car calculé
      },
      eleves: {
        total: totalEleves,
        absent: absentEleves, // TODO
        indisponible: indisponibleEleves, // TODO
        present: totalEleves - absentEleves - indisponibleEleves, // TODO: Adapter
        surLeRang: totalEleves - absentEleves - indisponibleEleves // TODO: Adapter
      },
    };

    res.json(summaryStats);

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques du tableau de bord :', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération des statistiques.', error: error.message });
  }
});

module.exports = router;