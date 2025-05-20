'use strict';
const cron = require('node-cron');
const moment = require('moment-timezone');
const { Op } = require('sequelize');
const {
    HistoriqueStatsJournalieresCadres,
    HistoriquePersonnesJournalieresCadres,
    Cadre,
    // Ajoutez d'autres modèles si nécessaire
} = require('../models'); // Assurez-vous que le chemin est correct

// Importe les fonctions utilitaires de date (assurez-vous qu'elles gèrent le fuseau horaire si nécessaire)
// Assurez-vous que le chemin '../utils/date' est correct par rapport à tasks/historicalTasks.js
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');

// Définissez une constante pour le fuseau horaire de votre application.
// C'est CRUCIAL que ce fuseau horaire corresponde à celui utilisé dans vos utilitaires de date.
const APP_TIMEZONE = 'Indian/Antananarivo'; // Fuseau horaire d'Antananarivo (EAT)
console.log(`Planification des tâches historiques utilisant le fuseau horaire : ${APP_TIMEZONE}`);


/**
 * Calcule les statistiques agrégées actuelles des cadres en lisant
 * leur statut directement depuis la table Cadre.
 * Cette fonction doit être appelée au moment où l'on veut prendre un snapshot
 * de l'état actuel de l'effectif.
 *
 * @returns {Promise<{total: number, absent: number, present: number, indisponible: number}>}
 */
async function calculateCurrentAggregateStats() {
    console.log('Calculating current aggregate stats by reading Cadre status...');
    try {
        // Lire l'etat actuel de TOUS les cadres directement depuis le modèle Cadre
        const cadres = await Cadre.findAll({
            attributes: ['id', 'statut_absence'],
        });

        let present = 0;
        let absent = 0;
        let indisponible = 0;
        const total = cadres.length;

        for (const cadre of cadres) {
            switch (cadre.statut_absence) {
                case 'Présent':
                    present++;
                    break;
                case 'Absent':
                    absent++;
                    break;
                case 'Indisponible':
                    indisponible++;
                    break;
                default:
                    console.warn(`Cadre ${cadre.id} has unexpected status: ${cadre.statut_absence}. Counting as Présent.`);
                    // Décidez comment compter les statuts inattendus
                    // Par défaut, on peut les compter comme Présent si c'est l'état normal
                    present++;
            }
        }

        console.log(`Calculé - Total: ${total}, Présent: ${present}, Absent: ${absent}, Indisponible: ${indisponible}`);

        return {
            total: total,
            present: present, // Ce nombre correspond au 'Sur le rang' dans l'interface si 'Présent' == 'Sur le rang'
            absent: absent,
            indisponible: indisponible,
            surLeRang: present // Si Sur Le Rang est défini comme étant les Présents
        };

    } catch (error) {
        console.error('Error calculating current aggregate stats:', error);
        return { total: 0, present: 0, absent: 0, indisponible: 0, surLeRang: 0 };
    }
}

/**
 * Tâche planifiée : Calcule les stats agrégées actuelles et les met à jour (upsert)
 * pour la journée historique correspondante.
 * S'exécute toutes les 2 heures (et à 16h00 via la tâche de finalisation qui appelle calculateCurrentAggregateStats).
 * La date historique clé est la date de fin de la période 16h-15h59.
 */
async function upsertAggregateSnapshotTask() {
    const now = new Date();
    console.log(`Running upsertAggregateSnapshotTask at ${now.toISOString()} (Server Time)`);

    try {
        // Détermine la date historique (date de fin de la période 16h-15h59) pour le moment présent
        // Si now est entre 16h J et 15h59 J+1, historicalDate est J+1
        // Si now est entre 00h J et 15h59 J, historicalDate est J
        const historicalDate = getHistoricalDate(now); // Cette utilitaire DOIT retourner la date de FIN de la période

        console.log(`Determined historical date for current aggregate snapshot: ${historicalDate}`);

        const stats = await calculateCurrentAggregateStats(); // Calcule les stats actuelles

        // Effectue un "upsert" pour les stats intermédiaires
        const [record, created] = await HistoriqueStatsJournalieresCadres.findOrCreate({
            where: { date_snapshot: historicalDate }, // Clé est la date de fin de la période
            defaults: {
                total_cadres: stats.total,
                absents_cadres: stats.absent,
                presents_cadres: stats.present,
                indisponibles_cadres: stats.indisponible,
                sur_le_rang_cadres: stats.surLeRang,
            }
        });

        if (!created) {
            // Si l'enregistrement existait, on le met à jour
            await record.update({
                total_cadres: stats.total, // Le total peut changer si des cadres sont ajoutés/supprimés
                absents_cadres: stats.absent,
                presents_cadres: stats.present,
                indisponibles_cadres: stats.indisponible,
                sur_le_rang_cadres: stats.surLeRang,
            });
            console.log(`Updated aggregate stats for historical date: ${historicalDate}`);
        } else {
            console.log(`Created aggregate stats for historical date: ${historicalDate}`);
        }

    } catch (error) {
        console.error('Failed to run upsertAggregateSnapshotTask:', error);
    }
}

/**
 * Tâche planifiée : Finalise la journée historique précédente (se déclenche à 16h00).
 * Effectue le dernier calcul agrégé, insère les détails individuels définitifs,
 * ET réinitialise TOUS les cadres à "Présent" pour la nouvelle journée qui commence.
 * La date historique clé est la date de fin de la période 16h-15h59.
 */
async function finalizeHistoricalDayTask() {
    const now = new Date(); // C'est le moment du déclenchement (ex: 16:00:00 le 15 mai)
    console.log(`Running finalizeHistoricalDayTask at ${now.toISOString()} (Server Time)`);

    try {
        // La date historique pour la finalisation est la date calendaire du jour de l'exécution (ex: 15 mai si exécuté le 15 mai à 16h).
        // C'est la date de FIN de la période 16h (veille) - 15h59 (jour).
        // Utilisez moment.tz pour assurer la cohérence avec le fuseau horaire de l'application
        const historicalDateToFinalize = moment.tz(now, APP_TIMEZONE).format('YYYY-MM-DD');

        console.log(`Finalizing historical data for date: ${historicalDateToFinalize}`);

        // --- PARTIE 1: Finaliser les stats agrégées ---
        // Calcule les stats à 16h00 (dernières stats de la journée historique qui vient de se terminer)
        const finalStats = await calculateCurrentAggregateStats();
        const [finalRecord, finalCreated] = await HistoriqueStatsJournalieresCadres.findOrCreate({
            where: { date_snapshot: historicalDateToFinalize }, // Clé est la date de fin de la période
            defaults: {
                total_cadres: finalStats.total,
                absents_cadres: finalStats.absent,
                presents_cadres: finalStats.present,
                indisponibles_cadres: finalStats.indisponible,
                sur_le_rang_cadres: finalStats.surLeRang,
            }
        });

        if (!finalCreated) {
            // Si l'enregistrement existait, on le met à jour avec les stats finales
            await finalRecord.update({
                total_cadres: finalStats.total,
                absents_cadres: finalStats.absent,
                presents_cadres: finalStats.present,
                indisponibles_cadres: finalStats.indisponible,
                sur_le_rang_cadres: finalStats.surLeRang,
            });
            console.log(`Final aggregate stats updated for historical date: ${historicalDateToFinalize}`);
        } else {
            console.log(`Final aggregate stats created for historical date: ${historicalDateToFinalize}`);
        }


        // --- PARTIE 2: Enregistrer les statuts individuels définitifs ---
        // On snapshotte l'état actuel de chaque cadre (qui reflète la fin de journée historique à 16h00)
        console.log(`Saving individual cadre snapshots for historical date: ${historicalDateToFinalize}`);
        try {
            // Supprimer les enregistrements individuels existants pour cette date historique (pour garantir un snapshot unique à 16h)
            const deleteCount = await HistoriquePersonnesJournalieresCadres.destroy({
                where: {
                    date_snapshot: historicalDateToFinalize
                }
            });
            if(deleteCount > 0) console.log(`Deleted ${deleteCount} existing individual snapshots for ${historicalDateToFinalize}`);

            // Récupérer l'état actuel de TOUS les cadres
            const allCadres = await Cadre.findAll({
                attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service', 'statut_absence', 'date_debut_absence', 'motif_absence'], // Inclure les champs de statut
            });

            // Créer les objets snapshot pour l'insertion en masse
            const individualSnapshots = allCadres.map(cadre => ({
                date_snapshot: historicalDateToFinalize, // La date historique (date de fin)
                cadre_id: cadre.id,
                statut_snapshot: cadre.statut_absence, // Utilise le statut actuel du cadre à 16h
                motif_snapshot: cadre.motif_absence, // Utilise le motif actuel du cadre à 16h
                // Inclure d'autres champs si nécessaire pour le snapshot détaillé
                grade_snapshot: cadre.grade,
                nom_snapshot: cadre.nom,
                prenom_snapshot: cadre.prenom,
                matricule_snapshot: cadre.matricule,
                service_snapshot: cadre.service,
                date_debut_absence_snapshot: cadre.date_debut_absence // Inclure la date de début d'absence si pertinente
            }));


            // Insérer en masse les snapshots individuels
            if (individualSnapshots.length > 0) {
                await HistoriquePersonnesJournalieresCadres.bulkCreate(individualSnapshots, { ignoreDuplicates: true });
                console.log(`Inserted ${individualSnapshots.length} individual snapshots for ${historicalDateToFinalize}`);
            } else {
                console.log(`No cadres found to insert individual snapshots for ${historicalDateToFinalize}.`);
            }


        } catch (error) {
            console.error('Error saving individual cadre snapshots:', error);
            // Ne pas relancer ici, car la partie 3 doit toujours s'exécuter si possible
        }

        // --- PARTIE 3 : RÉINITIALISATION AUTOMATIQUE DES STATUTS À "PRÉSENT" ---
        // Cette partie se déclenche à 16h00, signifiant le début d'une NOUVELLE journée historique.
        // Tous les cadres sont réinitialisés à 'Présent' pour cette nouvelle journée.
        console.log(`Attempting to reset ALL cadre statuses to 'Présent' for the new historical day...`);
        try {
            const [numberOfRevertedCadres] = await Cadre.update(
                {
                    statut_absence: 'Présent', // Changer le statut à Présent
                    date_debut_absence: null, // Effacer la date de début d'absence
                    motif_absence: null, // Effacer le motif d'absence
                },
                {
                    where: {
                        // Aucun filtre ici pour réinitialiser TOUS les cadres.
                        // Si vous voulez exclure des cadres (ex: absences de longue durée gérées manuellement),
                        // ajoutez des conditions ici.
                    }
                }
            );

            console.log(`Successfully reset ${numberOfRevertedCadres} cadre(s) to 'Présent'.`);

        } catch (error) {
            console.error('Error during automatic status reset:', error);
            // Ne pas relancer l'erreur ici
        }
        // --- FIN PARTIE 3 ---


        console.log(`Historical day ${historicalDateToFinalize} finalized successfully.`);

    } catch (error) {
        console.error('Failed to run finalizeHistoricalDayTask:', error);
        // Erreur logguée plus haut si elle vient d'une des parties
    }
}


/**
 * Fonction pour démarrer les tâches planifiées.
 * Appeler cette fonction au démarrage de votre application backend APRÈS la synchronisation de la BD.
 */
function scheduleHistoricalTasks() {
    // Utilise le fuseau horaire de l'application défini
    console.log(`Scheduling tasks with timezone: ${APP_TIMEZONE}`);


    // Tâche 1 : Mettre à jour les stats agrégées toutes les 2 heures
    // Ces snapshots intermédiaires permettent de voir l'évolution dans la journée historique en cours.
    // La date historique associée sera celle retournée par getHistoricalDate(now), qui est la date de FIN de la période.
    cron.schedule('0 */2 * * *', upsertAggregateSnapshotTask, {
        scheduled: true,
        timezone: APP_TIMEZONE // S'assurer que la tâche s'exécute selon ce fuseau horaire
    });
    console.log('Scheduled aggregate snapshot task to run every 2 hours.');

    // Tâche 2 : Finaliser la journée historique à 16h00
    // Cette tâche calcule les stats définitives, les snapshots individuels, ET réinitialise les statuts
    // pour la journée historique qui se termine À CE MOMENT-LÀ (à 15h59).
    cron.schedule('0 16 * * *', finalizeHistoricalDayTask, {
        scheduled: true,
        timezone: APP_TIMEZONE // S'assurer que la tâche s'exécute à 16h dans le fuseau horaire correct
    });
    console.log('Scheduled historical day finalization and status reset task to run daily at 16:00.');

    // Optionnel: Exécuter la tâche agrégée une fois au démarrage pour avoir des données tout de suite
    // utisation de setTimeout pour laisser le temps à la DB de se connecter si scheduleHistoricalTasks est appelée tôt
    // setTimeout(upsertAggregateSnapshotTask, 5000); // Exécute après 5 secondes

    // Optionnel: Exécuter la tâche de finalisation une fois au démarrage si vous déboguez ou si la dernière exécution a été manquée
    // Utilisez avec prudence, cela peut réinitialiser les statuts si les conditions sont remplies
    // setTimeout(finalizeHistoricalDayTask, 10000); // Exécute après 10 secondes
}

module.exports = {
    scheduleHistoricalTasks,
    // Exporter les fonctions si vous avez besoin de les appeler manuellement pour des tests ou débuggage
    upsertAggregateSnapshotTask,
    finalizeHistoricalDayTask,
    // Exporter d'autres fonctions si nécessaire
};