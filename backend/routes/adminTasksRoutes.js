// routes/adminTasksRoutes.js
const express = require('express');
const router = express.Router();

// Importez la fonction de la tâche que vous voulez déclencher manuellement
const { finalizeHistoricalDayTask, upsertAggregateSnapshotTask } = require('../tasks/historicalTasks');

// Importez votre middleware d'authentification si vous en avez un,
// et idéalement un middleware pour vérifier les permissions (par exemple, isAdmin)
 const { authenticateJWT } = require('../middleware/authMiddleware');
// const { isAdmin } = require('../middleware/permissionsMiddleware'); // Supposons que vous ayez ceci

/**
 * Route pour déclencher manuellement la tâche de finalisation de l'historique quotidien.
 * NECESSITE UNE AUTHENTIFICATION ET DES PERMISSIONS APPROPRIEES EN PRODUCTION !
 */
router.post('/run-finalize-snapshot', /* authenticateJWT, isAdmin, */ async (req, res) => {
    console.log('>>> Déclenchement manuel de la tâche finalizeHistoricalDayTask...'); // Log pour confirmation

    try {
        // Appelez directement la fonction de la tâche
        await finalizeHistoricalDayTask();

        // Réponse en cas de succès
        console.log('>>> Tâche finalizeHistoricalDayTask terminée avec succès.');
        res.status(200).json({ message: 'Tâche finalizeHistoricalDayTask exécutée avec succès.' });

    } catch (error) {
        // Réponse en cas d'erreur
        console.error('>>> Erreur lors du déclenchement manuel de la tâche finalizeHistoricalDayTask:', error);
        res.status(500).json({ message: 'Impossible d\'exécuter la tâche finalizeHistoricalDayTask', error: error.message });
    }
});

/**
 * Route optionnelle pour déclencher manuellement la tâche de snapshot intermédiaire (toutes les 2h).
 * NECESSITE UNE AUTHENTIFICATION ET DES PERMISSIONS APPROPRIEES EN PRODUCTION !
 */
 router.post('/run-intermediate-snapshot', /* authenticateJWT, isAdmin, */ async (req, res) => {
     console.log('>>> Déclenchement manuel de la tâche upsertAggregateSnapshotTask...');

     try {
         await upsertAggregateSnapshotTask();

         console.log('>>> Tâche upsertAggregateSnapshotTask terminée avec succès.');
         res.status(200).json({ message: 'Tâche upsertAggregateSnapshotTask exécutée avec succès.' });

     } catch (error) {
         console.error('>>> Erreur lors du déclenchement manuel de la tâche upsertAggregateSnapshotTask:', error);
         res.status(500).json({ message: 'Impossible d\'exécuter la tâche upsertAggregateSnapshotTask', error: error.message });
     }
 });


module.exports = router;