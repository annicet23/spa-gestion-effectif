'use strict';
const { Cadre, User, Escadron, Permission } = require('../models');
const express = require('express');
const router = express.Router();
const multer = require('multer'); // Import de multer
const path = require('path');     // Import de path, utile pour les chemins de fichiers
const fs = require('fs');         // Import de fs pour la suppression de fichiers

const { authenticateJWT, isAdmin, isStandard } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');
const { getHistoricalDate, getHistoricalDayStartTime, getHistoricalDayEndTime } = require('../utils/date');

const calculateDaysInclusive = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
};

// --- Configuration de Multer ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const matricule = req.body.matricule || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `${matricule}-${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error("Seules les images (jpeg, jpg, png, gif) sont autorisées !"), false);
        }
    }
});

router.use(authenticateJWT);

// POST /api/cadres - Créer un nouveau cadre
router.post('/', upload.single('photo'), async (req, res) => {
    const {
        grade, nom, prenom, matricule, service, numero_telephone, fonction, entite, cours, sexe,
        date_naissance, date_sejour_egna, statut_matrimonial, nombre_enfants, email, telephones, date_nomination
    } = req.body;

    const photo_url = req.file ? req.file.path : null;
    const currentUser = req.user;

    // Validation des champs requis
    if (!grade || !nom || !prenom || !matricule || !entite || !sexe) {
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ message: 'Champs requis manquants: grade, nom, prenom, matricule, entite, sexe.' });
    }
    if (entite === 'Service' && !service) {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(400).json({ message: "Le service est requis pour l'entité 'Service'." });
    }
    if (entite === 'Escadron' && !cours) {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(400).json({ message: "L'ID de l'Escadron est requis pour l'entité 'Escadron'." });
    }
    if (!['Service', 'Escadron', 'None'].includes(entite)) {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(400).json({ message: 'Valeur d\'entité invalide. Doit être Service, Escadron ou None.' });
    }
    if (!['Masculin', 'Féminin', 'Autre'].includes(sexe)) {
        if (req.file) { fs.unlinkSync(req.file.path); }
        return res.status(400).json({ message: 'Valeur de sexe invalide. Doit être Masculin, Féminin ou Autre.' });
    }

    try {
        // Vérification des rôles et permissions
        if (currentUser.role === 'Admin') {
            // L'administrateur peut créer n'importe quel cadre
        } else if (currentUser.role === 'Standard') {
            if (entite !== 'Service') {
                if (req.file) { fs.unlinkSync(req.file.path); }
                return res.status(403).json({ message: 'Les utilisateurs standards ne peuvent créer des cadres que pour un "Service".' });
            }

            // MODIFICATION : Utiliser le service de l'utilisateur au lieu du cadre associé
            if (!currentUser.service) {
                if (req.file) { fs.unlinkSync(req.file.path); }
                return res.status(403).json({ message: 'Accès refusé : Votre compte standard n\'a pas de service défini.' });
            }

            if (service !== currentUser.service) {
                if (req.file) { fs.unlinkSync(req.file.path); }
                return res.status(403).json({ message: `Accès refusé : Vous ne pouvez créer des cadres que pour le service "${currentUser.service}".` });
            }
        } else {
            if (req.file) { fs.unlinkSync(req.file.path); }
            return res.status(403).json({ message: 'Accès non autorisé pour la création de cadre. Rôle insuffisant.' });
        }

        // Vérification de l'existence du matricule
        const existingCadre = await Cadre.findOne({ where: { matricule } });
        if (existingCadre) {
            if (req.file) { fs.unlinkSync(req.file.path); }
            return res.status(409).json({ message: `Un cadre avec le matricule ${matricule} existe déjà.` });
        }

        // Vérification de l'existence de l'email si fourni
        if (email) {
            const existingEmailCadre = await Cadre.findOne({ where: { email } });
            if (existingEmailCadre) {
                 if (req.file) { fs.unlinkSync(req.file.path); }
                return res.status(409).json({ message: `Un cadre avec l'adresse e-mail ${email} existe déjà.` });
            }
        }

        // Parse `telephones`
        let parsedTelephones = [];
        if (telephones) {
            try {
                parsedTelephones = JSON.parse(telephones);
                if (!Array.isArray(parsedTelephones)) {
                     parsedTelephones = [];
                }
            } catch (e) {
                console.warn("Erreur lors du parsing des téléphones, utilisation d'un tableau vide:", e);
                parsedTelephones = [];
            }
        }

        // Convertir nombre_enfants en entier
        const parsedNombreEnfants = nombre_enfants !== undefined && nombre_enfants !== '' ? parseInt(nombre_enfants, 10) : 0;

        const nouveauCadre = await Cadre.create({
            grade, nom, prenom, matricule,
            entite,
            service: entite === 'Service' ? service : null,
            cours: entite === 'Escadron' ? cours : null,
            sexe,
            numero_telephone: numero_telephone || null,
            fonction: fonction || null,
            date_naissance: date_naissance || null,
            date_sejour_egna: date_sejour_egna || null,
            statut_matrimonial: statut_matrimonial || null,
            nombre_enfants: parsedNombreEnfants,
            email: email || null,
            photo_url: photo_url,
            telephones: parsedTelephones,
            date_nomination: date_nomination || null,
        });

        return res.status(201).json({
            message: 'Cadre créé avec succès',
            cadre: nouveauCadre.toJSON()
        });

    } catch (error) {
        console.error('Erreur lors de la création du cadre:', error);
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation: ' + error.errors.map(e => e.message).join(', ')
            });
        }
        if (error instanceof multer.MulterError) {
            return res.status(400).json({ message: "Erreur de téléchargement de fichier : " + error.message });
        }
        return res.status(500).json({ message: 'Erreur serveur interne', error: error.message });
    }
});

// GET /api/cadres - Lister les cadres avec filtres
router.get('/', async (req, res) => {
    const { user, query } = req;
    const whereClause = {};
    const includeClause = [{
        model: Escadron,
        as: 'EscadronResponsable',
        attributes: ['id', 'nom', 'numero'],
        required: false
    }];

    console.log('[DEBUG GET /api/cadres] Requête reçue. Rôle utilisateur:', user.role);
    console.log('[DEBUG GET /api/cadres] User Service:', user.service);
    console.log('[DEBUG GET /api/cadres] Paramètres de requête (query):', query);

    try {
        if (query.statut) {
            const allowedStatuses = ['Présent', 'Absent', 'Indisponible'];
            if (allowedStatuses.includes(query.statut)) {
                whereClause.statut_absence = query.statut;
            } else {
                console.warn(`Statut invalide reçu pour le filtrage: ${query.statut}`);
            }
        }

        if (user.role === 'Admin') {
            // L'administrateur peut appliquer des filtres de manière globale
            if (query.entite) whereClause.entite = query.entite;
            if (query.service) whereClause.service = query.service;
            if (query.cours) whereClause.cours = query.cours;
            if (query.grade) whereClause.grade = query.grade;
            if (query.nom) whereClause.nom = { [Op.like]: `%${query.nom}%` };
            if (query.prenom) whereClause.prenom = { [Op.like]: `%${query.prenom}%` };
            if (query.matricule) whereClause.matricule = { [Op.like]: `%${query.matricule}%` };
            if (query.fonction) whereClause.fonction = { [Op.like]: `%${query.fonction}%` };
            if (query.sexe) whereClause.sexe = query.sexe;
            if (query.date_naissance) whereClause.date_naissance = query.date_naissance;
            if (query.date_sejour_egna) whereClause.date_sejour_egna = query.date_sejour_egna;
            if (query.statut_matrimonial) whereClause.statut_matrimonial = query.statut_matrimonial;
            if (query.email) whereClause.email = { [Op.like]: `%${query.email}%` };
            if (query.date_nomination) whereClause.date_nomination = query.date_nomination;

            console.log('[DEBUG GET /api/cadres] Logique Admin. whereClause finale:', whereClause);

        } else if (user.role === 'Standard') {
            // === NOUVELLE LOGIQUE CORRIGÉE POUR LES UTILISATEURS STANDARD ===
            console.log('[DEBUG GET /api/cadres] Utilisateur Standard détecté');
            console.log('[DEBUG GET /api/cadres] User ID:', user.id);
            console.log('[DEBUG GET /api/cadres] User cadre_id:', user.cadre_id);
            console.log('[DEBUG GET /api/cadres] User service:', user.service);

            // Récupérer le cadre associé à l'utilisateur pour déterminer son entité
            let userCadre = null;
            if (user.cadre_id) {
                try {
                    userCadre = await Cadre.findByPk(user.cadre_id);
                    console.log('[DEBUG GET /api/cadres] Cadre associé trouvé:', {
                        id: userCadre?.id,
                        entite: userCadre?.entite,
                        service: userCadre?.service,
                        cours: userCadre?.cours
                    });
                } catch (error) {
                    console.error('[DEBUG GET /api/cadres] Erreur récupération cadre associé:', error);
                }
            }

            // Déterminer la logique de filtrage selon l'entité du cadre associé
            if (userCadre && userCadre.entite === 'Escadron') {
                // ===== LOGIQUE POUR LES UTILISATEURS ESCADRON =====
                console.log(`[DEBUG GET /api/cadres] Scope Escadron: Cours '${userCadre.cours}'`);

                if (!userCadre.cours) {
                    console.log('[DEBUG GET /api/cadres] Utilisateur Escadron sans cours défini. Retourne tableau vide.');
                    return res.status(200).json([]);
                }

                // Filtrer par escadron (cours)
                whereClause.entite = 'Escadron';
                whereClause.cours = userCadre.cours;

                // Vérifier les conflits de filtres
                if (query.entite && query.entite !== 'Escadron') {
                    console.log(`[DEBUG GET /api/cadres] Conflit de filtre 'entite'. Query: '${query.entite}', mais utilisateur Escadron.`);
                    return res.status(200).json([]);
                }
                if (query.cours && parseInt(query.cours) !== userCadre.cours) {
                    console.log(`[DEBUG GET /api/cadres] Conflit de filtre 'cours'. Query: '${query.cours}', Scope: '${userCadre.cours}'.`);
                    return res.status(200).json([]);
                }
                if (query.service) {
                    console.log(`[DEBUG GET /api/cadres] Filtre 'service' ignoré pour utilisateur Escadron.`);
                }

            } else if (userCadre && userCadre.entite === 'Service') {
                // ===== LOGIQUE POUR LES UTILISATEURS SERVICE =====
                console.log(`[DEBUG GET /api/cadres] Scope Service: Service '${userCadre.service}'`);

                if (!userCadre.service) {
                    console.log('[DEBUG GET /api/cadres] Utilisateur Service sans service défini. Retourne tableau vide.');
                    return res.status(200).json([]);
                }

                // Filtrer par service
                whereClause.entite = 'Service';
                whereClause.service = userCadre.service;

                // Vérifier les conflits de filtres
                if (query.entite && query.entite !== 'Service') {
                    console.log(`[DEBUG GET /api/cadres] Conflit de filtre 'entite'. Query: '${query.entite}', mais utilisateur Service.`);
                    return res.status(200).json([]);
                }
                if (query.service && query.service !== userCadre.service) {
                    console.log(`[DEBUG GET /api/cadres] Conflit de filtre 'service'. Query: '${query.service}', Scope: '${userCadre.service}'.`);
                    return res.status(200).json([]);
                }
                if (query.cours) {
                    console.log(`[DEBUG GET /api/cadres] Filtre 'cours' ignoré pour utilisateur Service.`);
                }

            } else if (user.service) {
                // ===== FALLBACK : UTILISER LE SERVICE DE L'UTILISATEUR =====
                console.log(`[DEBUG GET /api/cadres] Fallback: Utilisation du service utilisateur '${user.service}'`);

                whereClause.service = user.service;

                // Vérifications existantes
                if (query.entite && query.entite !== 'Service') {
                    console.log(`[DEBUG GET /api/cadres] Conflit de filtre 'entite'. Query: '${query.entite}', mais utilisateur Standard limité aux Services seulement.`);
                    return res.status(200).json([]);
                }
                if (query.service && query.service !== user.service) {
                    console.log(`[DEBUG GET /api/cadres] Conflit de filtre 'service'. Query: '${query.service}', Scope: '${user.service}'.`);
                    return res.status(200).json([]);
                }

            } else {
                // ===== AUCUNE AUTORISATION =====
                console.log('[DEBUG GET /api/cadres] Utilisateur standard sans cadre associé ni service défini. Retourne tableau vide.');
                return res.status(200).json([]);
            }

            // Appliquer les autres filtres valides dans leur scope
            if (query.grade) whereClause.grade = query.grade;
            if (query.nom) whereClause.nom = { [Op.like]: `%${query.nom}%` };
            if (query.prenom) whereClause.prenom = { [Op.like]: `%${query.prenom}%` };
            if (query.matricule) whereClause.matricule = { [Op.like]: `%${query.matricule}%` };
            if (query.fonction) whereClause.fonction = { [Op.like]: `%${query.fonction}%` };
            if (query.sexe) whereClause.sexe = query.sexe;
            if (query.date_naissance) whereClause.date_naissance = query.date_naissance;
            if (query.date_sejour_egna) whereClause.date_sejour_egna = query.date_sejour_egna;
            if (query.statut_matrimonial) whereClause.statut_matrimonial = query.statut_matrimonial;
            if (query.email) whereClause.email = { [Op.like]: `%${query.email}%` };
            if (query.date_nomination) whereClause.date_nomination = query.date_nomination;

            console.log('[DEBUG GET /api/cadres] Logique Standard. whereClause finale avant findAll:', whereClause);

        } else {
            console.log('[DEBUG GET /api/cadres] Rôle non autorisé. Accès 403.');
            return res.sendStatus(403);
        }

        const cadres = await Cadre.findAll({
            where: whereClause,
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite',
                'sexe', 'photo_url',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'timestamp_derniere_maj_statut',
                'cours', 'droit_annuel_perm',
                'date_naissance', 'date_sejour_egna', 'statut_matrimonial',
                'nombre_enfants', 'email', 'telephones', 'date_nomination'
            ],
            include: includeClause,
            order: [['nom', 'ASC'], ['prenom', 'ASC']]
        });
        console.log(`[DEBUG GET /api/cadres] Nombre de cadres trouvés: ${cadres.length}`);
        return res.status(200).json(cadres);

    } catch (error) {
        console.error('Erreur récupération cadres:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// GET /api/cadres/matricule/:mat - Obtenir un cadre par matricule
router.get('/matricule/:mat', async (req, res) => {
    try {
        const cadre = await Cadre.findOne({
            where: { matricule: req.params.mat },
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite',
                'sexe', 'photo_url',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'timestamp_derniere_maj_statut',
                'cours', 'droit_annuel_perm',
                'date_naissance', 'date_sejour_egna', 'statut_matrimonial',
                'nombre_enfants', 'email', 'telephones', 'date_nomination'
            ],
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }]
        });

        if (!cadre) return res.status(404).json({ message: 'Matricule non trouvé.' });

        if (req.user.role === 'Standard') {
            // MODIFICATION : Vérifier contre le cadre associé de l'utilisateur
            let userCadre = null;
            if (req.user.cadre_id) {
                userCadre = await Cadre.findByPk(req.user.cadre_id);
            }

            if (userCadre && userCadre.entite === 'Escadron') {
                // Utilisateur Escadron : vérifier que le cadre recherché appartient au même escadron
                if (cadre.entite !== 'Escadron' || cadre.cours !== userCadre.cours) {
                    return res.status(403).json({ message: 'Accès non autorisé.' });
                }
            } else if (userCadre && userCadre.entite === 'Service') {
                // Utilisateur Service : vérifier que le cadre recherché appartient au même service
                if (cadre.entite !== 'Service' || cadre.service !== userCadre.service) {
                    return res.status(403).json({ message: 'Accès non autorisé.' });
                }
            } else if (req.user.service) {
                // Fallback : utiliser le service de l'utilisateur
                if (cadre.service !== req.user.service) {
                    return res.status(403).json({ message: 'Accès non autorisé.' });
                }
            } else {
                return res.status(403).json({ message: 'Accès non autorisé.' });
            }
        }

        return res.status(200).json(cadre);

    } catch (error) {
        console.error('Erreur récupération cadre:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// PUT /api/cadres/:id - Mettre à jour un cadre (VERSION CORRIGÉE)
router.put('/:id', isStandard, async (req, res) => {
    const { statut_absence, motif_absence, permissionDetails, ...otherCadreData } = req.body;
    const { id } = req.params;

    console.log(`[DEBUG PUT /api/cadres/:id] ID Cadre à mettre à jour: ${id}`);
    console.log(`[DEBUG PUT /api/cadres/:id] Corps de la requête (req.body):`, req.body);

    const t = await Cadre.sequelize.transaction();
    let isTransactionActive = true;

    try {
        const cadre = await Cadre.findByPk(id, { transaction: t });
        if (!cadre) {
            await t.rollback();
            isTransactionActive = false;
            return res.status(404).json({ message: 'Cadre non trouvé.' });
        }

        if (req.user.role === 'Standard') {
            let userCadre = null;
            if (req.user.cadre_id) {
                userCadre = await Cadre.findByPk(req.user.cadre_id, { transaction: t });
            }

            if (userCadre && userCadre.entite === 'Escadron') {
                if (cadre.entite !== 'Escadron' || cadre.cours !== userCadre.cours) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(403).json({ message: 'Accès non autorisé.' });
                }
            } else if (userCadre && userCadre.entite === 'Service') {
                if (cadre.entite !== 'Service' || cadre.service !== userCadre.service) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(403).json({ message: 'Accès non autorisé.' });
                }
            } else if (req.user.service) {
                if (cadre.service !== req.user.service) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(403).json({ message: 'Accès non autorisé.' });
                }
            } else {
                await t.rollback();
                isTransactionActive = false;
                return res.status(403).json({ message: 'Accès non autorisé.' });
            }
        }

        const updateData = { ...otherCadreData };

        if (statut_absence !== undefined) {
            updateData.statut_absence = statut_absence;
            if (statut_absence !== cadre.statut_absence) {
                updateData.timestamp_derniere_maj_statut = new Date();
            } else {
                updateData.timestamp_derniere_maj_statut = cadre.timestamp_derniere_maj_statut;
            }
        }
        if (req.body.date_debut_absence !== undefined) updateData.date_debut_absence = req.body.date_debut_absence;
        if (motif_absence !== undefined) updateData.motif_absence = motif_absence;

        // Gérer les nouveaux champs pour la mise à jour
        if (req.body.date_naissance !== undefined) updateData.date_naissance = req.body.date_naissance;
        if (req.body.date_sejour_egna !== undefined) updateData.date_sejour_egna = req.body.date_sejour_egna;
        if (req.body.statut_matrimonial !== undefined) updateData.statut_matrimonial = req.body.statut_matrimonial;
        if (req.body.nombre_enfants !== undefined) updateData.nombre_enfants = req.body.nombre_enfants;
        if (req.body.email !== undefined) {
            if (req.body.email !== null && req.body.email !== cadre.email) {
                const existingEmailCadre = await Cadre.findOne({ where: { email: req.body.email }, transaction: t });
                if (existingEmailCadre && existingEmailCadre.id !== cadre.id) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(409).json({ message: `Un autre cadre utilise déjà l'adresse e-mail ${req.body.email}.` });
                }
            }
            updateData.email = req.body.email;
        }
        if (req.body.photo_url !== undefined) updateData.photo_url = req.body.photo_url;
        if (req.body.telephones !== undefined) updateData.telephones = req.body.telephones;
        if (req.body.date_nomination !== undefined) updateData.date_nomination = req.body.date_nomination;

        console.log(`[DEBUG PUT /api/cadres/:id] Traitement de l'entité. req.body.entite: ${req.body.entite}`);
        if (req.body.entite !== undefined) {
            updateData.entite = req.body.entite;

            if (req.body.entite === 'Escadron') {
                if (req.body.cours === undefined || req.body.cours === null) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(400).json({ message: "L'ID de l'Escadron est requis pour l'entité 'Escadron'." });
                }
                const parsedEscadronId = parseInt(req.body.cours);
                if (isNaN(parsedEscadronId)) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(400).json({ message: "L'ID de l'Escadron doit être un nombre entier valide." });
                }
                updateData.cours = parsedEscadronId;
                updateData.service = null;
                console.log(`[DEBUG PUT /api/cadres/:id] Entité définie à 'Escadron', service mis à null.`);
            } else if (req.body.entite === 'Service') {
                updateData.cours = null;
                if (req.body.service === undefined || req.body.service === null || (typeof req.body.service === 'string' && req.body.service.trim() === '')) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(400).json({ message: "Le service est requis pour l'entité 'Service'." });
                }
                updateData.service = req.body.service;
                console.log(`[DEBUG PUT /api/cadres/:id] Entité définie à 'Service', service mis à: ${req.body.service}`);
            } else {
                updateData.cours = null;
                updateData.service = null;
                console.log(`[DEBUG PUT /api/cadres/:id] Entité définie à 'None', service et cours mis à null.`);
            }
        }

        await cadre.update(updateData, { transaction: t });

        // ✅ CORRECTION - Gestion des permissions avec les vraies colonnes
        if (permissionDetails) {
            console.log(`[DEBUG PUT /api/cadres/:id] Traitement des permissions:`, permissionDetails);

            // Si c'est un objet simple de permission (pas un array)
            if (typeof permissionDetails === 'object' && !Array.isArray(permissionDetails)) {
                const { droitAnnee, dateDepart, dateArrivee, totalJours, referenceMessageDepart } = permissionDetails;

                if (droitAnnee && dateDepart && dateArrivee) {
                    console.log(`[DEBUG PUT /api/cadres/:id] Création nouvelle permission`);

                    const calculatedDays = calculateDaysInclusive(dateDepart, dateArrivee);
                    const finalJours = totalJours !== undefined ? totalJours : calculatedDays;

                    await Permission.create({
                        cadre_id: id,
                        droitAnneePerm: droitAnnee,
                        dateDepartPerm: dateDepart,
                        dateArriveePerm: dateArrivee,
                        joursPrisPerm: finalJours,
                        referenceMessageDepart: referenceMessageDepart || null
                    }, { transaction: t });

                    console.log(`[DEBUG PUT /api/cadres/:id] Permission créée: ${dateDepart} au ${dateArrivee} (${finalJours} jours)`);
                }
            }
        }

        await t.commit();
        isTransactionActive = false;

        // ✅ CORRECTION - Récupération avec les bonnes colonnes
        const updatedCadre = await Cadre.findByPk(id, {
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite',
                'sexe', 'photo_url',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'timestamp_derniere_maj_statut',
                'cours', 'droit_annuel_perm',
                'date_naissance', 'date_sejour_egna', 'statut_matrimonial',
                'nombre_enfants', 'email', 'telephones', 'date_nomination'
            ],
            include: [
                {
                    model: Escadron,
                    as: 'EscadronResponsable',
                    attributes: ['id', 'nom', 'numero'],
                    required: false
                },
                {
                    model: Permission,
                    as: 'Permissions',
                    attributes: [
                        'id',
                        'droitAnneePerm',
                        'dateDepartPerm',
                        'dateArriveePerm',
                        'joursPrisPerm',
                        'referenceMessageDepart',
                        'referenceMessageArrivee'
                    ], // ✅ CORRECTION - Utiliser les vraies colonnes
                    required: false
                }
            ]
        });

        return res.status(200).json({
            message: 'Cadre mis à jour avec succès',
            cadre: updatedCadre
        });

    } catch (error) {
        if (isTransactionActive) {
            try {
                await t.rollback();
            } catch (rollbackError) {
                console.error('Erreur lors du rollback:', rollbackError);
            }
        }

        console.error('Erreur mise à jour cadre:', error);
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation: ' + error.errors.map(e => e.message).join(', ')
            });
        }
        return res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

// DELETE /api/cadres/:id - Supprimer un cadre
router.delete('/:id', isAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        const cadre = await Cadre.findByPk(id);
        if (!cadre) {
            return res.status(404).json({ message: 'Cadre non trouvé.' });
        }

        await cadre.destroy();
        return res.status(200).json({ message: 'Cadre supprimé avec succès.' });

    } catch (error) {
        console.error('Erreur suppression cadre:', error);
        return res.status(500).json({ message: 'Erreur serveur', error: error.message });
    }
});

module.exports = router;