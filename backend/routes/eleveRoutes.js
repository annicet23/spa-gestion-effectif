// routes/eleveRoutes.js
const express = require('express');
const router = express.Router();
// Importez les modèles nécessaires (Eleve, Escadron)
const { Eleve, Escadron } = require('../models'); // <-- Vérifiez le chemin
// Importez vos middlewares d'authentification et d'autorisation
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware'); // <-- Vérifiez le chemin
const { Op } = require('sequelize'); // Nécessaire si vous utilisez des opérateurs Sequelize
// Importez les types d'erreurs Sequelize si vous les utilisez pour la gestion d'erreurs (comme dans cadreRoutes.js)
// const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');


// GET /api/eleves
// Obtenir la liste de tous les élèves, avec filtres
// Accessible aux utilisateurs authentifiés (Admin voit tout, Standard peut voir son escadron/peloton si responsable)
router.get('/', authenticateJWT, async (req, res) => {
    // Récupérer tous les paramètres de requête possibles, y compris 'statut'
    const { escadron_id, peloton, statut } = req.query; // <-- Ajout de 'statut'

    const whereClause = {}; // Initialiser l'objet de filtre

    // Gestion des filtres existants (escadron_id et peloton)
    if (escadron_id) {
        const parsedEscadronId = parseInt(escadron_id, 10);
        if (isNaN(parsedEscadronId)) {
            return res.status(400).json({ message: 'L\'ID de l\'escadron doit être un nombre valide.' });
        }
        whereClause.escadron_id = parsedEscadronId;
    }
    if (peloton) {
        whereClause.peloton = peloton;
    }

    // --- AJOUT DE LA GESTION DU FILTRE STATUT ---
    if (statut) {
        // Le champ dans la DB/modèle qui stocke le statut global de l'élève
        // D'après votre code POST, ce champ est nommé 'statut'
        whereClause.statut = statut; // <-- Utilisez le nom exact du champ dans votre modèle Eleve
    }
    // --- FIN DE L'AJOUT ---

    // TODO: Implémenter la logique de permission pour les utilisateurs 'Standard'.
    // Un utilisateur Standard ne devrait voir que les élèves de son escadron/peloton s'il est responsable.
    // Cette logique doit être combinée avec les filtres de requête (escadron_id, peloton, statut).
    if (req.user.role === 'Standard') {
        console.log(`TODO: Implémenter le filtrage des élèves basé sur l'utilisateur ${req.user.username} (${req.user.role}).`);
        // Exemple (à adapter selon votre logique de responsabilité):
        // Si l'utilisateur Standard est lié à un cadre responsable d'un escadron/peloton
        // whereClause.escadron_id = req.user.cadre.escadron_id;
        // whereClause.peloton = req.user.cadre.peloton;
        // Si l'utilisateur Standard n'a pas de responsabilité, renvoyer une liste vide ou 403.
        // return res.status(403).json({ message: "Accès refusé." }); // Exemple de refus
    }


    try {
        const eleves = await Eleve.findAll({
            where: whereClause, // Applique la clause where avec tous les filtres
            order: [
                ['escadron_id', 'ASC'],
                ['peloton', 'ASC'],
                ['nom', 'ASC'],
                ['prenom', 'ASC']
            ],
            // Incluez les champs nécessaires pour l'affichage dans le tableau du tableau de bord
            // D'après HomePage.jsx, nous avons besoin de : id, nom, prenom, incorporation, statut, matricule, escadron_id, peloton, sexe
            attributes: ['id', 'nom', 'prenom', 'incorporation', 'statut', 'matricule', 'escadron_id', 'peloton', 'sexe'], // <-- Inclure 'statut' et autres champs nécessaires
            include: [
                // Inclure l'Escadron si nécessaire (par exemple pour afficher le nom de l'escadron)
                // Assurez-vous que l'association Eleve.belongsTo(Escadron) est définie dans vos modèles
                { model: Escadron, attributes: ['nom', 'numero'], as: 'escadron', required: false } // 'as: 'escadron'' doit correspondre à l'alias dans votre association
            ]
        });
        res.status(200).json(eleves);
    } catch (error) {
        console.error("Erreur lors de la récupération des élèves avec filtres:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération des élèves.', error: error.message });
    }
});

// Ajoutez cette route pour obtenir un élève par son numéro d'incorporation
router.get('/incorporation/:incorporation', authenticateJWT, async (req, res) => {
    const incorporation = req.params.incorporation;
    try {
        const eleve = await Eleve.findOne({
            where: { incorporation: incorporation },
            include: [{ model: Escadron, attributes: ['nom'], as: 'escadron' }]
        });
        if (!eleve) {
            return res.status(404).json({ message: 'Numéro d\'incorporation non trouvé.' });
        }
        res.status(200).json(eleve);
    } catch (error) {
        console.error("Erreur lors de la récupération de l'élève par incorporation:", error);
        res.status(500).json({ message: 'Erreur serveur lors de la récupération de l\'élève.', error: error.message });
    }
});

// POST /api/eleves
// Créer un ou plusieurs nouveaux élèves (gestion de lot ou unitaire)
router.post('/', authenticateJWT, async (req, res) => {
    const elevesData = req.body;

    if (Array.isArray(elevesData)) {
        // Gestion d'un lot d'élèves
        const results = {
            successes: [],
            failures: []
        };

        try {
            // Pré-charger les escadrons existants et les incorporations existantes pour validation rapide
            const escadrons = await Escadron.findAll({ attributes: ['id'] });
            const existingEscadronIds = new Set(escadrons.map(e => e.id));

            const existingEleves = await Eleve.findAll({ attributes: ['incorporation'] });
            const existingIncorporations = new Set(existingEleves.map(e => e.incorporation));

            for (const eleve of elevesData) {
                // Validation de base pour chaque élève dans le lot
                if (!eleve.nom || !eleve.prenom || !eleve.incorporation || !eleve.escadron_id || !eleve.peloton || !eleve.sexe) {
                    results.failures.push({ eleve, error: 'Certains champs requis sont manquants ou vides.' });
                    continue; // Passer à l'élève suivant
                }

                // Validation de l'ID de l'escadron
                const escadronId = parseInt(eleve.escadron_id, 10);
                if (isNaN(escadronId) || !existingEscadronIds.has(escadronId)) {
                    results.failures.push({ eleve, error: `L'escadron avec l'ID ${eleve.escadron_id} n'existe pas.` });
                    continue;
                }

                // Vérification de l'unicité de l'incorporation
                if (existingIncorporations.has(eleve.incorporation)) {
                    results.failures.push({ eleve, error: `Un élève avec l'incorporation ${eleve.incorporation} existe déjà.` });
                    continue;
                }

                // Si validation réussie, ajouter à la liste des succès
                results.successes.push({
                    nom: eleve.nom.toUpperCase(),
                    prenom: eleve.prenom.charAt(0).toUpperCase() + eleve.prenom.slice(1).toLowerCase(),
                    matricule: eleve.matricule || null, // Peut être null
                    incorporation: eleve.incorporation,
                    escadron_id: escadronId,
                    peloton: eleve.peloton,
                    sexe: eleve.sexe,
                    statut: eleve.statut || 'Présent' // Défaut à 'Présent' si non fourni
                });
                // Ajouter l'incorporation à l'ensemble pour les vérifications futures dans le même lot
                existingIncorporations.add(eleve.incorporation);
            }

            // Insertion groupée des élèves valides
            if (results.successes.length > 0) {
                try {
                    // bulkCreate insère plusieurs lignes en une seule requête
                    const createdEleves = await Eleve.bulkCreate(results.successes, { returning: true }); // returning: true pour obtenir les objets créés avec leurs IDs
                    // Optionnel: Vous pourriez vouloir ajouter les élèves créés à 'results.successes' si vous avez besoin de leurs IDs
                } catch (bulkError) {
                    console.error('Erreur lors de l\'insertion groupée via bulkCreate:', bulkError);
                    // Si bulkCreate échoue, considérer tous les succès potentiels comme des échecs
                    results.failures = results.failures.concat(results.successes.map(eleve => ({ eleve, error: `Échec de l'insertion groupée: ${bulkError.message}` })));
                    results.successes = []; // Vider la liste des succès
                }
            }

            // Déterminer le code de statut de la réponse
            const statusCode = results.failures.length > 0 ? 207 : (results.successes.length > 0 ? 201 : 400); // 207 Multi-Status si certains échouent, 201 Created si succès, 400 Bad Request si rien n'a pu être traité

            // Renvoyer les résultats du traitement du lot
            return res.status(statusCode).json({
                message: `Traitement du lot terminé. ${results.successes.length} succès, ${results.failures.length} échecs.`,
                successCount: results.successes.length,
                failureCount: results.failures.length,
                failures: results.failures // Liste des élèves qui ont échoué et la raison
            });

        } catch (validationPrepError) {
            console.error('Erreur lors de la préparation des validations (escadrons/élèves existants):', validationPrepError);
            return res.status(500).json({ message: 'Erreur serveur lors de la préparation des validations.', error: validationPrepError.message });
        }

    } else if (elevesData && typeof elevesData === 'object') {
        // Gestion d'un seul élève
        const { nom, prenom, matricule, incorporation, escadron_id, peloton, sexe, statut } = elevesData;

        // Validation de base pour un seul élève
        if (!nom || !prenom || !incorporation || !escadron_id || !peloton || !sexe) {
            return res.status(400).json({ message: 'Certains champs requis sont manquants ou vides.' });
        }

        try {
            // Vérifier si l'escadron existe
            const escadronExiste = await Escadron.findByPk(escadron_id);
            if (!escadronExiste) {
                return res.status(400).json({ message: `L'escadron avec l'ID ${escadron_id} n'existe pas.` });
            }

            // Vérifier l'unicité de l'incorporation
            const existingEleve = await Eleve.findOne({ where: { incorporation } });
            if (existingEleve) {
                return res.status(409).json({ message: `Un élève avec l'incorporation ${incorporation} existe déjà.` });
            }

            // Créer le nouvel élève
            const nouvelEleve = await Eleve.create({
                nom: nom.toUpperCase(),
                prenom: prenom.charAt(0).toUpperCase() + prenom.slice(1).toLowerCase(),
                matricule: matricule || null, // Peut être null
                incorporation,
                escadron_id: parseInt(escadron_id, 10),
                peloton,
                sexe,
                statut: statut || 'Présent' // Défaut à 'Présent' si non fourni
            });

            return res.status(201).json({ message: 'Élève créé avec succès', eleve: nouvelEleve });

        } catch (error) {
            console.error('Erreur lors de l\'insertion de l\'élève unique:', error);
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ message: `Erreur de contrainte unique: ${error.errors[0].message}` });
            }
            // TODO: Gérer d'autres types d'erreurs Sequelize si nécessaire (ValidationError, ForeignKeyConstraintError)
            return res.status(500).json({ message: 'Erreur serveur lors de la création de l\'élève unique.', error: error.message });
        }

    } else {
        // Corps de requête invalide
        return res.status(400).json({ message: 'Le corps de la requête doit être un objet élève ou un tableau d\'élèves.' });
    }
});

// PUT /api/eleves/incorporation/:incorporation
// Mettre à jour le statut d'un élève par son numéro d'incorporation
router.put('/incorporation/:incorporation', authenticateJWT, async (req, res) => {
    const incorporation = req.params.incorporation;
    // Les champs potentiellement mis à jour (ici, principalement le statut d'absence)
    const { statut, date_debut_absence, motif } = req.body;

    // TODO: Validation des champs mis à jour (ex: statut est une valeur valide)
    if (statut !== undefined && !['Présent', 'Absent', 'Indisponible', ''].includes(statut)) { // <-- Adaptez les valeurs possibles
         return res.status(400).json({ message: 'Valeur de statut invalide.' });
    }


    try {
        // Rechercher l'élève par son incorporation
        const eleve = await Eleve.findOne({
            where: { incorporation: incorporation }
        });

        if (!eleve) {
            return res.status(404).json({ message: 'Élève non trouvé pour cette incorporation.' });
        }

        // Mettre à jour les champs
        // Utilisez 'undefined' pour vérifier si le champ était présent dans le corps de la requête
        eleve.statut = statut !== undefined ? (statut === '' ? null : statut) : eleve.statut; // Gérer la chaîne vide comme null
        eleve.date_debut_absence = date_debut_absence !== undefined ? (date_debut_absence === '' ? null : date_debut_absence) : eleve.date_debut_absence; // Gérer la chaîne vide comme null
        eleve.motif = motif !== undefined ? (motif === '' ? null : motif) : eleve.motif; // Gérer la chaîne vide comme null

        // Sauvegarder les changements
        await eleve.save();

        console.log(`Élève avec incorporation ${incorporation} mis à jour.`);
        res.status(200).json({ message: 'Mise à jour réussie.', eleve: eleve });

    } catch (error) {
        console.error(`Erreur lors de la mise à jour de l'élève avec incorporation ${incorporation}:`, error);
        // TODO: Gérer les erreurs Sequelize spécifiques si nécessaire (ValidationError, UniqueConstraintError, ForeignKeyConstraintError)
        res.status(500).json({ message: 'Erreur serveur lors de la mise à jour de l\'élève.', error: error.message });
    }
});


module.exports = router; // Exporter le routeur
