// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const db = require('./models');

const { scheduleHistoricalTasks } = require('./tasks/historicalTasks');

const authRoutes = require('./routes/authRoutes');
const cadreRoutes = require('./routes/cadreRoutes');
const absenceRoutes = require('./routes/absenceRoutes');
const miseajourRoutes = require('./routes/miseajourRoutes');
const userRoutes = require('./routes/userRoutes');
const escadronRoutes = require('./routes/escadronRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const statusRoutes = require('./routes/statusRoutes');
const historyRoutes = require('./routes/history');
const adminTasksRoutes = require('./routes/adminTasksRoutes');
const repartitionRoutes = require('./routes/repartitionRoutes');
const consultantRoutes = require('./routes/consultantRoutes');
const app = express();
const PORT = process.env.PORT || 3000;

// --- DÉBUT DES MODIFICATIONS/VÉRIFICATIONS CRUCIALES ICI ---

// Configuration CORS explicite pour gérer les requêtes OPTIONS (preflight) et les en-têtes
const corsOptions = {
    // CORRECTION APPORTÉE ICI:
    // Remplacez '*' par l'URL exacte de votre frontend.
    // Si votre frontend peut être accédé depuis plusieurs adresses (ex: localhost et l'IP),
    // vous pouvez fournir un tableau d'origines.
    origin: 'http://10.87.63.23:5173',
    // Exemple si vous utilisez aussi localhost pour le développement:
    // origin: ['http://10.87.63.23:5173', 'http://localhost:5173'],

    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // Incluez toutes les méthodes HTTP que votre API utilise, et surtout 'OPTIONS'.
    allowedHeaders: ['Content-Type', 'Authorization'], // C'est essentiel d'autoriser 'Authorization' pour les tokens JWT.
    credentials: true, // Permet l'envoi de cookies et d'en-têtes d'autorisation avec les requêtes.
    optionsSuccessStatus: 204 // Le statut de réponse standard pour une requête OPTIONS réussie.
};

app.use(cors(corsOptions)); // Appliquez le middleware CORS avec les options définies.
                            // Ceci doit être placé AVANT tous vos autres `app.use` pour les routes.

// --- FIN DES MODIFICATIONS/VÉRIFICATIONS CRUCIALES ICI ---


// Les middlewares de parsing du corps doivent venir APRÈS CORS et AVANT toutes les routes qui en ont besoin
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Monter les routeurs
app.use('/api/auth', authRoutes);
app.use('/api/cadres', cadreRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/escadrons', escadronRoutes);
app.use('/api/mises-a-jour', miseajourRoutes);
app.use('/api/users', userRoutes);
app.use('/api', dashboardRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/admin', adminTasksRoutes);
app.use('/api/repartition', repartitionRoutes);
app.use('/api/consultant', consultantRoutes); // Confirmez que cette route est bien là

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

        const host = '0.0.0.0';
        app.listen(PORT, host, () => {
            console.log(`Serveur backend démarré sur http://${host}:${PORT}.`);
            console.log(`Accessible sur le réseau local via http://10.87.63.23:${PORT}`);
        });

    } catch (err) {
        console.error('Erreur de synchronisation de la base de données ou de démarrage du serveur :', err);
        process.exit(1);
    }
})();