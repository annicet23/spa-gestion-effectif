// src/components/Header.jsx
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Header() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login'); // Rediriger vers la page de connexion après déconnexion
    };

    const isAdmin = user && user.role === 'Admin';
    const isStandard = user && user.role === 'Standard';
    const isConsultant = user && user.role === 'Consultant';

    return (
        <header className="navbar navbar-expand-lg navbar-dark bg-primary">
            <div className="container-fluid">
                <Link className="navbar-brand" to="/dashboard">GECO</Link>
                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#navbarNav"
                    aria-controls="navbarNav"
                    aria-expanded="false"
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav me-auto mb-2 mb-lg-0">
                        {user && ( // Afficher les liens si l'utilisateur est connecté
                            <>
                                <li className="nav-item">
                                    <Link className="nav-link" to="/dashboard">Tableau de Bord</Link>
                                </li>
                                {(isAdmin || isStandard) && (
                                    <>
                                        <li className="nav-item dropdown">
                                            <a className="nav-link dropdown-toggle" href="#" id="cadresDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                Cadres
                                            </a>
                                            <ul className="dropdown-menu" aria-labelledby="cadresDropdown">
                                                <li><Link className="dropdown-item" to="/cadres">Liste des Cadres</Link></li>
                                                {isAdmin && <li><Link className="dropdown-item" to="/cadres/new">Ajouter Cadre</Link></li>}
                                                <li><Link className="dropdown-item" to="/mises-a-jour/new">Ajouter Mise à Jour</Link></li>
                                            </ul>
                                        </li>
                                        <li className="nav-item dropdown">
                                            <a className="nav-link dropdown-toggle" href="#" id="libraryDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                Bibliothèque
                                            </a>
                                            <ul className="dropdown-menu" aria-labelledby="libraryDropdown">
                                                <li><Link className="dropdown-item" to="/library">Voir la Bibliothèque</Link></li>
                                                {isAdmin && <li><Link className="dropdown-item" to="/library/new">Ajouter un Document</Link></li>}
                                            </ul>
                                        </li>
                                        {/* Nouveau Dropdown pour le Suivi et Résumé des Permissions */}
                                        <li className="nav-item dropdown">
                                            <a className="nav-link dropdown-toggle" href="#" id="permissionsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                Permissions
                                            </a>
                                            <ul className="dropdown-menu" aria-labelledby="permissionsDropdown">
                                                <li><Link className="dropdown-item" to="/suivi-permissions">Suivi des Permissions</Link></li>
                                                {isAdmin && <li><Link className="dropdown-item" to="/suivi-permissions/summary">Résumé par Cadre</Link></li>} {/* NOUVEAU LIEN ICI */}
                                            </ul>
                                        </li>
                                    </>
                                )}
                                {isAdmin && (
                                    <>
                                        <li className="nav-item dropdown">
                                            <a className="nav-link dropdown-toggle" href="#" id="rapportsDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                                Rapports
                                            </a>
                                            <ul className="dropdown-menu" aria-labelledby="rapportsDropdown">
                                                <li><Link className="dropdown-item" to="/rapports/absences">Absences</Link></li>
                                                <li><Link className="dropdown-item" to="/historical-data">Données Historiques</Link></li>
                                            </ul>
                                        </li>
                                        <li className="nav-item">
                                            <Link className="nav-link" to="/users">Utilisateurs</Link>
                                        </li>
                                    </>
                                )}
                                {isConsultant && (
                                    <li className="nav-item">
                                        <Link className="nav-link" to="/consultant-dashboard">Dashboard Consultant</Link>
                                    </li>
                                )}
                            </>
                        )}
                    </ul>
                    <ul className="navbar-nav">
                        {user ? (
                            <li className="nav-item dropdown">
                                <a className="nav-link dropdown-toggle" href="#" id="navbarDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    {user.nom} ({user.role})
                                </a>
                                <ul className="dropdown-menu dropdown-menu-end" aria-labelledby="navbarDropdown">
                                    <li><button className="dropdown-item" onClick={handleLogout}>Déconnexion</button></li>
                                </ul>
                            </li>
                        ) : (
                            <>
                                <li className="nav-item">
                                    <Link className="nav-link" to="/login">Connexion</Link>
                                </li>
                                <li className="nav-item">
                                    <Link className="nav-link" to="/register">Inscription</Link>
                                </li>
                            </>
                        )}
                    </ul>
                </div>
            </div>
        </header>
    );
}

export default Header;