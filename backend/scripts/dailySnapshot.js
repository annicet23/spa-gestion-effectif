// scripts/dailySnapshot.js
// Ce script est execute par un scheduler (cron, etc.) chaque nuit a minuit.

// Importez votre configuration et vos modeles comme dans app.js
// Assurez-vous que le chemin vers models/index.js est correct par rapport a l'emplacement de ce script.
const db = require('../models'); // Adaptez le chemin si necessaire

// Importez les operateurs Sequelize si necessaire (pas directement utilise ici mais bonne pratique)
// const { Op } = require('sequelize');

// Fonction principale asynchrone pour le scheduler
async function runDailySnapshotAndReset() {
    console.log("Scheduler: Debut de la tache quotidienne de snapshot et reinitialisation...");

    try {
        // --- Calcul des dates ---
        const now = new Date();
        // Date d'hier pour l'archivage (fin de journee J-1)
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayDateOnly = yesterday.toISOString().split('T')[0]; // Format YYYY-MM-DD

        // Date d'aujourd'hui pour l'archivage (debut de journee J - apres reset)
        const todayDateOnly = now.toISOString().split('T')[0]; // Format YYYY-MM-DD

        console.log(`Scheduler: Archivage pour la date : ${yesterdayDateOnly}`);
        console.log(`Scheduler: Reinitialisation pour la date : ${todayDateOnly}`);

        // Utiliser une transaction pour garantir l'atomicite des operations (tout reussit ou tout echoue)
        const transaction = await db.sequelize.transaction();

        try {
            // --- PHASE 1 : ARCHIVAGE (Snapshot de fin de journee J-1) ---
            console.log("Scheduler: Phase 1: Archivage de l'etat de fin de journee (J-1)...");

            // 1. Lire l'etat actuel de TOUS les cadres
            const cadresActuels = await db.Cadre.findAll({
                attributes: ['id', 'statut_absence', 'motif_absence'], // Selectionnez seulement les champs necessaires
                transaction // Utiliser la transaction
            });

            const totalCadres = cadresActuels.length;
            const absentsCadres = cadresActuels.filter(c => c.statut_absence === 'Absent').length;
            const indisponiblesCadres = cadresActuels.filter(c => c.statut_absence === 'Indisponible').length;
            const presentsCadres = totalCadres - absentsCadres - indisponiblesCadres;
            const surLeRangCadres = presentsCadres; // Selon votre definition actuelle

            console.log(`Scheduler: Stats J-1 : Total=${totalCadres}, A=${absentsCadres}, I=${indisponiblesCadres}, P=${presentsCadres}, S=${surLeRangCadres}`);

            // 2. Insérer les statistiques globales de fin de journée dans la table d'historique
            try {
                await db.HistoriqueStatsJournalieresCadres.create({
                    date_snapshot: yesterdayDateOnly,
                    total_cadres: totalCadres,
                    absents_cadres: absentsCadres,
                    presents_cadres: presentsCadres,
                    indisponibles_cadres: indisponiblesCadres,
                    sur_le_rang_cadres: surLeRangCadres,
                }, { transaction }); // Utiliser la transaction
                 console.log("Scheduler: Stats J-1 archivees avec succes.");
            } catch (error) {
                // Gerer le cas ou un enregistrement pour hier existe deja (si le script tourne plusieurs fois)
                 if (error.name === 'SequelizeUniqueConstraintError') {
                    console.warn(`Scheduler: Stats pour le ${yesterdayDateOnly} existent deja. Passage a l'archivage detaille.`);
                 } else {
                     throw error; // Relancer si c'est une autre erreur
                 }
            }

            // 3. Insérer l'etat detaille de chaque cadre en fin de journee dans la table d'historique
            const historiquePersonnesData = cadresActuels.map(cadre => ({
                date_snapshot: yesterdayDateOnly,
                cadre_id: cadre.id,
                statut_snapshot: cadre.statut_absence,
                motif_snapshot: cadre.motif_absence,
            }));

             if (historiquePersonnesData.length > 0) {
                 try {
                     await db.HistoriquePersonnesJournalieresCadres.bulkCreate(historiquePersonnesData, {
                         ignoreDuplicates: true, // ignoreDuplicates pour gerer les executions multiples potentielles
                         transaction // Utiliser la transaction
                     });
                      console.log(`Scheduler: ${historiquePersonnesData.length} enregistrements detailles J-1 archives avec succes (ou ignores si doublons).`);
                 } catch (error) {
                     console.error("Scheduler: Erreur lors de l'archivage detaille J-1:", error);
                     // Decidez si une erreur ici doit bloquer le reset. Probablement non, juste logguer.
                 }
             } else {
                 console.log("Scheduler: Aucun cadre trouve pour l'archivage detaille J-1.");
             }


            // --- PHASE 2 : REINITIALISATION (pour le debut de journee J) ---
            console.log("Scheduler: Phase 2: Reinitialisation de la table cadres (J)...");

            await db.Cadre.update(
                {
                    statut_absence: 'Présent',
                    date_debut_absence: null,
                    motif_absence: null
                },
                {
                    where: {}, // La clause where vide affecte toutes les lignes
                    transaction // Utiliser la transaction
                }
            );

            console.log("Scheduler: Table cadres reinitialisee avec succes.");


            // --- PHASE 3 (Optionnel mais recommande) : ARCHIVAGE (Snapshot de debut de journee J) ---
             console.log("Scheduler: Phase 3: Archivage de l'etat de debut de journee (J)...");

             // Relire l'etat apres reinitialisation (qui devrait etre tout Present)
             const cadresApresReset = await db.Cadre.findAll({
                 attributes: ['id', 'statut_absence', 'motif_absence'],
                 transaction // Utiliser la transaction
             });

             const totalCadresApresReset = cadresApresReset.length;
             // Apres reset, A=0, I=0, donc P=Total et S=P
             const absentsCadresApresReset = 0;
             const indisponiblesCadresApresReset = 0;
             const presentsCadresApresReset = totalCadresApresReset;
             const surLeRangCadresApresReset = presentsCadresApresReset;

             console.log(`Scheduler: Stats J : Total=${totalCadresApresReset}, A=${absentsCadresApresReset}, I=${indisponiblesCadresApresReset}, P=${presentsCadresApresReset}, S=${surLeRangCadresApresReset}`);


             try {
                 await db.HistoriqueStatsJournalieresCadres.create({
                     date_snapshot: todayDateOnly,
                     total_cadres: totalCadresApresReset,
                     absents_cadres: absentsCadresApresReset,
                     presents_cadres: presentsCadresApresReset,
                     indisponibles_cadres: indisponiblesCadresApresReset,
                     sur_le_rang_cadres: surLeRangCadresApresReset,
                 }, { transaction }); // Utiliser la transaction
                  console.log("Scheduler: Stats J archivees avec succes.");
             } catch (error) {
                 if (error.name === 'SequelizeUniqueConstraintError') {
                    console.warn(`Scheduler: Stats pour le ${todayDateOnly} existent deja (debut de journee).`);
                 } else {
                     throw error;
                 }
             }

             const historiquePersonnesDataApresReset = cadresApresReset.map(cadre => ({
                 date_snapshot: todayDateOnly,
                 cadre_id: cadre.id,
                 statut_snapshot: cadre.statut_absence, // Devrait etre 'Present'
                 motif_snapshot: cadre.motif_absence, // Devrait etre null
             }));

              if (historiquePersonnesDataApresReset.length > 0) {
                  try {
                     await db.HistoriquePersonnesJournalieresCadres.bulkCreate(historiquePersonnesDataApresReset, {
                         ignoreDuplicates: true,
                         transaction // Utiliser la transaction
                     });
                      console.log(`Scheduler: ${historiquePersonnesDataApresReset.length} enregistrements detailles J archives avec succes (ou ignores si doublons).`);
                  } catch (error) {
                      console.error("Scheduler: Erreur lors de l'archivage detaille J:", error);
                  }
              } else {
                  console.log("Scheduler: Aucun cadre trouve pour l'archivage detaille J.");
              }

            // Si tout s'est bien passe, commiter la transaction
            await transaction.commit();
            console.log("Scheduler: Transaction commitee. Tache quotidienne terminee avec succes.");

        } catch (error) {
            // En cas d'erreur, annuler toutes les operations de la transaction
            await transaction.rollback();
            console.error("Scheduler: Transaction annulee suite a une erreur:", error);
            throw error; // Relancer l'erreur pour qu'elle soit capturee par le catch externe
        }

    } catch (error) {
        console.error("Scheduler: Erreur critique lors de l'execution de la tache quotidienne:", error);
        // Gerer l'erreur (envoyer une alerte, logguer, etc.)
    } finally {
        // Fermer la connexion a la base de donnees a la fin du script
        // Attention: Dans certains environnements (comme AWS Lambda), la connexion peut etre geree differemment.
        // Pour un script cron simple, fermer la connexion est approprie.
        if (db && db.sequelize) {
             try {
                await db.sequelize.close();
                console.log("Scheduler: Connexion DB fermee.");
             } catch (closeError) {
                console.error("Scheduler: Erreur lors de la fermeture de la connexion DB:", closeError);
             }
        }
    }
}

// Exécuter la fonction principale lorsque le script est lance
runDailySnapshotAndReset();
