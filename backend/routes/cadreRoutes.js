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

// ✅ ROUTE CORRIGÉE : GET /api/cadres/matricule/:matricule
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

// ==========================================
// NOUVELLE ROUTE : GET /api/cadres/all
// Spécialement pour les consultants (accès global)
// ==========================================
router.get('/all', async (req, res) => {
    const { user, query } = req;
    const whereClause = {};
    const includeClause = [{
        model: Escadron,
        as: 'EscadronResponsable',
        attributes: ['id', 'nom', 'numero'],
        required: false
    }];

    console.log('[DEBUG GET /api/cadres/all] Requête reçue. Rôle utilisateur:', user.role);

    try {
        // Vérification des permissions - Seuls les consultants peuvent utiliser cette route
        if (user.role !== 'Consultant') {
            console.log('[DEBUG GET /api/cadres/all] Accès refusé - Rôle non autorisé:', user.role);
            return res.status(403).json({
                message: 'Cette route est réservée aux utilisateurs Consultant.'
            });
        }

        // Appliquer les filtres de recherche (sans restriction d'entité)
        if (query.statut) {
            const allowedStatuses = ['Présent', 'Absent', 'Indisponible'];
            if (allowedStatuses.includes(query.statut)) {
                whereClause.statut_absence = query.statut;
            }
        }

        // Filtres globaux pour les consultants
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

        console.log('[DEBUG GET /api/cadres/all] whereClause finale:', whereClause);

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

        console.log(`[DEBUG GET /api/cadres/all] Nombre de cadres trouvés: ${cadres.length}`);
        return res.status(200).json(cadres);

    } catch (error) {
        console.error('Erreur récupération cadres (route /all):', error);
        return res.status(500).json({ message: 'Erreur serveur' });
    }
});

// POST /api/cadres - Créer un nouveau cadre (ADMINS EXCLUS DES MISES À JOUR)
router.post('/', upload.single('photo'), async (req, res) => {
    // Bloquer les admins pour les mises à jour
    if (req.user.role === 'Admin') {
        return res.status(403).json({
            message: 'Les administrateurs ne peuvent pas effectuer de mises à jour. Veuillez vous connecter avec un compte Standard ou Consultant.'
        });
    }

    // ... reste du code inchangé ...
    // Note: Vous devrez compléter cette partie avec votre code existant
});

// GET /api/cadres - Lister les cadres (AVEC RESTRICTIONS POUR STANDARD)
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

        if (user.role === 'Admin') {
            // Admins peuvent voir tout mais ne peuvent pas modifier
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

// PUT /api/cadres/:id - Mettre à jour un cadre (PERMISSIONS SIMPLIFIÉES + ADMINS EXCLUS)
router.put('/:id', async (req, res) => {
    // Bloquer les admins pour les mises à jour
    if (req.user.role === 'Admin') {
        return res.status(403).json({
            message: 'Les administrateurs ne peuvent pas effectuer de mises à jour. Veuillez vous connecter avec un compte Standard ou Consultant.'
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

        // Vérifications de permissions selon le rôle
        if (req.user.role === 'Standard') {
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
        } else if (req.user.role === 'Consultant') {
            // Consultant : accès global, aucune restriction
            console.log('[DEBUG PUT /api/cadres/:id] Consultant - Accès global autorisé');
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

        // Gestion des permissions simplifiée (sans droits annuels)
        if (permissionDetails) {
            console.log(`[DEBUG PUT /api/cadres/:id] Traitement des permissions simplifiées:`, permissionDetails);

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

                    console.log(`[DEBUG PUT /api/cadres/:id] Permission simplifiée créée: ${dateDepart} au ${dateArrivee} (${finalJours} jours)`);
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

// DELETE /api/cadres/:id - Supprimer un cadre (ADMINS SEULEMENT)
router.delete('/:id', isAdmin, async (req, res) => {
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