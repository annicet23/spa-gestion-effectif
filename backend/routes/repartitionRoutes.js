// routes/repartitionRoutes.js
const express = require('express');
const router = express.Router();
const { Cadre } = require('../models'); // Assurez-vous que le chemin vers vos modèles est correct
const { authenticateJWT, isAdmin } = require('../middleware/authMiddleware'); // Assurez-vous que le chemin est correct
const { Op } = require('sequelize');
const { sequelize } = require('../models'); // Importe l'instance sequelize pour les transactions


// ============================================================================
// HELPERS
// ============================================================================

// Structure pour définir l'ordre des grades (du plus haut au plus bas)
const GRADE_ORDER = [
   
    'CNE', 'LTN',
    'GPCE', 'GPHC',
    'GP1C', 'GP2C',
    'GHC', 'G1C', 'G2C', 'GST',
   
];

// Helper pour comparer les grades (utilisé principalement pour le tri si nécessaire)
const compareGrades = (gradeA, gradeB) => {
    const indexA = GRADE_ORDER.indexOf(gradeA);
    const indexB = GRADE_ORDER.indexOf(gradeB);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1; // gradeA non trouvé, considéré inférieur (vers la fin)
    if (indexB === -1) return -1; // gradeB non trouvé, considéré inférieur (vers la fin)
    return indexA - indexB; // Compare les index
};

// Helper pour trier des cadres (peut être utilisé pour d'autres besoins, mais PAS pour la randomisation ici)
const sortCadresByGradeThenMatricule = (cadres) => {
    cadres.sort((a, b) => {
        const gradeComparison = compareGrades(a.grade, b.grade);
        if (gradeComparison !== 0) return gradeComparison;

        // Gérer les matricules null/undefined pour le tri
        if (a.matricule == null && b.matricule == null) return 0;
        if (a.matricule == null) return -1;
        if (b.matricule == null) return 1;

        return a.matricule.localeCompare(b.matricule);
    });
};

// --- Helper : Mélanger un tableau aléatoirement (Algorithme de Fisher-Yates) ---
function shuffleArray(array) {
    // Créer une copie pour ne pas modifier le tableau original si nécessaire ailleurs
    const shuffledArray = [...array];
    for (let i = shuffledArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledArray[i], shuffledArray[j]] = [shuffledArray[j], shuffledArray[i]]; // Échange
    }
    return shuffledArray; // Retourne la copie mélangée
}
// ----------------------------------------------------------------------------


// Middleware d'authentification appliqué à toutes les routes de ce routeur
router.use(authenticateJWT);

// ============================================================================
// POST /api/repartition/create - Création d'une proposition de répartition (Admin seulement)
// ============================================================================
// ** AJOUT DE isAdmin ICI **
router.post('/create', isAdmin, async (req, res) => {
    // Validation du corps de la requête
    if (!req.body || typeof req.body !== 'object') {
        console.error("Repartition Create Error: Request body is not a valid JSON object");
        return res.status(400).json({
            success: false,
            message: "Le corps de la requête doit être un objet JSON valide"
        });
    }

    const { numEscadrons } = req.body;

    // Validation du champ numEscadrons
    if (typeof numEscadrons === 'undefined') {
        console.error("Repartition Create Error: 'numEscadrons' field is missing in the request body");
        return res.status(400).json({
            success: false,
            message: "Le champ 'numEscadrons' est requis"
        });
    }

    if (typeof numEscadrons !== 'number' || numEscadrons <= 0 || !Number.isInteger(numEscadrons)) {
         console.error("Repartition Create Error: 'numEscadrons' must be a positive integer. Received:", numEscadrons);
        return res.status(400).json({
            success: false,
            message: "Le nombre d'escadrons doit être un entier positif"
        });
    }

    const numPelotonsPerEscadron = 3; // Constante selon votre logique
    const totalPelotons = numEscadrons * numPelotonsPerEscadron;

    // Définition des besoins minimaux (seuils pour les erreurs 400)
    // Ces rôles sont considérés comme obligatoires pour que la répartition soit possible
    const requiredChefSiat = numEscadrons;
    const requiredCmdtPeloton = totalPelotons;

    // --- Définir les grades pour chaque pool distinct ---
    // Ces définitions déterminent qui est éligible pour quoi.
    const GRADES_CMDT_ESC = ['CNE', 'LTN']; // Grades éligibles Commandant Escadron
    const GRADES_CHEF_SIAT = ['GPCE', 'GPHC']; // Grades éligibles Chef SIAT
    const GRADES_CMDT_PEL = ['GPHC', 'GP1C', 'GP2C']; // Grades éligibles Commandant Peloton
    const GRADES_ADJ_PEL = ['GP2C']; // Grades éligibles Adjoint Commandant Peloton
    // Grades éligibles Moniteur (Ceux qui peuvent être moniteurs s'ils sont 'Escadron' et 'Présent')
    // Un cadre dont le grade est listé dans un rôle clé ci-dessus NE devrait PAS être listé ici si vous ne voulez pas qu'il devienne moniteur s'il n'est pas attribué à son rôle clé.
    const GRADES_MONITEUR = ['GHC', 'G1C', 'G2C', 'GST']; // Grades éligibles Moniteur (confirmés)**

    // Vérification basique pour détecter un éventuel chevauchement non souhaité dans la définition des grades éligibles
    const allKeyRoleGrades = [...GRADES_CMDT_ESC, ...GRADES_CHEF_SIAT, ...GRADES_CMDT_PEL, ...GRADES_ADJ_PEL]; // Peut contenir des doublons, ce n'est pas grave
    const overlappingGrades = GRADES_MONITEUR.filter(grade => allKeyRoleGrades.includes(grade));
    if (overlappingGrades.length > 0) {
        console.warn(`Defined grades overlap: ${overlappingGrades.join(', ')} are listed for both key roles and moniteurs. Adjust GRADES_MONITEUR if this is not intended.`);
    }


    try {
        // Récupération des cadres disponibles (scope 'Escadron' ET 'Présent')
        const cadresEscadronsDisponibles = await Cadre.findAll({
            where: {
                responsibility_scope: 'Escadron',
                statut_absence: 'Présent' // Seulement les cadres présents
            },
            attributes: ['id', 'matricule', 'grade', 'nom', 'prenom', 'sexe', 'fonction'],
            order: [['matricule', 'ASC']], // Un tri initial par défaut (n'impacte pas l'aléatoire après shuffle)
        });

        console.log(`Found ${cadresEscadronsDisponibles.length} available cadres for répartition.`);

        // Vérification si au moins un cadre est disponible du tout
        if (cadresEscadronsDisponibles.length === 0) {
             console.warn("Repartition Create Warning: No available cadres matching criteria. Returning 404.");
            return res.status(404).json({
                success: false,
                message: "Aucun cadre avec responsibility_scope 'Escadron' disponible et 'Présent' pour la répartition."
            });
        }

        // --- Filtrer les cadres en pools distincts basés sur l'éligibilité ---
        const cmdtEscEligiblePool = cadresEscadronsDisponibles.filter(c => GRADES_CMDT_ESC.includes(c.grade));
        const chefSiatEligiblePool = cadresEscadronsDisponibles.filter(c => GRADES_CHEF_SIAT.includes(c.grade));
        const cmdtPelEligiblePool = cadresEscadronsDisponibles.filter(c => GRADES_CMDT_PEL.includes(c.grade));
        const adjPelEligiblePool = cadresEscadronsDisponibles.filter(c => GRADES_ADJ_PEL.includes(c.grade));
        // Le pool des moniteurs est distinct et ne contient PAS les grades des rôles clés (même s'ils sont aussi 'Escadron')
        const moniteurEligiblePool = cadresEscadronsDisponibles.filter(c => GRADES_MONITEUR.includes(c.grade));

        // ** Vérifications des rôles OBLIGATOIRES (Cmdt SIAT et Cmdt Peloton) sur les pools éligibles **
        if (chefSiatEligiblePool.length < requiredChefSiat) {
             console.warn(`Repartition Create Warning: Insufficient eligible Chefs SIAT (${chefSiatEligiblePool.length}/${requiredChefSiat}). Returning 400.`);
             return res.status(400).json({
                 success: false,
                 message: `Nombre insuffisant de cadres éligibles Chef SIAT (${chefSiatEligiblePool.length}/${requiredChefSiat} nécessaires). Impossible de créer la répartition.`
             });
         }

         if (cmdtPelEligiblePool.length < requiredCmdtPeloton) {
               console.warn(`Repartition Create Warning: Insufficient eligible Commandants Peloton (${cmdtPelEligiblePool.length}/${requiredCmdtPeloton}). Returning 400.`);
             return res.status(400).json({
                 success: false,
                 message: `Nombre insuffisant de cadres éligibles Commandant Peloton (${cmdtPelEligiblePool.length}/${requiredCmdtPeloton} nécessaires). Impossible de créer la répartition.`
             });
         }


        // --- Mélanger aléatoirement chaque pool d'éligibilité ---
        const shuffledCmdtEscPool = shuffleArray(cmdtEscEligiblePool);
        const shuffledChefSiatPool = shuffleArray(chefSiatEligiblePool);
        const shuffledCmdtPelPool = shuffleArray(cmdtPelEligiblePool);
        const shuffledAdjPelPool = shuffleArray(adjPelEligiblePool);
        const shuffledMoniteurPool = shuffleArray(moniteurEligiblePool); // Mélanger le pool des moniteurs

        // Set pour garder une trace des IDs de cadres attribués à N'IMPORTE QUEL rôle clé
        const usedCadresIds = new Set();

        // Helper pour trouver et marquer comme utilisé le prochain cadre disponible dans un pool SHUFFLÉ
        // Cette version simplifiée prend le premier cadre non utilisé du pool donné.
        const findAndUseNextCadre = (pool) => {
            // Trouver le premier cadre dans le pool qui n'a pas encore été utilisé pour un rôle clé
            const cadre = pool.find(c => !usedCadresIds.has(c.id));
            if (cadre) {
                usedCadresIds.add(cadre.id); // Marque l'ID comme utilisé pour un rôle clé
            }
            return cadre || null; // Retourne le cadre ou null
        };


        // --- Attribution des rôles clés à partir des pools mélangés ---
        // Ces tableaux stockeront les cadres ATTRIBUÉS (peut contenir des null si pool insuffisant)
        const commandantsEscadron = [];
        for (let i = 0; i < numEscadrons; i++) {
            commandantsEscadron.push(findAndUseNextCadre(shuffledCmdtEscPool)); // Attribue dans l'ordre mélangé
        }
        console.log(`Attributed ${commandantsEscadron.filter(Boolean).length} Commandants Escadron.`);


        // Chefs SIAT (rôle OBLIGATOIRE - on sait qu'on aura assez si vérif passée)
        const chefsSiat = [];
        for (let i = 0; i < numEscadrons; i++) {
            chefsSiat.push(findAndUseNextCadre(shuffledChefSiatPool)); // Attribue dans l'ordre mélangé
        }
         console.log(`Attributed ${chefsSiat.filter(Boolean).length} Chefs SIAT.`);


        // Commandants de Peloton (rôle OBLIGATOIRE - on sait qu'on aura assez si vérif passée)
        const commandantsPeloton = [];
        for (let i = 0; i < totalPelotons; i++) {
            commandantsPeloton.push(findAndUseNextCadre(shuffledCmdtPelPool)); // Attribue dans l'ordre mélangé
        }
         console.log(`Attributed ${commandantsPeloton.filter(Boolean).length} Commandants Peloton.`);


        // Attribution des Adjoints Commandants de Peloton (GP2C) - Rôle NON OBLIGATOIRE
        const adjointsPeloton = [];
        for (let i = 0; i < totalPelotons; i++) { // Tente d'attribuer un Adjoint pour chaque peloton
            adjointsPeloton.push(findAndUseNextCadre(shuffledAdjPelPool)); // Attribue dans l'ordre mélangé
        }
         console.log(`Attributed ${adjointsPeloton.filter(Boolean).length} Adjoints Commandants Peloton.`);


        // --- Répartition des Moniteurs ---
        // Ce pool contient les cadres du pool moniteur éligible qui n'ont PAS été attribués à un rôle clé.
        const moniteursPourRepartition = shuffledMoniteurPool.filter(cadre => !usedCadresIds.has(cadre.id)); // On filtre bien le pool *moniteur* par ceux qui n'ont pas eu de rôle clé

         console.log(`Found ${moniteursPourRepartition.length} cadres from Moniteur pool available for distribution.`);

        // Algorithme de répartition équitable des moniteurs par peloton (opère sur le pool mélangé)
        const pelotonsDistribution = Array(numEscadrons).fill(null).map(() =>
            Array(numPelotonsPerEscadron).fill(null).map(() => ({
                moniteurs: [],
                counts: { byGrade: {}, bySexe: {}, total: 0 } // Compteurs pour l'équilibrage
            }))
        );

        // Répartit les moniteurs disponibles (déjà mélangés) en essayant d'équilibrer par grade et par sexe
        for (const moniteur of moniteursPourRepartition) {
            let bestPeloton = null;
            let minScore = Infinity;

            // Parcours tous les pelotons pour trouver le "meilleur" où affecter ce moniteur
            pelotonsDistribution.forEach(escadronPelotons => {
                escadronPelotons.forEach(peloton => {
                    const gradeCount = peloton.counts.byGrade[moniteur.grade] || 0;
                    const sexeCount = peloton.counts.bySexe[moniteur.sexe] || 0;
                    const totalCount = peloton.counts.total;

                    const score = gradeCount * 2 + sexeCount * 1 + totalCount * 0.5; // Ajustez ces poids si nécessaire

                    if (score < minScore) {
                        minScore = score;
                        bestPeloton = peloton;
                    } else if (score === minScore) {
                        // En cas d'égalité de score, choisir aléatoirement pour renforcer l'aléatoire
                        if (Math.random() < 0.5) {
                            bestPeloton = peloton;
                        }
                    }
                });
            });

            if (bestPeloton) {
                bestPeloton.moniteurs.push(moniteur);
                bestPeloton.counts.byGrade[moniteur.grade] = (bestPeloton.counts.byGrade[moniteur.grade] || 0) + 1;
                bestPeloton.counts.bySexe[moniteur.sexe] = (bestPeloton.counts.bySexe[moniteur.sexe] || 0) + 1;
                bestPeloton.counts.total++;
            } else {
                 console.error("Repartition Create Error: Logical error - Could not find a suitable peloton for a monitor.");
            }
        }


        // Construction de la structure de réponse finale pour le frontend
        const proposedStructure = [];
        for (let e = 0; e < numEscadrons; e++) {
            const escadron = {
                numero: e + 1,
                // Utilise les cadres attribués (peuvent être null)
                commandant: commandantsEscadron[e] || null,
                chefSiat: chefsSiat[e] || null,
                pelotons: []
            };

            for (let p = 0; p < numPelotonsPerEscadron; p++) {
                const pelotonIndex = e * numPelotonsPerEscadron + p;
                const peloton = {
                    numero: p + 1,
                    // Utilise les cadres attribués (peuvent être null)
                    commandant: commandantsPeloton[pelotonIndex] || null,
                    adjoint: adjointsPeloton[pelotonIndex] || null,
                    // Utilise les moniteurs répartis
                    moniteurs: pelotonsDistribution[e][p].moniteurs
                };
                escadron.pelotons.push(peloton);
            }
            proposedStructure.push(escadron);
        }

        // Calcul des statistiques finales (pour information dans la réponse)
         const totalCadresDisponiblesInitial = cadresEscadronsDisponibles.length;
         const assignedKeyRolesCount = commandantsEscadron.filter(Boolean).length + chefsSiat.filter(Boolean).length + commandantsPeloton.filter(Boolean).length + adjointsPeloton.filter(Boolean).length;
         const assignedMoniteursCount = moniteursPourRepartition.length; // Nombre de moniteurs disponibles et répartis
         const totalCadresAttribuésFinal = assignedKeyRolesCount + assignedMoniteursCount;
         const cadresNonAttribues = totalCadresDisponiblesInitial - totalCadresAttribuésFinal;

         console.log(`Total cadres disponibles (scope='Escadron', Présent): ${totalCadresDisponiblesInitial}`);
         console.log(`Cadres utilisés pour rôles clés attribués: ${assignedKeyRolesCount}`);
           console.log(`Cadres éligibles moniteurs non utilisés pour rôle clé: ${moniteurEligiblePool.length - moniteursPourRepartition.length}`); // Combien de moniteurs éligibles ont été utilisés pour un rôle clé (devrait être 0 si les sets de grades sont exclusifs)
         console.log(`Cadres répartis comme moniteurs: ${assignedMoniteursCount}`);
         console.log(`Total cadres attribués dans la structure finale: ${totalCadresAttribuésFinal}`);
         console.log(`Cadres disponibles mais non attribués du tout (grades non éligibles aux rôles attribués) : ${cadresNonAttribues}`); // Ceux qui n'ont pas eu de rôle clé ET ne sont pas moniteurs éligibles

        // Succès : renvoie la proposition
        return res.status(200).json({
            success: true,
            message: `Proposition de répartition pour ${numEscadrons} escadron${numEscadrons > 1 ? 's' : ''} créée avec succès. ${assignedMoniteursCount} moniteurs répartis.`,
            data: { // <-- Structure attendue par le frontend
                distribution: proposedStructure, // <-- Le tableau de distribution
                 stats: { // Ajout de statistiques utiles dans la réponse API
                    totalCadresDisponibles: totalCadresDisponiblesInitial,
                    cadresUtilisesPourRolesCles: assignedKeyRolesCount,
                    cadresMoniteursRepartis: assignedMoniteursCount, // Nom ajusté
                    cadresNonAttribues: cadresNonAttribues
                 }
            }
        });

    } catch (error) {
        console.error('Erreur serveur lors de la création de la répartition :', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Erreur serveur inattendue lors de la création de la répartition.'
        });
    }
});


// ============================================================================
// POST /api/repartition/validate - Validation de la répartition (Admin seulement)
// ============================================================================
// Ce code semble correct pour valider la structure reçue et mettre à jour la BDD.
// Pas de modification nécessaire ici pour la logique de randomisation.
router.post('/validate', isAdmin, async (req, res) => {
    // Validation du corps de la requête : vérifie que 'distribution' est bien un tableau
    if (!req.body || !req.body.distribution || !Array.isArray(req.body.distribution)) {
         console.error("Repartition Validate Error: Invalid or missing 'distribution' array in request body.");
        return res.status(400).json({
            success: false,
            message: "La structure de répartition est requise dans le corps de la requête et doit être un tableau."
        });
        // On pourrait ajouter une vérification plus poussée de la structure interne du tableau ici si besoin
    }

    const { distribution } = req.body;
    // Démarrer une transaction
    const transaction = await sequelize.transaction();

    try {
        // 1. Réinitialisation des affectations existantes pour les cadres concernés (scope 'Escadron')
        console.log("Resetting existing assignments for cadres with responsibility_scope 'Escadron'...");
        const [resetCount] = await Cadre.update(
            {
                responsible_escadron_id: null,
                fonction: null // Réinitialise la fonction attribuée
            },
            {
                where: {
                     responsibility_scope: 'Escadron'
                },
                transaction // Applique à la transaction
            }
        );
        console.log(`${resetCount} cadres with responsibility_scope 'Escadron' reset.`);


        // 2. Mise à jour des nouvelles affectations
        const updatePromises = [];
        const assignedCadreIds = new Set(); // Pour détecter les doublons dans la proposition reçue

        // Parcourir chaque escadron dans la structure de distribution reçue
        for (const escadron of distribution) {
             if (typeof escadron.numero === 'undefined' || !escadron.pelotons || !Array.isArray(escadron.pelotons)) {
                  console.error("Repartition Validate Error: Invalid escadron structure in distribution:", escadron);
                  throw new Error(`Structure d'escadron invalide trouvée dans la distribution.`);
             }

            // Commandant d'escadron (si attribué)
            if (escadron.commandant && escadron.commandant.id) {
                // Vérifie si cet ID a déjà été vu dans cette proposition pour éviter les doublons
                if (assignedCadreIds.has(escadron.commandant.id)) {
                    console.warn(`Repartition Validate Warning: Duplicate assignment for cadre ID ${escadron.commandant.id} (Commandant Escadron ${escadron.numero}). Skipping update.`);
                } else {
                    assignedCadreIds.add(escadron.commandant.id); // Marque l'ID comme utilisé dans la proposition
                    updatePromises.push( // Ajoute la promesse de mise à jour
                        Cadre.update(
                            {
                                responsible_escadron_id: escadron.numero, // Affecte l'escadron
                                fonction: `Commandant Escadron ${escadron.numero}` // Définit la fonction
                            },
                            {
                                where: { id: escadron.commandant.id }, // Cible le cadre par son ID
                                transaction // Applique à la transaction
                            }
                        )
                    );
                }
            }


            // Chef SIAT (si attribué dans la proposition)
            if (escadron.chefSiat && escadron.chefSiat.id) {
                if (assignedCadreIds.has(escadron.chefSiat.id)) {
                    console.warn(`Repartition Validate Warning: Duplicate assignment for cadre ID ${escadron.chefSiat.id} (Chef SIAT Escadron ${escadron.numero}). Skipping update.`);
                } else {
                    assignedCadreIds.add(escadron.chefSiat.id);
                    updatePromises.push(
                        Cadre.update(
                            {
                                responsible_escadron_id: escadron.numero,
                                fonction: `Chef SIAT Escadron ${escadron.numero}`
                            },
                            {
                                where: { id: escadron.chefSiat.id },
                                transaction
                            }
                        )
                    );
                }
             }


            // Parcours des pelotons
            for (const peloton of escadron.pelotons) {
                 if (typeof peloton.numero === 'undefined' || !peloton.moniteurs || !Array.isArray(peloton.moniteurs)) {
                      console.error("Repartition Validate Error: Invalid peloton structure in distribution:", peloton);
                      throw new Error(`Structure de peloton invalide trouvée dans l'escadron ${escadron.numero}.`);
                 }

                // Commandant de peloton (si attribué)
                if (peloton.commandant && peloton.commandant.id) {
                    if (assignedCadreIds.has(peloton.commandant.id)) {
                        console.warn(`Repartition Validate Warning: Duplicate assignment for cadre ID ${peloton.commandant.id} (Commandant Peloton ${peloton.numero} Escadron ${escadron.numero}). Skipping update.`);
                    } else {
                        assignedCadreIds.add(peloton.commandant.id);
                        updatePromises.push(
                            Cadre.update(
                                {
                                    responsible_escadron_id: escadron.numero,
                                    fonction: `Commandant Peloton ${peloton.numero} Escadron ${escadron.numero}`
                                },
                                {
                                    where: { id: peloton.commandant.id },
                                    transaction
                                }
                            )
                    );
                }
                }

                // Adjoint commandant de peloton (si attribué - rôle non obligatoire)
                if (peloton.adjoint && peloton.adjoint.id) {
                    if (assignedCadreIds.has(peloton.adjoint.id)) {
                        console.warn(`Repartition Validate Warning: Duplicate assignment for cadre ID ${peloton.adjoint.id} (Adjoint Cdt Peloton ${peloton.numero} Escadron ${escadron.numero}). Skipping update.`);
                    } else {
                        assignedCadreIds.add(peloton.adjoint.id);
                        updatePromises.push(
                            Cadre.update(
                                {
                                    responsible_escadron_id: escadron.numero,
                                    fonction: `Adjoint Cdt Peloton ${peloton.numero} Escadron ${escadron.numero}`
                                },
                                {
                                    where: { id: peloton.adjoint.id },
                                    transaction
                                }
                            )
                    );
                }
                }


                // Moniteurs (s'ils sont attribués)
                for (const moniteur of peloton.moniteurs) {
                    if (moniteur && moniteur.id) {
                        // Vérifie si cet ID a déjà été vu dans cette proposition
                        if (assignedCadreIds.has(moniteur.id)) {
                            console.warn(`Repartition Validate Warning: Duplicate assignment for cadre ID ${moniteur.id} (Moniteur Peloton ${peloton.numero} Escadron ${escadron.numero}). Skipping update.`);
                        } else {
                            assignedCadreIds.add(moniteur.id); // Marque l'ID comme utilisé
                            updatePromises.push(
                                Cadre.update(
                                    {
                                        responsible_escadron_id: escadron.numero,
                                        fonction: `${moniteur.grade} Peloton ${peloton.numero} Escadron ${escadron.numero}` // Fonction plus descriptive
                                    },
                                    {
                                        where: { id: moniteur.id },
                                        transaction
                                    }
                                )
                            );
                        }
                    }
                }
            }
        }

        // Exécuter toutes les promesses de mise à jour en parallèle
        console.log(`Executing ${updatePromises.length} update promises...`);
        await Promise.all(updatePromises);
        console.log("All update promises finished.");

        // Si tout s'est bien passé, valider la transaction
        await transaction.commit();

         console.log("Repartition validation successful. Database updated.");

        return res.status(200).json({
            success: true,
            message: "Répartition validée et base de données mise à jour avec succès."
        });

    } catch (error) {
        // En cas d'erreur, annuler toutes les opérations de la transaction
        await transaction.rollback();
        console.error('Erreur lors de la validation de la répartition (transaction annulée) :', error);
        // Renvoie l'erreur au frontend
        return res.status(500).json({
            success: false,
            message: "Erreur lors de la validation de la répartition.",
            error: error.message // Inclure le message d'erreur pour le débogage côté client
        });
    }
});

module.exports = router;