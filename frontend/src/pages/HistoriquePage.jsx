// src/pages/HistoriquePage.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext';
import moment from 'moment'; // Using moment.js for date formatting

// Importations pour la generation de PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper function to group and count motifs (copied from HomePage)
const groupAndCountMotifs = (peopleList) => {
    if (!peopleList || peopleList.length === 0) {
        return {};
    }
    const motifCounts = {};
    peopleList.forEach(person => {
        // Note: In the historical detailed list API, the motif is under item.motif_snapshot
        const motif = person.motif_snapshot || 'Motif inconnu';
        motifCounts[motif] = (motifCounts[motif] || 0) + 1;
    });
    return motifCounts;
};


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

function HistoriquePage() {
    // State for the unique date filter (YYYY-MM-DD format)
    const [dateFilter, setDateFilter] = useState('');

    // State for the summary counts (R, A, P, I, S) - Fetched from /api/history/cadres/summary
    const [summaryData, setSummaryData] = useState({ total: 0, absent: 0, present: 0, indisponible: 0, surLeRang: 0 }); // Adjusted keys to match backend API

    // State to hold filtered lists for detailed view - Fetched from /api/history/cadres/liste
    const [absentsList, setAbsentsList] = useState([]);
    const [indisponiblesList, setIndisponiblesList] = useState([]);

    // State for detailed lists visibility in the normal view
    const [showAbsentsDetail, setShowAbsentsDetail] = useState(false);
    const [showIndisponiblesDetail, setShowIndisponiblesDetail] = useState(false);

    // State for loading and error
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [loadingAbsents, setLoadingAbsents] = useState(false);
    const [loadingIndisponibles, setLoadingIndisponibles] = useState(false);
    const [errorSummary, setErrorSummary] = useState(null);
    const [errorAbsents, setErrorAbsents] = useState(null);
    const [errorIndisponibles, setErrorIndisponibles] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false); // New state for PDF generation status


    // Auth token
    const { token } = useAuth();

    // Ref for the printable content area
    const componentRef = useRef();

    // --- Function to fetch the historical summary for a specific date ---
    // --- Function to fetch the historical summary for a specific date ---
    const fetchHistoricalSummary = async (date) => {
        if (!date || !token) {
            setSummaryData({ total: 0, absent: 0, present: 0, indisponible: 0, surLeRang: 0 });
            setErrorSummary(token ? null : 'Authentification requise.');
            return;
        }

        setLoadingSummary(true);
        setErrorSummary(null);

        // Correct API URL based on backend router file provided earlier
        const apiUrl = `${API_BASE_URL}/api/status/cadres/summary?date=${date}`;
        console.log("Fetching historical summary for date:", apiUrl);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorBody.message || `Erreur lors de la récupération du résumé historique: ${response.status}`);
            }

            const data = await response.json();
            console.log("Historical summary data received:", data);

            // --- DÉBUT DU BLOC CORRIGÉ ---
            // Utilisez les bonnes clés _cadres de la réponse API backend
            const updatedSummaryData = {
                total: data.total_cadres ?? 0,         // CORRIGÉ : de data.total à data.total_cadres
                absent: data.absents_cadres ?? 0,       // CORRIGÉ : de data.absent à data.absents_cadres
                present: data.presents_cadres ?? 0,     // CORRIGÉ : de data.present à data.presents_cadres
                indisponible: data.indisponibles_cadres ?? 0, // CORRIGÉ : de data.indisponible à data.indisponibles_cadres
                surLeRang: data.sur_le_rang_cadres ?? 0, // CORRIGÉ : de data.surLeRang à data.sur_le_rang_cadres
            };

            setSummaryData(updatedSummaryData);

            // Log ajouté pour vérifier les données passées à setSummaryData (laisser pour le débogage si besoin)
            console.log("setSummaryData called with:", updatedSummaryData);
            // --- FIN DU BLOC CORRIGÉ ---


        } catch (err) {
            console.error("Erreur lors de la récupération du résumé historique:", err);
            const errorMessage = `Erreur lors du chargement du résumé : ${err.message}`;
            setErrorSummary(errorMessage);
            // En cas d'erreur, on remet l'état initial ou un état vide pour éviter d'afficher de vieilles données incorrectes
            setSummaryData({ total: 0, absent: 0, present: 0, indisponible: 0, surLeRang: 0 });
        } finally {
            setLoadingSummary(false);
        }
    };

    // --- Function to fetch a specific historical list (Absents or Indisponibles) ---
    const fetchHistoricalList = async (type, date) => {
        if (!date || !token) {
            if (type === 'Absent') setAbsentsList([]);
            if (type === 'Indisponible') setIndisponiblesList([]);
             if (!token) {
                 if (type === 'Absent') setErrorAbsents('Authentification requise.');
                 if (type === 'Indisponible') setErrorIndisponibles('Authentification requise.');
             }
            return []; // Return empty array in case of no date/token
        }

        if (type === 'Absent') { setLoadingAbsents(true); setErrorAbsents(null); setAbsentsList([]); }
        if (type === 'Indisponible') { setLoadingIndisponibles(true); setErrorIndisponibles(null); setIndisponiblesList([]); }


        const apiUrl = `${API_BASE_URL}/api/history/cadres/liste?date=${date}&statut=${type}`; // Use the new list API
        console.log(`Fetching historical list (${type}) for date:`, apiUrl);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorBody.message || `Erreur lors de la récupération de la liste historique (${type}): ${response.status}`);
            }

            const data = await response.json();
            console.log(`Historical list (${type}) data received:`, data);

            // The received data should be an array of cadres with their status and motif for the date
            if (type === 'Absent') { setAbsentsList(data); return data; } // Return data
            if (type === 'Indisponible') { setIndisponiblesList(data); return data; } // Return data
            return []; // Should not happen

        } catch (err) {
            console.error(`Erreur lors de la récupération de la liste historique (${type}):`, err);
            const errorMessage = `Erreur lors du chargement de la liste ${type} : ${err.message}`;
            if (type === 'Absent') { setErrorAbsents(errorMessage); setAbsentsList([]); }
            if (type === 'Indisponible') { setErrorIndisponibles(errorMessage); setIndisponiblesList([]); }
            return []; // Return empty array in case of error
        } finally {
            if (type === 'Absent') setLoadingAbsents(false);
            if (type === 'Indisponible') setLoadingIndisponibles(false);
        }
    };


    // --- Effect to fetch summary data when dateFilter or token changes ---
    useEffect(() => {
        fetchHistoricalSummary(dateFilter);
        // When date changes, hide detailed lists and clear their data
        setShowAbsentsDetail(false);
        setShowIndisponiblesDetail(false);
        setAbsentsList([]);
        setIndisponiblesList([]);
    }, [dateFilter, token]); // Depend on dateFilter and token

    // --- Handle form submission for date filter ---
    const handleFilterSubmit = (e) => {
        e.preventDefault();
        // The useEffect above will handle fetching the summary when dateFilter state is updated.
        // Detailed lists are fetched on demand when clicking the count.
    };

    // --- Handlers to toggle detailed lists and fetch data if needed ---
    const handleToggleAbsentsDetail = () => {
        const newState = !showAbsentsDetail;
        setShowAbsentsDetail(newState);
        // Fetch absents list only if showing it, data is empty, and a date is selected
        if (newState && absentsList.length === 0 && dateFilter && !loadingAbsents && !errorAbsents) {
            fetchHistoricalList('Absent', dateFilter);
        }
    };

    const handleToggleIndisponiblesDetail = () => {
        const newState = !showIndisponiblesDetail;
        setShowIndisponiblesDetail(newState);
        // Fetch indisponibles list only if showing it, data is empty, and a date is selected
        if (newState && indisponiblesList.length === 0 && dateFilter && !loadingIndisponibles && !errorIndisponibles) {
            fetchHistoricalList('Indisponible', dateFilter);
        }
    };


    // Calculate motif counts for the detailed lists (used in print view)
    const absentsMotifCounts = useMemo(() => {
        return groupAndCountMotifs(absentsList);
    }, [absentsList]);

    const indisponiblesMotifCounts = useMemo(() => {
        return groupAndCountMotifs(indisponiblesList);
    }, [indisponiblesList]);


    // --- Handle PDF generation using html2canvas and jspdf ---
    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        setErrorSummary(null); // Clear summary error before generating PDF

        // Ensure detailed lists are fetched and visible in the DOM before capture
        const fetchPromises = [];
        let fetchedAbsents = absentsList;
        let fetchedIndisponibles = indisponiblesList;

        if (absentsList.length === 0 && dateFilter && !loadingAbsents && !errorAbsents) {
            fetchPromises.push(fetchHistoricalList('Absent', dateFilter).then(data => { fetchedAbsents = data; }));
        }
        if (indisponiblesList.length === 0 && dateFilter && !loadingIndisponibles && !errorIndisponibles) {
            fetchPromises.push(fetchHistoricalList('Indisponible', dateFilter).then(data => { fetchedIndisponibles = data; }));
        }

        try {
            await Promise.all(fetchPromises);

            // Temporarily show detailed sections in state so they are rendered in the DOM for print
            setShowAbsentsDetail(true);
            setShowIndisponiblesDetail(true);

            // Give DOM a moment to update after state change/fetch
            await new Promise(resolve => setTimeout(resolve, 500)); // Adjust delay if needed

            const input = componentRef.current;

            if (!input) {
                throw new Error("Zone d'impression introuvable.");
            }

            // Use html2canvas to capture the printable area as a canvas
            const canvas = await html2canvas(input, {
                scale: 2, // Adjust scale for better resolution
                logging: false, // Disable html2canvas logging
                useCORS: true, // Enable CORS if you have external images (like cadre photos)
                // ignoreElements: (element) => element.classList.contains('no-print') // Ignore elements with 'no-print' class
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4'); // 'p' for portrait, 'mm' for millimeters, 'a4' size
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width; // Calculate image height based on canvas aspect ratio
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add new pages if the content exceeds one page
            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save the PDF with a dynamic filename
            const pdfDate = dateFilter ? moment(dateFilter).format('DD-MM-YYYY') : 'historique';
            pdf.save(`rapport_spa_cadres_${pdfDate}.pdf`);

        } catch (error) {
            console.error("Erreur lors de la generation du PDF:", error);
            setErrorSummary(`Impossible de generer le PDF. Details: ${error.message || error}.`);
        } finally {
            setIsGeneratingPdf(false); // Disable PDF generation status

            // Revert detailed sections visibility state after printing
            // Use a timeout to ensure print dialog is closed before hiding
            setTimeout(() => {
                 setShowAbsentsDetail(false);
                 setShowIndisponiblesDetail(false);
            }, 100); // Adjust delay if needed
        }
    };


    // Determine if any loading is happening (excluding PDF generation)
    const isLoading = loadingSummary || loadingAbsents || loadingIndisponibles;
    // Determine if any error is present
    const hasError = errorSummary || errorAbsents || errorIndisponibles;


    return (
        // Wrap content to be printed in a div with a ref
        // Apply print-specific styles here or in a separate CSS file
        <div ref={componentRef} className="container mt-4 mb-5 printable-area-historique">
            {/* Add print-specific styles for this area */}
            <style>
                {`
                .printable-area-historique {
                    /* Styles applied when printing */
                    /* These styles can override screen styles */
                     font-family: Arial, sans-serif;
                     font-size: 10pt;
                     color: #000;
                     line-height: 1.5;
                     background-color: #fff; /* Ensure white background */
                     padding: 15mm; /* Add margins for print */
                }

                @media print {
                    /* Styles specific to print */
                    .no-print {
                        display: none !important; /* Hide elements not needed for print */
                    }
                    .print-visible {
                        display: block !important; /* Ensure detailed sections are visible */
                    }
                    .card {
                        border: 1px solid #ccc; /* Add borders to cards in print */
                    }
                    .table {
                        width: 100%; /* Ensure tables take full width */
                        border-collapse: collapse;
                    }
                    .table th, .table td {
                        border: 1px solid #000; /* Add borders to table cells */
                        padding: 5px;
                    }
                     .print-flex-gap {
                         display: flex;
                         justify-content: space-between;
                         gap: 10mm; /* Adjust gap for print if needed */
                     }
                      .print-flex-gap > div {
                         flex: 1;
                          min-width: 45%; /* Ensure columns take space */
                      }
                }
                      @media print {
                    .no-print { display: none !important; }
                    .print-visible { display: block !important; }
                    /* Adjust table styles for print */
                     table { page-break-after: auto; }
                     tr    { page-break-inside:avoid; page-break-after:auto; }
                     td, th { vertical-align: top; }
                }
                
                /* Règles pour le survol des stats cliquables */
                .clickable-stat:hover {
                    cursor: pointer; /* Change le curseur en main */
                    text-decoration: underline; /* Ajoute un soulignement au survol */
                    filter: brightness(1.2); /* Rends légèrement plus lumineux */
                }

                /* Règles pour l'état actif (une fois cliqué et liste affichée) */
                .active-stat {
                    font-weight: bold; /* Rends le texte en gras */
                    background-color: #eee; /* Ajoute un léger fond gris */
                    /* color: #000; /* Optionnel: Changer la couleur du texte si besoin */
                    padding: 0 5px; /* Ajoute un peu d'espace autour du chiffre */
                    border-radius: 3px; /* Ajoute des coins arrondis */
                    /* border: 1px solid #ccc; /* Optionnel: Ajouter une petite bordure */
                }
                `}
            </style>

            {/* Dynamic Title (Always visible in print area) */}
            <h1 className="text-center mb-4">
                SPA Cadre {dateFilter ? `du ${moment(dateFilter).format('DD/MM/YYYY')}` : 'Historique'}
            </h1>

            {/* Section des filtres - Hide this section when printing */}
            <div className="card mb-4 no-print">
                <div className="card-header">Sélectionner une Date Historique</div>
                <div className="card-body">
                    <form onSubmit={handleFilterSubmit}>
                        <div className="row g-3 align-items-end">
                            <div className="col-md-4">
                                <label htmlFor="dateFilter" className="form-label">Date du rapport :</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    id="dateFilter"
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    required // Make date selection required
                                     max={moment().format('YYYY-MM-DD')} // Prevent selecting future dates
                                />
                            </div>
                            <div className="col-auto">
                                <button type="submit" className="btn btn-primary" disabled={isLoading || !dateFilter}>
                                    {loadingSummary ? (
                                         <>
                                             <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                             Chargement...
                                         </>
                                    ) : 'Afficher le Rapport'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>

            {/* Error Messages */}
            {errorSummary && (
                <div className="alert alert-danger" role="alert">{errorSummary}</div>
            )}
             {errorAbsents && showAbsentsDetail && ( // Show absent error only if trying to show the list
                 <div className="alert alert-danger" role="alert">{errorAbsents}</div>
             )}
             {errorIndisponibles && showIndisponiblesDetail && ( // Show indisponible error only if trying to show the list
                 <div className="alert alert-danger" role="alert">{errorIndisponibles}</div>
             )}


            {/* Message if no date selected or no data */}
            {!dateFilter && !isLoading && !hasError && (
                 <div className="alert alert-info text-center" role="alert">
                     Veuillez sélectionner une date historique pour afficher le rapport SPA Cadre.
                 </div>
            )}

             {/* Loading message outside printable area */}
             {isLoading && (
                 <div className="text-center mt-4 no-print">
                     <div className="spinner-border text-primary" role="status">
                         <span className="visually-hidden">Chargement...</span>
                     </div>
                     <p>Chargement du rapport...</p>
                 </div>
             )}

            {/* PDF Generation Status Message */}
             {isGeneratingPdf && (
                 <div className="alert alert-info text-center no-print" role="alert">
                     Génération du PDF en cours... Veuillez patienter.
                 </div>
             )}


            {/* Report Sections (only show if data is available and not loading, and no critical error) */}
            {!isLoading && !errorSummary && dateFilter && summaryData.total > 0 && (
                <>
                     {/* Summary Dashboard (Visible in print) */}
                     <div className="card mb-4">
                         <div className="card-header">Tableau de bord récapitulatif</div>
                         <div className="card-body">
                             <div className="row text-center">
                                <div className="col">
                                       <h5>Total (R)</h5>
                                       <p className="fs-4 text-primary">{summaryData.total}</p>
                                   </div>
                                   <div className="col-md-2 col-4 mb-2">
                                <div className="p-2 border rounded">
                                    <h5 className="mb-1">Absent (A)</h5>
                                    {summaryData.absent > 0 ? (
                                         <p
                                             // --- MODIFICATION ICI : Ajouter la classe active-stat si showAbsentsDetail est vrai ---
                                             className={`mb-0 h4 text-danger clickable-stat ${showAbsentsDetail ? 'active-stat' : ''}`}
                                             onClick={handleToggleAbsentsDetail}
                                         >
                                             {summaryData.absent}
                                         </p>
                                     ) : (
                                         <p className="mb-0 h4 text-danger">{summaryData.absent}</p>
                                     )}
                                </div>
                            </div>
                                 <div className="col">
                                     <h5>Présent (P)</h5>
                                     <p className="fs-4 text-success">{summaryData.present}</p>
                                 </div>
                                 
                                 <div className="col-md-2 col-4 mb-2"> {/* Adapter les classes */}
                                <div className="p-2 border rounded">
                                    <h5 className="mb-1">Indisponible (I)</h5>
                                    {summaryData.indisponible > 0 ? (
                                         <p
                                              // --- MODIFICATION ICI : Ajouter la classe active-stat si showIndisponiblesDetail est vrai ---
                                             className={`mb-0 h4 text-warning clickable-stat ${showIndisponiblesDetail ? 'active-stat' : ''}`}
                                             onClick={handleToggleIndisponiblesDetail}
                                         >
                                             {summaryData.indisponible}
                                         </p>
                                     ) : (
                                         <p className="mb-0 h4 text-warning">{summaryData.indisponible}</p>
                                     )}
                                </div>
                            </div>
                                  {/* Add other summary counts (R, S) if needed */}
                                   
                                   <div className="col">
                                       <h5>Sur le rang (S)</h5>
                                       <p className="fs-4 text-info">{summaryData.surLeRang}</p>
                                   </div>
                             </div>
                         </div>
                     </div>

                     {/* Detailed Absents List (conditionally displayed based on state AND forced visible for print) */}
                      {/* Use d-none to hide in normal view, print-visible overrides. Add id for print CSS targeting */}
                      <div className={`card mb-4 ${showAbsentsDetail ? '' : 'd-none'} print-visible`} id="absentsDetailSection">
                          <div className="card-header d-flex justify-content-between align-items-center no-print"> {/* Header hidden in print */}
                              Liste Détaillée des Absents
                              {/* Button to hide the section - Hide this when printing */}
                              <button
                                   className="btn btn-sm btn-outline-secondary" // no-print class handled by parent div
                                   onClick={() => setShowAbsentsDetail(false)}
                              >
                                   Masquer
                              </button>
                          </div>
                          <div className="card-body">
                              {loadingAbsents && <div className="alert alert-info">Chargement de la liste des Absents...</div>}
                              {errorAbsents && <div className="alert alert-danger">{errorAbsents}</div>}
                              {!loadingAbsents && !errorAbsents && absentsList.length > 0 && (
                                  <div className="table-responsive">
                                       {/* Table Title for Print */}
                                       <h6 className="print-visible" style={{ fontWeight: 'bold', marginBottom: '5px' }}>Liste Détaillée des Absents :</h6>
                                      <table className="table table-striped table-hover table-sm">
                                          <thead>
                                              <tr>
                                                  <th>Grade</th>
                                                  <th>Nom Prénom</th>
                                                  <th>Matricule</th>
                                                  <th>Service</th> {/* Assuming service is available via cadre relation */}
                                                  <th>Motif</th>
                                                  

                                              </tr>
                                          </thead>
                                          <tbody>
                                              {absentsList.map(item => (
                                                  // Assurez-vous que la structure de l'item correspond a ce que l'API historique /liste renvoie
                                                  // L'API est censée retourner { cadre: {...cadreDetails}, statut_snapshot: 'Absent', motif_snapshot: '...' }
                                                  <tr key={item.Cadre?.id || item.id}> {/* Use cadre.id if available, fallback to item.id */}
                                                      <td>{item.Cadre?.grade || 'N/A'}</td>
                                                      <td>{`${item.Cadre?.nom || ''} ${item.Cadre?.prenom || ''}`}</td>
                                                      <td>{item.Cadre?.matricule || 'N/A'}</td>
                                                      <td>{item.Cadre?.service || 'N/A'}</td>
                                                      <td>{item.motif_snapshot || '-'}</td> {/* Use motif_snapshot from history data */}
                                                  </tr>
                                              ))}
                                          </tbody>
                                      </table>
                                  </div>
                              )}
                               {!loadingAbsents && !errorAbsents && absentsList.length === 0 && (
                                    <div className="alert alert-info">Aucun absent trouvé pour cette date.</div>
                               )}
                                {/* Display Motif Counts for Absents in print */}
                                {/* This section is hidden normally but visible in print */}
                                <div className="mt-3 print-visible">
                                     <h6 className="text-decoration-underline">Motifs des Absents :</h6>
                                     {Object.entries(absentsMotifCounts).length > 0 ? (
                                         <ul>
                                             {Object.entries(absentsMotifCounts).map(([motif, count]) => (
                                                 <li key={motif}>{motif} : {count}</li>
                                             ))}
                                         </ul>
                                     ) : (
                                         <p>Aucun motif spécifié pour les absents.</p>
                                     )}
                                </div>
                          </div>
                      </div>

                      {/* Detailed Indisponibles List (conditionally displayed based on state AND forced visible for print) */}
                       {/* Use d-none to hide in normal view, print-visible overrides. Add id for print CSS targeting */}
                       <div className={`card mb-4 ${showIndisponiblesDetail ? '' : 'd-none'} print-visible`} id="indisponiblesDetailSection">
                           <div className="card-header d-flex justify-content-between align-items-center no-print"> {/* Header hidden in print */}
                               Liste Détaillée des Indisponibles
                               {/* Button to hide the section - Hide this when printing */}
                               <button
                                    className="btn btn-sm btn-outline-secondary" // no-print class handled by parent div
                                    onClick={() => setShowIndisponiblesDetail(false)}
                               >
                                    Masquer
                               </button>
                           </div>
                           <div className="card-body">
                               {loadingIndisponibles && <div className="alert alert-info">Chargement de la liste des Indisponibles...</div>}
                               {errorIndisponibles && <div className="alert alert-danger">{errorIndisponibles}</div>}
                               {!loadingIndisponibles && !errorIndisponibles && indisponiblesList.length > 0 && (
                                   <div className="table-responsive">
                                        {/* Table Title for Print */}
                                        <h6 className="print-visible" style={{ fontWeight: 'bold', marginBottom: '5px' }}>Liste Détaillée des Indisponibles :</h6>
                                       <table className="table table-striped table-hover table-sm">
                                           <thead>
                                               <tr>
                                                   <th>Grade</th>
                                                   <th>Nom Prénom</th>
                                                   <th>Matricule</th>
                                                   <th>Service</th> {/* Assuming service is available via cadre relation */}
                                                   <th>Motif</th>
                                               </tr>
                                           </thead>
                                           <tbody>
                                               {indisponiblesList.map(item => (
                                                   // Assurez-vous que la structure de l'item correspond a ce que l'API historique /liste renvoie
                                                   // L'API est censée retourner { cadre: {...cadreDetails}, statut_snapshot: 'Indisponible', motif_snapshot: '...' }
                                                   <tr key={item.Cadre?.id || item.id}> {/* Use cadre.id if available, fallback to item.id */}
                                                       <td>{item.Cadre?.grade || 'N/A'}</td>
                                                       <td>{`${item.Cadre?.nom || ''} ${item.Cadre?.prenom || ''}`}</td>
                                                       <td>{item.Cadre?.matricule || 'N/A'}</td>
                                                       <td>{item.Cadre?.service || 'N/A'}</td>
                                                       <td>{item.motif_snapshot || '-'}</td> {/* Use motif_snapshot from history data */}
                                                   </tr>
                                               ))}
                                           </tbody>
                                       </table>
                                   </div>
                               )}
                                {!loadingIndisponibles && !errorIndisponibles && indisponiblesList.length === 0 && (
                                     <div className="alert alert-info">Aucun indisponible trouvé pour cette date.</div>
                                )}
                                 {/* Display Motif Counts for Indisponibles in print */}
                                 {/* This section is hidden normally but visible in print */}
                                 <div className="mt-3 print-visible">
                                      <h6 className="text-decoration-underline">Motifs des Indisponibles :</h6>
                                      {Object.entries(indisponiblesMotifCounts).length > 0 ? (
                                          <ul>
                                              {Object.entries(indisponiblesMotifCounts).map(([motif, count]) => (
                                                  <li key={motif}>{motif} : {count}</li>
                                              ))}
                                          </ul>
                                      ) : (
                                          <p>Aucun motif spécifié pour les indisponibles.</p>
                                      )}
                                 </div>
                           </div>
                       </div>


                    {/* Print Button - Hide this when printing */}
                    <div className="text-center mb-4 no-print">
                         <button className="btn btn-secondary" onClick={handleGeneratePdf} disabled={isLoading || hasError || !dateFilter || summaryData.total === 0 || isGeneratingPdf}>
                             {isGeneratingPdf ? (
                                  <>
                                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                      Génération PDF...
                                  </>
                             ) : 'Imprimer ce rapport quotidien'}
                         </button>
                    </div>
                </>
            )}

             {/* "Grade de Semaine" section - Always visible in print area if data is shown */}
              {!isLoading && !errorSummary && dateFilter && summaryData.total > 0 && (
                  <div style={{ marginTop: '20mm', textAlign: 'right', fontWeight: 'bold' }}>
                      
                  </div>
              )}


        </div> // End of componentRef div
    );
}

export default HistoriquePage;
