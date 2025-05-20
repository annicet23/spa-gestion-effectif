// src/pages/RepartitionCadresPage.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';

// Pour accéder au token d'authentification (Assurez-vous que ce chemin est correct)
import { useAuth } from '../context/AuthContext';

// Assurez-vous que Bootstrap est importé globalement ou ici pour les styles
import 'bootstrap/dist/css/bootstrap.min.css';

// Pour la logique de date décalée (nécessite l'installation de moment-timezone)
import moment from 'moment-timezone';

// Pour les boîtes de dialogue SweetAlert2 (nécessite l'installation)
import Swal from 'sweetalert2';

// Pour la génération de PDF (nécessite l'installation de jspdf et html2canvas)
// Gardé si vous souhaitez aussi avoir l'option PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Pour la génération EXCEL (nécessite l'installation de xlsx) ---
import * as XLSX from 'xlsx';
// ----------------------------------------------------------------


// ============================================================================
// HELPER FUNCTION : Calcul de la date d'affichage selon la logique 16h-15h59
// ============================================================================
// realTime: Date object or Moment object
// timezone: String, e.g., 'Europe/Paris' or null for local time
const getDisplayDateLabel = (realTime, timezone) => {
    // Utilise moment.tz si un fuseau horaire est spécifié, sinon l'heure locale
    const momentDate = timezone ? moment.tz(realTime, timezone) : moment(realTime);

    // La logique : Si l'heure actuelle est 16h ou plus (>= 16), la date label est la date du jour suivant.
    // Sinon (< 16), la date label est la date du jour actuel.
    const historicalMoment = momentDate.hour() >= 16 ?
                             momentDate.clone().add(1, 'day') : // Utilisez clone() pour ne pas modifier momentDate
                             momentDate.clone();

    // Retourne la date formatée pour l'affichage (Ex: 17/05/2025)
    return historicalMoment.format('DD/MM/YYYY');
};


// ============================================================================
// COMPOSANT PRINCIPAL : RepartitionCadresPage
// ============================================================================
function RepartitionCadresPage() {
    // Accéder au token pour les appels API (si nécessaire pour cette page)
    // Le token est ajouté dans les headers des fetch requests si il existe.
    const { token } = useAuth();

    // --- États du composant ---
    // État pour le nombre d'escadrons saisi par l'utilisateur
    const [numEscadrons, setNumEscadrons] = useState(0);
    // État pour stocker la proposition de répartition reçue du backend
    // Sera null initialement ou après validation/erreur. Contiendra la structure [escadron1, escadron2, ...]
    const [proposedDistribution, setProposedDistribution] = useState(null);
    // États de chargement pour les différentes actions
    const [isLoadingCreation, setIsLoadingCreation] = useState(false);
    const [isLoadingValidation, setIsLoadingValidation] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // Pour l'impression PDF
    const [isExportingExcel, setIsExportingExcel] = useState(false); // Pour l'export Excel
    // État pour les messages d'erreur (peut être utilisé pour des messages d'erreur sous les boutons)
    const [error, setError] = useState(null);
    // État pour la date affichée selon la logique 16h-15h59
    const [displayDateLabel, setDisplayDateLabel] = useState('');

    // Ref pour cibler la zone d'impression dans le DOM (sera cachée)
    const printAreaRef = useRef(null);
    // État pour indiquer quelle catégorie est en cours d'impression (utilisé pour le rendu conditionnel de la zone cachée)
    // Permet d'afficher le contenu à imprimer juste au moment où html2canvas en a besoin.
    const [printCategory, setPrintCategory] = useState(null);


    // --- Effet : Initialisation de la date affichée au chargement de la page ---
    useEffect(() => {
        const now = new Date();
        // Calcule la date affichée en utilisant la logique 16h-15h59
        // Passez null pour utiliser l'heure locale du navigateur, ou APP_TIMEZONE si défini dans vos constantes
        const calculatedDisplayDate = getDisplayDateLabel(now, null); // ou process.env.APP_TIMEZONE
        setDisplayDateLabel(calculatedDisplayDate);
    }, []); // Le tableau vide assure que cet effet ne s'exécute qu'une seule fois au montage du composant.


    // ============================================================================
    // HANDLERS D'ÉVÉNEMENTS
    // ============================================================================

    // Gère le changement dans le champ du nombre d'escadrons
    const handleNumEscadronsChange = (e) => {
        const value = parseInt(e.target.value, 10);
        // Assurez-vous que la valeur est un nombre positif (minimum 1), sinon 0
        const sanitizedValue = isNaN(value) || value < 1 ? 0 : value;
        setNumEscadrons(sanitizedValue);
        // Réinitialiser la proposition et l'erreur si l'utilisateur change le nombre,
        // car l'ancienne proposition n'est plus valide pour ce nouveau nombre.
        setProposedDistribution(null);
        setError(null); // Efface l'erreur quand la saisie change
    };

    // Gère le clic sur le bouton "Créer la répartition"
    const handleCreateDistribution = async () => {
        // Validation basique côté frontend
        if (numEscadrons <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Saisie invalide',
                text: "Veuillez spécifier un nombre d'escadrons valide (sur à 0).",
                confirmButtonText: 'OK'
            });
            return; // Arrête l'exécution si la validation échoue
        }

        // Réinitialiser les états pertinents avant de commencer la création
        setIsLoadingCreation(true);
        setError(null); // Réinitialiser l'erreur texte générale
        setProposedDistribution(null); // Vider l'ancienne proposition affichée

        let timerInterval; // Variable pour stocker l'ID de l'intervalle du compte à rebours SweetAlert2

        // --- Afficher la modale SweetAlert2 de chargement avec compte à rebours ---
        Swal.fire({
            title: 'Création de la répartition en cours...',
            html: `L'algorithme prépare la proposition.<br>Temps restant estimé : <strong>5</strong> secondes.`,
            icon: 'info',
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            timer: 30000, // Timeout de sécurité max
            timerProgressBar: true,
            didOpen: (dialog) => {
                const content = Swal.getHtmlContainer();
                const timerStrong = content ? content.querySelector('strong') : null;

                let timeLeft = 5;
                timerInterval = setInterval(() => {
                    timeLeft--;
                    if (timerStrong && timeLeft >= 0) {
                       timerStrong.textContent = timeLeft;
                    }
                }, 1000); // <-- Ce timer frontend n'est pas lié au temps réel de l'API
                Swal.showLoading();
            },
            willClose: () => {
                clearInterval(timerInterval);
                Swal.hideLoading();
            }
        });
        // ---------------------------------------------------------------------


        try {
            const response = await fetch('/api/repartition/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: JSON.stringify({ numEscadrons }),
            });

            Swal.close(); // Fermer la modale SweetAlert2

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.message || `Erreur lors de la création : ${response.status}`);
            }

            const data = await response.json();
            console.log("Réponse de l'API /create reçue (objet complet):", data);

            // --- Accéder à data.data.distribution selon la structure réelle de l'API ---
            const receivedDistribution = data.data?.distribution;

            // Vérification pour s'assurer que receivedDistribution est bien un tableau
            if (!receivedDistribution || !Array.isArray(receivedDistribution)) {
                 console.error("Structure de réponse API /create inattendue:", data);
                 throw new Error("La réponse de l'API n'a pas la structure de données attendue (manque 'data.distribution' ou ce n'est pas un tableau).");
            }
            // -----------------------------------------------------------------------------------

            // --- Mettre à jour l'état avec le tableau de distribution CORRECT ---
            setProposedDistribution(receivedDistribution);
            console.log("proposedDistribution state updated with:", receivedDistribution);
            // ----------------------------------------------------------------------

            Swal.fire({
                icon: 'success',
                title: 'Succès !',
                text: data.message || 'La proposition de répartition a été créée.',
                confirmButtonText: 'OK'
            });


        } catch (err) {
            console.error("Erreur lors de la création de la répartition :", err);
            if (Swal.isVisible()) {
                 Swal.close();
            }
            Swal.fire({
                icon: 'error',
                title: 'Erreur de Création',
                text: `Impossible de créer la répartition. Détails : ${err.message || err}`,
                confirmButtonText: 'OK'
            });
            setError(`Échec de la création : ${err.message || err}`);
            setProposedDistribution(null);

        } finally {
            setIsLoadingCreation(false);
            // Nettoyage timer/spinner géré par willClose
        }
    };

    // Gère le clic sur le bouton "Valider la répartition"
    const handleValidateDistribution = async () => {
         // Vérifier qu'il y a bien une proposition à valider
        if (!proposedDistribution) {
            Swal.fire({
                icon: 'warning',
                title: 'Action impossible',
                text: 'Aucune proposition de répartition à valider.',
                confirmButtonText: 'OK'
            });
            return; // Arrête l'exécution si pas de proposition
        }

        // --- Demander confirmation ---
        const confirmResult = await Swal.fire({
            title: 'Confirmer la validation ?',
            text: "Cette action mettra à jour l'affectation des Cadres dans la base de données. Cette opération est irréversible.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oui, valider !',
            cancelButtonText: 'Annuler'
        });

        if (!confirmResult.isConfirmed) {
             return; // Arrêter si l'utilisateur clique sur "Annuler"
        }
        // --------------------------

        setIsLoadingValidation(true);
        setError(null);

        try {
            const response = await fetch('/api/repartition/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                // Envoyer la proposition complète actuelle pour validation
                body: JSON.stringify({ distribution: proposedDistribution }), // Assurez-vous que le backend attend cette structure
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.message || `Erreur lors de la validation : ${response.status}`);
            }

            const result = await response.json();
            console.log("Résultat validation reçu :", result);

            Swal.fire({
                icon: 'success',
                title: 'Validé !',
                text: result.message || 'La base de données a été mise à jour avec succès.',
                confirmButtonText: 'OK'
            });

            // Vider la proposition affichée après validation réussie
            setProposedDistribution(null);
            setNumEscadrons(0); // Réinitialiser le nombre d'escadrons

        } catch (err) {
            console.error("Erreur lors de la validation :", err);
            Swal.fire({
                icon: 'error',
                title: 'Erreur de Validation',
                text: `Impossible de valider la répartition. Détails : ${err.message || err}`,
                confirmButtonText: 'OK'
            });
            setError(`Échec de la validation : ${err.message || err}`);
        } finally {
            setIsLoadingValidation(false);
        }
    };


    // Gère le clic sur le bouton "Imprimer" (Fonctionnalité PDF existante)
    const handlePrint = async () => {
         // Vérifier qu'il y a bien une proposition à imprimer
        if (!proposedDistribution) {
            Swal.fire({
                icon: 'warning',
                title: 'Action impossible',
                text: 'Aucune proposition de répartition à imprimer.',
                confirmButtonText: 'OK'
            });
            return;
        }

        setIsGeneratingPdf(true);
        setError(null);

        try {
            console.log("Préparation à la génération du PDF...");
            // Activer le rendu de la zone d'impression dédiée
            setPrintCategory('repartition-cadres');

            // Attendre un court délai pour permettre au DOM de se mettre à jour
            await new Promise(resolve => setTimeout(resolve, 300));

            const input = printAreaRef.current;
            if (!input) {
                 throw new Error("Zone d'impression introuvable dans le DOM.");
            }

            // --- Utiliser html2canvas ---
            const canvas = await html2canvas(input, {
                scale: 2,
                logging: false,
                useCORS: true
            });
            // ---------------------------

            const imgData = canvas.toDataURL('image/png');

            // --- Initialiser jsPDF ---
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // Largeur A4 en mm
            const pageHeight = 297; // Hauteur A4 en mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0; // Position verticale

            // Ajouter la première page
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Ajouter des pages si nécessaire
            while (heightLeft > 0) {
                // Calcule la position pour la nouvelle page (décalage vers le haut)
                position = heightLeft - imgHeight;
                pdf.addPage(); // Ajoute une nouvelle page
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); // Ajoute l'image avec le décalage
                heightLeft -= pageHeight; // Décrémente la hauteur restante
            }
            // ------------------------

            // --- Enregistrer le fichier PDF ---
            const todayStandard = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-');
            const fileName = `repartition_cadres_${todayStandard}.pdf`;
            pdf.save(fileName);
            // ----------------------------------

            console.log("PDF généré avec succès.");

            Swal.fire({
                icon: 'success',
                title: 'PDF Généré',
                text: 'Le rapport de répartition a été téléchargé au format PDF.',
                confirmButtonText: 'OK'
            });

        } catch (err) {
            console.error("Erreur lors de la génération du PDF :", err);
            setError(`Échec de la génération du PDF : ${err.message || err}`);
            Swal.fire({
                icon: 'error',
                title: 'Erreur PDF',
                text: `Impossible de générer le PDF. Détails : ${err.message || err}`,
                confirmButtonText: 'OK'
            });
        } finally {
            setIsGeneratingPdf(false);
             // Désactiver le rendu de la zone d'impression après un court délai
            setTimeout(() => {
                setPrintCategory(null);
            }, 150);
        }
    };


    // --- NOUVEAU : Gère le clic sur le bouton "Exporter en Excel" ---
    const handleExportExcel = () => {
        // Vérifier qu'il y a bien une proposition à exporter
        if (!proposedDistribution) {
            Swal.fire({
                icon: 'warning',
                title: 'Action impossible',
                text: 'Aucune proposition de répartition à exporter.',
                confirmButtonText: 'OK'
            });
            return;
        }

        setIsExportingExcel(true); // Activer l'état de chargement pour l'export Excel
        setError(null); // Réinitialiser l'erreur

        try {
            // Créer un nouveau classeur Excel
            const workbook = XLSX.utils.book_new();

            // --- Feuille 1 : Liste détaillée de tous les cadres attribués ---
            const allCadresData = [
                ["Escadron", "Peloton", "Role/Fonction", "Grade", "Nom", "Prénom", "Sexe"] // En-têtes
            ];

            proposedDistribution.forEach(escadron => {
                 // Ajouter le Commandant d'Escadron
                 allCadresData.push([
                     escadron.numero,
                     '', // Pas de peloton pour le Cdt Esc
                     'Commandant Escadron',
                     escadron.commandant?.grade || 'Non attribué',
                     escadron.commandant?.nom || '',
                     escadron.commandant?.prenom || '',
                     escadron.commandant?.sexe === 'Masculin' ? 'M' : escadron.commandant?.sexe === 'Féminin' ? 'F' : escadron.commandant ? 'Autre' : ''
                 ]);
                 // Ajouter le Chef SIAT
                 allCadresData.push([
                     escadron.numero,
                     '', // Pas de peloton pour le Chef SIAT
                     'Chef SIAT',
                     escadron.chefSiat?.grade || 'Non attribué',
                     escadron.chefSiat?.nom || '',
                     escadron.chefSiat?.prenom || '',
                     escadron.chefSiat?.sexe === 'Masculin' ? 'M' : escadron.chefSiat?.sexe === 'Féminin' ? 'F' : escadron.chefSiat ? 'Autre' : ''
                 ]);


                escadron.pelotons.forEach(peloton => {
                    // Ajouter le Commandant de Peloton
                    allCadresData.push([
                        escadron.numero,
                        peloton.numero,
                        `Commandant Peloton ${peloton.numero}`,
                        peloton.commandant?.grade || 'Non attribué',
                        peloton.commandant?.nom || '',
                        peloton.commandant?.prenom || '',
                         peloton.commandant?.sexe === 'Masculin' ? 'M' : peloton.commandant?.sexe === 'Féminin' ? 'F' : peloton.commandant ? 'Autre' : ''
                    ]);
                     // Ajouter l'Adjoint Commandant de Peloton
                     allCadresData.push([
                        escadron.numero,
                        peloton.numero,
                        `Adjoint Cdt Peloton ${peloton.numero}`,
                        peloton.adjoint?.grade || 'Non attribué',
                        peloton.adjoint?.nom || '',
                        peloton.adjoint?.prenom || '',
                        peloton.adjoint?.sexe === 'Masculin' ? 'M' : peloton.adjoint?.sexe === 'Féminin' ? 'F' : peloton.adjoint ? 'Autre' : ''
                    ]);

                    // Ajouter les Moniteurs
                    peloton.moniteurs.forEach(moniteur => {
                        allCadresData.push([
                            escadron.numero,
                            peloton.numero,
                            'Moniteur', // Ou moniteur.fonction si vous la stockez dans la structure
                            moniteur.grade,
                            moniteur.nom,
                            moniteur.prenom,
                            moniteur.sexe === 'Masculin' ? 'M' : moniteur.sexe === 'Féminin' ? 'F' : 'Autre'
                        ]);
                    });
                     // Ligne vide pour séparer visuellement les pelotons dans la feuille détaillée
                     allCadresData.push(['', '', '', '', '', '', '']);
                });
                 // Ligne vide pour séparer visuellement les escadrons dans la feuille détaillée
                 allCadresData.push(['', '', '', '', '', '', '']);
            });

            // Convertir les données en feuille de calcul
            const allCadresSheet = XLSX.utils.aoa_to_sheet(allCadresData);
             // Ajuster la largeur des colonnes automatiquement (estimation)
             const colWidths = allCadresData[0].map((_, i) => ({
                 wch: Math.max(...allCadresData.map(row => (row[i] ? row[i].toString().length : 1))) * 1.2 // Estimation basée sur la longueur du texte
             }));
             allCadresSheet['!cols'] = colWidths;

            // Ajouter la feuille au classeur
            XLSX.utils.book_append_sheet(workbook, allCadresSheet, "Repartition Detaillee");


            // --- Feuille 2 (Optionnel) : Résumé des Moniteurs par Peloton ---
            // Utile pour vérifier l'équité de la répartition des moniteurs
            const moniteurSummaryData = [
                ["Escadron", "Peloton", "Nombre de Moniteurs"] // En-têtes
            ];

            proposedDistribution.forEach(escadron => {
                escadron.pelotons.forEach(peloton => {
                    moniteurSummaryData.push([
                        escadron.numero,
                        peloton.numero,
                        peloton.moniteurs.length
                    ]);
                });
                 // Ligne vide pour séparer visuellement les escadrons
                 moniteurSummaryData.push(['', '', '']);
            });

            const moniteurSummarySheet = XLSX.utils.aoa_to_sheet(moniteurSummaryData);
            XLSX.utils.book_append_sheet(workbook, moniteurSummarySheet, "Resume Moniteurs");


            // --- Générer le fichier et déclencher le téléchargement ---
            const todayStandard = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-');
            const fileName = `repartition_cadres_${todayStandard}.xlsx`;

            // Écrire le classeur et déclencher le téléchargement
            XLSX.writeFile(workbook, fileName);

            console.log("Export Excel généré avec succès.");

            Swal.fire({
                icon: 'success',
                title: 'Export Excel',
                text: 'Le rapport de répartition a été téléchargé au format Excel.',
                confirmButtonText: 'OK'
            });

        } catch (error) {
            console.error("Erreur lors de l'export Excel :", error);
            setError(`Échec de l'export Excel : ${error.message || error}`);
            Swal.fire({
                icon: 'error',
                title: 'Erreur Export',
                text: `Impossible d'exporter en Excel. Détails : ${error.message || error}`,
                confirmButtonText: 'OK'
            });
        } finally {
            setIsExportingExcel(false); // Désactiver l'état de chargement
        }
    };

    // ============================================================================
    // RENDU DE L'INTERFACE UTILISATEUR (JSX) - UTILISATION DE TABLEAUX
    // ============================================================================
    return (
        <div className="container mt-4">
            {/* ======================================== */}
            {/* CONTENU VISIBLE DANS LE NAVIGATEUR       */}
            {/* ======================================== */}
            <div>
                <h2 className="mb-4">Répartition Automatique des Cadres (Cours)</h2>

                <div className="mb-3">
                    <p>Journée SPA du : <strong>{displayDateLabel}</strong></p>
                </div>

                {/* Section de configuration et boutons */}
                <div className="card p-4 mb-4">
                    <h4 className="card-title">Configuration et Actions</h4>
                    <div className="row g-3 align-items-end">
                        <div className="col-md-4">
                            <label htmlFor="numEscadrons" className="form-label">Nombre d'Escadrons :</label>
                            <input
                                type="number"
                                className="form-control"
                                id="numEscadrons"
                                value={numEscadrons === 0 ? '' : numEscadrons}
                                onChange={handleNumEscadronsChange}
                                min="1"
                                disabled={isLoadingCreation || isLoadingValidation || isGeneratingPdf || isExportingExcel}
                                placeholder="Saisir un nombre"
                            />
                        </div>
                        <div className="col-md-8">
                            <button
                                className="btn btn-primary me-2"
                                onClick={handleCreateDistribution}
                                disabled={numEscadrons < 1 || isLoadingCreation || isLoadingValidation || isGeneratingPdf || isExportingExcel}
                            >
                                {isLoadingCreation ? 'Création en cours...' : 'Créer la répartition'}
                            </button>
                            <button
                                className="btn btn-success me-2"
                                onClick={handleValidateDistribution}
                                disabled={!proposedDistribution || isLoadingValidation || isLoadingCreation || isGeneratingPdf || isExportingExcel}
                            >
                                {isLoadingValidation ? 'Validation en cours...' : 'Valider la répartition'}
                            </button>
                             {/* Bouton Exporter en Excel */}
                             <button
                                className="btn btn-info me-2" // Utilisez une autre couleur pour distinguer
                                onClick={handleExportExcel}
                                disabled={!proposedDistribution || isExportingExcel || isLoadingCreation || isLoadingValidation || isGeneratingPdf}
                             >
                                {isExportingExcel ? 'Exportation Excel...' : 'Exporter en Excel'}
                             </button>
                            {/* Bouton Imprimer (PDF) - Gardé comme option distincte */}
                            <button
                                className="btn btn-secondary"
                                onClick={handlePrint}
                                disabled={!proposedDistribution || isGeneratingPdf || isLoadingCreation || isLoadingValidation || isExportingExcel}
                            >
                                {isGeneratingPdf ? 'Préparation PDF...' : 'Imprimer (PDF)'}
                            </button>
                        </div>
                    </div>
                    {error && <div className="alert alert-danger mt-3">{error}</div>}
                    {(isLoadingValidation || isExportingExcel || isGeneratingPdf) && ( // Afficher un seul message de chargement global si plusieurs actions possibles
                         <div className="alert alert-info mt-3">
                             {isLoadingValidation && "Validation en cours..."}
                             {isExportingExcel && "Exportation Excel en cours..."}
                             {isGeneratingPdf && "Génération PDF en cours..."}
                         </div>
                    )}
                </div>

                {/* Section d'affichage de la proposition de répartition (avec Tableaux) */}
                {proposedDistribution && (
                    <div className="mt-4">
                        <h3>Proposition de Répartition ({numEscadrons} Escadron{numEscadrons > 1 ? 's' : ''})</h3>

                        {/* Boucler sur chaque escadron */}
                        {proposedDistribution.map(escadron => (
                            <div key={escadron.numero} className="card mb-4">
                                <div className="card-header">
                                    <h5 className="mb-0">Escadron {escadron.numero}</h5>
                                </div>
                                <div className="card-body">

                                    {/* Tableau pour les rôles clés de l'Escadron */}
                                    <h6>Rôles Clés de l'Escadron :</h6>
                                    <table className="table table-bordered table-sm mb-3"> {/* table-bordered et table-sm pour style compact */}
                                        <thead>
                                            <tr>
                                                <th>Rôle</th>
                                                <th>Grade</th>
                                                <th>Nom Prénom</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Ligne pour le Commandant d'Escadron */}
                                            <tr>
                                                <td>Commandant d'Escadron</td>
                                                <td>{escadron.commandant?.grade || <span className="text-muted">-</span>}</td>
                                                <td>{escadron.commandant ? `${escadron.commandant.nom} ${escadron.commandant.prenom}` : <span className="text-muted">Non attribué</span>}</td>
                                            </tr>
                                            {/* Ligne pour le Chef SIAT */}
                                             <tr>
                                                <td>Chef SIAT</td>
                                                <td>{escadron.chefSiat?.grade || <span className="text-muted">-</span>}</td>
                                                <td>{escadron.chefSiat ? `${escadron.chefSiat.nom} ${escadron.chefSiat.prenom}` : <span className="text-muted">Non attribué</span>}</td>
                                            </tr>
                                        </tbody>
                                    </table>


                                    {/* Boucler sur chaque peloton de l'escadron */}
                                    {escadron.pelotons && Array.isArray(escadron.pelotons) && escadron.pelotons.map(peloton => (
                                        <div key={`${escadron.numero}-${peloton.numero}`} className="mb-4 ms-md-4 ps-md-3 border-start"> {/* Indentation et bordure */}

                                            <h6>Peloton {peloton.numero}</h6>

                                            {/* Tableau pour les rôles clés du Peloton */}
                                            <h6 className="mt-3">Rôles Clés du Peloton :</h6>
                                             <table className="table table-bordered table-sm mb-3">
                                                <thead>
                                                    <tr>
                                                        <th>Rôle</th>
                                                        <th>Grade</th>
                                                        <th>Nom Prénom</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {/* Ligne pour le Commandant de Peloton */}
                                                    <tr>
                                                        <td>Commandant de Peloton</td>
                                                        <td>{peloton.commandant?.grade || <span className="text-muted">-</span>}</td>
                                                        <td>{peloton.commandant ? `${peloton.commandant.nom} ${peloton.commandant.prenom}` : <span className="text-muted">Non attribué</span>}</td>
                                                    </tr>
                                                    {/* Ligne pour l'Adjoint Commandant Peloton */}
                                                    <tr>
                                                        <td>Adjoint C. Peloton</td>
                                                        <td>{peloton.adjoint?.grade || <span className="text-muted">-</span>}</td>
                                                        <td>{peloton.adjoint ? `${peloton.adjoint.nom} ${peloton.adjoint.prenom}` : <span className="text-muted">Non attribué</span>}</td>
                                                    </tr>
                                                </tbody>
                                            </table>


                                            {/* Tableau pour la liste des Moniteurs */}
                                            {peloton.moniteurs && Array.isArray(peloton.moniteurs) && peloton.moniteurs.length > 0 ? (
                                                <>
                                                    <h6 className="mt-3 mb-1">Moniteurs ({peloton.moniteurs.length}) :</h6>
                                                    <table className="table table-striped table-sm"> {/* table-striped pour alterner les couleurs de ligne */}
                                                        <thead>
                                                            <tr>
                                                                <th>Grade</th>
                                                                <th>Nom Prénom</th>
                                                                <th>Sexe</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {peloton.moniteurs.map(moniteur => (
                                                                <tr key={moniteur.id}> {/* Utilisation de l'id du moniteur comme key */}
                                                                    <td>{moniteur.grade}</td>
                                                                    <td>{`${moniteur.nom} ${moniteur.prenom}`}</td>
                                                                    <td>{moniteur.sexe === 'Masculin' ? 'M' : moniteur.sexe === 'Féminin' ? 'F' : 'Autre'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </>
                                            ) : (
                                                 // Message si aucun moniteur
                                                <div className="alert alert-info mt-2 py-2">Aucun moniteur attribué à ce peloton.</div>
                                            )}
                                        </div>
                                    ))}
                                    {/* Message si l'escadron n'a pas de pelotons */}
                                    {(!escadron.pelotons || (Array.isArray(escadron.pelotons) && escadron.pelotons.length === 0)) && (
                                        <div className="alert alert-warning mt-3 py-2">Aucun peloton attribué à cet escadron.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                 {/* Message d'instruction si aucune proposition n'a été générée */}
                 {!proposedDistribution && !error && !isLoadingCreation && !isLoadingValidation && !isGeneratingPdf && !isExportingExcel && (
                     <div className="alert alert-info mt-4">
                         Entrez le nombre d'escadrons et cliquez sur "Créer la répartition" pour générer une proposition.
                     </div>
                 )}

            </div> {/* Fin du contenu visible */}

            {/* ======================================== */}
            {/* ZONE CACHÉE POUR LA GÉNÉRATION PDF       */}
            {/* ======================================== */}
            {/* Cette zone est rendue hors écran et sert de source pour html2canvas */}
            {/* Elle doit refléter la structure affichée, mais avec des styles simples pour l'impression */}
            {/* Rendre conditionnellement uniquement lorsque printCategory est défini */}
            {printCategory === 'repartition-cadres' && proposedDistribution && (
                <div className="printable-area" ref={printAreaRef} style={{
                    position: 'absolute', left: '-9999px', top: '-9999px', zIndex: '-1',
                    backgroundColor: '#fff', padding: '15mm', width: '210mm', minHeight: '297mm', boxSizing: 'border-box',
                    fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', lineHeight: '1.5'
                }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '15mm', fontSize: '14pt' }}>
                        Répartition Automatique des Cadres (Cours)
                    </h2>
                     <p style={{ textAlign: 'center', marginBottom: '15mm', fontSize: '10pt' }}>
                        Journée SPA du : {displayDateLabel} - Généré le : {new Date().toLocaleDateString('fr-FR')}
                    </p>

                    {/* Rendu de la structure de répartition pour le PDF (avec Tableaux simples) */}
                    {proposedDistribution.map(escadron => (
                         // breakInside: 'avoid' aide à ne pas couper les éléments sur les sauts de page PDF
                        <div key={escadron.numero} style={{ marginBottom: '10mm', border: '1px solid #000', padding: '5mm', breakInside: 'avoid' }}>
                            <h3 style={{ fontSize: '11pt', textDecoration: 'underline', marginBottom: '3mm' }}>{`Escadron ${escadron.numero}`}</h3>

                            {/* Tableau pour les rôles clés de l'Escadron (PDF) */}
                            <h6 style={{ fontSize: '10pt', marginBottom: '2mm' }}>Rôles Clés de l'Escadron :</h6>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5mm', fontSize: '9pt' }}>
                                <thead>
                                    <tr>
                                        <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Rôle</th>
                                        <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Grade</th>
                                        <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Nom Prénom</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>Commandant d'Escadron</td>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>{escadron.commandant?.grade || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>{escadron.commandant ? `${escadron.commandant.nom} ${escadron.commandant.prenom}` : 'Non attribué'}</td>
                                    </tr>
                                     <tr>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>Chef SIAT</td>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>{escadron.chefSiat?.grade || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>{escadron.chefSiat ? `${escadron.chefSiat.nom} ${escadron.chefSiat.prenom}` : 'Non attribué'}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Boucler sur chaque peloton pour le PDF */}
                            {escadron.pelotons && Array.isArray(escadron.pelotons) && escadron.pelotons.map(peloton => (
                                 // breakInside: 'avoid' pour les pelotons également
                                <div key={`${escadron.numero}-${peloton.numero}`} style={{ marginTop: '8mm', marginLeft: '5mm', borderLeft: '1px solid #ccc', paddingLeft: '3mm', breakInside: 'avoid' }}>
                                    <h4 style={{ fontSize: '10pt', fontStyle: 'italic', marginBottom: '2mm' }}>{`Peloton ${peloton.numero}`}</h4>

                                    {/* Tableau pour les rôles clés du Peloton (PDF) */}
                                    <h6 style={{ fontSize: '9pt', marginBottom: '2mm' }}>Rôles Clés du Peloton :</h6>
                                     <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '5mm', fontSize: '9pt' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Rôle</th>
                                                <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Grade</th>
                                                <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Nom Prénom</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ border: '1px solid #000', padding: '2mm' }}>Commandant de Peloton</td>
                                                <td style={{ border: '1px solid #000', padding: '2mm' }}>{peloton.commandant?.grade || '-'}</td>
                                                <td style={{ border: '1px solid #000', padding: '2mm' }}>{peloton.commandant ? `${peloton.commandant.nom} ${peloton.commandant.prenom}` : 'Non attribué'}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ border: '1px solid #000', padding: '2mm' }}>Adjoint C. Peloton</td>
                                                <td style={{ border: '1px solid #000', padding: '2mm' }}>{peloton.adjoint?.grade || '-'}</td>
                                                <td style={{ border: '1px solid #000', padding: '2mm' }}>{peloton.adjoint ? `${peloton.adjoint.nom} ${peloton.adjoint.prenom}` : 'Non attribué'}</td>
                                            </tr>
                                        </tbody>
                                    </table>


                                    {/* Tableau pour la liste des Moniteurs (PDF) */}
                                    {peloton.moniteurs && Array.isArray(peloton.moniteurs) && peloton.moniteurs.length > 0 ? (
                                        <div style={{ marginTop: '3mm' }}>
                                            <h6 style={{ fontSize: '9pt', marginBottom: '1mm' }}>Moniteurs ({peloton.moniteurs.length}) :</h6>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
                                                 <thead>
                                                     <tr>
                                                         <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Grade</th>
                                                         <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Nom Prénom</th>
                                                         <th style={{ border: '1px solid #000', padding: '2mm', textAlign: 'left' }}>Sexe</th>
                                                     </tr>
                                                 </thead>
                                                <tbody>
                                                    {peloton.moniteurs.map(moniteur => (
                                                        // Pas besoin de key pour html2canvas, mais bonne pratique React
                                                        <tr key={moniteur.id}>
                                                            <td style={{ border: '1px solid #000', padding: '2mm' }}>{moniteur.grade}</td>
                                                            <td style={{ border: '1px solid #000', padding: '2mm' }}>{`${moniteur.nom} ${moniteur.prenom}`}</td>
                                                            <td style={{ border: '1px solid #000', padding: '2mm' }}>{moniteur.sexe === 'Masculin' ? 'M' : moniteur.sexe === 'Féminin' ? 'F' : 'Autre'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p style={{ fontStyle: 'italic', fontSize: '9pt', margin: '3mm 0' }}>Aucun moniteur attribué à ce peloton.</p>
                                    )}
                                </div>
                            ))}
                            {/* Message si l'escadron n'a pas de pelotons pour le PDF */}
                            {(!escadron.pelotons || (Array.isArray(escadron.pelotons) && escadron.pelotons.length === 0)) && (
                                <p style={{ fontStyle: 'italic', fontSize: '9pt', margin: '3mm 0' }}>Aucun peloton attribué à cet escadron.</p>
                            )}
                        </div>
                    ))}

                 </div>
            )}

        </div>
    );
}

export default RepartitionCadresPage;