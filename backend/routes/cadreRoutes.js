'use strict';
const { Cadre, User, Escadron, Permission } = require('../models');
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

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

// Configuration de Multer (inchangée)
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

// ✅ ROUTE INCHANGÉE : GET /api/cadres/matricule/:matricule
router.get('/matricule/:matricule', async (req, res) => {
    const { matricule } = req.params;

    console.log('[DEBUG GET /api/cadres/matricule] Recherche matricule:', matricule);
    console.log('[DEBUG GET /api/cadres/matricule] Utilisateur:', req.user.role, req.user.username);

    try {
        const cadre = await Cadre.findOne({
            where: { matricule: matricule },
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }],
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite',
                'sexe', 'photo_url', 'cours',
                'date_naissance', 'date_sejour_egna', 'statut_matrimonial',
                'nombre_enfants', 'email', 'telephones', 'date_nomination'
            ]
        });

        console.log('[DEBUG GET /api/cadres/matricule] Cadre trouvé:', cadre ? 'OUI' : 'NON');

        if (!cadre) {
            console.log('[DEBUG GET /api/cadres/matricule] Aucun cadre avec ce matricule');
            return res.status(404).json({
                message: `Aucun cadre trouvé avec le matricule ${matricule}`
            });
        }

        console.log('[DEBUG GET /api/cadres/matricule] Réponse envoyée:', {
            id: cadre.id,
            nom: cadre.nom,
            prenom: cadre.prenom,
            entite: cadre.entite,
            matricule: cadre.matricule
        });

        return res.status(200).json(cadre);

    } catch (error) {
        console.error('[DEBUG GET /api/cadres/matricule] Erreur:', error);
        return res.status(500).json({
            message: 'Erreur serveur lors de la recherche du cadre.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ✅ ROUTE INCHANGÉE pour les services
router.get('/services', async (req, res) => {
    try {
        const services = await Cadre.findAll({
            attributes: ['service'],
            where: {
                service: { [Op.ne]: null }
            },
            group: ['service'],
            order: [['service', 'ASC']]
        });

        const servicesList = services.map(s => s.service).filter(Boolean);
        res.json(servicesList);
    } catch (error) {
        console.error('Erreur récupération services:', error);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ✅ NOUVELLE ROUTE : GET /api/cadres/all - Pour les consultants (accès global)
router.get('/all', async (req, res) => {
    console.log('[DEBUG GET /api/cadres/all] Requête reçue. Rôle utilisateur:', req.user.role);

    // Vérifier que l'utilisateur est un Consultant
    if (req.user.role !== 'Consultant') {
        console.log('[DEBUG GET /api/cadres/all] ❌ Accès refusé - Réservé aux Consultants');
        return res.status(403).json({
            message: 'Cette route est réservée aux consultants.'
        });
    }

    console.log('[DEBUG GET /api/cadres/all] ✅ Consultant - Accès global autorisé');

    const { query } = req;
    const whereClause = {};
    const includeClause = [{
        model: Escadron,
        as: 'EscadronResponsable',
        attributes: ['id', 'nom', 'numero'],
        required: false
    }];

    try {
        // Appliquer les filtres optionnels
        if (query.statut) {
            const allowedStatuses = ['Présent', 'Absent', 'Indisponible'];
            if (allowedStatuses.includes(query.statut)) {
                whereClause.statut_absence = query.statut;
            }
        }

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

        console.log(`[DEBUG GET /api/cadres/all] ✅ Retour de ${cadres.length} cadres pour consultant`);
        return res.status(200).json(cadres);

    } catch (error) {
        console.error('[DEBUG GET /api/cadres/all] ❌ Erreur:', error);
        return res.status(500).json({
            message: 'Erreur serveur lors de la récupération des cadres',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ✅ MODIFIÉ : POST /api/cadres - Autoriser Admin, bloquer seulement Consultant
router.post('/', upload.single('photo'), async (req, res) => {
    console.log('[DEBUG POST /api/cadres] Création d\'un nouveau cadre');
    console.log('[DEBUG POST /api/cadres] Utilisateur:', req.user.role, req.user.username);
    console.log('[DEBUG POST /api/cadres] Données reçues:', req.body);

    // Vérifications des permissions
    if (req.user.role === 'Consultant') {
        return res.status(403).json({
            message: 'Mode consultation : création non autorisée'
        });
    }

    const t = await Cadre.sequelize.transaction();
    let isTransactionActive = true;

    try {
        // Validation des champs obligatoires
        const requiredFields = [
            'grade', 'nom', 'prenom', 'matricule', 'entite', 'sexe',
            'date_naissance', 'lieu_naissance', 'cfeg', 'date_sejour_egna',
            'situation_familiale', 'email', 'date_nomination'
        ];

        for (const field of requiredFields) {
            if (!req.body[field]) {
                await t.rollback();
                isTransactionActive = false;
                return res.status(400).json({
                    message: `Le champ "${field}" est obligatoire.`
                });
            }
        }

        // Validation du matricule (unicité)
        const existingCadre = await Cadre.findOne({
            where: { matricule: req.body.matricule },
            transaction: t
        });

        if (existingCadre) {
            await t.rollback();
            isTransactionActive = false;
            return res.status(409).json({
                message: `Le matricule "${req.body.matricule}" est déjà utilisé.`
            });
        }

        // Validation de l'email (unicité)
        if (req.body.email) {
            const existingEmail = await Cadre.findOne({
                where: { email: req.body.email },
                transaction: t
            });

            if (existingEmail) {
                await t.rollback();
                isTransactionActive = false;
                return res.status(409).json({
                    message: `L'email "${req.body.email}" est déjà utilisé.`
                });
            }
        }

        // Vérifications de permissions pour Standard
        if (req.user.role === 'Standard') {
            let userCadre = null;
            if (req.user.cadre_id) {
                userCadre = await Cadre.findByPk(req.user.cadre_id, { transaction: t });
            }

            // Standard ne peut créer que dans son entité
            if (userCadre && userCadre.entite === 'Service') {
                if (req.body.entite !== 'Service' || req.body.service !== userCadre.service) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(403).json({
                        message: 'Vous ne pouvez créer des cadres que dans votre service.'
                    });
                }
            } else if (userCadre && userCadre.entite === 'Escadron') {
                if (req.body.entite !== 'Escadron' || parseInt(req.body.responsible_escadron_id) !== userCadre.cours) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(403).json({
                        message: 'Vous ne pouvez créer des cadres que dans votre escadron.'
                    });
                }
            } else if (req.user.service) {
                if (req.body.entite !== 'Service' || req.body.service !== req.user.service) {
                    await t.rollback();
                    isTransactionActive = false;
                    return res.status(403).json({
                        message: 'Vous ne pouvez créer des cadres que dans votre service.'
                    });
                }
            }
        }

        // Préparer les données du cadre
        const cadreData = {
            grade: req.body.grade,
            nom: req.body.nom,
            prenom: req.body.prenom,
            matricule: req.body.matricule,
            service: req.body.entite === 'Service' ? req.body.service : null,
            numero_telephone: req.body.numero_telephone || null,
            fonction: req.body.fonction || null,
            entite: req.body.entite,
            cours: req.body.entite === 'Escadron' ? parseInt(req.body.responsible_escadron_id) : null,
            sexe: req.body.sexe,
            date_naissance: req.body.date_naissance,
            lieu_naissance: req.body.lieu_naissance,
            cfeg: req.body.cfeg,
            date_sejour_egna: req.body.date_sejour_egna,
            statut_matrimonial: req.body.situation_familiale,
            nombre_enfants: parseInt(req.body.nombre_enfants) || 0,
            email: req.body.email,
            date_nomination: req.body.date_nomination,
            statut_absence: 'Présent', // Statut par défaut
            timestamp_derniere_maj_statut: new Date()
        };

        // Gestion de la photo
        if (req.file) {
            cadreData.photo_url = `/uploads/${req.file.filename}`;
        }

        // Gestion des téléphones
        if (req.body.telephones) {
            try {
                const telephones = JSON.parse(req.body.telephones);
                cadreData.telephones = JSON.stringify(telephones);
            } catch (error) {
                console.error('Erreur parsing téléphones:', error);
                cadreData.telephones = JSON.stringify([]);
            }
        }

        console.log('[DEBUG POST /api/cadres] Données à insérer:', cadreData);

        // Créer le cadre
        const nouveauCadre = await Cadre.create(cadreData, { transaction: t });

        console.log('[DEBUG POST /api/cadres] Cadre créé avec ID:', nouveauCadre.id);

        await t.commit();
        isTransactionActive = false;

        // Récupérer le cadre complet avec les associations
        const cadreComplet = await Cadre.findByPk(nouveauCadre.id, {
            include: [{
                model: Escadron,
                as: 'EscadronResponsable',
                attributes: ['id', 'nom', 'numero'],
                required: false
            }],
            attributes: [
                'id', 'grade', 'nom', 'prenom', 'matricule', 'service',
                'numero_telephone', 'fonction', 'entite',
                'sexe', 'photo_url', 'cours',
                'statut_absence', 'date_debut_absence', 'motif_absence',
                'timestamp_derniere_maj_statut',
                'date_naissance', 'date_sejour_egna', 'statut_matrimonial',
                'nombre_enfants', 'email', 'telephones', 'date_nomination'
            ]
        });

        console.log('[DEBUG POST /api/cadres] ✅ Cadre créé avec succès');

        return res.status(201).json({
            message: `Cadre "${cadreData.grade} ${cadreData.nom} ${cadreData.prenom}" créé avec succès.`,
            cadre: cadreComplet
        });

    } catch (error) {
        if (isTransactionActive) {
            try {
                await t.rollback();
            } catch (rollbackError) {
                console.error('Erreur lors du rollback:', rollbackError);
            }
        }

        console.error('[DEBUG POST /api/cadres] ❌ Erreur lors de la création:', error);

        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                message: 'Erreur de validation: ' + error.errors.map(e => e.message).join(', ')
            });
        }

        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({
                message: 'Contrainte d\'unicité violée: ' + error.errors.map(e => e.message).join(', ')
            });
        }

        return res.status(500).json({
            message: 'Erreur serveur lors de la création du cadre.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// ✅ MODIFIÉ : GET /api/cadres - Route pour Standard et Admin (accès restreint)
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

    try {
        if (query.statut) {
            const allowedStatuses = ['Présent', 'Absent', 'Indisponible'];
            if (allowedStatuses.includes(query.statut)) {
                whereClause.statut_absence = query.statut;
            }
        }

        // CORRIGÉ : Admin peut voir tout sans restriction
        if (user.role === 'Admin') {
            console.log('[DEBUG GET /api/cadres] Admin - Accès complet autorisé');
            // Admins peuvent voir tout sans restriction
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

        } else if (user.role === 'Consultant') {
            // Rediriger les consultants vers la route /all
            console.log('[DEBUG GET /api/cadres] Consultant - Redirection vers /all');
            return res.status(403).json({
                message: 'Les consultants doivent utiliser la route /api/cadres/all'
            });

        } else if (user.role === 'Standard') {
            // Logique restrictive pour les utilisateurs Standard (inchangée)
            console.log('[DEBUG GET /api/cadres] Utilisateur Standard - Restrictions par entité');

            let userCadre = null;
            if (user.cadre_id) {
                userCadre = await Cadre.findByPk(user.cadre_id);
            }

            if (userCadre && userCadre.entite === 'Escadron') {
                if (!userCadre.cours) {
                    return res.status(200).json([]);
                }
                whereClause.entite = 'Escadron';
                whereClause.cours = userCadre.cours;
            } else if (userCadre && userCadre.entite === 'Service') {
                if (!userCadre.service) {
                    return res.status(200).json([]);
                }
                whereClause.entite = 'Service';
                whereClause.service = userCadre.service;
            } else if (user.service) {
                whereClause.service = user.service;
            } else {
                return res.status(200).json([]);
            }

            // Appliquer les autres filtres dans leur scope
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

        } else {
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

        return res.status(200).json(cadres);

    } catch (error) {
        console.error('Erreur récupération cadres:', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// ✅ MODIFIÉ : PUT /api/cadres/:id - Autoriser Admin, bloquer seulement Consultant
router.put('/:id', async (req, res) => {
    // CORRIGÉ : Bloquer seulement les consultants
    if (req.user.role === 'Consultant') {
        return res.status(403).json({
            message: 'Mode consultation : modification non autorisée'
        });
    }

    const { statut_absence, motif_absence, permissionDetails, ...otherCadreData } = req.body;
    const { id } = req.params;

    console.log(`[DEBUG PUT /api/cadres/:id] ID Cadre à mettre à jour: ${id}`);
    console.log(`[DEBUG PUT /api/cadres/:id] Utilisateur: ${req.user.role}`);

    const t = await Cadre.sequelize.transaction();
    let isTransactionActive = true;

    try {
        const cadre = await Cadre.findByPk(id, { transaction: t });
        if (!cadre) {
            await t.rollback();
            isTransactionActive = false;
            return res.status(404).json({ message: 'Cadre non trouvé.' });
        }

        // CORRIGÉ : Vérifications de permissions selon le rôle
        if (req.user.role === 'Admin') {
            // Admin peut modifier tout sans restriction
            console.log('[DEBUG PUT /api/cadres/:id] Admin - Accès complet autorisé');
        } else if (req.user.role === 'Standard') {
            // Standard : restrictions par entité (inchangées)
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

        // Gestion des autres champs (inchangée)
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

        await cadre.update(updateData, { transaction: t });

        // CORRIGÉ : Gestion des permissions (SANS insertion d'absence depuis cette route)
        if (permissionDetails) {
            console.log(`[DEBUG PUT /api/cadres/:id] Traitement des permissions (pas d'absence):`, permissionDetails);

            if (typeof permissionDetails === 'object' && !Array.isArray(permissionDetails)) {
                const { dateDepart, dateArrivee, totalJours, referenceMessageDepart } = permissionDetails;

                if (dateDepart && dateArrivee) {
                    const calculatedDays = calculateDaysInclusive(dateDepart, dateArrivee);
                    const finalJours = totalJours !== undefined ? totalJours : calculatedDays;

                    await Permission.create({
                        cadre_id: id,
                        droitAnneePerm: 0, // Valeur par défaut (non utilisée)
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
                        'id', 'droitAnneePerm', 'dateDepartPerm', 'dateArriveePerm',
                        'joursPrisPerm', 'referenceMessageDepart', 'referenceMessageArrivee'
                    ],
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

// ✅ MODIFIÉ : DELETE /api/cadres/:id - Supprimer le middleware isAdmin, vérification manuelle
router.delete('/:id', async (req, res) => {
    // CORRIGÉ : Vérification manuelle au lieu du middleware
    console.log(`[DEBUG DELETE] Rôle utilisateur: "${req.user.role}"`);
    console.log(`[DEBUG DELETE] Username: ${req.user.username}`);

    if (req.user.role !== 'Admin') {
        console.log(`[DEBUG DELETE] ❌ Accès refusé pour le rôle: "${req.user.role}"`);
        return res.status(403).json({
            message: `Accès refusé : droits administrateur requis. Votre rôle actuel: "${req.user.role}"`
        });
    }

    console.log(`[DEBUG DELETE] ✅ Accès autorisé pour Admin`);

    const { id } = req.params;

    console.log(`[DEBUG DELETE /api/cadres/:id] Tentative de suppression du cadre ID: ${id}`);
    console.log(`[DEBUG DELETE /api/cadres/:id] Demandeur: ${req.user.username} (ID: ${req.user.id}, Role: ${req.user.role})`);

    try {
        const cadre = await Cadre.findByPk(id);
        if (!cadre) {
            console.log(`[DEBUG DELETE /api/cadres/:id] Cadre ID ${id} non trouvé`);
            return res.status(404).json({ message: 'Cadre non trouvé.' });
        }

        console.log(`[DEBUG DELETE /api/cadres/:id] Cadre trouvé: ${cadre.nom} ${cadre.prenom} (${cadre.matricule})`);

        // Vérifier si le cadre est lié à un utilisateur
        const linkedUser = await User.findOne({ where: { cadre_id: id } });
        if (linkedUser) {
            console.log(`[DEBUG DELETE /api/cadres/:id] Cadre lié à l'utilisateur: ${linkedUser.username}`);
            return res.status(400).json({
                message: `Impossible de supprimer ce cadre car il est associé à l'utilisateur "${linkedUser.username}". Veuillez d'abord supprimer ou modifier cet utilisateur.`,
                linkedUser: {
                    id: linkedUser.id,
                    username: linkedUser.username,
                    role: linkedUser.role
                }
            });
        }

        await cadre.destroy();

        console.log(`[DEBUG DELETE /api/cadres/:id] ✅ Cadre supprimé avec succès`);

        return res.status(200).json({
            message: `Cadre "${cadre.nom} ${cadre.prenom}" (${cadre.matricule}) supprimé avec succès.`,
            action: 'deleted',
            deletedCadre: {
                id: cadre.id,
                nom: cadre.nom,
                prenom: cadre.prenom,
                matricule: cadre.matricule
            }
        });

    } catch (error) {
        console.error('[DEBUG DELETE /api/cadres/:id] ❌ Erreur lors de la suppression:', error);
        return res.status(500).json({
            message: 'Erreur serveur lors de la suppression du cadre.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

module.exports = router;