'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron'); // Importation de node-cron
require('dotenv').config();
// Importez les fonctions utilitaires de date - AJOUTÉ
const { getHistoricalDate } = require('./utils/date'); // Assurez-vous du chemin correct


const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import des models (necessaire pour le cron job et les routes)
const db = require('./models');

// Import des routes
const authRoutes = require('./routes/authRoutes');
const cadreRoutes = require('./routes/cadreRoutes');
// const eleveRoutes = require('./routes/eleveRoutes'); // Retire l'importation des routes eleves - SUPPRIMÉ
const absenceRoutes = require('./routes/absenceRoutes');
const miseajourRoutes = require('./routes/miseajourRoutes');
const userRoutes = require('./routes/userRoutes');
const escadronRoutes = require('./routes/escadronRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const historiqueAbsencesRoutes = require('./routes/historique-absences');

const statusRoutes = require('./routes/statusRoutes');
const adminTasksRoutes = require('./routes/adminTasksRoutes');

// Montage des routeurs
app.use('/api/auth', authRoutes);
app.use('/api/cadres', cadreRoutes);
// app.use('/api/eleves', eleveRoutes); // Retire le montage des routes eleves - SUPPRIMÉ
app.use('/api/absences', absenceRoutes);
app.use('/api/escadrons', escadronRoutes);
app.use('/api/mises-a-jour', miseajourRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard/summary', dashboardRoutes);
app.use('/api/historique-absences', historiqueAbsencesRoutes);
// Montez la route historiqueCadresRoutes si vous l'avez
// app.use('/api/historique-cadres', historiqueCadresRoutes);
// Si la route /api/status/cadres/summary est dans statusRoutes, c'est deja gere par la ligne ci-dessous
app.use('/api/status', statusRoutes);

app.use('/api/admin', adminTasksRoutes);
// Route de base pour tester si le serveur fonctionne
app.get('/', (req, res) => {
    res.send('API backend pour la gestion des effectifs des cadres.');
});


cron.schedule('0 16 * * *', async () => { // MODIFIÉ
    console.log("Scheduler: Debut de la tache quotidienne de snapshot et reinitialisation...");

    try {
       
        const now = new Date(); // L'heure actuelle, ~16h00:00

        const dateForArchivingPeriod = new Date(getHistoricalDate(now)); // Convertir la date string en objet Date
        dateForArchivingPeriod.setDate(dateForArchivingPeriod.getDate() - 1); // Reculer d'un jour pour obtenir la date du jour qui se termine à 15h59.
        const previousHistoricalDayDateOnly = dateForArchivingPeriod.toISOString().split('T')[0]; // Format YYYY-MM-DD

        // La date pour la nouvelle période qui commence maintenant (16h) est simplement la date de fin du jour historique retournée par getHistoricalDate(now).
        const todayHistoricalDate = getHistoricalDate(now);


        console.log(`Scheduler: Archivage de fin de journee pour la date historique : ${previousHistoricalDayDateOnly} (Période se terminant à 15:59:59).`); // MODIFIÉ
        console.log(`Scheduler: Reinitialisation et debut de journee pour la date historique : ${todayHistoricalDate} (Période commençant à 16:00:00).`); // MODIFIÉ

        // Utiliser une transaction pour garantir l'atomicite des operations (tout reussit ou tout echoue)
        const transaction = await db.sequelize.transaction();

        try {
            // --- PHASE 1 : ARCHIVAGE (Snapshot de fin de journee historique) ---
            console.log("Scheduler: Phase 1: Archivage de l'etat de fin de journee historique..."); // MODIFIÉ

            // 1. Lire l'etat actuel de TOUS les cadres (cet etat est celui de la fin de la période 16h-15h59)
            const cadresFinJourneeHier = await db.Cadre.findAll({
                attributes: ['id', 'statut_absence', 'motif_absence'], // Selectionnez seulement les champs necessaires
                transaction // Utiliser la transaction
            });

            // Calculer les statistiques basees sur l'etat de fin de journee
            const totalCadres = cadresFinJourneeHier.length;
            const absentsCadres = cadresFinJourneeHier.filter(c => c.statut_absence === 'Absent').length;
            const indisponiblesCadres = cadresFinJourneeHier.filter(c => c.statut_absence === 'Indisponible').length;
            const presentsCadres = totalCadres - absentsCadres - indisponiblesCadres;
            const surLeRangCadres = presentsCadres; // Selon votre definition actuelle

            console.log(`Scheduler: Stats Fin periode pour date historique ${previousHistoricalDayDateOnly} : Total=${totalCadres}, A=${absentsCadres}, I=${indisponiblesCadres}, P=${presentsCadres}, S=${surLeRangCadres}`); // MODIFIÉ

            // 2. Insérer les statistiques globales de fin de journée historique dans la table d'historique
            try {
                await db.HistoriqueStatsJournalieresCadres.create({
                    date_snapshot: previousHistoricalDayDateOnly, // <-- Utiliser la date historique de la période finie - MODIFIÉ
                    total_cadres: totalCadres,
                    absents_cadres: absentsCadres,
                    presents_cadres: presentsCadres,
                    indisponibles_cadres: indisponiblesCadres,
                    sur_le_rang_cadres: surLeRangCadres,
                }, { transaction, ignoreDuplicates: true });
                 console.log(`Scheduler: Stats Fin periode pour ${previousHistoricalDayDateOnly} archivees avec succes (ou ignorees si doublons).`); // MODIFIÉ
            } catch (error) {
                // Gerer l'erreur de doublon si ignoreDuplicates ne suffit pas pour une raison X (rare)
                 if (error.name === 'SequelizeUniqueConstraintError') {
                    console.warn(`Scheduler: Stats Fin periode pour ${previousHistoricalDayDateOnly} existent deja. Passage a l'archivage detaille.`); // MODIFIÉ
                 } else {
                     console.error("Scheduler: Erreur lors de l'archivage des stats Fin periode:", error); // MODIFIÉ
                     throw error; // Relancer si c'est une autre erreur pour annuler la transaction
                 }
            }


            // 3. Insérer l'etat detaille de chaque cadre en fin de journee historique dans la table d'historique
            const historiquePersonnesDataFinJMoins1 = cadresFinJourneeHier.map(cadre => ({
                date_snapshot: previousHistoricalDayDateOnly, // <-- Utiliser la date historique - MODIFIÉ
                cadre_id: cadre.id,
                statut_snapshot: cadre.statut_absence,
                motif_snapshot: cadre.motif_absence,
            }));

             if (historiquePersonnesDataFinJMoins1.length > 0) {
                 try {
                     await db.HistoriquePersonnesJournalieresCadres.bulkCreate(historiquePersonnesDataFinJMoins1, {
                         ignoreDuplicates: true,
                         transaction
                     });
                      console.log(`Scheduler: ${historiquePersonnesDataFinJMoins1.length} enregistrements detailles Fin periode archives avec succes (ou ignores si doublons).`); // MODIFIÉ
                 } catch (error) {
                     console.error("Scheduler: Erreur lors de l'archivage detaille Fin periode:", error); // MODIFIÉ
                     throw error;
                 }
             } else {
                 console.log("Scheduler: Aucun cadre trouve pour l'archivage detaille Fin periode."); // MODIFIÉ
             }


            // --- PHASE 2 : REINITIALISATION (pour le debut de journee historique) ---
            console.log("Scheduler: Phase 2: Reinitialisation de la table cadres pour la nouvelle periode..."); // MODIFIÉ

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
            console.log("Scheduler: Table cadres reinitialisee avec succes pour la nouvelle periode."); // MODIFIÉ


            // --- PHASE 3 (Optionnel mais recommande) : ARCHIVAGE (Snapshot de debut de journee historique) ---
             console.log("Scheduler: Phase 3: Archivage de l'etat de debut de journee historique..."); // MODIFIÉ

             // Relire l'etat apres reinitialisation (qui devrait etre tout Present)
             const cadresDebutJourneeJ = await db.Cadre.findAll({
                 attributes: ['id', 'statut_absence', 'motif_absence'],
                 transaction // Utiliser la transaction
             });

             // Calculer les statistiques basees sur l'etat de debut de journee (tout Present)
             const totalCadresDebutJ = cadresDebutJourneeJ.length;
             const absentsCadresDebutJ = 0;
             const indisponiblesCadresDebutJ = 0;
             const presentsCadresDebutJ = totalCadresDebutJ;
             const surLeRangCadresDebutJ = presentsCadresDebutJ;

             console.log(`Scheduler: Stats Debut periode pour date historique ${todayHistoricalDate} : Total=${totalCadresDebutJ}, A=${absentsCadresDebutJ}, I=${indisponiblesCadresDebutJ}, P=${presentsCadresDebutJ}, S=${surLeRangCadresDebutJ}`); // MODIFIÉ

             try {
                 await db.HistoriqueStatsJournalieresCadres.create({
                     date_snapshot: todayHistoricalDate, // <-- Utiliser la date historique de la nouvelle période - MODIFIÉ
                     total_cadres: totalCadresDebutJ,
                     absents_cadres: absentsCadresDebutJ,
                     presents_cadres: presentsCadresDebutJ,
                     indisponibles_cadres: indisponiblesCadresDebutJ,
                     sur_le_rang_cadres: surLeRangCadresDebutJ,
                 }, { transaction, ignoreDuplicates: true });
                  console.log(`Scheduler: Stats Debut periode pour ${todayHistoricalDate} archivees avec succes (ou ignorees si doublons).`); // MODIFIÉ
             } catch (error) {
                 // Gerer l'erreur de doublon si ignoreDuplicates ne suffit pas
                 if (error.name === 'SequelizeUniqueConstraintError') {
                    console.warn(`Scheduler: Stats Debut periode pour ${todayHistoricalDate} existent deja.`); // MODIFIÉ
                 } else {
                     console.error("Scheduler: Erreur lors de l'archivage des stats Debut periode:", error); // MODIFIÉ
                    throw error;
                 }
             }


             const historiquePersonnesDataDebutJ = cadresDebutJourneeJ.map(cadre => ({
                 date_snapshot: todayHistoricalDate, // <-- Utiliser la date historique - MODIFIÉ
                 cadre_id: cadre.id,
                 statut_snapshot: cadre.statut_absence, // Devrait etre 'Present'
                 motif_snapshot: cadre.motif_absence, // Devrait etre null
             }));

              if (historiquePersonnesDataDebutJ.length > 0) {
                  try {
                     await db.HistoriquePersonnesJournalieresCadres.bulkCreate(historiquePersonnesDataDebutJ, {
                         ignoreDuplicates: true,
                         transaction
                     });
                      console.log(`Scheduler: ${historiquePersonnesDataDebutJ.length} enregistrements detailles Debut periode archives avec succes (ou ignores si doublons).`); // MODIFIÉ
                  } catch (error) {
                      console.error("Scheduler: Erreur lors de l'archivage detaille Debut periode:", error); // MODIFIÉ
                      throw error;
                  }
              } else {
                  console.log("Scheduler: Aucun cadre trouve pour l'archivage detaille Debut periode."); // MODIFIÉ
              }


            // Si tout s'est bien passe, commiter la transaction
            await transaction.commit();
            console.log("Scheduler: Transaction commitee. Tache quotidienne terminee avec succes.");

        } catch (error) {
            // En cas d'erreur, annuler toutes les operations de la transaction
            await transaction.rollback();
            console.error("Scheduler: Transaction annulee suite a une erreur:", error);
            // Important : relancer l'erreur pour que node-cron puisse potentiellement la logger
            throw error;
        }

    } catch (error) {
        console.error("Scheduler: Erreur critique lors de l'execution de la tache quotidienne:", error);
        // Ici, vous pourriez ajouter une notification (ex: email d'alerte)
    }
   
});


// Synchronisation DB et démarrage serveur
(async () => {
    try {
        await db.sequelize.sync(); // { logging: false } si vous voulez moins de logs au demarrage
        console.log('Base de données synchronisée');

        app.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}`);
            console.log('Planificateur de tâches démarré (node-cron).');
        });
    } catch (err) {
        console.error('Erreur de synchronisation de la base de données ou démarrage du serveur :', err);
        process.exit(1);
    }
})();