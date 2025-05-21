import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './RightSidebar.css'; // Importez votre fichier CSS

function RightSidebar() {
    const { token, user } = useAuth();
    const isAdmin = user && user.role === 'Admin';

    const [userStatuses, setUserStatuses] = useState({
        completed: [],
        pending: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userSubmissionDetails, setUserSubmissionDetails] = useState([]);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [detailsError, setDetailsError] = useState(null);

    // New state for sidebar visibility
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Commence fermé par défaut
    const [isMobile, setIsMobile] = useState(false); // État pour détecter les écrans mobiles

    const sidebarRef = useRef(null);
    const toggleButtonRef = useRef(null);

    const API_BASE_URL = 'http://localhost:3000';
    const API_STATUS_URL = `${API_BASE_URL}/api/status/daily-updates`;

    // Gestion des clics en dehors de la sidebar
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isSidebarOpen &&
                !sidebarRef.current.contains(event.target) &&
                (!toggleButtonRef.current || !toggleButtonRef.current.contains(event.target))) {
                setIsSidebarOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isSidebarOpen]);

    const formatUpdateDateTime = (timestamp) => {
        if (!timestamp) return 'Non disponible';
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return 'Date invalide';

            return new Intl.DateTimeFormat('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }).format(date);
        } catch (e) {
            console.error("Erreur de formatage de date:", e);
            return 'Format invalide';
        }
    };

    const getTodayDateString = () => {
        const today = new Date();
        return [
            today.getFullYear(),
            String(today.getMonth() + 1).padStart(2, '0'),
            String(today.getDate()).padStart(2, '0')
        ].join('-');
    };

    const fetchUserStatuses = async () => {
        setIsLoading(true);
        setError(null);

        if (!token) {
            setError("Authentification requise pour récupérer les statuts.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(API_STATUS_URL, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue.' }));
                throw new Error(
                    response.status === 404
                        ? 'Service de statut indisponible ou aucune donnée.'
                        : `Erreur ${response.status}: ${errorData.message || response.statusText}`
                );
            }

            const data = await response.json();
            setUserStatuses({
                completed: data.completed || [],
                pending: data.pending || []
            });
        } catch (err) {
            console.error('Erreur lors de la récupération des statuts:', err);
            setError(err.message);
            setUserStatuses({ completed: [], pending: [] });
        } finally {
            setIsLoading(false);
        }
    };

    const fetchUserSubmissionDetails = async (userId) => {
        setIsLoadingDetails(true);
        setDetailsError(null);

        if (!isAdmin || !token) {
            setDetailsError("Accès non autorisé pour les détails des soumissions.");
            setIsLoadingDetails(false);
            return;
        }

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/mises-a-jour/users/${userId}/submissions?date=${getTodayDateString()}`,
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue.' }));
                throw new Error(`Erreur ${response.status}: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            setUserSubmissionDetails(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Erreur lors de la récupération des détails de soumission:', err);
            setDetailsError(err.message);
            setUserSubmissionDetails([]);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleCompletedUserClick = async (userToSelect) => {
        if (!isAdmin) {
            console.log("Accès aux détails refusé : l'utilisateur n'est pas un administrateur.");
            return;
        }
        setSelectedUser(userToSelect);
        setShowDetailsModal(true);
        await fetchUserSubmissionDetails(userToSelect.id);
    };

    const handleCloseDetailsModal = () => {
        setShowDetailsModal(false);
        setSelectedUser(null);
        setUserSubmissionDetails([]);
        setDetailsError(null);
    };

    // --- Fonctions de gestion de la visibilité du sidebar ---
    const handleMouseEnter = () => {
        if (!isMobile) { // Ouvre au survol seulement sur les grands écrans
            setIsSidebarOpen(true);
        }
    };

    const handleMouseLeave = () => {
        if (!isMobile) { // Ferme à la sortie du survol seulement sur les grands écrans
            setIsSidebarOpen(false);
        }
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {
        fetchUserStatuses();

        const intervalId = setInterval(fetchUserStatuses, 30000);

        const handleResize = () => {
            // Définissez votre breakpoint pour mobile, par exemple 768px
            if (window.innerWidth <= 768) {
                setIsMobile(true);
                setIsSidebarOpen(false); // Cacher par défaut sur mobile
            } else {
                setIsMobile(false);
                setIsSidebarOpen(false); // Caché par défaut sur desktop aussi, s'ouvre au survol
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize(); // Appeler une fois au montage pour définir l'état initial

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', handleResize);
        };
    }, [token]);

    return (
        <>
            {/* Bouton de bascule pour mobile, visible uniquement sur les petits écrans */}
            {isMobile && (
                <button
                    ref={toggleButtonRef}
                    className="btn btn-primary position-fixed bottom-0 end-0 m-3 sidebar-toggle-button"
                    onClick={toggleSidebar}
                    style={{zIndex: 1000}}
                >
                    {isSidebarOpen ? <i className="bi bi-x-lg"></i> : <i className="bi bi-list"></i>} Statut
                </button>
            )}

            <div
                ref={sidebarRef}
                className={`d-flex flex-column flex-shrink-0 p-3 bg-light right-sidebar-custom overflow-y-auto ${isSidebarOpen ? 'open' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="sidebar-content"> {/* Nouveau conteneur pour le contenu interne */}
                    <h5 className="text-center mb-3">Statut des Mises à Jour</h5>
                    <hr />

                    {isLoading && !error && (
                        <div className="text-center">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Chargement...</span>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-danger text-center">
                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                            {error}
                        </div>
                    )}

                    {!isLoading && !error && (
                        <>
                            <div className="mb-4">
                                <h6>
                                    <span className="badge bg-success me-2">
                                        {userStatuses.completed.length}
                                    </span>
                                    Terminés
                                </h6>

                                {userStatuses.completed.length > 0 ? (
                                    <ul className="list-unstyled">
                                        {userStatuses.completed.map(user => (
                                            <li
                                                key={user.id}
                                                className={`d-flex justify-content-between align-items-center py-2 px-3 mb-2 bg-white rounded ${isAdmin ? 'clickable-item' : ''}`}
                                                onClick={isAdmin ? () => handleCompletedUserClick(user) : undefined}
                                                style={!isAdmin ? { cursor: 'default' } : {}}
                                            >
                                                <div>
                                                    <i className="bi bi-check-circle-fill text-success me-2"></i>
                                                    <span>{user.username}</span>
                                                </div>
                                                {isAdmin && user.dailySubmissionCount > 1 && (
                                                    <div className="text-end">
                                                        <small className="text-muted d-block">
                                                            {formatUpdateDateTime(user.updatedAt)}
                                                        </small>
                                                        <span
                                                            className="badge bg-primary rounded-pill ms-2"
                                                            title={`${user.dailySubmissionCount} soumissions`}
                                                        >
                                                            +{user.dailySubmissionCount - 1}
                                                        </span>
                                                    </div>
                                                )}
                                                {!isAdmin && (
                                                    <div className="text-end">
                                                        <small className="text-muted d-block">
                                                            {formatUpdateDateTime(user.updatedAt)}
                                                        </small>
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="alert alert-info mb-0">
                                        Aucune mise à jour terminée
                                    </div>
                                )}
                            </div>

                            <div>
                                <h6>
                                    <span className="badge bg-warning text-dark me-2">
                                        {userStatuses.pending.length}
                                    </span>
                                    En attente
                                </h6>

                                {userStatuses.pending.length > 0 ? (
                                    <ul className="list-unstyled">
                                        {userStatuses.pending.map(user => (
                                            <li
                                                key={user.id}
                                                className="d-flex align-items-center py-2 px-3 mb-2 bg-white rounded"
                                            >
                                                <i className="bi bi-exclamation-circle-fill text-warning me-2"></i>
                                                <span>{user.username}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="alert alert-success mb-0">
                                        Toutes les mises à jour sont terminées
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {showDetailsModal && (
                    <div
                        className="modal fade show"
                        style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
                        onClick={handleCloseDetailsModal}
                    >
                        <div
                            className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-content">
                                <div className="modal-header bg-primary text-white">
                                    <h5 className="modal-title">
                                        Détails des soumissions pour {selectedUser?.username || 'Utilisateur'} - {getTodayDateString()}
                                    </h5>
                                    <button
                                        type="button"
                                        className="btn-close btn-close-white"
                                        onClick={handleCloseDetailsModal}
                                    ></button>
                                </div>

                                <div className="modal-body">
                                    {isLoadingDetails ? (
                                        <div className="text-center py-4">
                                            <div className="spinner-border text-primary" role="status">
                                                <span className="visually-hidden">Chargement...</span>
                                            </div>
                                        </div>
                                    ) : detailsError ? (
                                        <div className="alert alert-danger">
                                            <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                            {detailsError}
                                        </div>
                                    ) : userSubmissionDetails.length > 0 ? (
                                        <div className="list-group">
                                            {userSubmissionDetails.map((submission, index) => (
                                                <div
                                                    key={submission.id || index}
                                                    className="list-group-item mb-3 rounded"
                                                >
                                                    <div className="d-flex justify-content-between mb-2">
                                                        <strong>Soumission #{index + 1}</strong>
                                                        <span className={`badge ${submission.status === 'Validée' ? 'bg-success' : 'bg-warning text-dark'}`}>
                                                            {submission.status || 'En attente'}
                                                        </span>
                                                    </div>

                                                    {submission.SubmittedBy && (
                                                        <div className="mb-1">
                                                            <i className="bi bi-person-fill me-2"></i>
                                                            Soumis par :
                                                            <strong>
                                                                {submission.SubmittedBy.nom_complet || submission.SubmittedBy.username}
                                                                {` (${submission.SubmittedBy.username})`}
                                                            </strong>
                                                            {submission.SubmittedBy.Cadre?.fonction && (
                                                                <small className="text-muted ms-2">({submission.SubmittedBy.Cadre.fonction})</small>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="mb-1">
                                                        <small className="text-muted">
                                                            Soumis le: {formatUpdateDateTime(submission.created_at)}
                                                        </small>
                                                    </div>

                                                    {submission.status === 'Validée' && submission.ValidatedBy && (
                                                        <div className="mb-1">
                                                            <i className="bi bi-check-circle-fill text-success me-2"></i> Validé par: <strong>{submission.ValidatedBy.username}</strong>
                                                            {submission.validation_date && (
                                                                <small className="text-muted ms-2">Le: {formatUpdateDateTime(submission.validation_date)}</small>
                                                            )}
                                                        </div>
                                                    )}

                                                    {submission.Cadre && (
                                                        <div className="mb-1">
                                                            <i className="bi bi-building me-2"></i>
                                                            Cadre concerné:
                                                            <strong>
                                                                {submission.Cadre?.nom ? `${submission.Cadre.nom}${submission.Cadre.prenom ? ' ' + submission.Cadre.prenom : ''}` : 'Nom inconnu'}
                                                            </strong>
                                                            {submission.Cadre.fonction && (
                                                                <small className="text-muted ms-2">({submission.Cadre.fonction})</small>
                                                            )}
                                                        </div>
                                                    )}
                                                    {submission.statut_absence_cadre && (
                                                        <div className="mb-1">
                                                            <i className="bi bi-person-slash me-2"></i> Statut d'absence du cadre: <strong>{submission.statut_absence_cadre}</strong>
                                                        </div>
                                                    )}
                                                    {submission.commentaire && (
                                                        <div className="mb-1">
                                                            <i className="bi bi-chat-dots me-2"></i> Commentaire: <em>{submission.commentaire}</em>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="alert alert-info">
                                            Aucun détail de soumission disponible pour {selectedUser?.username || 'cet utilisateur'} à cette date.
                                        </div>
                                    )}
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={handleCloseDetailsModal}
                                    >
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

export default RightSidebar;