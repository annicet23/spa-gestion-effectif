const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const db = require('../models');
const LibraryItem = db.LibraryItem;
const { Op } = require('sequelize');

// ===== CONFIGURATION AMÉLIORÉE DU STOCKAGE =====
const UPLOAD_DEST_DIR = path.join(__dirname, '..', 'public', 'files');

// S'assurer que le répertoire existe
if (!fs.existsSync(UPLOAD_DEST_DIR)) {
    console.log(`📁 Création du répertoire d'upload : ${UPLOAD_DEST_DIR}`);
    fs.mkdirSync(UPLOAD_DEST_DIR, { recursive: true });
}

// Configuration Multer améliorée
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DEST_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalExtension = path.extname(file.originalname);
        const baseName = req.body.id ?
            req.body.id.replace(/[^a-zA-Z0-9.\-_]/g, '_') :
            path.basename(file.originalname, originalExtension).replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const fileName = `${uniqueSuffix}-${file.fieldname}-${baseName}${originalExtension}`;
        console.log(`📄 Nouveau fichier généré: ${fileName}`);
        cb(null, fileName);
    }
});

// Filtre pour les types de fichiers autorisés
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp4|avi|mov|xlsx|xls|ppt|pptx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Type de fichier non autorisé'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB max
    }
});

// ===== ROUTES API AMÉLIORÉES =====

// POST /api/library-items - Ajouter un nouvel élément
router.post('/', upload.single('documentFile'), async (req, res) => {
    try {
        const { id, title, description, type, category, tags, externalUrl, videoUrl, imageUrl } = req.body;

        console.log('📝 Création nouvel élément:', { id, title, type });
        console.log('📎 Fichier reçu:', req.file ? req.file.filename : 'Aucun');

        let parsedTags = [];
        if (tags) {
            try {
                parsedTags = JSON.parse(tags);
            } catch (e) {
                parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
            }
        }

        let fileUrl = null;
        if (req.file) {
            // IMPORTANT: Construire l'URL avec le bon chemin
            fileUrl = `/files/${req.file.filename}`;
            console.log(`✅ Fichier sauvegardé: ${fileUrl}`);
        }

        // Générer des métadonnées par défaut
        const newItem = {
            id,
            title,
            description,
            type,
            category,
            tags: parsedTags,
            fileUrl,
            externalUrl: externalUrl || null,
            videoUrl: videoUrl || null,
            imageUrl: imageUrl || null,
            downloads: 0, // Initialiser à 0
            views: 0, // Initialiser à 0
            rating: (Math.random() * 2 + 3).toFixed(1), // Rating aléatoire entre 3-5
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const createdItem = await LibraryItem.create(newItem);
        console.log(`✅ Élément créé avec succès: ${createdItem.id}`);

        res.status(201).json({
            message: 'Document ajouté avec succès',
            item: createdItem
        });

    } catch (error) {
        console.error('❌ Erreur création élément:', error);

        // Nettoyer le fichier en cas d'erreur
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("❌ Erreur suppression fichier:", unlinkErr);
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: `L'ID '${req.body.id}' existe déjà.`
            });
        }

        res.status(500).json({
            message: 'Erreur serveur lors de l\'ajout du document.',
            error: error.message
        });
    }
});

// GET /api/library-items - Récupérer avec filtres améliorés
router.get('/', async (req, res) => {
    try {
        const { search, category, dateFilter, sortBy } = req.query;
        let whereClause = {};

        console.log('🔍 Recherche avec paramètres:', { search, category, dateFilter, sortBy });

        // Filtre de recherche
        if (search) {
            whereClause = {
                [Op.or]: [
                    { title: { [Op.like]: `%${search}%` } },
                    { description: { [Op.like]: `%${search}%` } },
                    { tags: { [Op.like]: `%${search}%` } },
                    { category: { [Op.like]: `%${search}%` } },
                    { type: { [Op.like]: `%${search}%` } },
                    { id: { [Op.like]: `%${search}%` } }
                ]
            };
        }

        // Filtre par catégorie
        if (category && category !== 'All') {
            whereClause.category = category;
        }

        // Filtre par date
        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            let dateThreshold;

            switch (dateFilter) {
                case 'week':
                    dateThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    dateThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case 'year':
                    dateThreshold = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                    break;
            }

            if (dateThreshold) {
                whereClause.createdAt = { [Op.gte]: dateThreshold };
            }
        }

        // Ordre de tri
        let orderClause = [['createdAt', 'DESC']]; // Par défaut

        switch (sortBy) {
            case 'popular':
                orderClause = [['downloads', 'DESC']];
                break;
            case 'alphabetical':
                orderClause = [['title', 'ASC']];
                break;
            case 'rating':
                orderClause = [['rating', 'DESC']];
                break;
        }

        const items = await LibraryItem.findAll({
            where: whereClause,
            order: orderClause
        });

        console.log(`📚 ${items.length} éléments trouvés`);
        res.status(200).json(items);

    } catch (error) {
        console.error('❌ Erreur récupération:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la récupération.',
            error: error.message
        });
    }
});

// PUT /api/library-items/:id - Mettre à jour (avec gestion des compteurs)
router.put('/:id', upload.single('documentFile'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title, description, type, category, tags, externalUrl, videoUrl,
            fileUrl: existingFileUrlFromFrontend, imageUrl,
            downloads, views, rating // Nouveaux champs pour les stats
        } = req.body;

        console.log(`📝 Mise à jour élément: ${id}`);

        let parsedTags = [];
        if (tags) {
            try {
                parsedTags = JSON.parse(tags);
            } catch (e) {
                parsedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
            }
        }

        const itemToUpdate = await LibraryItem.findByPk(id);
        if (!itemToUpdate) {
            return res.status(404).json({ message: "Document non trouvé." });
        }

        let newFileUrl = itemToUpdate.fileUrl;

        // Nouveau fichier uploadé
        if (req.file) {
            newFileUrl = `/files/${req.file.filename}`;
            console.log(`📎 Nouveau fichier: ${newFileUrl}`);

            // Supprimer l'ancien fichier
            if (itemToUpdate.fileUrl && !itemToUpdate.fileUrl.startsWith('http')) {
                const oldFilePath = path.join(UPLOAD_DEST_DIR, path.basename(itemToUpdate.fileUrl));
                if (fs.existsSync(oldFilePath)) {
                    fs.unlink(oldFilePath, (unlinkErr) => {
                        if (unlinkErr) console.error("❌ Erreur suppression ancien fichier:", unlinkErr);
                        else console.log(`🗑️ Ancien fichier supprimé`);
                    });
                }
            }
        } else if (existingFileUrlFromFrontend === '') {
            // Effacer le fichier
            if (itemToUpdate.fileUrl && !itemToUpdate.fileUrl.startsWith('http')) {
                const oldFilePath = path.join(UPLOAD_DEST_DIR, path.basename(itemToUpdate.fileUrl));
                if (fs.existsSync(oldFilePath)) {
                    fs.unlink(oldFilePath, (unlinkErr) => {
                        if (unlinkErr) console.error("❌ Erreur suppression fichier:", unlinkErr);
                        else console.log(`🗑️ Fichier supprimé`);
                    });
                }
            }
            newFileUrl = null;
        }

        // Préparer les données de mise à jour
        const updateData = {
            title,
            description,
            type,
            category,
            tags: parsedTags,
            fileUrl: newFileUrl,
            externalUrl: externalUrl || null,
            videoUrl: videoUrl || null,
            imageUrl: imageUrl || null,
            updatedAt: new Date()
        };

        // Mise à jour des stats si fournies
        if (downloads !== undefined) updateData.downloads = parseInt(downloads) || 0;
        if (views !== undefined) updateData.views = parseInt(views) || 0;
        if (rating !== undefined) updateData.rating = parseFloat(rating) || 0;

        await itemToUpdate.update(updateData);
        console.log(`✅ Élément mis à jour: ${id}`);

        res.status(200).json({
            message: 'Document mis à jour avec succès',
            item: itemToUpdate
        });

    } catch (error) {
        console.error('❌ Erreur mise à jour:', error);

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error("❌ Erreur suppression nouveau fichier:", unlinkErr);
            });
        }

        res.status(500).json({
            message: 'Erreur serveur lors de la mise à jour.',
            error: error.message
        });
    }
});

// DELETE /api/library-items/:id - Supprimer un élément
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Suppression élément: ${id}`);

        const itemToDelete = await LibraryItem.findByPk(id);
        if (!itemToDelete) {
            return res.status(404).json({ message: 'Document non trouvé.' });
        }

        // Supprimer le fichier physique
        if (itemToDelete.fileUrl && !itemToDelete.fileUrl.startsWith('http')) {
            const filePath = path.join(UPLOAD_DEST_DIR, path.basename(itemToDelete.fileUrl));
            if (fs.existsSync(filePath)) {
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) console.error("❌ Erreur suppression fichier:", unlinkErr);
                    else console.log(`🗑️ Fichier physique supprimé`);
                });
            }
        }

        await itemToDelete.destroy();
        console.log(`✅ Élément supprimé: ${id}`);

        res.status(200).json({ message: 'Document supprimé avec succès.' });

    } catch (error) {
        console.error('❌ Erreur suppression:', error);
        res.status(500).json({
            message: 'Erreur serveur lors de la suppression.',
            error: error.message
        });
    }
});

// ✅ CORRECTION: Route pour incrémenter les compteurs (existante mais corrigée)
router.patch('/:id/stats', async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'download' ou 'view'

        console.log(`📊 Mise à jour statistique: ${action} pour item ${id}`);

        const item = await LibraryItem.findByPk(id);
        if (!item) {
            return res.status(404).json({ message: 'Document non trouvé.' });
        }

        if (action === 'download') {
            await item.increment('downloads');
            console.log(`📥 Download comptabilisé pour: ${id} (total: ${item.downloads + 1})`);
        } else if (action === 'view') {
            await item.increment('views');
            console.log(`👁️ Vue comptabilisée pour: ${id} (total: ${item.views + 1})`);
        } else {
            return res.status(400).json({ message: 'Action non valide (download ou view)' });
        }

        res.status(200).json({
            message: 'Statistique mise à jour',
            action,
            itemId: id
        });

    } catch (error) {
        console.error('❌ Erreur stats:', error);
        res.status(500).json({
            error: 'Erreur mise à jour statistiques',
            details: error.message
        });
    }
});

// ✅ NOUVELLE ROUTE: Téléchargement forcé de fichiers
router.get('/download/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOAD_DEST_DIR, filename);

        console.log('📥 Tentative téléchargement forcé:', filename);
        console.log('📁 Chemin complet:', filePath);

        // Vérifier que le fichier existe
        if (!fs.existsSync(filePath)) {
            console.log('❌ Fichier non trouvé:', filePath);
            return res.status(404).json({
                error: 'Fichier non trouvé',
                filename,
                path: filePath,
                suggestion: 'Vérifiez le nom du fichier ou utilisez /api/debug/files pour voir la liste'
            });
        }

        // Stats du fichier
        const stats = fs.statSync(filePath);
        console.log(`📄 Fichier trouvé - Taille: ${stats.size} bytes`);

        // Headers pour forcer le téléchargement
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', stats.size);

        // Envoyer le fichier
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('❌ Erreur envoi fichier:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Erreur lors de l\'envoi du fichier' });
                }
            } else {
                console.log('✅ Fichier envoyé avec succès:', filename);
            }
        });

    } catch (error) {
        console.error('❌ Erreur route téléchargement:', error);
        res.status(500).json({
            error: 'Erreur serveur',
            details: error.message
        });
    }
});

// ✅ NOUVELLE ROUTE: Tester l'existence d'un fichier
router.get('/test-file/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(UPLOAD_DEST_DIR, filename);

        const exists = fs.existsSync(filePath);

        // Lister tous les fichiers disponibles pour debug
        let allFiles = [];
        try {
            allFiles = fs.readdirSync(UPLOAD_DEST_DIR);
        } catch (err) {
            console.warn('⚠️ Impossible de lire le dossier files:', err);
        }

        console.log(`🔍 Test fichier "${filename}": ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);

        res.json({
            filename,
            exists,
            path: filePath,
            directory: UPLOAD_DEST_DIR,
            allFiles: allFiles.slice(0, 20), // Limiter à 20 pour éviter une réponse trop lourde
            totalFiles: allFiles.length
        });

    } catch (error) {
        console.error('❌ Erreur test fichier:', error);
        res.status(500).json({
            error: 'Erreur lors du test fichier',
            details: error.message
        });
    }
});

// ✅ NOUVELLE ROUTE: Debug - Lister tous les fichiers disponibles
router.get('/debug/files', (req, res) => {
    try {
        console.log('🔍 Debug: Listage des fichiers dans:', UPLOAD_DEST_DIR);

        if (!fs.existsSync(UPLOAD_DEST_DIR)) {
            return res.json({
                error: 'Dossier files non trouvé',
                path: UPLOAD_DEST_DIR,
                files: [],
                suggestion: 'Le dossier sera créé automatiquement lors du premier upload'
            });
        }

        const files = fs.readdirSync(UPLOAD_DEST_DIR);

        const fileDetails = files.map(filename => {
            const filePath = path.join(UPLOAD_DEST_DIR, filename);
            const stats = fs.statSync(filePath);

            return {
                filename,
                size: stats.size,
                sizeHuman: `${(stats.size / 1024).toFixed(2)} KB`,
                modified: stats.mtime,
                extension: path.extname(filename),
                downloadUrl: `/api/library-items/download/${filename}`
            };
        });

        console.log(`📁 ${files.length} fichiers trouvés`);

        res.json({
            directory: UPLOAD_DEST_DIR,
            totalFiles: files.length,
            totalSize: fileDetails.reduce((sum, file) => sum + file.size, 0),
            files: fileDetails
        });

    } catch (error) {
        console.error('❌ Erreur debug files:', error);
        res.status(500).json({
            error: 'Erreur lors du listage des fichiers',
            details: error.message
        });
    }
});

module.exports = router;