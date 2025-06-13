const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// ✅ CONFIGURATION FUSEAU HORAIRE - DOIT ÊTRE EN PREMIER
process.env.TZ = 'Indian/Antananarivo';

// ✅ Vérification immédiate
console.log("=== CONFIGURATION FUSEAU HORAIRE ===");
console.log("Fuseau configuré:", process.env.TZ);
console.log("Heure serveur locale:", new Date().toString());
console.log("Heure UTC:", new Date().toUTCString());
console.log("Timezone détecté:", Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log("Offset en minutes:", new Date().getTimezoneOffset());
console.log("=======================================");

const db = require('./models'); // Chargé APRÈS la config TZ

const { scheduleHistoricalTasks } = require('./tasks/historicalTasks');

// --- NOUVEAUX IMPORTS POUR LE CHAT EN TEMPS RÉEL ---
const http = require('http'); // Importez http pour créer le serveur WebSocket
const { Server } = require('socket.io'); // Importez Socket.IO
// --- FIN NOUVEAUX IMPORTS POUR LE CHAT ---

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

// --- NOUVEAUX IMPORTS POUR LA BIBLIOTHÈQUE ET L'UPLOAD (DÉJÀ PRÉSENTS) ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const libraryRoutes = require('./routes/libraryRoutes');
// --- FIN NOUVEAUX IMPORTS ---
const organigrammeRoutes = require('./routes/organigramme');
// --- NOUVEL IMPORT POUR LES PERMISSIONS (DÉJÀ PRÉSENT) ---
const permissionRoutes = require('./routes/permissionsRoutes');
// --- FIN NOUVEL IMPORT ---

const app = express();

// Créez le serveur HTTP à partir de l'application Express
const server = http.createServer(app);

// ✅ CONFIGURATION URL DYNAMIQUE BASÉE SUR VOTRE .env.local
const API_HOST = process.env.API_HOST ;
const API_PORT = process.env.PORT ;
const FRONTEND_PORT = process.env.FRONTEND_PORT ;

// ✅ CONFIGURATION EXACTE BASÉE SUR VOTRE VITE_API_BASE_URL
const FRONTEND_URL = `http://${API_HOST}:${FRONTEND_PORT}`;
const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;

console.log("=== CONFIGURATION URLS ===");
console.log("API_HOST:", API_HOST);
console.log("API_PORT:", API_PORT);
console.log("FRONTEND_PORT:", FRONTEND_PORT);
console.log("FRONTEND_URL:", FRONTEND_URL);
console.log("API_BASE_URL:", API_BASE_URL);
console.log("VITE_API_BASE_URL compatible:", `${API_BASE_URL}/`);
console.log("==============================");

// --- INITIALISATION DE SOCKET.IO ---
const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL, // ✅ URL frontend (port 5173)
        methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
        credentials: true,
    }
});
// --- FIN INITIALISATION DE SOCKET.IO ---

// Configuration CORS explicite pour gérer les requêtes OPTIONS (preflight) et les en-têtes
const corsOptions = {
    origin: FRONTEND_URL, // ✅ URL frontend (port 5173)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Dans la section des imports
const dbAdminRoutes = require('./routes/dbAdmin');

// Dans la section des routes (avec les autres routes API)
app.use('/api/db-admin', dbAdminRoutes);

// ✅ Route pour obtenir l'heure du serveur - CORRIGÉE
app.get('/api/server-time', (req, res) => {
  try {
    const serverDate = new Date();

    // ✅ INFORMATIONS DÉTAILLÉES POUR DEBUG
    console.log("=== DEBUG HEURE SERVEUR ===");
    console.log("Date brute:", serverDate);
    console.log("toString():", serverDate.toString());
    console.log("toISOString():", serverDate.toISOString());
    console.log("getTimezoneOffset():", serverDate.getTimezoneOffset());

    res.json({
      serverTime: serverDate.toISOString(), // UTC pour compatibilité
      serverTimeLocal: serverDate.toString(), // Heure locale
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timezoneOffset: serverDate.getTimezoneOffset(),
      // ✅ HEURE SPÉCIFIQUE MADAGASCAR
      madagascarTime: new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Indian/Antananarivo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(serverDate)
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'heure du serveur:', error);
    res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'heure.' });
  }
});

// --- DÉBUT CONFIGURATION UPLOAD DE FICHIERS (ADAPTÉE POUR LE CHAT) ---
const UPLOAD_DIR_CHAT = path.join(__dirname, 'public', 'chat_uploads'); // Nouveau dossier pour les uploads de chat
const UPLOAD_DIR_LIBRARY = path.join(__dirname, 'public', 'files'); // Dossier pour les fichiers de la bibliothèque
const TEMP_UPLOAD_DIR = path.join(__dirname, 'public', 'temp_uploads'); // Dossier temporaire partagé si nécessaire
// ✅ AJOUT - Dossier pour les photos des cadres
const UPLOAD_DIR_CADRES = path.join(__dirname, 'uploads');

// Assurez-vous que les répertoires d'upload existent
[UPLOAD_DIR_CHAT, UPLOAD_DIR_LIBRARY, TEMP_UPLOAD_DIR, UPLOAD_DIR_CADRES].forEach(dir => {
    if (!fs.existsSync(dir)) {
        console.log(`📁 Création du répertoire: ${dir}`);
        fs.mkdirSync(dir, { recursive: true });
    } else {
        console.log(`📁 Répertoire existant: ${dir}`);
    }
});

// Configuration du stockage Multer pour les uploads du chat
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR_CHAT); // Les fichiers du chat vont ici directement
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`); // Nom unique + nom original
    }
});

// Multer instance for chat file uploads (max 10MB)
const uploadChatFile = multer({
    storage: chatStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 Mo
    fileFilter: (req, file, cb) => {
        // Optionnel: vous pouvez filtrer les types de fichiers ici si besoin
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            return cb(new Error('Type de fichier non autorisé.'));
        }
        cb(null, true);
    }
});

// ✅ AJOUT - Configuration Multer pour les photos de cadres
const cadrePhotoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR_CADRES);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const uploadCadrePhoto = multer({
    storage: cadrePhotoStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Seuls les fichiers image sont autorisés.'));
        }
        cb(null, true);
    }
});

// Route d'upload de fichier spécifique pour le chat
// Cette route est appelée AVANT d'envoyer le message via WebSocket
app.post('/api/chat/upload-file', uploadChatFile.single('chatFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier n\'a été uploadé.' });
    }

    const fileData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        // ✅ URL conforme à votre VITE_API_BASE_URL
        fileUrl: `${API_BASE_URL}/chat_uploads/${req.file.filename}`
    };

    res.json({
        message: 'Fichier uploadé avec succès.',
        file: fileData
    });
});

// ✅ NOUVELLE ROUTE - Upload de photo pour les cadres
app.post('/api/upload/photo', uploadCadrePhoto.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Aucun fichier photo n\'a été uploadé.' });
    }

    const photoData = {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        photo_url: `/uploads/${req.file.filename}`
    };

    console.log('✅ Photo uploadée avec succès:', photoData);

    res.json({
        message: 'Photo uploadée avec succès.',
        photo_url: photoData.photo_url,
        file: photoData
    });
});

// Gérer les erreurs de Multer (par exemple, taille de fichier trop grande)
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'Le fichier est trop grand (max 10MB).' });
        }
    } else if (err) {
        // Autres erreurs (par exemple, type de fichier non autorisé)
        return res.status(400).json({ message: err.message });
    }
    next();
});

// ===== SERVIR LES FICHIERS STATIQUES =====

// Servir les fichiers uploadés du chat
app.use('/chat_uploads', express.static(UPLOAD_DIR_CHAT));

// ✅ AJOUT - Servir les photos des cadres
app.use('/uploads', express.static(UPLOAD_DIR_CADRES));

// ===== MIDDLEWARE DE DÉBOGAGE POUR LES FICHIERS DE BIBLIOTHÈQUE =====
app.use('/files/*', (req, res, next) => {
    const requestedFile = req.params[0] || req.url.replace('/files/', '');
    const filePath = path.join(UPLOAD_DIR_LIBRARY, requestedFile);

    console.log(`🔍 Requête fichier bibliothèque: ${req.url}`);
    console.log(`📂 Fichier demandé: ${requestedFile}`);
    console.log(`📁 Chemin complet: ${filePath}`);
    console.log(`✅ Fichier existe: ${fs.existsSync(filePath)}`);

    if (!fs.existsSync(filePath)) {
        console.log(`❌ FICHIER INTROUVABLE: ${filePath}`);
        console.log(`📋 Fichiers disponibles:`, fs.existsSync(UPLOAD_DIR_LIBRARY) ? fs.readdirSync(UPLOAD_DIR_LIBRARY) : 'Dossier inexistant');
    } else {
        const stats = fs.statSync(filePath);
        console.log(`📊 Taille fichier: ${stats.size} bytes`);
    }

    next();
});

// Servir les fichiers statiques de la bibliothèque
app.use('/files', express.static(UPLOAD_DIR_LIBRARY, {
    setHeaders: (res, filePath) => {
        console.log(`📥 Envoi fichier bibliothèque: ${filePath}`);
        res.set({
            'Content-Disposition': 'inline',
            'Cache-Control': 'public, max-age=3600'
        });
    }
}));

// ===== ROUTES DE DEBUG ET TÉLÉCHARGEMENT POUR LA BIBLIOTHÈQUE =====

// Route de debug pour lister les fichiers de la bibliothèque
app.get('/api/debug/files', (req, res) => {
    try {
        console.log('📁 Debug files - Chemin bibliothèque:', UPLOAD_DIR_LIBRARY);

        if (!fs.existsSync(UPLOAD_DIR_LIBRARY)) {
            return res.status(404).json({
                error: 'Dossier bibliothèque inexistant',
                path: UPLOAD_DIR_LIBRARY
            });
        }

        const files = fs.readdirSync(UPLOAD_DIR_LIBRARY);
        const fileDetails = files.map(file => {
            const filePath = path.join(UPLOAD_DIR_LIBRARY, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                url: `/files/${file}`,
                fullUrl: `${API_BASE_URL}/files/${file}`, // ✅ Conforme à votre config
                exists: fs.existsSync(filePath)
            };
        });

        res.json({
            libraryPath: UPLOAD_DIR_LIBRARY,
            totalFiles: files.length,
            files: fileDetails
        });
    } catch (error) {
        console.error('❌ Erreur debug files:', error);
        res.status(500).json({
            error: error.message,
            libraryPath: UPLOAD_DIR_LIBRARY
        });
    }
});

// Route de téléchargement forcé pour la bibliothèque
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR_LIBRARY, filename);

    console.log(`📥 Demande téléchargement: ${filename}`);
    console.log(`📂 Chemin complet: ${filePath}`);

    // Vérifier si le fichier existe
    if (!fs.existsSync(filePath)) {
        console.log(`❌ Fichier non trouvé: ${filePath}`);
        return res.status(404).json({
            error: 'Fichier non trouvé',
            path: filePath,
            filename,
            libraryDir: UPLOAD_DIR_LIBRARY,
            allFiles: fs.existsSync(UPLOAD_DIR_LIBRARY) ? fs.readdirSync(UPLOAD_DIR_LIBRARY) : []
        });
    }

    try {
        const stats = fs.statSync(filePath);
        console.log(`✅ Fichier trouvé, taille: ${stats.size} bytes`);

        // Headers pour forcer le téléchargement
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);

        // Créer un stream de lecture
        const fileStream = fs.createReadStream(filePath);

        // Gérer les erreurs de stream
        fileStream.on('error', (err) => {
            console.log(`❌ Erreur lecture fichier: ${err.message}`);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Erreur lecture fichier' });
            }
        });

        fileStream.on('end', () => {
            console.log(`✅ Téléchargement terminé: ${filename}`);
        });

        // Envoyer le fichier
        fileStream.pipe(res);

    } catch (error) {
        console.log(`❌ Erreur accès fichier: ${error.message}`);
        res.status(500).json({
            error: error.message,
            path: filePath
        });
    }
});

// Route de test pour vérifier un fichier spécifique
app.get('/api/test-file/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR_LIBRARY, filename);

    res.json({
        filename,
        filePath,
        exists: fs.existsSync(filePath),
        libraryDir: UPLOAD_DIR_LIBRARY,
        libraryDirExists: fs.existsSync(UPLOAD_DIR_LIBRARY),
        allFiles: fs.existsSync(UPLOAD_DIR_LIBRARY) ? fs.readdirSync(UPLOAD_DIR_LIBRARY) : [],
        stats: fs.existsSync(filePath) ? fs.statSync(filePath) : null
    });
});

// ===== MONTER LES ROUTEURS EXISTANTS =====
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
app.use('/api/consultant', consultantRoutes);
app.use('/api/library-items', libraryRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/files', express.static(path.join(__dirname, 'public', 'files')));
app.use('/api/organigramme', organigrammeRoutes);

// --- POINT DE TERMINAISON POUR RÉCUPÉRER LA LISTE DES UTILISATEURS DU CHAT ---
app.get('/api/chat/users', async (req, res) => {
    try {
        const users = await db.User.findAll({
            attributes: ['id', 'username', 'nom', 'prenom'],
            where: { status: 'Active' }
        });
        res.json(users);
    } catch (error) {
        console.error('Erreur lors de la récupération des utilisateurs du chat:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des utilisateurs.' });
    }
});
// --- FIN POINT DE TERMINAISON POUR LES UTILISATEURS DU CHAT ---

// --- NOUVELLES ROUTES POUR LA GESTION DES GROUPES DE CHAT ---
// Route pour créer un nouveau groupe
app.post('/api/chat/groups', async (req, res) => {
    const { name, members } = req.body; // 'members' doit être un tableau d'IDs utilisateur
    if (!name || !members || !Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ message: 'Nom du groupe et membres (array non vide) sont requis.' });
    }

    try {
        // Créez le groupe
        const newGroup = await db.Group.create({ name });

        // Ajoutez les membres au groupe
        // Assurez-vous que db.UserGroup est bien défini pour gérer la relation M:N
        const groupMembers = members.map(userId => ({
            groupId: newGroup.id,
            userId: userId
        }));
        await db.UserGroup.bulkCreate(groupMembers);

        res.status(201).json(newGroup); // Renvoie le groupe créé
    } catch (error) {
        console.error('Erreur lors de la création du groupe:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la création du groupe.' });
    }
});

// Route pour récupérer les groupes d'un utilisateur (ou tous les groupes)
app.get('/api/chat/groups', async (req, res) => {
    try {
        // Si vous voulez récupérer tous les groupes ou les groupes spécifiques à l'utilisateur connecté
        // Pour l'instant, récupérons tous les groupes avec leurs membres (pour la démo)
        const groups = await db.Group.findAll({
            include: [{
                model: db.User, // Inclure le modèle User
                as: 'members', // L'alias défini dans votre association (e.g., Group.belongsToMany(User, { as: 'members' }))
                attributes: ['id', 'username'] // Sélectionnez les attributs des membres
            }]
        });
        res.json(groups);
    } catch (error) {
        console.error('Erreur lors de la récupération des groupes de chat:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des groupes.' });
    }
});
// --- FIN NOUVELLES ROUTES POUR LA GESTION DES GROUPES DE CHAT ---

// --- ROUTE POUR RÉCUPÉRER L'HISTORIQUE DES MESSAGES ---
// Mise à jour pour inclure les messages de groupe
app.get('/api/chat/messages', async (req, res) => {
    const { type, targetId, currentUserId, groupId } = req.query;

    let whereClause = {};
    if (type === 'broadcast') {
        whereClause = { receiver_id: null, group_id: null }; // S'assurer que ce sont bien des messages de diffusion
    } else if (type === 'private' && targetId && currentUserId) {
        whereClause = {
            [db.Sequelize.Op.or]: [
                { sender_id: currentUserId, receiver_id: targetId },
                { sender_id: targetId, receiver_id: currentUserId }
            ],
            group_id: null // S'assurer que ce sont des messages privés
        };
    } else if (type === 'group' && groupId) { // NOUVEAU: Historique des messages de groupe
        whereClause = { group_id: groupId };
    } else {
        return res.status(400).json({ message: 'Type de chat ou IDs manquants pour l\'historique.' });
    }

    try {
        const messages = await db.Message.findAll({
            where: whereClause,
            order: [['timestamp', 'ASC']],
            limit: 100, // Limitez le nombre de messages pour la performance
            include: [
                {
                    model: db.User,
                    as: 'sender', // Assurez-vous que votre modèle Message a une association 'sender'
                    attributes: ['username']
                }
            ]
        });
        res.json(messages);
    } catch (error) {
        console.error('Erreur lors de la récupération de l\'historique des messages:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'historique.' });
    }
});
// --- FIN ROUTE POUR L'HISTORIQUE ---

// --- POINT DE TERMINAISON POUR MARQUER LES MESSAGES COMME LUS ---
app.post('/api/chat/mark-as-read', async (req, res) => {
    const { userId, chatId, chatType } = req.body;
    console.log(`[Backend] Reçu demande pour marquer comme lu: userId=${userId}, chatId=${chatId}, chatType=${chatType}`);

    try {
        if (chatType === 'private') {
            const [affectedRows] = await db.Message.update(
                { read_at: new Date() },
                {
                    where: {
                        sender_id: chatId,
                        receiver_id: userId,
                        read_at: null
                    }
                }
            );
            console.log(`Messages privés (${affectedRows} ligne(s) affectée(s)) marqués comme lus pour ${userId} dans le chat avec ${chatId}.`);

        } else if (chatType === 'group') {
            // Pour les messages de groupe, la gestion de "lu par" est plus complexe.
            // La solution simple ici est de marquer `read_at` sur le message lui-même,
            // ce qui est *global* et pas par utilisateur.
            // Pour une solution robuste, vous auriez besoin d'une table `UserGroupMessageReadStatus`
            // ou une colonne `last_read_message_id` par utilisateur dans la table `UserGroup`.
            const [affectedRows] = await db.Message.update(
                { read_at: new Date() }, // Cette mise à jour est globale sur le message, pas par utilisateur.
                {
                    where: {
                        group_id: chatId,
                        sender_id: { [db.Sequelize.Op.ne]: userId }, // Messages non envoyés par l'utilisateur courant
                        // Note: Pour une gestion réelle par utilisateur, vous devriez vérifier si
                        // l'utilisateur a déjà lu le message via une table de jointure distincte.
                        // read_at: null // On ne vérifie pas 'read_at' ici car on veut marquer comme lu pour cet utilisateur.
                    }
                }
            );
            console.log(`Messages du groupe ${chatId} (${affectedRows} ligne(s) affectée(s)) marqués comme lus pour ${userId}. (Note: \`read_at\` est mis à jour globalement sur le message, ce qui est une simplification)`);
        } else if (chatType === 'broadcast') {
            console.log(`Aucune action spécifique pour marquer les messages de diffusion comme lus.`);
        } else {
            return res.status(400).json({ message: 'Type de chat invalide.' });
        }
        res.status(200).json({ message: 'Messages marqués comme lus.' });
    } catch (error) {
        console.error('Erreur lors du marquage des messages comme lus:', error);
        res.status(500).json({ message: 'Erreur serveur lors du marquage des messages.' });
    }
});
// --- FIN POINT DE TERMINAISON POUR MARQUER LES MESSAGES COMME LUS ---

// --- ✅ NOUVELLE ROUTE CORRIGÉE POUR RÉCUPÉRER LES STATUTS DE MESSAGES NON LUS ---
app.get('/api/chat/unread-status', async (req, res) => {
    const { userId } = req.query; // L'ID de l'utilisateur qui fait la requête

    if (!userId) {
        return res.status(400).json({ message: 'L\'ID utilisateur est requis pour récupérer les statuts de chat.' });
    }

    try {
        const statuses = [];

        // --- Statut des chats privés ---
        const privateConversations = await db.Message.findAll({
            attributes: [
                'sender_id',
                'receiver_id',
                [db.Sequelize.fn('MAX', db.Sequelize.col('timestamp')), 'last_message_timestamp']
            ],
            where: {
                group_id: null,
                [db.Sequelize.Op.or]: [
                    { sender_id: userId },
                    { receiver_id: userId }
                ]
            },
            group: ['sender_id', 'receiver_id'],
            order: [[db.Sequelize.literal('last_message_timestamp'), 'DESC']]
        });

        for (const convo of privateConversations) {
            let otherUserId;
            if (convo.sender_id === parseInt(userId, 10)) {
                otherUserId = convo.receiver_id;
            } else {
                otherUserId = convo.sender_id;
            }

            if (otherUserId === null) continue;

            const unreadCountResult = await db.Message.count({
                where: {
                    sender_id: otherUserId,
                    receiver_id: userId,
                    read_at: null,
                    group_id: null
                }
            });

            // ✅ CORRECTION: Frontend attend 'other_user_id', pas 'chatId'
            statuses.push({
                other_user_id: otherUserId, // ✅ Changé de 'chatId' vers 'other_user_id'
                group_id: null,
                unread_count: unreadCountResult,
                last_message_timestamp: convo.getDataValue('last_message_timestamp')
            });
        }

        // --- Statut des chats de groupe ---
        const userGroups = await db.Group.findAll({
            include: [{
                model: db.User,
                as: 'members',
                where: { id: userId },
                attributes: []
            }],
            attributes: ['id', 'name']
        });

        for (const group of userGroups) {
            const latestGroupMessage = await db.Message.findOne({
                attributes: ['timestamp'],
                where: {
                    group_id: group.id
                },
                order: [['timestamp', 'DESC']]
            });

            const unreadGroupMessagesCount = await db.Message.count({
                where: {
                    group_id: group.id,
                    sender_id: { [db.Sequelize.Op.ne]: userId },
                    read_at: null // Simplification
                }
            });

            // ✅ CORRECTION: Frontend attend 'group_id', pas 'chatId'
            statuses.push({
                other_user_id: null,
                group_id: group.id, // ✅ Changé de 'chatId' vers 'group_id'
                unread_count: unreadGroupMessagesCount,
                last_message_timestamp: latestGroupMessage ? latestGroupMessage.timestamp : null
            });
        }

        // --- Statut du chat de diffusion (optionnel) ---
        const broadcastInfo = await db.Message.findOne({
            attributes: [
                [db.Sequelize.fn('MAX', db.Sequelize.col('timestamp')), 'last_message_timestamp']
            ],
            where: {
                receiver_id: null,
                group_id: null
            },
            raw: true
        });

        if (broadcastInfo && broadcastInfo.last_message_timestamp) {
            statuses.push({
                other_user_id: null,
                group_id: null,
                unread_count: 0, // À implémenter si vous avez une logique de lecture pour le broadcast
                last_message_timestamp: broadcastInfo.last_message_timestamp
            });
        }

        // Trier tous les statuts par last_message_timestamp (les plus récents en premier)
        statuses.sort((a, b) => {
            const dateA = a.last_message_timestamp ? new Date(a.last_message_timestamp) : new Date(0);
            const dateB = b.last_message_timestamp ? new Date(b.last_message_timestamp) : new Date(0);
            return dateB.getTime() - dateA.getTime();
        });

        res.json(statuses);
    } catch (error) {
        console.error('Erreur lors de la récupération des statuts de chat:', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des statuts de chat.' });
    }
});
// --- FIN NOUVELLE ROUTE POUR LES STATUTS ---

// Route de base pour tester si le serveur fonctionne
app.use(express.static(path.join(__dirname,'../frontend/dist')));
app.get("*",(req,res)=> {
    res.sendFile(path.join(__dirname,'../frontend/dist/index.html'));
});
app.get('/', (req, res) => {
    res.send('API backend pour la gestion des effectifs des cadres.');
});

//vita eto

// --- ✅ GESTION COMPLÈTE DES CONNEXIONS SOCKET.IO ET MESSAGES ---
io.on('connection', (socket) => {
    console.log(`Un utilisateur est connecté via Socket.IO: ${socket.id}`);

    // Quand un utilisateur se connecte, il doit s'identifier pour le chat
    socket.on('identify', (userId) => {
        socket.userId = userId; // Associe l'ID de l'utilisateur à la socket
        // Rejoindre une "salle" nommée d'après l'ID de l'utilisateur pour les messages privés
        socket.join(userId);
        console.log(`Utilisateur ${userId} identifié et a rejoint la salle ${userId}`);
    });

    // Permet à un utilisateur de rejoindre une salle de groupe
    socket.on('joinGroup', (groupId) => {
        if (socket.userId) {
            socket.join(`group-${groupId}`); // Utiliser un préfixe pour éviter les conflits d'ID
            console.log(`Utilisateur ${socket.userId} a rejoint le groupe: group-${groupId}`);
        } else {
            console.warn(`Tentative de rejoindre le groupe sans identification préalable: ${socket.id}`);
        }
    });

    // ✅ NOUVEAU: Rejoindre automatiquement tous les groupes de l'utilisateur
    socket.on('joinUserGroups', async (userId) => {
        try {
            const userGroups = await db.Group.findAll({
                include: [{
                    model: db.User,
                    as: 'members',
                    where: { id: userId },
                    attributes: []
                }],
                attributes: ['id']
            });

            userGroups.forEach(group => {
                socket.join(`group-${group.id}`);
                console.log(`Utilisateur ${userId} rejoint automatiquement le groupe ${group.id}`);
            });
        } catch (error) {
            console.error('Erreur lors du join automatique des groupes:', error);
        }
    });

    // ✅ NOUVEAUX ÉVÉNEMENTS POUR LES INDICATEURS DE FRAPPE
    socket.on('typingStart', (data) => {
        const { userId, username, chatType, chatId } = data;

        if (chatType === 'group' && chatId) {
            socket.to(`group-${chatId}`).emit('typingStart', { userId, username });
        } else if (chatType === 'private' && chatId) {
            socket.to(chatId).emit('typingStart', { userId, username });
        } else if (chatType === 'broadcast') {
            socket.broadcast.emit('typingStart', { userId, username });
        }

        console.log(`${username} a commencé à taper dans ${chatType} chat`);
    });

    socket.on('typingStop', (data) => {
        const { userId, chatType, chatId } = data;

        if (chatType === 'group' && chatId) {
            socket.to(`group-${chatId}`).emit('typingStop', { userId });
        } else if (chatType === 'private' && chatId) {
            socket.to(chatId).emit('typingStop', { userId });
        } else if (chatType === 'broadcast') {
            socket.broadcast.emit('typingStop', { userId });
        }

        console.log(`Utilisateur ${userId} a arrêté de taper dans ${chatType} chat`);
    });

    // ✅ GESTION DES MESSAGES AVEC DEBUG TIMESTAMP
    socket.on('chatMessage', async (data) => {
        const { senderId, messageText, receiverId, groupId, fileData } = data;

        try {
            // ✅ DEBUGGING TIMESTAMP
            const messageTimestamp = new Date();
            console.log("=== NOUVEAU MESSAGE ===");
            console.log("Timestamp local:", messageTimestamp.toString());
            console.log("Timestamp ISO:", messageTimestamp.toISOString());
            console.log("Sender ID:", senderId);

            const newMessage = await db.Message.create({
                sender_id: senderId,
                message_text: messageText || null,
                receiver_id: receiverId || null,
                group_id: groupId || null,
                file_url: fileData ? fileData.fileUrl : null,
                original_file_name: fileData ? fileData.originalName : null,
                file_mime_type: fileData ? fileData.mimeType : null,
                file_size_bytes: fileData ? fileData.size : null,
                timestamp: messageTimestamp,
                // read_at n'est pas défini ici, il reste null par défaut, indiquant non lu
            });

            console.log("Message créé en DB avec timestamp:", newMessage.timestamp);
            console.log("=======================");

            const senderUser = await db.User.findByPk(senderId, { attributes: ['username'] });

            const messageToEmit = {
                id: newMessage.id,
                sender_id: senderId,
                sender_username: senderUser ? senderUser.username : 'Utilisateur inconnu',
                message_text: messageText,
                receiver_id: receiverId,
                group_id: groupId,
                file_url: fileData ? fileData.fileUrl : null,
                original_file_name: fileData ? fileData.originalName : null,
                file_mime_type: fileData ? fileData.mimeType : null,
                file_size_bytes: fileData ? fileData.size : null,
                timestamp: newMessage.timestamp
            };

            // Émission du message selon le type
            if (groupId) {
                io.to(`group-${groupId}`).emit('chatMessage', messageToEmit);
                console.log(`Message de groupe envoyé à group-${groupId}`);
            } else if (receiverId === null) {
                io.emit('chatMessage', messageToEmit);
                console.log('Message de diffusion envoyé à tous');
            } else {
                io.to(senderId).emit('chatMessage', messageToEmit);
                if (io.sockets.adapter.rooms.has(receiverId)) {
                    io.to(receiverId).emit('chatMessage', messageToEmit);
                } else {
                    console.log(`Destinataire ${receiverId} non connecté`);
                }
                console.log(`Message privé envoyé entre ${senderId} et ${receiverId}`);
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde du message dans la DB ou de l\'émission:', error);
            socket.emit('chatError', { message: 'Échec de l\'envoi du message.', error: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log(`Utilisateur déconnecté via Socket.IO: ${socket.id}`);
    });
});
// --- FIN GESTION DES CONNEXIONS SOCKET.IO ---

// ✅ Démarrage du serveur Express et Socket.IO - AVEC DEBUG ET INFORMATIONS
(async () => {
    try {
        // ✅ AJOUT - Vérification de la config avant sync
        console.log("=== VÉRIFICATION AVANT SYNC DB ===");
        console.log("Heure Node.js avant sync:", new Date().toString());

        // ⚠️ IMPORTANT - Changez alter: true en false pour éviter les problèmes d'index
        //await db.sequelize.sync({ logging: console.log }); // ✅ Logging activé pour debug
        console.log('Base de données synchronisée.');

        // ✅ AJOUT - Vérification après sync
        console.log("=== VÉRIFICATION APRÈS SYNC DB ===");
        console.log("Heure Node.js après sync:", new Date().toString());

        // ✅ TEST - Création d'un timestamp de test
        const testDate = new Date();
        console.log("Test timestamp creation:");
        console.log("  - Date brute:", testDate);
        console.log("  - toString():", testDate.toString());
        console.log("  - toISOString():", testDate.toISOString());

        scheduleHistoricalTasks();
        console.log('Historical tasks scheduled.');

        const host = '0.0.0.0';
        const PORT = process.env.PORT || 3000;

        // Vérifier les dossiers
        [UPLOAD_DIR_LIBRARY, UPLOAD_DIR_CHAT, TEMP_UPLOAD_DIR, UPLOAD_DIR_CADRES].forEach(dir => {
            console.log(`📂 ${path.basename(dir)}: ${fs.existsSync(dir) ? '✅ Existe' : '❌ Manquant'}`);
            if (fs.existsSync(dir)) {
                try {
                    const files = fs.readdirSync(dir);
                    console.log(`   📚 ${files.length} fichiers`);
                    if (dir === UPLOAD_DIR_LIBRARY && files.length > 0) {
                        console.log(`   📄 Premiers fichiers:`, files.slice(0, 3));
                    }
                } catch (err) {
                    console.log(`   ❌ Erreur lecture: ${err.message}`);
                }
            }
        });

        server.listen(PORT, host, () => {
            console.log(`\n🚀 Serveur GESPA démarré sur http://${host}:${PORT}`);
            console.log(`🌐 Accessible sur le réseau: ${API_BASE_URL}`);
            console.log(`📥 Fichiers bibliothèque: ${API_BASE_URL}/files/`);
            console.log(`💬 Fichiers chat: ${API_BASE_URL}/chat_uploads/`);
            console.log(`📸 Photos cadres: ${API_BASE_URL}/uploads/`);
            console.log(`🔧 Debug files: ${API_BASE_URL}/api/debug/files`);
            console.log(`📋 Test API: ${API_BASE_URL}/api/test-file/FILENAME`);
            console.log(`⬇️ Téléchargement: ${API_BASE_URL}/api/download/FILENAME`);

            // ✅ AJOUT - Vérification finale de l'heure
            console.log("\n=== HEURE FINALE AU DÉMARRAGE ===");
            console.log("Heure serveur:", new Date().toString());
            console.log("Fuseau horaire:", process.env.TZ);
            console.log("====================================\n");

            // Afficher les fichiers de la bibliothèque au démarrage
            try {
                if (fs.existsSync(UPLOAD_DIR_LIBRARY)) {
                    const files = fs.readdirSync(UPLOAD_DIR_LIBRARY);
                    console.log(`📚 ${files.length} fichiers dans la bibliothèque:`);
                    files.slice(0, 5).forEach(file => console.log(`   📄 ${file}`));
                    if (files.length > 5) console.log(`   ... et ${files.length - 5} autres`);
                } else {
                    console.log('❌ Dossier bibliothèque introuvable!');
                }
            } catch (err) {
                console.log('❌ Erreur lecture bibliothèque:', err.message);
            }
        });

    } catch (err) {
        console.error('Erreur de synchronisation de la base de données ou de démarrage du serveur :', err);
        process.exit(1);
    }
})();