import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import './RightSidebar.css';

function RightSidebar() {
    const { token, user } = useAuth();
    // ✅ MODIFICATION - Admin ET Consultant peuvent tout voir
    const isAdminOrConsultant = user && (user.role === 'Admin' || user.role === 'Consultant');

    // États pour les admins/consultants (vue de tous les utilisateurs)
    const [userStatuses, setUserStatuses] = useState({
        completed: [],
        pending: []
    });

    // États pour les utilisateurs standards (leurs propres soumissions)
    const [mySubmissions, setMySubmissions] = useState([]);

    // ✅ NOUVEAU - État pour plier/déplier les soumissions
    const [isSubmissionsExpanded, setIsSubmissionsExpanded] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userSubmissionDetails, setUserSubmissionDetails] = useState([]);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [detailsError, setDetailsError] = useState(null);

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const sidebarRef = useRef(null);
    const toggleButtonRef = useRef(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const API_STATUS_URL = `${(API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL)}/api/status/daily-updates`;

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

    // ✅ NOUVEAU - Fonction pour plier/déplier les soumissions
    const toggleSubmissionsExpanded = () => {
        setIsSubmissionsExpanded(!isSubmissionsExpanded);
    };

    // Fonction pour récupérer les propres soumissions de l'utilisateur
    const fetchMySubmissions = async () => {
        console.log('[RightSidebar] === DÉBUT fetchMySubmissions ===');
        setIsLoading(true);
        setError(null);

        if (!token || !user || !user.id) {
            setError("Authentification requise pour récupérer vos soumissions.");
            setIsLoading(false);
            return;
        }

        try {
            const apiUrl = `${API_BASE_URL}api/status/users/${user.id}/submissions?date=${getTodayDateString()}`;
            console.log('[RightSidebar] URL API appelée:', apiUrl);
            console.log('[RightSidebar] User ID:', user.id);
            console.log('[RightSidebar] Token présent:', !!token);

            const response = await fetch(apiUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log('[RightSidebar] Réponse reçue, status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue.' }));
                throw new Error(`Erreur ${response.status}: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            console.log('[RightSidebar] Données reçues:', data);
            console.log('[RightSidebar] Nombre de soumissions:', data.length);

            setMySubmissions(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[RightSidebar] ❌ Erreur lors de la récupération de vos soumissions:', err);
            setError(err.message);
            setMySubmissions([]);
        } finally {
            setIsLoading(false);
        }
    };

    // Fonction pour les admins/consultants
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

    // Fonction pour récupérer les détails des soumissions (admin/consultant)
    const fetchUserSubmissionDetails = async (userId) => {
        console.log('[RightSidebar] === DÉBUT fetchUserSubmissionDetails ===');
        setIsLoadingDetails(true);
        setDetailsError(null);

        // ✅ MODIFICATION - Admin OU Consultant peuvent voir
        if (!isAdminOrConsultant || !token) {
            setDetailsError("Accès non autorisé pour les détails des soumissions.");
            setIsLoadingDetails(false);
            return;
        }

        try {
            const apiUrl = `${API_BASE_URL}api/status/users/${userId}/submissions?date=${getTodayDateString()}`;
            console.log('[RightSidebar] URL API détails appelée:', apiUrl);

            const response = await fetch(apiUrl, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Erreur inconnue.' }));
                throw new Error(`Erreur ${response.status}: ${errorData.message || response.statusText}`);
            }

            const data = await response.json();
            console.log('[RightSidebar] Détails reçus:', data);
            setUserSubmissionDetails(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('[RightSidebar] ❌ Erreur lors de la récupération des détails de soumission:', err);
            setDetailsError(err.message);
            setUserSubmissionDetails([]);
        } finally {
            setIsLoadingDetails(false);
        }
    };

    const handleCompletedUserClick = async (userToSelect) => {
        // ✅ MODIFICATION - Admin OU Consultant peuvent cliquer
        if (!isAdminOrConsultant) {
            console.log("Accès aux détails refusé : l'utilisateur n'est ni administrateur ni consultant.");
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

    const handleMouseEnter = () => {
        if (!isMobile) {
            setIsSidebarOpen(true);
        }
    };

    const handleMouseLeave = () => {
        if (!isMobile) {
            setIsSidebarOpen(false);
        }
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    useEffect(() => {
        console.log('[RightSidebar] useEffect déclenché');
        console.log('[RightSidebar] isAdminOrConsultant:', isAdminOrConsultant);
        console.log('[RightSidebar] user:', user);
        console.log('[RightSidebar] token présent:', !!token);

        // ✅ MODIFICATION - Charger selon le rôle (Admin/Consultant vs Standard)
        if (isAdminOrConsultant) {
            console.log('[RightSidebar] Chargement vue admin/consultant');
            fetchUserStatuses(); // Vue globale pour les admins/consultants
        } else {
            console.log('[RightSidebar] Chargement mes soumissions');
            fetchMySubmissions(); // Mes soumissions pour les utilisateurs standards
        }

        const intervalId = setInterval(() => {
            if (isAdminOrConsultant) {
                fetchUserStatuses();
            } else {
                fetchMySubmissions();
            }
        }, 30000);

        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsMobile(true);
                setIsSidebarOpen(false);
            } else {
                setIsMobile(false);
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', handleResize);
        };
    }, [token, isAdminOrConsultant, user]);

    // ✅ NOUVELLE FONCTION - Affichage de qui a fait la mise à jour
    const renderUpdaterInfo = (submission) => {
        if (!submission.is_updated_by_responsible && submission.ActualUpdater) {
            // Mise à jour par un consultant (gradé de semaine)
            return (
                <div className="mb-2">
                    <i className="bi bi-person-badge text-warning me-2"></i>
                    <strong>Mise à jour par le gradé de semaine:</strong>
                    <span className="ms-1 fw-bold text-warning">
                        {submission.ActualUpdater.username}
                    </span>
                    {submission.ActualUpdater.nom && submission.ActualUpdater.prenom && (
                        <span className="text-muted ms-1">
                            ({submission.ActualUpdater.nom} {submission.ActualUpdater.prenom})
                        </span>
                    )}
                    {submission.actual_updater_grade && (
                        <span className="badge bg-warning text-dark ms-2">
                            {submission.actual_updater_grade}
                        </span>
                    )}
                </div>
            );
        } else {
            // Mise à jour par le responsable
            return (
                <div className="mb-2">
                    <i className="bi bi-person-fill text-primary me-2"></i>
                    <strong>Mise à jour par le responsable:</strong>
                    <span className="ms-1 fw-bold text-success">
                        {user?.username || 'Vous'}
                    </span>
                    {user?.nom && user?.prenom && (
                        <span className="text-muted ms-1">
                            ({user.nom} {user.prenom})
                        </span>
                    )}
                </div>
            );
        }
    };

    return (
        <>
            {isMobile && (
                <button
                    ref={toggleButtonRef}
                    className="btn btn-primary position-fixed bottom-0 end-0 m-3 sidebar-toggle-button"
                    onClick={toggleSidebar}
                    style={{zIndex: 1000}}
                >
                    {isSidebarOpen ? <i className="bi bi-x-lg"></i> : <i className="bi bi-list"></i>}
                    {isAdminOrConsultant ? ' Statut' : ' Mes Soumissions'}
                </button>
            )}

            <div
                ref={sidebarRef}
                className={`d-flex flex-column flex-shrink-0 p-3 bg-light right-sidebar-custom overflow-y-auto ${isSidebarOpen ? 'open' : ''}`}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="sidebar-content">
                    <h5 className="text-center mb-3">
                        {isAdminOrConsultant ? 'Statut des Mises à Jour' : 'Mes Soumissions'}
                    </h5>
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
                            {/* ✅ AFFICHAGE CONDITIONNEL - Admin/Consultant vs Utilisateur Standard */}
                            {isAdminOrConsultant ? (
                                // Vue Admin/Consultant - Statuts de tous les utilisateurs
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
                                                        className={`d-flex justify-content-between align-items-center py-2 px-3 mb-2 bg-white rounded ${isAdminOrConsultant ? 'clickable-item' : ''}`}
                                                        onClick={isAdminOrConsultant ? () => handleCompletedUserClick(user) : undefined}
                                                        style={!isAdminOrConsultant ? { cursor: 'default' } : {}}
                                                    >
                                                        <div>
                                                            <i className="bi bi-check-circle-fill text-success me-2"></i>
                                                            <span>{user.username}</span>
                                                        </div>
                                                        {isAdminOrConsultant && user.dailySubmissionCount > 1 && (
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
                                                        {!isAdminOrConsultant && (
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
                            ) : (
                                // Vue Utilisateur Standard - Ses propres soumissions DÉTAILLÉES
                                <div className="mb-4">
                                    {/* ✅ NOUVEAU - En-tête cliquable pour plier/déplier */}
                                    <div
                                        className="d-flex justify-content-between align-items-center mb-3 p-2 bg-white rounded shadow-sm"
                                        onClick={toggleSubmissionsExpanded}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <h6 className="mb-0">
                                            <span className="badge bg-info me-2">
                                                {mySubmissions.length}
                                            </span>
                                            Mes soumissions d'aujourd'hui
                                        </h6>
                                        <i className={`bi ${isSubmissionsExpanded ? 'bi-chevron-up' : 'bi-chevron-down'} text-primary`}></i>
                                    </div>

                                    {/* ✅ CONTENU PLIABLE */}
                                    {isSubmissionsExpanded && (
                                        <>
                                            {mySubmissions.length > 0 ? (
                                                <ul className="list-unstyled">
                                                    {mySubmissions.map((submission, index) => (
                                                        <li key={submission.id || index} className="py-3 px-3 mb-3 bg-white rounded border shadow-sm">
                                                            <div className="d-flex flex-column">
                                                                {/* En-tête de la soumission */}
                                                                <div className="d-flex justify-content-between align-items-center mb-2">
                                                                    <div className="d-flex align-items-center">
                                                                        <i className={`bi ${
                                                                            submission.status === 'Validée' || submission.status === 'validé' ? 'bi-check-circle-fill text-success' :
                                                                            submission.status === 'Rejetée' || submission.status === 'rejeté' ? 'bi-x-circle-fill text-danger' :
                                                                            'bi-clock text-warning'
                                                                        } me-2`}></i>
                                                                        <span className="fw-bold text-primary">
                                                                            Soumission #{index + 1}
                                                                        </span>
                                                                    </div>
                                                                    {submission.status && (
                                                                        <span className={`badge ${
                                                                            submission.status === 'Validée' || submission.status === 'validé' ? 'bg-success' :
                                                                            submission.status === 'Rejetée' || submission.status === 'rejeté' ? 'bg-danger' :
                                                                            'bg-warning text-dark'
                                                                        }`}>
                                                                            {submission.status || 'En attente'}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {/* Détails de la soumission */}
                                                                <div className="ms-3">
                                                                    {/* ✅ MODIFIÉ - Affichage de qui a fait la mise à jour */}
                                                                    {renderUpdaterInfo(submission)}

                                                                    {/* Sur quel cadre */}
                                                                    {submission.Cadre && (
                                                                        <div className="mb-2">
                                                                            <i className="bi bi-person-badge text-info me-2"></i>
                                                                            <strong>Cadre mis à jour:</strong>
                                                                            <div className="ms-4 mt-1">
                                                                                {submission.Cadre.matricule && (
                                                                                    <span className="badge bg-secondary me-2">
                                                                                        {submission.Cadre.matricule}
                                                                                    </span>
                                                                                )}
                                                                                <span className="fw-bold">
                                                                                    {submission.Cadre.nom || 'Nom inconnu'}
                                                                                    {submission.Cadre.prenom && ` ${submission.Cadre.prenom}`}
                                                                                </span>
                                                                                {submission.Cadre.grade && (
                                                                                    <span className="text-muted ms-2">
                                                                                        ({submission.Cadre.grade})
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* Date et heure de soumission */}
                                                                    <div className="mb-2">
                                                                        <i className="bi bi-calendar-check text-success me-2"></i>
                                                                        <strong>Soumis le:</strong>
                                                                        <span className="ms-1">
                                                                            {formatUpdateDateTime(submission.created_at)}
                                                                        </span>
                                                                    </div>

                                                                    {/* Informations de validation */}
                                                                    {submission.ValidatedBy && (
                                                                        <div className="mb-2">
                                                                            <i className="bi bi-person-check text-success me-2"></i>
                                                                            <strong>Validé par:</strong>
                                                                            <span className="ms-1 fw-bold text-success">
                                                                                {submission.ValidatedBy.username}
                                                                            </span>
                                                                            {submission.ValidatedBy.nom && submission.ValidatedBy.prenom && (
                                                                                <span className="text-muted ms-1">
                                                                                    ({submission.ValidatedBy.nom} {submission.ValidatedBy.prenom})
                                                                                </span>
                                                                            )}
                                                                            {submission.validation_date && (
                                                                                <div className="ms-4 mt-1">
                                                                                    <small className="text-muted">
                                                                                        <i className="bi bi-clock me-1"></i>
                                                                                        Le: {formatUpdateDateTime(submission.validation_date)}
                                                                                    </small>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Commentaire éventuel */}
                                                                    {submission.commentaire && (
                                                                        <div className="mb-2">
                                                                            <i className="bi bi-chat-dots text-info me-2"></i>
                                                                            <strong>Commentaire:</strong>
                                                                            <div className="ms-4 mt-1 p-2 bg-light rounded">
                                                                                <em className="text-muted">{submission.commentaire}</em>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Ligne de séparation pour les soumissions multiples */}
                                                                {index < mySubmissions.length - 1 && (
                                                                    <hr className="mt-3 mb-0" />
                                                                )}
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <div className="text-center py-4">
                                                    <i className="bi bi-inbox text-muted" style={{fontSize: '3rem'}}></i>
                                                    <h6 className="text-muted mt-3">Aucune soumission aujourd'hui</h6>
                                                    <p className="text-muted mb-0">
                                                        Vos soumissions de mise à jour apparaîtront ici
                                                    </p>
                                                    <small className="text-muted">
                                                        Date: {getTodayDateString()}
                                                    </small>
                                                </div>
                                            )}

                                            {/* Résumé en bas */}
                                            {mySubmissions.length > 0 && (
                                                <div className="mt-3 p-2 bg-light rounded">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <small className="text-muted">
                                                            <i className="bi bi-clock me-1"></i>
                                                            Dernière mise à jour automatique il y a quelques secondes
                                                        </small>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* ✅ APERÇU QUAND REPLIÉ */}
                                    {!isSubmissionsExpanded && mySubmissions.length > 0 && (
                                        <div className="mt-2 p-2 bg-light rounded">
                                            <small className="text-muted">
                                                <i className="bi bi-info-circle me-1"></i>
                                                Cliquez sur le nombre de soumissions pour voir les détails
                                            </small>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Modal pour les détails des soumissions (Admin/Consultant seulement) */}
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

                                                    {/* ✅ MODIFIÉ - Affichage de qui a fait la mise à jour dans la modal */}
                                                    {submission.is_updated_by_responsible ? (
                                                        <div className="mb-1">
                                                            <i className="bi bi-person-fill me-2"></i>
                                                            Soumis par le responsable :
                                                            <strong>
                                                                {submission.SubmittedBy?.nom_complet || submission.SubmittedBy?.username}
                                                                {submission.SubmittedBy?.username && ` (${submission.SubmittedBy.username})`}
                                                            </strong>
                                                            {submission.SubmittedBy?.Cadre?.fonction && (
                                                                <small className="text-muted ms-2">({submission.SubmittedBy.Cadre.fonction})</small>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="mb-1">
                                                            <i className="bi bi-person-badge text-warning me-2"></i>
                                                            Mise à jour par le gradé de semaine :
                                                            <strong className="text-warning">
                                                                {submission.ActualUpdater?.username || 'Consultant'}
                                                                {submission.ActualUpdater?.nom && submission.ActualUpdater?.prenom &&
                                                                    ` (${submission.ActualUpdater.nom} ${submission.ActualUpdater.prenom})`
                                                                }
                                                            </strong>
                                                            {submission.actual_updater_grade && (
                                                                <span className="badge bg-warning text-dark ms-2">
                                                                    {submission.actual_updater_grade}
                                                                </span>
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