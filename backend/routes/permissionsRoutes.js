// routes/permissionsRoutes.js
console.log("DEBUG_VERIFICATION_DEBUT: Fichier permissionsRoutes.js chargé. Version: 2025-01-21_SIMPLIFIE (Suppression droits annuels)");
const express = require('express');
const router = express.Router();

const db = require('../models');
const { Permission, Cadre, Sequelize } = db;

const { authenticateJWT, isStandard, isAdmin } = require('../middleware/authMiddleware');

const calculateDaysInclusive = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(end.getTime() - start.getTime())+1;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
};

// --- ROUTE : GET /api/permissions/ (pour l'affichage de toutes les permissions) ---
router.get('/', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const { dateDepart, dateFin, cadreId, nomCadre, matriculeCadre, service, escadronId } = req.query;

        const whereClause = {};
        const cadreWhereClause = {};

        if (dateDepart) {
            whereClause.dateDepartPerm = { [Sequelize.Op.gte]: new Date(dateDepart) };
        }
        if (dateFin) {
            whereClause.dateArriveePerm = { [Sequelize.Op.lte]: new Date(dateFin) };
        }

        if (cadreId) {
            whereClause.cadre_id = cadreId;
        }
        if (nomCadre) {
            cadreWhereClause.nom = { [Sequelize.Op.like]: `%${nomCadre}%` };
        }
        if (matriculeCadre) {
            cadreWhereClause.matricule = { [Sequelize.Op.like]: `%${matriculeCadre}%` };
        }
        if (service) {
            cadreWhereClause.service = { [Sequelize.Op.like]: `%${service}%` };
        }
        if (escadronId) {
            cadreWhereClause.escadronId = escadronId;
        }

        const permissions = await Permission.findAll({
            where: whereClause,
            include: [{
                model: Cadre,
                as: 'Cadre',
                where: Object.keys(cadreWhereClause).length > 0 ? cadreWhereClause : undefined,
                required: Object.keys(cadreWhereClause).length > 0
            }]
        });

        res.json(permissions);
    } catch (error) {
        console.error('Erreur lors de la récupération des permissions (GET /):', error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des permissions.' });
    }
});

// --- Route : GET /api/permissions/active/:cadreId ---
router.get('/active/:cadreId', authenticateJWT, isStandard, async (req, res) => {
    const { cadreId } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        const activePermission = await Permission.findOne({
            where: {
                cadre_id: cadreId,
                dateDepartPerm: { [Sequelize.Op.lte]: today },
                dateArriveePerm: { [Sequelize.Op.gte]: today }
            }
        });

        if (activePermission) {
            return res.json({ hasActivePermission: true, activePermission: activePermission });
        } else {
            return res.json({ hasActivePermission: false });
        }

    } catch (error) {
        console.error(`Error checking active permission for cadre ${cadreId}:`, error);
        res.status(500).json({ message: "Server error while checking active permission." });
    }
});

// --- Route SIMPLIFIÉE : GET /api/permissions/cadre-summary/:cadreId ---
// Suppression de la logique des droits annuels
router.get('/cadre-summary/:cadreId', authenticateJWT, isStandard, async (req, res) => {
    const { cadreId } = req.params;
    const currentYear = new Date().getFullYear();

    try {
        const cadre = await Cadre.findByPk(cadreId, {
            attributes: ['id', 'nom', 'prenom', 'matricule']
        });

        if (!cadre) {
            return res.status(404).json({ message: "Cadre not found." });
        }

        const yearStart = new Date(`${currentYear}-01-01`);
        const yearEnd = new Date(`${currentYear}-12-31`);

        const permissionsForYear = await Permission.findAll({
            where: {
                cadre_id: cadreId,
                [Sequelize.Op.or]: [
                    {
                        dateDepartPerm: { [Sequelize.Op.between]: [yearStart, yearEnd] }
                    },
                    {
                        dateArriveePerm: { [Sequelize.Op.between]: [yearStart, yearEnd] }
                    },
                    {
                        dateDepartPerm: { [Sequelize.Op.lte]: yearStart },
                        dateArriveePerm: { [Sequelize.Op.gte]: yearEnd }
                    }
                ]
            }
        });

        let totalJoursPrisAnnee = 0;
        permissionsForYear.forEach(perm => {
            if (perm.dateDepartPerm && perm.dateArriveePerm) {
                const permStartDate = new Date(perm.dateDepartPerm);
                const permEndDate = new Date(perm.dateArriveePerm);

                const periodStart = new Date(Math.max(permStartDate.getTime(), yearStart.getTime()));
                const periodEnd = new Date(Math.min(permEndDate.getTime(), yearEnd.getTime()));

                if (periodStart <= periodEnd) {
                    totalJoursPrisAnnee += calculateDaysInclusive(periodStart, periodEnd);
                }
            }
        });

        // SIMPLIFICATION : Plus de notion de droits annuels
        res.json({
            cadre: {
                nom: cadre.nom,
                prenom: cadre.prenom,
                matricule: cadre.matricule
            },
            totalJoursPrisAnnee: totalJoursPrisAnnee,
            nombrePermissions: permissionsForYear.length
        });

    } catch (error) {
        console.error(`Error fetching permission summary for cadre ${cadreId}:`, error);
        res.status(500).json({ message: "Server error while retrieving permission summary." });
    }
});

// --- Route : GET /api/permissions/summary-by-cadre ---
router.get('/summary-by-cadre', authenticateJWT, isAdmin, async (req, res) => {
    try {
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
        const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);

        const permissionSummary = await Permission.findAll({
            attributes: [
                'cadre_id',
                [Sequelize.fn('SUM', Sequelize.col('joursPrisPerm')), 'totalJoursPermissionAnnee'],
                [Sequelize.fn('COUNT', Sequelize.col('Permission.id')), 'nombrePermissions']
            ],
            where: {
                [Sequelize.Op.or]: [
                    { dateDepartPerm: { [Sequelize.Op.between]: [yearStart, yearEnd] } },
                    { dateArriveePerm: { [Sequelize.Op.between]: [yearStart, yearEnd] } },
                    {
                        dateDepartPerm: { [Sequelize.Op.lte]: yearStart },
                        dateArriveePerm: { [Sequelize.Op.gte]: yearEnd }
                    }
                ]
            },
            include: [{
                model: Cadre,
                as: 'Cadre',
                attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service', ['responsibility_scope', 'entite']],
                required: true
            }],
            group: ['cadre_id', 'Cadre.id', 'Cadre.grade', 'Cadre.nom', 'Cadre.prenom', 'Cadre.matricule', 'Cadre.service', 'Cadre.responsibility_scope'],
            order: [[Sequelize.literal('totalJoursPermissionAnnee'), 'DESC']]
        });

        res.json(permissionSummary);

    } catch (error) {
        console.error('Erreur lors de la récupération du résumé des permissions par cadre :', error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération du résumé des permissions." });
    }
});

// --- Route : GET /api/permissions/details-by-cadre/:cadreId ---
router.get('/details-by-cadre/:cadreId', authenticateJWT, isAdmin, async (req, res) => {
    const { cadreId } = req.params;
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01T00:00:00.000Z`);
    const yearEnd = new Date(`${currentYear}-12-31T23:59:59.999Z`);

    try {
        const cadre = await Cadre.findByPk(cadreId, {
            attributes: ['id', 'grade', 'nom', 'prenom', 'matricule', 'service', 'entite']
        });

        if (!cadre) {
            return res.status(404).json({ message: "Cadre non trouvé." });
        }

        const permissions = await Permission.findAll({
            where: {
                cadre_id: cadreId,
                [Sequelize.Op.or]: [
                    { dateDepartPerm: { [Sequelize.Op.between]: [yearStart, yearEnd] } },
                    { dateArriveePerm: { [Sequelize.Op.between]: [yearStart, yearEnd] } },
                    {
                        dateDepartPerm: { [Sequelize.Op.lte]: yearStart },
                        dateArriveePerm: { [Sequelize.Op.gte]: yearEnd }
                    }
                ]
            },
            order: [['dateDepartPerm', 'ASC']]
        });

        const formattedPermissions = permissions.map(perm => ({
            id: perm.id,
            dateDepartPerm: perm.dateDepartPerm,
            dateArriveePerm: perm.dateArriveePerm,
            joursPrisPerm: perm.joursPrisPerm,
            referenceMessageDepart: perm.referenceMessageDepart,
            referenceMessageArrivee: perm.referenceMessageArrivee
        }));

        res.json({
            cadre: cadre,
            permissions: formattedPermissions
        });

    } catch (error) {
        console.error(`Erreur lors de la récupération des détails des permissions pour le cadre ${cadreId}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des détails des permissions." });
    }
});

// --- Route : POST /api/permissions/:id/arrivee ---
router.post('/:id/arrivee', authenticateJWT, isAdmin, async (req, res) => {
    const { id } = req.params;
    const { referenceMessageArrivee } = req.body;

    try {
        const permission = await Permission.findByPk(id);
        if (!permission) {
            return res.status(404).json({ message: 'Permission non trouvée.' });
        }

        if (permission.referenceMessageArrivee) {
            return res.status(400).json({ message: 'La référence d\'arrivée a déjà été enregistrée pour cette permission.' });
        }

        permission.referenceMessageArrivee = referenceMessageArrivee;

        await permission.save();
        res.json({ message: 'Référence d\'arrivée enregistrée avec succès.', permission });
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement de la référence d\'arrivée :', error);
        res.status(500).json({ message: 'Erreur serveur lors de l\'enregistrement de la référence d\'arrivée.' });
    }
});

module.exports = router;