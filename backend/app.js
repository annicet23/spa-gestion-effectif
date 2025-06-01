'use strict';
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config(); // Garde cette ligne au tout début pour charger les variables d'environnement

// Importez les fonctions utilitaires de date
const { getHistoricalDate } = require('./utils/date');

const app = express();
const PORT = process.env.PORT || 3000; // Le port vient du .env, ou 3000 par défaut

// --- DÉBUT DES MODIFICATIONS/VÉRIFICATIONS CRUCIALES ICI ---

// Configuration CORS explicite
const corsOptions = {
    // --- MODIFICATION ICI: Utilisation de process.env.FRONTEND_URL ---
    // Remplacez l'URL codée en dur par la variable d'environnement
    origin: process.env.FRONTEND_URL,
    // Si tu as besoin de multiples origines (par exemple, localhost en dev),
    // assure-toi que process.env.FRONTEND_URL est configuré comme une chaîne JSON d'array si tu veux cette flexibilité,
    // ou gère-le avec un autre .env si le besoin est ponctuel.
    // Pour l'instant, on se base sur une seule URL venant du .env.
    // L'exemple 'http://localhost:5173' peut être retiré ou commenté.
    // origin: ['http://10.134.174.81:5173', 'http://localhost:5173'], // Exemple pour le développement local

    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// --- FIN DES MODIFICATIONS/VÉRIFICATIONS CRUCIALES ICI ---

// Les middlewares de parsing du corps doivent venir APRÈS CORS
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Import des models (nécessaire pour le cron job et les routes)
const db = require('./models');

// Import des routes
const authRoutes = require('./routes/authRoutes');
const cadreRoutes = require('./routes/cadreRoutes');
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
app.use('/api/absences', absenceRoutes);
app.use('/api/escadrons', escadronRoutes);
app.use('/api/mises-a-jour', miseajourRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard/summary', dashboardRoutes);
app.use('/api/historique-absences', historiqueAbsencesRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/admin', adminTasksRoutes);

// Route de base pour tester si le serveur fonctionne
app.get('/', (req, res) => {
    res.send('API backend pour la gestion des effectifs des cadres.');
});

// Le cron job n'a pas d'URL codée en dur, donc pas de modification nécessaire ici.
cron.schedule('0 16 * * *', async () => {
    console.log("Scheduler: Debut de la tache quotidienne de snapshot et reinitialisation...");
    try {
        const now = new Date();
        const dateForArchivingPeriod = new Date(getHistoricalDate(now));
        dateForArchivingPeriod.setDate(dateForArchivingPeriod.getDate() - 1);
        const previousHistoricalDayDateOnly = dateForArchivingPeriod.toISOString().split('T')[0];
        const todayHistoricalDate = getHistoricalDate(now);

        console.log(`Scheduler: Archivage de fin de journee pour la date historique : ${previousHistoricalDayDateOnly} (Période se terminant à 15:59:59).`);
        console.log(`Scheduler: Reinitialisation et debut de journee pour la date historique : ${todayHistoricalDate} (Période commençant à 16:00:00).`);

        const transaction = await db.sequelize.transaction();
        try {
            console.log("Scheduler: Phase 1: Archivage de l'etat de fin de journee historique...");
            const cadresFinJourneeHier = await db.Cadre.findAll({
                attributes: ['id', 'statut_absence', 'motif_absence'],
                transaction
            });

            const totalCadres = cadresFinJourneeHier.length;
            const absentsCadres = cadresFinJourneeHier.filter(c => c.statut_absence === 'Absent').length;
            const indisponiblesCadres = cadresFinJourneeHier.filter(c => c.statut_absence === 'Indisponible').length;
            const presentsCadres = totalCadres - absentsCadres - indisponiblesCadres;
            const surLeRangCadres = presentsCadres;

            console.log(`Scheduler: Stats Fin periode pour date historique ${previousHistoricalDayDateOnly} : Total=${totalCadres}, A=${absentsCadres}, I=${indisponiblesCadres}, P=${presentsCadres}, S=${surLeRangCadres}`);

            try {
                await db.HistoriqueStatsJournalieresCadres.create({
                    date_snapshot: previousHistoricalDayDateOnly,
                    total_cadres: totalCadres,
                    absents_cadres: absentsCadres,
                    presents_cadres: presentsCadres,
                    indisponibles_cadres: indisponiblesCadres,
                    sur_le_rang_cadres: surLeRangCadres,
                }, { transaction, ignoreDuplicates: true });
                console.log(`Scheduler: Stats Fin periode pour ${previousHistoricalDayDateOnly} archivees avec succes (ou ignorees si doublons).`);
            } catch (error) {
                if (error.name === 'SequelizeUniqueConstraintError') {
                    console.warn(`Scheduler: Stats Fin periode pour ${previousHistoricalDayDateOnly} existent deja. Passage a l'archivage detaille.`);
                } else {
                    console.error("Scheduler: Erreur lors de l'archivage des stats Fin periode:", error);
                    throw error;
                }
            }

            const historiquePersonnesDataFinJMoins1 = cadresFinJourneeHier.map(cadre => ({
                date_snapshot: previousHistoricalDayDateOnly,
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
                    console.log(`Scheduler: ${historiquePersonnesDataFinJMoins1.length} enregistrements detailles Fin periode archives avec succes (ou ignores si doublons).`);
                } catch (error) {
                    console.error("Scheduler: Erreur lors de l'archivage detaille Fin periode:", error);
                    throw error;
                }
            } else {
                console.log("Scheduler: Aucun cadre trouve pour l'archivage detaille Fin periode.");
            }

            console.log("Scheduler: Phase 2: Reinitialisation de la table cadres pour la nouvelle periode...");
            await db.Cadre.update(
                {
                    statut_absence: 'Présent',
                    date_debut_absence: null,
                    motif_absence: null
                },
                {
                    where: {},
                    transaction
                }
            );
            console.log("Scheduler: Table cadres reinitialisee avec succes pour la nouvelle periode.");

            console.log("Scheduler: Phase 3: Archivage de l'etat de debut de journee historique...");
            const cadresDebutJourneeJ = await db.Cadre.findAll({
                attributes: ['id', 'statut_absence', 'motif_absence'],
                transaction
            });

            const totalCadresDebutJ = cadresDebutJourneeJ.length;
            const absentsCadresDebutJ = 0;
            const indisponiblesCadresDebutJ = 0;
            const presentsCadresDebutJ = totalCadresDebutJ;
            const surLeRangCadresDebutJ = presentsCadresDebutJ;

            console.log(`Scheduler: Stats Debut periode pour date historique ${todayHistoricalDate} : Total=${totalCadresDebutJ}, A=${absentsCadresDebutJ}, I=${indisponiblesCadresDebutJ}, P=${presentsCadresDebutJ}, S=${surLeRangCadresDebutJ}`);

            try {
                await db.HistoriqueStatsJournalieresCadres.create({
                    date_snapshot: todayHistoricalDate,
                    total_cadres: totalCadresDebutJ,
                    absents_cadres: absentsCadresDebutJ,
                    presents_cadres: presentsCadresDebutJ,
                    indisponibles_cadres: indisponiblesCadresDebutJ,
                    sur_le_rang_cadres: surLeRangCadresDebutJ,
                }, { transaction, ignoreDuplicates: true });
                console.log(`Scheduler: Stats Debut periode pour ${todayHistoricalDate} archivees avec succes (ou ignorees si doublons).`);
            } catch (error) {
                if (error.name === 'SequelizeUniqueConstraintError') {
                    console.warn(`Scheduler: Stats Debut periode pour ${todayHistoricalDate} existent deja.`);
                } else {
                    console.error("Scheduler: Erreur lors de l'archivage des stats Debut periode:", error);
                    throw error;
                }
            }

            const historiquePersonnesDataDebutJ = cadresDebutJourneeJ.map(cadre => ({
                date_snapshot: todayHistoricalDate,
                cadre_id: cadre.id,
                statut_snapshot: cadre.statut_absence,
                motif_snapshot: cadre.motif_absence,
            }));

            if (historiquePersonnesDataDebutJ.length > 0) {
                try {
                    await db.HistoriquePersonnesJournalieresCadres.bulkCreate(historiquePersonnesDataDebutJ, {
                        ignoreDuplicates: true,
                        transaction
                    });
                    console.log(`Scheduler: ${historiquePersonnesDataDebutJ.length} enregistrements detailles Debut periode archives avec succes (ou ignores si doublons).`);
                } catch (error) {
                    console.error("Scheduler: Erreur lors de l'archivage detaille Debut periode:", error);
                    throw error;
                }
            } else {
                console.log("Scheduler: Aucun cadre trouve pour l'archivage detaille Debut periode.");
            }

            await transaction.commit();
            console.log("Scheduler: Transaction commitee. Tache quotidienne terminee avec succes.");

        } catch (error) {
            await transaction.rollback();
            console.error("Scheduler: Transaction annulee suite a une erreur:", error);
            throw error;
        }

    } catch (error) {
        console.error("Scheduler: Erreur critique lors de l'execution de la tache quotidienne:", error);
    }
});

// Synchronisation DB et démarrage serveur
(async () => {
    try {
        await db.sequelize.sync();
        console.log('Base de données synchronisée');

        const host = '0.0.0.0';
        app.listen(PORT, host, () => {
            console.log(`Serveur backend démarré sur http://${host}:${PORT}`);
            // --- MODIFICATION ICI : Utilisation de process.env.FRONTEND_URL pour le log ---
            // Cela donne une indication plus claire de l'adresse IP à utiliser pour le frontend
            console.log(`Assurez-vous que votre frontend est configuré pour se connecter à: ${process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(':5173', `:${PORT}`) : `http://ton_adresse_ip:${PORT}`}`);
            // --- FIN MODIFICATION ---
            console.log('Planificateur de tâches démarré (node-cron).');
        });
    } catch (err) {
        console.error('Erreur de synchronisation de la base de données ou démarrage du serveur :', err);
        process.exit(1);
    }
})();