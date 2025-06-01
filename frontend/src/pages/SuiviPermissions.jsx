import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom'; // Importez useNavigate

function SuiviPermissions() {
    const { user, token, loading: authLoading } = useAuth();
    const navigate = useNavigate(); // Initialisez useNavigate
    const [permissions, setPermissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [filters, setFilters] = useState({
        dateDepart: '',
        dateFin: '',
        cadreId: '',
        nomCadre: '',
        matriculeCadre: '',
        service: '',
        escadronId: '',
    });
    const [showArriveeForm, setShowArriveeForm] = useState(false);
    const [selectedPermissionId, setSelectedPermissionId] = useState(null);
    const [referenceArrivee, setReferenceArrivee] = useState('');
    const [arriveeError, setArriveeError] = useState(null);
    const [confirmationMessage, setConfirmationMessage] = useState(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

    useEffect(() => {
        if (authLoading) {
            return;
        }

        if (!user || user.role !== 'Admin') {
            console.warn("Accès non autorisé: Seuls les administrateurs peuvent voir cette page.");
            setError("Vous n'avez pas les permissions nécessaires pour accéder à cette page.");
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 2000);
            setLoading(false);
            return;
        }

        fetchPermissions();
    }, [filters, user, token, authLoading, navigate]);

    const fetchPermissions = async () => {
        setLoading(true);
        setError(null);
        setConfirmationMessage(null);

        const queryParams = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            if (filters[key] !== '' && filters[key] !== null && filters[key] !== undefined) {
                const value = typeof filters[key] === 'string' ? filters[key].trim() : filters[key];
                if (value !== '') {
                    queryParams.append(key, value);
                }
            }
        });

        const queryString = queryParams.toString();
        const url = `${API_BASE_URL}api/permissions${queryString ? `?${queryString}` : ''}`;

        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const permissionsWithCalculatedDelay = response.data.map(perm => {
                let joursRetard = 0;
                if (!perm.referenceMessageArrivee) {
                    const dateArriveePrevue = new Date(perm.dateArriveePerm);
                    const today = new Date();
                    dateArriveePrevue.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);

                    if (today > dateArriveePrevue) {
                        joursRetard = differenceInDays(today, dateArriveePrevue);
                    }
                }
                return { ...perm, joursRetard };
            });
            setPermissions(permissionsWithCalculatedDelay);
        } catch (err) {
            console.error('Erreur lors de la récupération des permissions:', err);
            if (err.response) {
                if (err.response.status === 404) {
                    setError('Erreur 404: La ressource de permissions est introuvable sur le serveur. Vérifiez l\'URL et la route backend.');
                } else if (err.response.status === 403) {
                    setError("Vous n'avez pas les permissions nécessaires pour accéder à cette ressource. (Problème backend)");
                } else if (err.response.status === 401) {
                    setError("Session expirée ou non autorisée. Veuillez vous reconnecter.");
                    navigate('/login');
                } else {
                    setError('Erreur lors du chargement des permissions: ' + (err.response.data?.message || err.message));
                }
            } else {
                setError('Erreur réseau ou serveur inaccessible: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({
            ...prevFilters,
            [name]: value
        }));
    };

    const handleArriveeClick = (permissionId) => {
        setSelectedPermissionId(permissionId);
        setShowArriveeForm(true);
        setReferenceArrivee('');
        setArriveeError(null);
    };

    const handleEnregistrerArrivee = async (e) => {
        e.preventDefault();
        setArriveeError(null);
        setConfirmationMessage(null);

        if (!referenceArrivee.trim()) {
            setArriveeError('La référence du message d\'arrivée est requise.');
            return;
        }

        try {
            await axios.post(`${API_BASE_URL}api/permissions/${selectedPermissionId}/arrivee`, {
                referenceMessageArrivee: referenceArrivee
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            setConfirmationMessage('Référence d\'arrivée enregistrée avec succès.');
            setShowArriveeForm(false);
            setSelectedPermissionId(null);
            fetchPermissions();
        } catch (err) {
            console.error('Erreur lors de l\'enregistrement de la référence d\'arrivée:', err);
            setArriveeError(err.response?.data?.message || 'Erreur lors de l\'enregistrement.');
        }
    };

    const isAdmin = user && user.role === 'Admin';

    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const toggleAdvancedFilters = () => {
        setShowAdvancedFilters(!showAdvancedFilters);
    };

    // Fonction pour gérer le clic sur le bouton "Voir le résumé"
    const handleViewSummary = () => {
        navigate('/suivi-permissions/summary'); // Redirige vers la page du résumé
    };

    if (authLoading || loading) {
        return <div className="alert alert-info mt-4">Chargement des données...</div>;
    }

    if (error && error.includes("Vous n'avez pas les permissions nécessaires")) {
        return <div className="alert alert-danger mt-4">{error}</div>;
    }
    if (!isAdmin) {
        return <div className="alert alert-danger mt-4">Vous n'êtes pas autorisé à voir cette page.</div>;
    }
    if (error) {
        return <div className="alert alert-danger mt-4">{error}</div>;
    }


    return (
        <div className="container mt-4">
            <h2 className="mb-4">Suivi de Permission</h2>

            {/* Bouton pour aller au résumé des permissions */}
            <div className="d-flex justify-content-end mb-3"> {/* Utilisez d-flex et justify-content-end pour aligner à droite */}
                <button
                    className="btn btn-info" // Un bouton bleu clair pour une action secondaire
                    onClick={handleViewSummary}
                >
                    Voir le résumé des permissions
                </button>
            </div>

            {/* Section des filtres */}
            <div className="card mb-4">
                <div className="card-header">Filtres</div>
                <div className="card-body">
                    <div className="row g-3">
                        <div className="col-md-3">
                            <label htmlFor="nomCadre" className="form-label">Nom du cadre</label>
                            <input
                                type="text"
                                className="form-control"
                                id="nomCadre"
                                name="nomCadre"
                                value={filters.nomCadre}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className="col-md-3">
                            <label htmlFor="matriculeCadre" className="form-label">Matricule</label>
                            <input
                                type="text"
                                className="form-control"
                                id="matriculeCadre"
                                name="matriculeCadre"
                                value={filters.matriculeCadre}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className="col-md-3">
                            <label htmlFor="dateDepart" className="form-label">Date de départ (min)</label>
                            <input
                                type="date"
                                className="form-control"
                                id="dateDepart"
                                name="dateDepart"
                                value={filters.dateDepart}
                                onChange={handleFilterChange}
                            />
                        </div>
                        <div className="col-md-3">
                            <label htmlFor="dateFin" className="form-label">Date d'arrivée (max)</label>
                            <input
                                type="date"
                                className="form-control"
                                id="dateFin"
                                name="dateFin"
                                value={filters.dateFin}
                                onChange={handleFilterChange}
                            />
                        </div>

                        {showAdvancedFilters && (
                            <>
                                <div className="col-md-3">
                                    <label htmlFor="service" className="form-label">Service</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="service"
                                        name="service"
                                        value={filters.service}
                                        onChange={handleFilterChange}
                                    />
                                </div>
                                <div className="col-md-3">
                                    <label htmlFor="escadronId" className="form-label">ID Escadron</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        id="escadronId"
                                        name="escadronId"
                                        value={filters.escadronId}
                                        onChange={handleFilterChange}
                                        placeholder="Ex: 1"
                                    />
                                </div>
                            </>
                        )}
                    </div>
                    <div className="mt-3">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={toggleAdvancedFilters}
                        >
                            {showAdvancedFilters ? 'Masquer les filtres avancés' : 'Afficher les filtres avancés'}
                        </button>
                    </div>
                </div>
            </div>

            {confirmationMessage && <div className="alert alert-success">{confirmationMessage}</div>}

            {!loading && !error && permissions.length === 0 && (
                <div className="alert alert-warning">Aucune permission trouvée avec les critères actuels.</div>
            )}

            {showArriveeForm && (
                <div className="card mb-4 p-3">
                    <h4>Enregistrer Référence d'Arrivée</h4>
                    <form onSubmit={handleEnregistrerArrivee}>
                        <div className="mb-3">
                            <label htmlFor="referenceArrivee" className="form-label">Référence Message d'Arrivée</label>
                            <input
                                type="text"
                                className="form-control"
                                id="referenceArrivee"
                                value={referenceArrivee}
                                onChange={(e) => setReferenceArrivee(e.target.value)}
                                required
                            />
                        </div>
                        {arriveeError && <div className="alert alert-danger">{arriveeError}</div>}
                        <button type="submit" className="btn btn-success me-2">Enregistrer</button>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowArriveeForm(false)}>Annuler</button>
                    </form>
                </div>
            )}

            {!loading && !error && permissions.length > 0 && (
                <div className="table-responsive">
                    <table className="table table-striped table-hover">
                        <thead className="table-dark">
                            <tr>
                                <th>ID</th>
                                <th>Cadre (Grade, Nom Prénom)</th>
                                <th>Matricule</th>
                                <th>Service/Entité</th>
                                <th>Départ (Ref.)</th>
                                <th>Prévu Arrivée (Ref.)</th>
                                <th>Jours Pris</th>
                                <th>Retard (jours)</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {permissions.map(perm => (
                                <tr key={perm.id}>
                                    <td>{perm.id}</td>
                                    <td>{perm.Cadre.grade} {perm.Cadre.nom} {perm.Cadre.prenom}</td>
                                    <td>{perm.Cadre.matricule}</td>
                                    <td>{perm.Cadre.service || perm.Cadre.entite}</td>
                                    <td>
                                        {format(new Date(perm.dateDepartPerm), 'dd/MM/yyyy')}
                                        {perm.referenceMessageDepart && ` (${perm.referenceMessageDepart})`}
                                    </td>
                                    <td>
                                        {format(new Date(perm.dateArriveePerm), 'dd/MM/yyyy')}
                                        {perm.referenceMessageArrivee && ` (${perm.referenceMessageArrivee})`}
                                    </td>
                                    <td>{perm.joursPrisPerm}</td>
                                    <td className={perm.joursRetard > 0 ? 'text-danger fw-bold' : ''}>
                                        {perm.referenceMessageArrivee ? 'Arrivé' : (perm.joursRetard > 0 ? perm.joursRetard : '0')}
                                    </td>
                                    <td>
                                        {!perm.referenceMessageArrivee && (
                                            <button
                                                className={`btn btn-sm ${perm.joursRetard > 0 ? 'btn-danger' : 'btn-primary'}`}
                                                onClick={() => handleArriveeClick(perm.id)}
                                                disabled={showArriveeForm && selectedPermissionId === perm.id}
                                            >
                                                Enregistrer Arrivée {perm.joursRetard > 0 && '(Retard)'}
                                            </button>
                                        )}
                                        {perm.referenceMessageArrivee && (
                                            <span className="badge bg-success">Arrivée enregistrée</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default SuiviPermissions;