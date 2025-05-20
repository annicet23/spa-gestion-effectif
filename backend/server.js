const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const db = require('./models');

const { scheduleHistoricalTasks } = require('./tasks/historicalTasks');

const authRoutes = require('./routes/authRoutes');
const cadreRoutes = require('./routes/cadreRoutes');
const absenceRoutes = require('./routes/absenceRoutes');
const miseajourRoutes = require('./routes/miseajourRoutes'); // Gardez cette ligne pour votre route
const userRoutes = require('./routes/userRoutes');
const escadronRoutes = require('./routes/escadronRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const statusRoutes = require('./routes/statusRoutes');
const historyRoutes = require('./routes/history');
const adminTasksRoutes = require('./routes/adminTasksRoutes');
const repartitionRoutes = require('./routes/repartitionRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares Express
app.use(cors()); // Permet les requêtes cross-origin

// LES MIDDLEWARES DE PARSING DU CORPS DOIVENT VENIR AVANT TOUTES LES ROUTES QUI EN ONT BESOIN
app.use(bodyParser.json()); // Analyse les requêtes avec un corps JSON (application/json)
app.use(bodyParser.urlencoded({ extended: true })); // Analyse les requêtes avec des corps URL-encoded

// Monter les routeurs - Faites-le APRES les middlewares de parsing
app.use('/api/auth', authRoutes);
app.use('/api/cadres', cadreRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/escadrons', escadronRoutes);
app.use('/api/mises-a-jour', miseajourRoutes); // <-- Cette ligne doit être ici
app.use('/api/users', userRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminTasksRoutes);
app.use('/api/repartition', repartitionRoutes);

// Route de base pour tester si le serveur fonctionne
app.get('/', (req, res) => {
    res.send('API backend pour la gestion des effectifs des cadres.');
});

(async () => {
    try {
        await db.sequelize.sync({ logging: false });
        console.log('Base de données synchronisée.');

        scheduleHistoricalTasks();
        console.log('Historical tasks scheduled.');

        app.listen(PORT, () => {
            console.log(`Serveur démarré sur le port ${PORT}.`);
        });

    } catch (err) {
        console.error('Erreur de synchronisation de la base de données ou de démarrage du serveur :', err);
        process.exit(1);
    }
})();