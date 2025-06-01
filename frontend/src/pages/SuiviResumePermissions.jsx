import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { format, differenceInDays } from 'date-fns';

function SuiviResumePermissions() {
    const { user, token, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // États pour la modale de détails
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedCadreDetails, setSelectedCadreDetails] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

    // Fonction utilitaire pour nettoyer l'URL de base (supprimer le slash final s'il existe)
    const cleanBaseUrl = (url) => {
        return url.endsWith('/') ? url.slice(0, -1) : url;
    };

    const isAdmin = user && user.role === 'Admin';

    useEffect(() => {
        if (!isAuthenticated || !isAdmin) {
            navigate('/login');
        }
    }, [isAuthenticated, isAdmin, navigate]);

    useEffect(() => {
        if (isAuthenticated && isAdmin) {
            fetchPermissionSummary();
        } else if (isAuthenticated && !isAdmin) {
            setLoading(false);
            setError('Vous n\'avez pas les permissions nécessaires pour accéder à cette page.');
        } else {
            setLoading(false);
        }
    }, [isAuthenticated, isAdmin, token]);

    const fetchPermissionSummary = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = `${cleanBaseUrl(API_BASE_URL)}/api/permissions/summary-by-cadre`;
            console.log("DEBUG: Appel API pour le résumé des permissions:", url);
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setSummaryData(response.data);
        } catch (err) {
            console.error('Erreur lors de la récupération du résumé des permissions:', err);
            setError('Erreur lors du chargement du résumé des permissions. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetails = async (cadreId) => {
        setDetailsLoading(true);
        setDetailsError(null);
        setSelectedCadreDetails(null);
        setShowDetailsModal(true); // Ouvrir la modale immédiatement pour montrer le chargement

        try {
            const url = `${cleanBaseUrl(API_BASE_URL)}/api/permissions/details-by-cadre/${cadreId}`;
            console.log("DEBUG: Appel API pour les détails du cadre:", url);
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setSelectedCadreDetails(response.data);
        } catch (err) {
            console.error(`Erreur lors de la récupération des détails pour le cadre ${cadreId}:`, err);
            setDetailsError('Erreur lors du chargement des détails des permissions. Veuillez réessayer.');
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleCloseDetailsModal = () => {
        setShowDetailsModal(false);
        setSelectedCadreDetails(null);
        setDetailsError(null);
    };

    if (loading && (!isAuthenticated || !isAdmin)) {
        return (
            <div className="container mt-4">
                <div className="alert alert-info">Vérification des permissions...</div>
            </div>
        );
    }

    if (!isAuthenticated || !isAdmin) {
        return (
            <div className="container mt-4">
                <div className="alert alert-danger">Accès refusé. Cette page est réservée aux administrateurs.</div>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            <h2 className="mb-4">Résumé des Permissions par Cadre ({new Date().getFullYear()})</h2>

            {loading && <div className="alert alert-info">Chargement du résumé...</div>}
            {error && <div className="alert alert-danger">{error}</div>}

            {!loading && !error && summaryData.length === 0 && (
                <div className="alert alert-warning">Aucune donnée de permission trouvée pour cette année.</div>
            )}

            {!loading && !error && summaryData.length > 0 && (
                <div className="table-responsive">
                    <table className="table table-striped table-hover">
                        <thead className="table-dark">
                            <tr>
                                <th>ID Cadre</th>
                                <th>Grade</th>
                                <th>Nom Prénom</th>
                                <th>Matricule</th>
                                <th>Service/Entité</th>
                                <th>Total Jours Pris</th> {/* Nouvelle colonne */}
                                <th>Nb. Insertions</th>   {/* Nouvelle colonne */}
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {summaryData.map(item => (
                                <tr key={item.cadre_id}>
                                    <td>{item.Cadre.id}</td>
                                    <td>{item.Cadre.grade}</td>
                                    <td>{item.Cadre.nom} {item.Cadre.prenom}</td>
                                    <td>{item.Cadre.matricule}</td>
                                    <td>{item.Cadre.service || item.Cadre.entite}</td>
                                    <td>{item.totalJoursPermissionAnnee}</td> {/* Donnée des jours */}
                                    <td>{item.nombrePermissions}</td>       {/* Donnée des insertions */}
                                    <td>
                                        <button
                                            className="btn btn-info btn-sm"
                                            onClick={() => handleViewDetails(item.cadre_id)}
                                        >
                                            Détails
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modale de détails des permissions */}
            <Modal show={showDetailsModal} onHide={handleCloseDetailsModal} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Détails des Permissions pour {selectedCadreDetails?.cadre.nom} {selectedCadreDetails?.cadre.prenom}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {detailsLoading && (
                        <div className="text-center my-3">
                            <Spinner animation="border" role="status">
                                <span className="visually-hidden">Chargement des détails...</span>
                            </Spinner>
                            <p className="mt-2">Chargement des détails...</p>
                        </div>
                    )}
                    {detailsError && <div className="alert alert-danger">{detailsError}</div>}
                    {selectedCadreDetails && !detailsLoading && !detailsError && (
                        <>
                            <p><strong>Cadre:</strong> {selectedCadreDetails.cadre.grade} {selectedCadreDetails.cadre.nom} {selectedCadreDetails.cadre.prenom}</p>
                            <p><strong>Matricule:</strong> {selectedCadreDetails.cadre.matricule}</p>
                            <p><strong>Service:</strong> {selectedCadreDetails.cadre.service || selectedCadreDetails.cadre.entite}</p>

                            <h5 className="mt-4">Permissions de l'année ({new Date().getFullYear()})</h5>
                            {selectedCadreDetails.permissions.length > 0 ? (
                                <table className="table table-bordered table-sm">
                                    <thead className="table-light">
                                        <tr>
                                            <th>ID Perm.</th>
                                            <th>Date Départ</th>
                                            <th>Date Arrivée</th>
                                            <th>Jours Pris</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedCadreDetails.permissions.map(perm => (
                                            <tr key={perm.id}>
                                                <td>{perm.id}</td>
                                                <td>{format(new Date(perm.dateDepartPerm), 'dd/MM/yyyy')}</td>
                                                <td>{format(new Date(perm.dateArriveePerm), 'dd/MM/yyyy')}</td>
                                                <td>{perm.joursPrisPerm}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="alert alert-warning">Aucune permission enregistrée pour ce cadre cette année.</p>
                            )}
                        </>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseDetailsModal}>
                        Fermer
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default SuiviResumePermissions;