import React, { useState, useEffect, useRef, useMemo } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext';
import moment from 'moment';

// Importations pour la generation de PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Importation pour l'export Excel
import * as XLSX from 'xlsx';

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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function HistoriquePage() {
    // State for the unique date filter (YYYY-MM-DD format)
    const [dateFilter, setDateFilter] = useState('');

    // State for the summary counts (R, A, P, I, S) - Fetched from /api/history/cadres/summary
    const [summaryData, setSummaryData] = useState({ total: 0, absent: 0, present: 0, indisponible: 0, surLeRang: 0 });

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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // Auth token
    const { token } = useAuth();

    // Ref for the printable content area
    const componentRef = useRef();

    // --- Function to fetch the historical summary for a specific date ---
    const fetchHistoricalSummary = async (date) => {
        if (!date || !token) {
            setSummaryData({ total: 0, absent: 0, present: 0, indisponible: 0, surLeRang: 0 });
            setErrorSummary(token ? null : 'Authentification requise.');
            return;
        }

        setLoadingSummary(true);
        setErrorSummary(null);

        const apiUrl = `${API_BASE_URL}api/status/cadres/summary?date=${date}`;
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

            const updatedSummaryData = {
                total: data.total_cadres ?? 0,
                absent: data.absents_cadres ?? 0,
                present: data.presents_cadres ?? 0,
                indisponible: data.indisponibles_cadres ?? 0,
                surLeRang: data.sur_le_rang_cadres ?? 0,
            };

            setSummaryData(updatedSummaryData);
            console.log("setSummaryData called with:", updatedSummaryData);

        } catch (err) {
            console.error("Erreur lors de la récupération du résumé historique:", err);
            const errorMessage = `Erreur lors du chargement du résumé : ${err.message}`;
            setErrorSummary(errorMessage);
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
            return [];
        }

        if (type === 'Absent') { setLoadingAbsents(true); setErrorAbsents(null); setAbsentsList([]); }
        if (type === 'Indisponible') { setLoadingIndisponibles(true); setErrorIndisponibles(null); setIndisponiblesList([]); }

        const apiUrl = `${API_BASE_URL}api/history/cadres/liste?date=${date}&statut=${type}`;
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

            if (type === 'Absent') { setAbsentsList(data); return data; }
            if (type === 'Indisponible') { setIndisponiblesList(data); return data; }
            return [];

        } catch (err) {
            console.error(`Erreur lors de la récupération de la liste historique (${type}):`, err);
            const errorMessage = `Erreur lors du chargement de la liste ${type} : ${err.message}`;
            if (type === 'Absent') { setErrorAbsents(errorMessage); setAbsentsList([]); }
            if (type === 'Indisponible') { setErrorIndisponibles(errorMessage); setIndisponiblesList([]); }
            return [];
        } finally {
            if (type === 'Absent') setLoadingAbsents(false);
            if (type === 'Indisponible') setLoadingIndisponibles(false);
        }
    };

    // --- Effect to fetch summary data when dateFilter or token changes ---
    useEffect(() => {
        fetchHistoricalSummary(dateFilter);
        setShowAbsentsDetail(false);
        setShowIndisponiblesDetail(false);
        setAbsentsList([]);
        setIndisponiblesList([]);
    }, [dateFilter, token]);

    // --- Handle form submission for date filter ---
    const handleFilterSubmit = (e) => {
        e.preventDefault();
    };

    // --- Handlers to toggle detailed lists and fetch data if needed ---
    const handleToggleAbsentsDetail = () => {
        const newState = !showAbsentsDetail;
        setShowAbsentsDetail(newState);
        if (newState && absentsList.length === 0 && dateFilter && !loadingAbsents && !errorAbsents) {
            fetchHistoricalList('Absent', dateFilter);
        }
    };

    const handleToggleIndisponiblesDetail = () => {
        const newState = !showIndisponiblesDetail;
        setShowIndisponiblesDetail(newState);
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

    // --- Function to generate Excel export ---
    const handleGenerateExcel = async () => {
        try {
            // S'assurer que les listes détaillées sont chargées
            const fetchPromises = [];
            let fetchedAbsents = absentsList;
            let fetchedIndisponibles = indisponiblesList;

            if (absentsList.length === 0 && dateFilter && !loadingAbsents && !errorAbsents) {
                fetchPromises.push(fetchHistoricalList('Absent', dateFilter).then(data => { fetchedAbsents = data; }));
            }
            if (indisponiblesList.length === 0 && dateFilter && !loadingIndisponibles && !errorIndisponibles) {
                fetchPromises.push(fetchHistoricalList('Indisponible', dateFilter).then(data => { fetchedIndisponibles = data; }));
            }

            await Promise.all(fetchPromises);

            // Préparer les données pour Excel
            const workbook = XLSX.utils.book_new();

            // Feuille 1: Résumé
            const summaryData_excel = [
                ['Rapport SPA Cadres', dateFilter ? moment(dateFilter).format('DD/MM/YYYY') : ''],
                [''],
                ['Statut', 'Nombre'],
                ['Total (R)', summaryData.total],
                ['Présent (P)', summaryData.present],
                ['Absent (A)', summaryData.absent],
                ['Indisponible (I)', summaryData.indisponible],
                ['Sur le rang (S)', summaryData.surLeRang]
            ];

            const summarySheet = XLSX.utils.aoa_to_sheet(summaryData_excel);
            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Résumé');

            // Feuille 2: Liste des Absents (si données disponibles)
            if (fetchedAbsents.length > 0) {
                const absentsData = [
                    ['Liste des Absents'],
                    [''],
                    ['Grade', 'Nom', 'Prénom', 'Matricule', 'Service', 'Motif']
                ];

                fetchedAbsents.forEach(item => {
                    absentsData.push([
                        item.Cadre?.grade || item.cadre?.grade || 'N/A',
                        item.Cadre?.nom || item.cadre?.nom || '',
                        item.Cadre?.prenom || item.cadre?.prenom || '',
                        item.Cadre?.matricule || item.cadre?.matricule || 'N/A',
                        item.Cadre?.service || item.cadre?.service || 'N/A',
                        item.motif_snapshot || '-'
                    ]);
                });

                // Ajouter les motifs groupés
                const motifCounts = groupAndCountMotifs(fetchedAbsents);
                if (Object.keys(motifCounts).length > 0) {
                    absentsData.push([''], ['Motifs des Absents:']);
                    Object.entries(motifCounts).forEach(([motif, count]) => {
                        absentsData.push([motif, count]);
                    });
                }

                const absentsSheet = XLSX.utils.aoa_to_sheet(absentsData);
                XLSX.utils.book_append_sheet(workbook, absentsSheet, 'Absents');
            }

            // Feuille 3: Liste des Indisponibles (si données disponibles)
            if (fetchedIndisponibles.length > 0) {
                const indisponiblesData = [
                    ['Liste des Indisponibles'],
                    [''],
                    ['Grade', 'Nom', 'Prénom', 'Matricule', 'Service', 'Motif']
                ];

                fetchedIndisponibles.forEach(item => {
                    indisponiblesData.push([
                        item.Cadre?.grade || item.cadre?.grade || 'N/A',
                        item.Cadre?.nom || item.cadre?.nom || '',
                        item.Cadre?.prenom || item.cadre?.prenom || '',
                        item.Cadre?.matricule || item.cadre?.matricule || 'N/A',
                        item.Cadre?.service || item.cadre?.service || 'N/A',
                        item.motif_snapshot || '-'
                    ]);
                });

                // Ajouter les motifs groupés
                const motifCounts = groupAndCountMotifs(fetchedIndisponibles);
                if (Object.keys(motifCounts).length > 0) {
                    indisponiblesData.push([''], ['Motifs des Indisponibles:']);
                    Object.entries(motifCounts).forEach(([motif, count]) => {
                        indisponiblesData.push([motif, count]);
                    });
                }

                const indisponiblesSheet = XLSX.utils.aoa_to_sheet(indisponiblesData);
                XLSX.utils.book_append_sheet(workbook, indisponiblesSheet, 'Indisponibles');
            }

            // Sauvegarder le fichier Excel
            const excelDate = dateFilter ? moment(dateFilter).format('DD-MM-YYYY') : 'historique';
            const fileName = `rapport_spa_cadres_${excelDate}.xlsx`;
            XLSX.writeFile(workbook, fileName);

        } catch (error) {
            console.error("Erreur lors de la génération Excel:", error);
            setErrorSummary(`Impossible de générer le fichier Excel. Détails: ${error.message || error}.`);
        }
    };

    // --- Handle PDF generation using html2canvas and jspdf ---
    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        setErrorSummary(null);

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
            await new Promise(resolve => setTimeout(resolve, 500));

            const input = componentRef.current;

            if (!input) {
                throw new Error("Zone d'impression introuvable.");
            }

            // Use html2canvas to capture the printable area as a canvas
            const canvas = await html2canvas(input, {
                scale: 2,
                logging: false,
                useCORS: true,
                backgroundColor: '#ffffff',
                allowTaint: true,
                removeContainer: true,
                ignoreElements: (element) => {
                    // Ignore tous les éléments avec la classe no-print
                    return element.classList.contains('no-print') ||
                           element.classList.contains('btn') ||
                           element.tagName === 'BUTTON' ||
                           element.classList.contains('alert-info');
                }
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = canvas.height * imgWidth / canvas.width;
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
            setIsGeneratingPdf(false);

            // Revert detailed sections visibility state after printing
            setTimeout(() => {
                setShowAbsentsDetail(false);
                setShowIndisponiblesDetail(false);
            }, 100);
        }
    };

    // Determine if any loading is happening (excluding PDF generation)
    const isLoading = loadingSummary || loadingAbsents || loadingIndisponibles;
    // Determine if any error is present
    const hasError = errorSummary || errorAbsents || errorIndisponibles;

    return (
        <div ref={componentRef} className="container mt-4 mb-5 printable-area-historique">
            {/* Add print-specific styles for this area */}
            <style>
                {`
                .printable-area-historique {
                    font-family: Arial, sans-serif;
                    font-size: 10pt;
                    color: #000;
                    line-height: 1.5;
                    background-color: #fff;
                    padding: 15mm;
                }

                @media print {
                    .no-print {
                        display: none !important;
                        visibility: hidden !important;
                        opacity: 0 !important;
                    }
                    .print-visible {
                        display: block !important;
                    }
                    .card {
                        border: 1px solid #ccc;
                    }
                    .table {
                        width: 100%;
                        border-collapse: collapse;
                    }
                    .table th, .table td {
                        border: 1px solid #000;
                        padding: 5px;
                    }
                    .print-flex-gap {
                        display: flex;
                        justify-content: space-between;
                        gap: 10mm;
                    }
                    .print-flex-gap > div {
                        flex: 1;
                        min-width: 45%;
                    }
                    table { page-break-after: auto; }
                    tr { page-break-inside:avoid; page-break-after:auto; }
                    td, th { vertical-align: top; }
                }

                .clickable-stat:hover {
                    cursor: pointer;
                    text-decoration: underline;
                    filter: brightness(1.2);
                }

                .active-stat {
                    font-weight: bold;
                    background-color: #eee;
                    padding: 0 5px;
                    border-radius: 3px;
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
                                    required
                                    max={moment().format('YYYY-MM-DD')}
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
                <div className="alert alert-danger no-print" role="alert">{errorSummary}</div>
            )}
            {errorAbsents && showAbsentsDetail && (
                <div className="alert alert-danger no-print" role="alert">{errorAbsents}</div>
            )}
            {errorIndisponibles && showIndisponiblesDetail && (
                <div className="alert alert-danger no-print" role="alert">{errorIndisponibles}</div>
            )}

            {/* Message if no date selected or no data */}
            {!dateFilter && !isLoading && !hasError && (
                <div className="alert alert-info text-center no-print" role="alert">
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
                                <div className="col-md-2 col-6 mb-2">
                                    <div className="p-2 border rounded">
                                        <h5 className="mb-1">Total (R)</h5>
                                        <p className="mb-0 h4 text-primary">{summaryData.total}</p>
                                    </div>
                                </div>
                                <div className="col-md-2 col-6 mb-2">
                                    <div className="p-2 border rounded">
                                        <h5 className="mb-1">Absent (A)</h5>
                                        {summaryData.absent > 0 ? (
                                            <p
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
                                <div className="col-md-2 col-6 mb-2">
                                    <div className="p-2 border rounded">
                                        <h5 className="mb-1">Présent (P)</h5>
                                        <p className="mb-0 h4 text-success">{summaryData.present}</p>
                                    </div>
                                </div>
                                <div className="col-md-2 col-6 mb-2">
                                    <div className="p-2 border rounded">
                                        <h5 className="mb-1">Indisponible (I)</h5>
                                        {summaryData.indisponible > 0 ? (
                                            <p
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
                                <div className="col-md-2 col-6 mb-2">
                                    <div className="p-2 border rounded">
                                        <h5 className="mb-1">Sur le rang (S)</h5>
                                        <p className="mb-0 h4 text-info">{summaryData.surLeRang}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Detailed Absents List */}
                    <div className={`card mb-4 ${showAbsentsDetail ? '' : 'd-none'} print-visible`} id="absentsDetailSection">
                        <div className="card-header d-flex justify-content-between align-items-center no-print">
                            Liste Détaillée des Absents
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setShowAbsentsDetail(false)}
                            >
                                Masquer
                            </button>
                        </div>
                        <div className="card-body">
                            {loadingAbsents && <div className="alert alert-info no-print">Chargement de la liste des Absents...</div>}
                            {errorAbsents && <div className="alert alert-danger no-print">{errorAbsents}</div>}
                            {!loadingAbsents && !errorAbsents && absentsList.length > 0 && (
                                <div className="table-responsive">
                                    <h6 className="print-visible" style={{ fontWeight: 'bold', marginBottom: '5px' }}>Liste Détaillée des Absents :</h6>
                                    <table className="table table-striped table-hover table-sm">
                                        <thead>
                                            <tr>
                                                <th>Grade</th>
                                                <th>Nom Prénom</th>
                                                <th>Matricule</th>
                                                <th>Service</th>
                                                <th>Motif</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {absentsList.map(item => (
                                                <tr key={item.Cadre?.id || item.cadre?.id || item.id}>
                                                    <td>{item.Cadre?.grade || item.cadre?.grade || 'N/A'}</td>
                                                    <td>{`${item.Cadre?.nom || item.cadre?.nom || ''} ${item.Cadre?.prenom || item.cadre?.prenom || ''}`}</td>
                                                    <td>{item.Cadre?.matricule || item.cadre?.matricule || 'N/A'}</td>
                                                    <td>{item.Cadre?.service || item.cadre?.service || 'N/A'}</td>
                                                    <td>{item.motif_snapshot || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {!loadingAbsents && !errorAbsents && absentsList.length === 0 && (
                                <div className="alert alert-info">Aucun absent trouvé pour cette date.</div>
                            )}
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

                    {/* Detailed Indisponibles List */}
                    <div className={`card mb-4 ${showIndisponiblesDetail ? '' : 'd-none'} print-visible`} id="indisponiblesDetailSection">
                        <div className="card-header d-flex justify-content-between align-items-center no-print">
                            Liste Détaillée des Indisponibles
                            <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => setShowIndisponiblesDetail(false)}
                            >
                                Masquer
                            </button>
                        </div>
                        <div className="card-body">
                            {loadingIndisponibles && <div className="alert alert-info no-print">Chargement de la liste des Indisponibles...</div>}
                            {errorIndisponibles && <div className="alert alert-danger no-print">{errorIndisponibles}</div>}
                            {!loadingIndisponibles && !errorIndisponibles && indisponiblesList.length > 0 && (
                                <div className="table-responsive">
                                    <h6 className="print-visible" style={{ fontWeight: 'bold', marginBottom: '5px' }}>Liste Détaillée des Indisponibles :</h6>
                                    <table className="table table-striped table-hover table-sm">
                                        <thead>
                                            <tr>
                                                <th>Grade</th>
                                                <th>Nom Prénom</th>
                                                <th>Matricule</th>
                                                <th>Service</th>
                                                <th>Motif</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {indisponiblesList.map(item => (
                                                <tr key={item.Cadre?.id || item.cadre?.id || item.id}>
                                                    <td>{item.Cadre?.grade || item.cadre?.grade || 'N/A'}</td>
                                                    <td>{`${item.Cadre?.nom || item.cadre?.nom || ''} ${item.Cadre?.prenom || item.cadre?.prenom || ''}`}</td>
                                                    <td>{item.Cadre?.matricule || item.cadre?.matricule || 'N/A'}</td>
                                                    <td>{item.Cadre?.service || item.cadre?.service || 'N/A'}</td>
                                                    <td>{item.motif_snapshot || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {!loadingIndisponibles && !errorIndisponibles && indisponiblesList.length === 0 && (
                                <div className="alert alert-info">Aucun indisponible trouvé pour cette date.</div>
                            )}
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

                    {/* Print and Export Buttons - Hide these when printing */}
                    <div className="text-center mb-4 no-print">
                        <div className="btn-group" role="group">
                            <button
                                className="btn btn-primary"
                                onClick={handleGeneratePdf}
                                disabled={isLoading || hasError || !dateFilter || summaryData.total === 0 || isGeneratingPdf}
                            >
                                {isGeneratingPdf ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Génération PDF...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-file-pdf me-2"></i>
                                        Exporter PDF
                                    </>
                                )}
                            </button>

                            <button
                                className="btn btn-success"
                                onClick={handleGenerateExcel}
                                disabled={isLoading || hasError || !dateFilter || summaryData.total === 0}
                            >
                                <i className="fas fa-file-excel me-2"></i>
                                Exporter Excel
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* "Grade de Semaine" section - Always visible in print area if data is shown */}
            {!isLoading && !errorSummary && dateFilter && summaryData.total > 0 && (
                <div style={{ marginTop: '20mm', textAlign: 'right', fontWeight: 'bold' }}>
                    {/* Ajoutez ici votre section Grade de Semaine si nécessaire */}
                </div>
            )}
        </div>
    );
}

export default HistoriquePage;