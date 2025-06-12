// src/pages/RepartitionCadresPage.jsx

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import moment from 'moment-timezone';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// ============================================================================
// COMPOSANT DE PROTECTION ADMIN
// ============================================================================
const AdminProtection = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="d-flex justify-content-center align-items-center min-vh-100">
                <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Vérification des droits...</span>
                    </div>
                    <p className="mt-3">Vérification des droits d'accès...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const isAdmin = user.role === 'Admin' || user.roles?.includes('Admin') || user.isAdmin === true;

    if (!isAdmin) {
        return (
            <div className="container mt-5">
                <div className="row justify-content-center">
                    <div className="col-md-8">
                        <div className="card border-danger">
                            <div className="card-header bg-danger text-white">
                                <h4 className="mb-0">
                                    <i className="fas fa-exclamation-triangle me-2"></i>
                                    Accès Refusé
                                </h4>
                            </div>
                            <div className="card-body text-center">
                                <div className="mb-4">
                                    <i className="fas fa-shield-alt text-danger" style={{ fontSize: '4rem' }}></i>
                                </div>
                                <h5 className="card-title">Droits Administrateur Requis</h5>
                                <p className="card-text text-muted">
                                    Cette page est réservée aux administrateurs.
                                    Vous n'avez pas les permissions nécessaires pour accéder à la gestion de répartition des cadres.
                                </p>
                                <div className="mt-4">
                                    <p className="small text-muted">
                                        <strong>Utilisateur connecté :</strong> {user.nom} {user.prenom || user.name || ''}<br />
                                        <strong>Rôle actuel :</strong> {user.role || 'Utilisateur standard'}
                                    </p>
                                </div>
                                <div className="mt-4">
                                    <button
                                        className="btn btn-secondary me-2"
                                        onClick={() => window.history.back()}
                                    >
                                        <i className="fas fa-arrow-left me-1"></i>
                                        Retour
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => window.location.href = '/dashboard'}
                                    >
                                        <i className="fas fa-home me-1"></i>
                                        Accueil
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return children;
};

// ============================================================================
// CONSTANTES ET UTILITAIRES
// ============================================================================
const GRADE_HIERARCHY = ['GPCE', 'GPHC', 'GP1C', 'GP2C'];

const getDisplayDateLabel = (realTime, timezone) => {
    const momentDate = timezone ? moment.tz(realTime, timezone) : moment(realTime);
    const historicalMoment = momentDate.hour() >= 16 ?
                             momentDate.clone().add(1, 'day') :
                             momentDate.clone();
    return historicalMoment.format('DD/MM/YYYY');
};

// ============================================================================
// COMPOSANTS RÉUTILISABLES
// ============================================================================
const TableauEscadron = React.memo(({ escadron, disableChefSiat }) => (
    <table className="table table-bordered table-sm mb-3">
        <thead>
            <tr>
                <th>Rôle</th>
                <th>Grade</th>
                <th>Nom Prénom</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Commandant d'Escadron</td>
                <td>{escadron.commandant?.grade || <span className="text-muted">-</span>}</td>
                <td>{escadron.commandant ? `${escadron.commandant.nom} ${escadron.commandant.prenom}` : <span className="text-muted">Non attribué</span>}</td>
            </tr>
            {!disableChefSiat && (
                <tr>
                    <td>Chef SIAT</td>
                    <td>{escadron.chefSiat?.grade || <span className="text-muted">-</span>}</td>
                    <td>{escadron.chefSiat ? `${escadron.chefSiat.nom} ${escadron.chefSiat.prenom}` : <span className="text-muted">Non attribué</span>}</td>
                </tr>
            )}
        </tbody>
    </table>
));

const TableauPeloton = React.memo(({ peloton }) => (
    <table className="table table-bordered table-sm mb-3">
        <thead>
            <tr>
                <th>Rôle</th>
                <th>Grade</th>
                <th>Nom Prénom</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Commandant de Peloton</td>
                <td>{peloton.commandant?.grade || <span className="text-muted">-</span>}</td>
                <td>{peloton.commandant ? `${peloton.commandant.nom} ${peloton.commandant.prenom}` : <span className="text-muted">Non attribué</span>}</td>
            </tr>
            <tr>
                <td>Adjoint C. Peloton</td>
                <td>{peloton.adjoint?.grade || <span className="text-muted">-</span>}</td>
                <td>{peloton.adjoint ? `${peloton.adjoint.nom} ${peloton.adjoint.prenom}` : <span className="text-muted">Non attribué</span>}</td>
            </tr>
        </tbody>
    </table>
));

const TableauMoniteurs = React.memo(({ moniteurs }) => (
    <table className="table table-striped table-sm">
        <thead>
            <tr>
                <th>Grade</th>
                <th>Nom Prénom</th>
                <th>Sexe</th>
            </tr>
        </thead>
        <tbody>
            {moniteurs.map(moniteur => (
                <tr key={moniteur.id}>
                    <td>{moniteur.grade}</td>
                    <td>{`${moniteur.nom} ${moniteur.prenom}`}</td>
                    <td>{moniteur.sexe === 'Masculin' ? 'M' : moniteur.sexe === 'Féminin' ? 'F' : 'Autre'}</td>
                </tr>
            ))}
        </tbody>
    </table>
));

// ============================================================================
// HOOKS PERSONNALISÉS
// ============================================================================
const useExportHandlers = (proposedDistribution, displayDateLabel, disableChefSiat) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [printCategory, setPrintCategory] = useState(null);
    const printAreaRef = useRef(null);

    const handlePrint = useCallback(async () => {
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

        try {
            setPrintCategory('repartition-cadres');
            await new Promise(resolve => setTimeout(resolve, 300));

            const input = printAreaRef.current;
            if (!input) {
                throw new Error("Zone d'impression introuvable dans le DOM.");
            }

            const canvas = await html2canvas(input, {
                scale: 2,
                logging: false,
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const todayStandard = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-');
            const fileName = `repartition_cadres_${todayStandard}.pdf`;
            pdf.save(fileName);

            Swal.fire({
                icon: 'success',
                title: 'PDF Généré',
                text: 'Le rapport de répartition a été téléchargé au format PDF.',
                confirmButtonText: 'OK'
            });

        } catch (err) {
            console.error("Erreur lors de la génération du PDF :", err);
            Swal.fire({
                icon: 'error',
                title: 'Erreur PDF',
                text: `Impossible de générer le PDF. Détails : ${err.message || err}`,
                confirmButtonText: 'OK'
            });
        } finally {
            setIsGeneratingPdf(false);
            setTimeout(() => setPrintCategory(null), 150);
        }
    }, [proposedDistribution]);

    const handleExportExcel = useCallback(() => {
        if (!proposedDistribution) {
            Swal.fire({
                icon: 'warning',
                title: 'Action impossible',
                text: 'Aucune proposition de répartition à exporter.',
                confirmButtonText: 'OK'
            });
            return;
        }

        setIsExportingExcel(true);

        try {
            const workbook = XLSX.utils.book_new();

            const allCadresData = [
                ["Escadron", "Peloton", "Role/Fonction", "Grade", "Nom", "Prénom", "Sexe"]
            ];

            proposedDistribution.forEach(escadron => {
                allCadresData.push([
                    escadron.numero,
                    '',
                    'Commandant Escadron',
                    escadron.commandant?.grade || 'Non attribué',
                    escadron.commandant?.nom || '',
                    escadron.commandant?.prenom || '',
                    escadron.commandant?.sexe === 'Masculin' ? 'M' : escadron.commandant?.sexe === 'Féminin' ? 'F' : escadron.commandant ? 'Autre' : ''
                ]);

                if (!disableChefSiat) {
                    allCadresData.push([
                        escadron.numero,
                        '',
                        'Chef SIAT',
                        escadron.chefSiat?.grade || 'Non attribué',
                        escadron.chefSiat?.nom || '',
                        escadron.chefSiat?.prenom || '',
                        escadron.chefSiat?.sexe === 'Masculin' ? 'M' : escadron.chefSiat?.sexe === 'Féminin' ? 'F' : escadron.chefSiat ? 'Autre' : ''
                    ]);
                }

                escadron.pelotons.forEach(peloton => {
                    allCadresData.push([
                        escadron.numero,
                        peloton.numero,
                        `Commandant Peloton ${peloton.numero}`,
                        peloton.commandant?.grade || 'Non attribué',
                        peloton.commandant?.nom || '',
                        peloton.commandant?.prenom || '',
                        peloton.commandant?.sexe === 'Masculin' ? 'M' : peloton.commandant?.sexe === 'Féminin' ? 'F' : peloton.commandant ? 'Autre' : ''
                    ]);

                    allCadresData.push([
                        escadron.numero,
                        peloton.numero,
                        `Adjoint Cdt Peloton ${peloton.numero}`,
                        peloton.adjoint?.grade || 'Non attribué',
                        peloton.adjoint?.nom || '',
                        peloton.adjoint?.prenom || '',
                        peloton.adjoint?.sexe === 'Masculin' ? 'M' : peloton.adjoint?.sexe === 'Féminin' ? 'F' : peloton.adjoint ? 'Autre' : ''
                    ]);

                    peloton.moniteurs.forEach(moniteur => {
                        allCadresData.push([
                            escadron.numero,
                            peloton.numero,
                            'Moniteur',
                            moniteur.grade,
                            moniteur.nom,
                            moniteur.prenom,
                            moniteur.sexe === 'Masculin' ? 'M' : moniteur.sexe === 'Féminin' ? 'F' : 'Autre'
                        ]);
                    });
                    allCadresData.push(['', '', '', '', '', '', '']);
                });
                allCadresData.push(['', '', '', '', '', '', '']);
            });

            const allCadresSheet = XLSX.utils.aoa_to_sheet(allCadresData);
            const colWidths = allCadresData[0].map((_, i) => ({
                wch: Math.max(...allCadresData.map(row => (row[i] ? row[i].toString().length : 1))) * 1.2
            }));
            allCadresSheet['!cols'] = colWidths;
            XLSX.utils.book_append_sheet(workbook, allCadresSheet, "Repartition Detaillee");

            const moniteurSummaryData = [
                ["Escadron", "Peloton", "Nombre de Moniteurs"]
            ];

            proposedDistribution.forEach(escadron => {
                escadron.pelotons.forEach(peloton => {
                    moniteurSummaryData.push([
                        escadron.numero,
                        peloton.numero,
                        peloton.moniteurs.length
                    ]);
                });
                moniteurSummaryData.push(['', '', '']);
            });

            const moniteurSummarySheet = XLSX.utils.aoa_to_sheet(moniteurSummaryData);
            XLSX.utils.book_append_sheet(workbook, moniteurSummarySheet, "Resume Moniteurs");

            const todayStandard = new Date().toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, '-');
            const fileName = `repartition_cadres_${todayStandard}.xlsx`;

            XLSX.writeFile(workbook, fileName);

            Swal.fire({
                icon: 'success',
                title: 'Export Excel',
                text: 'Le rapport de répartition a été téléchargé au format Excel.',
                confirmButtonText: 'OK'
            });

        } catch (error) {
            console.error("Erreur lors de l'export Excel :", error);
            Swal.fire({
                icon: 'error',
                title: 'Erreur Export',
                text: `Impossible d'exporter en Excel. Détails : ${error.message || error}`,
                confirmButtonText: 'OK'
            });
        } finally {
            setIsExportingExcel(false);
        }
    }, [proposedDistribution, disableChefSiat]);

    return {
        handlePrint,
        handleExportExcel,
        isGeneratingPdf,
        isExportingExcel,
        printCategory,
        printAreaRef
    };
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================
function RepartitionCadresPage() {
    const { token, user } = useAuth();

    // États principaux
    const [numEscadrons, setNumEscadrons] = useState(0);
    const [proposedDistribution, setProposedDistribution] = useState(null);
    const [isLoadingCreation, setIsLoadingCreation] = useState(false);
    const [isLoadingValidation, setIsLoadingValidation] = useState(false);
    const [error, setError] = useState(null);
    const [displayDateLabel, setDisplayDateLabel] = useState('');

    // Nouvelles options d'optimisation
    const [disableChefSiat, setDisableChefSiat] = useState(false);
    const [avoidPreviousAssignments, setAvoidPreviousAssignments] = useState(true);
    const [avoidSameTeams, setAvoidSameTeams] = useState(true);
    const [optimizationLevel, setOptimizationLevel] = useState(70);

    // Hook pour les exports
    const {
        handlePrint,
        handleExportExcel,
        isGeneratingPdf,
        isExportingExcel,
        printCategory,
        printAreaRef
    } = useExportHandlers(proposedDistribution, displayDateLabel, disableChefSiat);

    // Calcul de la date affichée
    useEffect(() => {
        const now = new Date();
        const calculatedDisplayDate = getDisplayDateLabel(now, null);
        setDisplayDateLabel(calculatedDisplayDate);
    }, []);

    // Mémorisation du statut de loading global
    const isAnyLoading = useMemo(() => {
        return isLoadingCreation || isLoadingValidation || isGeneratingPdf || isExportingExcel;
    }, [isLoadingCreation, isLoadingValidation, isGeneratingPdf, isExportingExcel]);

    // Handlers
    const handleNumEscadronsChange = useCallback((e) => {
        const value = parseInt(e.target.value, 10);
        const sanitizedValue = isNaN(value) || value < 1 ? 0 : value;
        setNumEscadrons(sanitizedValue);
        setProposedDistribution(null);
        setError(null);
    }, []);

    const handleCreateDistribution = useCallback(async () => {
        if (numEscadrons <= 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Saisie invalide',
                text: "Veuillez spécifier un nombre d'escadrons valide (supérieur à 0).",
                confirmButtonText: 'OK'
            });
            return;
        }

        setIsLoadingCreation(true);
        setError(null);
        setProposedDistribution(null);

        let timerInterval;

        Swal.fire({
            title: 'Création de la répartition en cours...',
            html: `L'algorithme optimise la répartition selon vos paramètres.<br>Temps restant estimé : <strong>5</strong> secondes.`,
            icon: 'info',
            showConfirmButton: false,
            allowOutsideClick: false,
            allowEscapeKey: false,
            timer: 30000,
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
                }, 1000);
                Swal.showLoading();
            },
            willClose: () => {
                clearInterval(timerInterval);
                Swal.hideLoading();
            }
        });

        try {
            const requestBody = {
                numEscadrons,
                disableChefSiat,
                avoidPreviousAssignments,
                avoidSameTeams,
                optimizationLevel
            };

            const response = await fetch('/api/repartition/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: JSON.stringify(requestBody),
            });

            Swal.close();

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.message || `Erreur lors de la création : ${response.status}`);
            }

            const data = await response.json();
            const receivedDistribution = data.data?.distribution;

            if (!receivedDistribution || !Array.isArray(receivedDistribution)) {
                throw new Error("La réponse de l'API n'a pas la structure de données attendue.");
            }

            setProposedDistribution(receivedDistribution);

            let successMessage = data.message || 'La proposition de répartition a été créée.';
            if (disableChefSiat) {
                successMessage += '\n\nNote: Les postes Chef SIAT ont été désactivés et redistribués selon la hiérarchie.';
            }

            Swal.fire({
                icon: 'success',
                title: 'Succès !',
                text: successMessage,
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
        }
    }, [numEscadrons, disableChefSiat, avoidPreviousAssignments, avoidSameTeams, optimizationLevel, token]);

    const handleValidateDistribution = useCallback(async () => {
        if (!proposedDistribution) {
            Swal.fire({
                icon: 'warning',
                title: 'Action impossible',
                text: 'Aucune proposition de répartition à valider.',
                confirmButtonText: 'OK'
            });
            return;
        }

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
            return;
        }

        setIsLoadingValidation(true);
        setError(null);

        try {
            const response = await fetch('/api/repartition/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
                body: JSON.stringify({
                    distribution: proposedDistribution,
                    disableChefSiat: disableChefSiat
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                throw new Error(errorData.message || `Erreur lors de la validation : ${response.status}`);
            }

            const result = await response.json();

            Swal.fire({
                icon: 'success',
                title: 'Validé !',
                text: result.message || 'La base de données a été mise à jour avec succès.',
                confirmButtonText: 'OK'
            });

            setProposedDistribution(null);
            setNumEscadrons(0);

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
    }, [proposedDistribution, disableChefSiat, token]);

    // Zone d'impression pour PDF
    const PrintArea = useMemo(() => {
        if (printCategory !== 'repartition-cadres' || !proposedDistribution) return null;

        return (
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
                    {disableChefSiat && <br />}
                    {disableChefSiat && <strong>Configuration: Chef SIAT désactivé</strong>}
                </p>

                {proposedDistribution.map(escadron => (
                    <div key={escadron.numero} style={{ marginBottom: '10mm', border: '1px solid #000', padding: '5mm', breakInside: 'avoid' }}>
                        <h3 style={{ fontSize: '11pt', textDecoration: 'underline', marginBottom: '3mm' }}>{`Escadron ${escadron.numero}`}</h3>

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
                                {!disableChefSiat && (
                                    <tr>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>Chef SIAT</td>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>{escadron.chefSiat?.grade || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '2mm' }}>{escadron.chefSiat ? `${escadron.chefSiat.nom} ${escadron.chefSiat.prenom}` : 'Non attribué'}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {escadron.pelotons && Array.isArray(escadron.pelotons) && escadron.pelotons.map(peloton => (
                            <div key={`${escadron.numero}-${peloton.numero}`} style={{ marginTop: '8mm', marginLeft: '5mm', borderLeft: '1px solid #ccc', paddingLeft: '3mm', breakInside: 'avoid' }}>
                                <h4 style={{ fontSize: '10pt', fontStyle: 'italic', marginBottom: '2mm' }}>{`Peloton ${peloton.numero}`}</h4>

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
                        {(!escadron.pelotons || (Array.isArray(escadron.pelotons) && escadron.pelotons.length === 0)) && (
                            <p style={{ fontStyle: 'italic', fontSize: '9pt', margin: '3mm 0' }}>Aucun peloton attribué à cet escadron.</p>
                        )}
                    </div>
                ))}
            </div>
        );
    }, [printCategory, proposedDistribution, displayDateLabel, disableChefSiat]);

    return (
        <AdminProtection>
            <div className="container mt-4">
                {/* Badge Admin en haut de page */}
                <div className="alert alert-info d-flex align-items-center mb-4">
                    <i className="fas fa-shield-alt me-2"></i>
                    <div>
                        <strong>Espace Administrateur</strong> - Gestion de la répartition des cadres
                        <br />
                        <small className="text-muted">
                            Connecté en tant que : {user?.nom} {user?.prenom || user?.name || ''}
                            ({user?.role || 'Admin'})
                        </small>
                    </div>
                </div>

                {/* Contenu visible dans le navigateur */}
                <div>
                    <h2 className="mb-4">
                        <i className="fas fa-users-cog me-2"></i>
                        Répartition Automatique des Cadres (Cours)
                    </h2>

                    <div className="mb-3">
                        <p>Journée SPA du : <strong>{displayDateLabel}</strong></p>
                    </div>

                    {/* Section de configuration et boutons */}
                    <div className="card p-4 mb-4">
                        <h4 className="card-title">
                            <i className="fas fa-cogs me-2"></i>
                            Configuration et Actions
                        </h4>

                        {/* Configuration des options */}
                        <div className="row mb-4">
                            <div className="col-md-6">
                                <h6 className="text-muted mb-3">Paramètres de Base</h6>

                                <div className="mb-3">
                                    <label htmlFor="numEscadrons" className="form-label">
                                        <i className="fas fa-calculator me-1"></i>
                                        Nombre d'Escadrons :
                                    </label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="numEscadrons"
                                        value={numEscadrons === 0 ? '' : numEscadrons}
                                        onChange={handleNumEscadronsChange}
                                        min="1"
                                        disabled={isAnyLoading}
                                        placeholder="Saisir un nombre"
                                    />
                                </div>

                                <div className="form-check mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="disableChefSiat"
                                        checked={disableChefSiat}
                                        onChange={(e) => setDisableChefSiat(e.target.checked)}
                                        disabled={isAnyLoading}
                                    />
                                    <label className="form-check-label" htmlFor="disableChefSiat">
                                        <i className="fas fa-user-slash me-1"></i>
                                        Désactiver le poste de Chef SIAT
                                    </label>
                                    <div className="form-text">
                                        Les gradés Chef SIAT seront redistribués selon la hiérarchie : GPCE , GPHC , GP1C , GP2C
                                    </div>
                                </div>
                            </div>

                            <div className="col-md-6">
                                <h6 className="text-muted mb-3">Options d'Optimisation</h6>

                                <div className="form-check mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="avoidPreviousAssignments"
                                        checked={avoidPreviousAssignments}
                                        onChange={(e) => setAvoidPreviousAssignments(e.target.checked)}
                                        disabled={isAnyLoading}
                                    />
                                    <label className="form-check-label" htmlFor="avoidPreviousAssignments">
                                        <i className="fas fa-sync-alt me-1"></i>
                                        Éviter les affectations précédentes
                                    </label>
                                    <div className="form-text">Favorise la rotation des postes</div>
                                </div>

                                <div className="form-check mb-3">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="avoidSameTeams"
                                        checked={avoidSameTeams}
                                        onChange={(e) => setAvoidSameTeams(e.target.checked)}
                                        disabled={isAnyLoading}
                                    />
                                    <label className="form-check-label" htmlFor="avoidSameTeams">
                                        <i className="fas fa-random me-1"></i>
                                        Éviter les regroupements récurrents
                                    </label>
                                    <div className="form-text">Diversifie la composition des équipes</div>
                                </div>

                                <div className="mb-3">
                                    <label htmlFor="optimizationLevel" className="form-label">
                                        <i className="fas fa-sliders-h me-1"></i>
                                        Niveau d'optimisation : {optimizationLevel}%
                                    </label>
                                    <input
                                        type="range"
                                        className="form-range"
                                        id="optimizationLevel"
                                        min="0"
                                        max="100"
                                        step="10"
                                        value={optimizationLevel}
                                        onChange={(e) => setOptimizationLevel(parseInt(e.target.value))}
                                        disabled={isAnyLoading}
                                    />
                                    <div className="form-text">
                                        Plus élevé = optimisation plus agressive (peut prendre plus de temps)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Boutons d'action */}
                        <div className="row g-3">
                            <div className="col-12">
                                <button
                                    className="btn btn-primary me-2"
                                    onClick={handleCreateDistribution}
                                    disabled={numEscadrons < 1 || isAnyLoading}
                                >
                                    <i className="fas fa-magic me-1"></i>
                                    {isLoadingCreation ? 'Création en cours...' : 'Créer la répartition'}
                                </button>
                                <button
                                    className="btn btn-success me-2"
                                    onClick={handleValidateDistribution}
                                    disabled={!proposedDistribution || isAnyLoading}
                                >
                                    <i className="fas fa-check me-1"></i>
                                    {isLoadingValidation ? 'Validation en cours...' : 'Valider la répartition'}
                                </button>
                                <button
                                    className="btn btn-info me-2"
                                    onClick={handleExportExcel}
                                    disabled={!proposedDistribution || isAnyLoading}
                                >
                                    <i className="fas fa-file-excel me-1"></i>
                                    {isExportingExcel ? 'Export Excel...' : 'Exporter en Excel'}
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={handlePrint}
                                    disabled={!proposedDistribution || isAnyLoading}
                                >
                                    <i className="fas fa-file-pdf me-1"></i>
                                    {isGeneratingPdf ? 'PDF en cours...' : 'Imprimer (PDF)'}
                                </button>
                            </div>
                        </div>

                        {/* Messages d'erreur et de chargement */}
                        {error && (
                            <div className="alert alert-danger mt-3">
                                <i className="fas fa-exclamation-triangle me-2"></i>
                                {error}
                            </div>
                        )}

                        {isAnyLoading && (
                            <div className="alert alert-info mt-3">
                                <div className="d-flex align-items-center">
                                    <div className="spinner-border spinner-border-sm me-2" role="status">
                                        <span className="visually-hidden">Chargement...</span>
                                    </div>
                                    <div>
                                        {isLoadingValidation && "Validation en cours..."}
                                        {isExportingExcel && "Exportation Excel en cours..."}
                                        {isGeneratingPdf && "Génération PDF en cours..."}
                                        {isLoadingCreation && "Création de la répartition en cours..."}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Section d'affichage de la proposition de répartition */}
                    {proposedDistribution && (
                        <div className="mt-4">
                            <h3>
                                <i className="fas fa-list-alt me-2"></i>
                                Proposition de Répartition ({numEscadrons} Escadron{numEscadrons > 1 ? 's' : ''})
                                {disableChefSiat && (
                                    <span className="badge bg-warning text-dark ms-2">
                                        <i className="fas fa-info-circle me-1"></i>
                                        Chef SIAT désactivé
                                    </span>
                                )}
                            </h3>

                            {/* Boucler sur chaque escadron */}
                            {proposedDistribution.map(escadron => (
                                <div key={escadron.numero} className="card mb-4">
                                    <div className="card-header">
                                        <h5 className="mb-0">
                                            <i className="fas fa-shield-alt me-2"></i>
                                            Escadron {escadron.numero}
                                        </h5>
                                    </div>
                                    <div className="card-body">
                                        <h6><i className="fas fa-star me-1"></i>Rôles Clés de l'Escadron :</h6>
                                        <TableauEscadron escadron={escadron} disableChefSiat={disableChefSiat} />

                                        {escadron.pelotons && Array.isArray(escadron.pelotons) && escadron.pelotons.map(peloton => (
                                            <div key={`${escadron.numero}-${peloton.numero}`} className="mb-4 ms-md-4 ps-md-3 border-start">
                                                <h6>
                                                    <i className="fas fa-users me-1"></i>
                                                    Peloton {peloton.numero}
                                                </h6>

                                                <h6 className="mt-3">Rôles Clés du Peloton :</h6>
                                                <TableauPeloton peloton={peloton} />

                                                {peloton.moniteurs && Array.isArray(peloton.moniteurs) && peloton.moniteurs.length > 0 ? (
                                                    <>
                                                        <h6 className="mt-3 mb-1">
                                                            <i className="fas fa-chalkboard-teacher me-1"></i>
                                                            Moniteurs ({peloton.moniteurs.length}) :
                                                        </h6>
                                                        <TableauMoniteurs moniteurs={peloton.moniteurs} />
                                                    </>
                                                ) : (
                                                    <div className="alert alert-info mt-2 py-2">
                                                        <i className="fas fa-info-circle me-2"></i>
                                                        Aucun moniteur attribué à ce peloton.
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {(!escadron.pelotons || (Array.isArray(escadron.pelotons) && escadron.pelotons.length === 0)) && (
                                            <div className="alert alert-warning mt-3 py-2">
                                                <i className="fas fa-exclamation-triangle me-2"></i>
                                                Aucun peloton attribué à cet escadron.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Message d'instruction si aucune proposition */}
                    {!proposedDistribution && !error && !isAnyLoading && (
                        <div className="alert alert-info mt-4">
                            <i className="fas fa-info-circle me-2"></i>
                            Configurez les paramètres et cliquez sur "Créer la répartition" pour générer une proposition optimisée.
                        </div>
                    )}
                </div>

                {/* Zone cachée pour PDF */}
                {PrintArea}
            </div>
        </AdminProtection>
    );
}

export default RepartitionCadresPage;