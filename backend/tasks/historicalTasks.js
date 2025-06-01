'use strict';
const cron = require('node-cron');

// AJOUTÉ : HistoriquePersonnesJournalieresCadres
const { Cadre, HistoriqueStatsJournalieresCadres, HistoriquePersonnesJournalieresCadres } = require('../models');
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');
const { Op } = require('sequelize');
const moment = require('moment-timezone'); // Assurez-vous d'avoir moment-timezone installé (npm install moment-timezone)

const APP_TIMEZONE = 'Indian/Antananarivo';
console.log(`Planification des tâches historiques utilisant le fuseau horaire : ${APP_TIMEZONE}`);

async function calculateCurrentAggregateStats() {
    console.log('[DEBUG_STATS] Calculating current aggregate stats by reading Cadre status...');
    try {
        const cadres = await Cadre.findAll({
            attributes: ['id', 'statut_absence'], // Assurez-vous que 'statut_absence' est le nom correct de la colonne
        });

        console.log(`[DEBUG_STATS] Nombre total de cadres trouvés dans la base de données: ${cadres.length}`);

        // Log détaillé de chaque cadre et son statut
        if (cadres.length > 0) {
            cadres.forEach(c => {
                console.log(`[DEBUG_STATS] Cadre ID: ${c.id}, Statut: '${c.statut_absence}'`);
            });
        } else {
            console.log(`[DEBUG_STATS] Aucun cadre trouvé dans la base de données.`);
        }

        let present = 0;
        let absent = 0;
        let indisponible = 0;
        const total = cadres.length;

        for (const cadre of cadres) {
            // Vérifiez la casse exacte des statuts stockés dans votre base de données
            switch (cadre.statut_absence) {
                case 'Présent': // Utilisez la casse exacte comme dans votre base de données
                    present++;
                    break;
                case 'Absent': // Utilisez la casse exacte comme dans votre base de données
                    absent++;
                    break;
                case 'Indisponible': // Utilisez la casse exacte comme dans votre base de données
                    indisponible++;
                    break;
                default:
                    console.warn(`[DEBUG_STATS] Cadre ${cadre.id} a un statut inattendu: '${cadre.statut_absence}'. Compte comme Présent.`);
                    present++; // Compter comme présent par défaut si le statut est inconnu
            }
        }

        console.log(`[DEBUG_STATS] Statistiques calculées - Total: ${total}, Présent: ${present}, Absent: ${absent}, Indisponible: ${indisponible}`);

        return {
            total: total,
            present: present,
            absent: absent,
            indisponible: indisponible,
            surLeRang: present // Si "Sur Le Rang" est équivalent aux "Présents"
        };

    } catch (error) {
        console.error('[ERROR_STATS] Error calculating current aggregate stats:', error);
        return { total: 0, present: 0, absent: 0, indisponible: 0, surLeRang: 0 };
    }
}

async function upsertAggregateSnapshotTask() {
    const now = new Date();
    console.log(`[CRON] Running upsertAggregateSnapshotTask at ${now.toISOString()} (Server Time)`);

    try {
        const historicalDate = getHistoricalDate(now);
        console.log(`[CRON] Determined historical date for current aggregate snapshot: ${historicalDate}`);
        const stats = await calculateCurrentAggregateStats();

        const [record, created] = await HistoriqueStatsJournalieresCadres.findOrCreate({
            where: { date_snapshot: historicalDate },
            defaults: {
                total_cadres: stats.total,
                absents_cadres: stats.absent,
                presents_cadres: stats.present,
                indisponibles_cadres: stats.indisponible,
                sur_le_rang_cadres: stats.surLeRang,
            }
        });

        if (!created) {
            await record.update({
                total_cadres: stats.total,
                absents_cadres: stats.absent,
                presents_cadres: stats.present,
                indisponibles_cadres: stats.indisponible,
                sur_le_rang_cadres: stats.surLeRang,
            });
            console.log(`[CRON] Updated aggregate stats for historical date: ${historicalDate}`);
        } else {
            console.log(`[CRON] Created aggregate stats for historical date: ${historicalDate}`);
        }

    } catch (error) {
        console.error('[CRON_ERROR] Failed to run upsertAggregateSnapshotTask:', error);
    }
}

async function finalizeHistoricalDayTask() {
    const now = new Date();
    console.log(`[CRON] Running finalizeHistoricalDayTask at ${now.toISOString()} (Server Time)`);

    try {
        const historicalDateToFinalize = moment.tz(now, APP_TIMEZONE).format('YYYY-MM-DD');
        console.log(`[CRON] Finalizing historical data for date: ${historicalDateToFinalize}`);

        const finalStats = await calculateCurrentAggregateStats();
        const [finalRecord, finalCreated] = await HistoriqueStatsJournalieresCadres.findOrCreate({
            where: { date_snapshot: historicalDateToFinalize },
            defaults: {
                total_cadres: finalStats.total,
                absents_cadres: finalStats.absent,
                presents_cadres: finalStats.present,
                indisponibles_cadres: finalStats.indisponible,
                sur_le_rang_cadres: finalStats.surLeRang,
            }
        });

        if (!finalCreated) {
            await finalRecord.update({
                total_cadres: finalStats.total,
                absents_cadres: finalStats.absent,
                presents_cadres: finalStats.present,
                indisponibles_cadres: finalStats.indisponible,
                sur_le_rang_cadres: finalStats.surLeRang,
            });
            console.log(`[CRON] Final aggregate stats updated for historical date: ${historicalDateToFinalize}`);
        } else {
            console.log(`[CRON] Final aggregate stats created for historical date: ${historicalDateToFinalize}`);
        }

        console.log(`[CRON] Saving individual cadre snapshots for historical date: ${historicalDateToFinalize}`);
        try {
            const deleteCount = await HistoriquePersonnesJournalieresCadres.destroy({
                where: {
                    date_snapshot: historicalDateToFinalize
                }
            });
            if(deleteCount > 0) console.log(`[CRON] Deleted ${deleteCount} existing individual snapshots for ${historicalDateToFinalize}`);

            const allCadres = await Cadre.findAll({
                attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service', 'statut_absence', 'date_debut_absence', 'motif_absence'],
            });

            const individualSnapshots = allCadres.map(cadre => ({
                date_snapshot: historicalDateToFinalize,
                cadre_id: cadre.id,
                statut_snapshot: cadre.statut_absence, // CORRIGÉ : était cadre.statre_absence
                motif_snapshot: cadre.motif_absence,
                // ATTENTION : Les champs suivants (grade_snapshot, nom_snapshot, etc.) ne sont pas définis
                // dans votre modèle HistoriquePersonnesJournalieresCadres.
                // Si vous voulez les stocker, vous devez d'abord mettre à jour le modèle et la base de données.
                // Sinon, Sequelize les ignorera lors de l'insertion.
                grade_snapshot: cadre.grade,
                nom_snapshot: cadre.nom,
                prenom_snapshot: cadre.prenom,
                matricule_snapshot: cadre.matricule,
                service_snapshot: cadre.service,
                date_debut_absence_snapshot: cadre.date_debut_absence
            }));

            if (individualSnapshots.length > 0) {
                await HistoriquePersonnesJournalieresCadres.bulkCreate(individualSnapshots, { ignoreDuplicates: true });
                console.log(`[CRON] Inserted ${individualSnapshots.length} individual snapshots for ${historicalDateToFinalize}`);
            } else {
                console.log(`[CRON] No cadres found to insert individual snapshots for ${historicalDateToFinalize}.`);
            }

        } catch (error) {
            console.error('[CRON_ERROR] Error saving individual cadre snapshots:', error);
        }

        console.log(`[CRON] Attempting to reset ALL cadre statuses to 'Présent' for the new historical day...`);
        try {
            const [numberOfRevertedCadres] = await Cadre.update(
                {
                    statut_absence: 'Présent',
                    date_debut_absence: null,
                    motif_absence: null,
                },
                {
                    where: {}
                }
            );
            console.log(`[CRON] Successfully reset ${numberOfRevertedCadres} cadre(s) to 'Présent'.`);

        } catch (error) {
            console.error('[CRON_ERROR] Error during automatic status reset:', error);
        }
        console.log(`[CRON] Historical day ${historicalDateToFinalize} finalized successfully.`);

    } catch (error) {
        console.error('[CRON_ERROR] Failed to run finalizeHistoricalDayTask:', error);
    }
}

// FONCTION CORRIGÉE : Rattrapage UNE SEULE FOIS basé sur l'horodatage
async function checkAndRunMissedTask() {
    try {
        const today = moment.tz(APP_TIMEZONE).format('YYYY-MM-DD');
        const today16h = moment.tz(APP_TIMEZONE).hour(16).minute(0).second(0);

        console.log(`[MISSED_TASK] Vérification de la tâche pour la date: ${today}`);

        // Vérifier si on a déjà des données historiques pour aujourd'hui
        const existingRecord = await HistoriqueStatsJournalieresCadres.findOne({
            where: { date_snapshot: today }
        });

        if (!existingRecord) {
            console.log('🔧 [MISSED_TASK] Aucun enregistrement trouvé - exécution de la tâche...');
            await finalizeHistoricalDayTask();
            console.log('✅ [MISSED_TASK] Tâche exécutée avec succès');
        } else {
            const recordUpdateTime = moment.tz(existingRecord.updated_at, APP_TIMEZONE);
            console.log(`[MISSED_TASK] Enregistrement trouvé, mis à jour à: ${recordUpdateTime.format('YYYY-MM-DD HH:mm:ss')}`);

            // Si l'enregistrement a été mis à jour AVANT 16h00 aujourd'hui
            if (recordUpdateTime.isBefore(today16h)) {
                console.log('🔧 [MISSED_TASK] Tâche de 16h00 manquée - exécution maintenant...');
                await finalizeHistoricalDayTask();
                console.log('✅ [MISSED_TASK] Tâche manquée exécutée avec succès');
            } else {
                console.log('✅ [MISSED_TASK] Tâche de 16h00 déjà faite - aucune action');
            }
        }
    } catch (error) {
        console.error('❌ [MISSED_TASK] Erreur lors de la vérification:', error);
    }
}

function scheduleHistoricalTasks() {
    console.log(`Scheduling tasks with timezone: ${APP_TIMEZONE}`);

    // NOUVEAU : Vérifier si on a raté la tâche de 16h aujourd'hui
    const now = moment.tz(APP_TIMEZONE);
    const today16h = moment.tz(APP_TIMEZONE).hour(16).minute(0).second(0);

    console.log(`Heure actuelle: ${now.format('HH:mm')}`);
    console.log(`Heure de la tâche: ${today16h.format('HH:mm')}`);

    // Si on est après 16h00 aujourd'hui et que le serveur vient de démarrer
    if (now.isAfter(today16h)) {
        console.log('🚨 DÉTECTION : Serveur démarré après 16h00, vérification de la tâche manquée...');
        // Exécuter la vérification de façon asynchrone pour ne pas bloquer le démarrage
        setImmediate(() => {
            checkAndRunMissedTask();
        });
    }

    cron.schedule('0 */2 * * *', upsertAggregateSnapshotTask, {
        scheduled: true,
        timezone: APP_TIMEZONE
    });
    console.log('Scheduled aggregate snapshot task to run every 2 hours.');

    cron.schedule('0 16 * * *', finalizeHistoricalDayTask, {
        scheduled: true,
        timezone: APP_TIMEZONE
    });
    console.log('Scheduled historical day finalization and status reset task to run daily at 16:00.');

    console.log('Historical tasks scheduled.');
}

module.exports = {
    scheduleHistoricalTasks,
    upsertAggregateSnapshotTask,
    finalizeHistoricalDayTask,
    calculateCurrentAggregateStats,
    checkAndRunMissedTask,
};