// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import './LoginPage.css';

function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    const handleUsernameChange = (event) => setUsername(event.target.value);
    const handlePasswordChange = (event) => setPassword(event.target.value);
    const handleRememberMeChange = (event) => setRememberMe(event.target.checked);
    const togglePasswordVisibility = () => setShowPassword(!showPassword);

    // ... (gardez toutes vos fonctions existantes: handleMatriculePrompt, handleProfileUpdatePrompt, etc.)

    const handleMatriculePrompt = async (initialMessage, currentPassword) => {
        setLoading(true);
        const { value: matricule, dismiss } = await Swal.fire({
            title: initialMessage || 'Veuillez saisir votre matricule',
            input: 'text',
            inputPlaceholder: 'Votre Matricule',
            showCancelButton: true,
            confirmButtonText: 'Valider',
            cancelButtonText: 'Annuler',
            allowOutsideClick: false,
            customClass: {
                popup: 'animated-popup',
                confirmButton: 'swal-confirm-btn',
                cancelButton: 'swal-cancel-btn'
            },
            inputValidator: (value) => {
                if (!value || value.trim() === '') {
                    return 'Le matricule est requis !';
                }
            }
        });

        if (dismiss) {
            Swal.fire({
                title: 'Annulé',
                text: 'Connexion annulée. Veuillez réessayer.',
                icon: 'info',
                customClass: { popup: 'animated-popup' }
            });
            setLoading(false);
            localStorage.removeItem('tempToken');
            return;
        }

        if (matricule) {
            const tempToken = localStorage.getItem('tempToken');
            if (!tempToken) {
                Swal.fire({
                    title: 'Erreur',
                    text: 'Session expirée. Veuillez vous reconnecter.',
                    icon: 'error',
                    customClass: { popup: 'animated-popup' }
                });
                navigate('/login');
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}api/consultant/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tempToken}`
                    },
                    body: JSON.stringify({
                        matricule: matricule.trim(),
                        oldPassword: currentPassword,
                        newPassword: currentPassword,
                        confirmNewPassword: currentPassword,
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire({
                        title: 'Succès',
                        text: data.message,
                        icon: 'success',
                        customClass: { popup: 'animated-popup' }
                    });
                    login(data.token, data.user);
                    localStorage.removeItem('tempToken');
                    navigate('/');
                } else {
                    const errorMessage = data.message || 'Erreur lors de la validation du matricule.';
                    Swal.fire({
                        title: 'Erreur',
                        text: errorMessage,
                        icon: 'error',
                        customClass: { popup: 'animated-popup' }
                    });
                    setError(errorMessage);

                    if (data.requiresMatriculePrompt) {
                        await handleMatriculePrompt(errorMessage, currentPassword);
                    } else if (data.requiresPasswordUpdate || data.requiresMatriculeUpdate) {
                        await handleProfileUpdatePrompt(errorMessage, matricule, currentPassword);
                    } else {
                        localStorage.removeItem('tempToken');
                    }
                }
            } catch (err) {
                Swal.fire({
                    title: 'Erreur',
                    text: 'Connexion au serveur échouée.',
                    icon: 'error',
                    customClass: { popup: 'animated-popup' }
                });
                setError('Connexion au serveur échouée.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleProfileUpdatePrompt = async (initialMessage, prefillMatricule = '', prefillOldPassword = '') => {
        setLoading(true);
        const { value: formValues, dismiss } = await Swal.fire({
            title: initialMessage || 'Mise à jour du profil requise',
            html:
                `<input id="swal-input-matricule" class="swal2-input" placeholder="Votre Matricule" value="${prefillMatricule}">` +
                `<input id="swal-input-old-pass" type="password" class="swal2-input" placeholder="Ancien mot de passe" value="${prefillOldPassword}">` +
                '<input id="swal-input-new-pass" type="password" class="swal2-input" placeholder="Nouveau mot de passe">' +
                '<input id="swal-input-confirm-pass" type="password" class="swal2-input" placeholder="Confirmer nouveau mot de passe">',
            showCancelButton: true,
            confirmButtonText: 'Mettre à jour',
            cancelButtonText: 'Annuler',
            allowOutsideClick: false,
            customClass: {
                popup: 'animated-popup',
                confirmButton: 'swal-confirm-btn',
                cancelButton: 'swal-cancel-btn'
            },
            preConfirm: () => {
                const matricule = document.getElementById('swal-input-matricule').value;
                const oldPassword = document.getElementById('swal-input-old-pass').value;
                const newPassword = document.getElementById('swal-input-new-pass').value;
                const confirmNewPassword = document.getElementById('swal-input-confirm-pass').value;

                if (!matricule || !oldPassword || !newPassword || !confirmNewPassword) {
                    Swal.showValidationMessage('Tous les champs sont requis.');
                    return false;
                }
                if (newPassword !== confirmNewPassword) {
                    Swal.showValidationMessage('Les mots de passe ne correspondent pas.');
                    return false;
                }
                if (newPassword.length < 6) {
                    Swal.showValidationMessage('Le mot de passe doit faire au moins 6 caractères.');
                    return false;
                }

                return { matricule, oldPassword, newPassword, confirmNewPassword };
            }
        });

        if (dismiss) {
            Swal.fire({
                title: 'Annulé',
                text: 'Mise à jour annulée.',
                icon: 'info',
                customClass: { popup: 'animated-popup' }
            });
            localStorage.removeItem('tempToken');
            setLoading(false);
            return;
        }

        if (formValues) {
            const tempToken = localStorage.getItem('tempToken');
            if (!tempToken) {
                Swal.fire({
                    title: 'Erreur',
                    text: 'Session expirée. Veuillez vous reconnecter.',
                    icon: 'error',
                    customClass: { popup: 'animated-popup' }
                });
                navigate('/login');
                setLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}api/consultant/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tempToken}`
                    },
                    body: JSON.stringify(formValues)
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire({
                        title: 'Succès',
                        text: data.message,
                        icon: 'success',
                        customClass: { popup: 'animated-popup' }
                    });
                    login(data.token, data.user);
                    localStorage.removeItem('tempToken');
                    navigate('/');
                } else {
                    const errorMessage = data.message || 'Erreur de mise à jour du profil.';
                    Swal.fire({
                        title: 'Erreur',
                        text: errorMessage,
                        icon: 'error',
                        customClass: { popup: 'animated-popup' }
                    });
                    setError(errorMessage);

                    if (data.requiresMatriculeUpdate || data.requiresPasswordUpdate || data.requiresMatriculePrompt) {
                        await handleProfileUpdatePrompt(errorMessage, formValues.matricule, formValues.oldPassword);
                    } else {
                        localStorage.removeItem('tempToken');
                    }
                }
            } catch (err) {
                Swal.fire({
                    title: 'Erreur',
                    text: 'Connexion au serveur échouée.',
                    icon: 'error',
                    customClass: { popup: 'animated-popup' }
                });
                setError('Connexion au serveur échouée.');
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.tempToken) {
                    localStorage.setItem('tempToken', data.tempToken);

                    let initialPromptMessage = data.message;
                    if (data.requiresPasswordUpdate && data.message.includes('expiré')) {
                        initialPromptMessage = 'Votre mot de passe a expiré. Veuillez le changer.';
                    } else if (data.requiresMatriculePrompt) {
                        initialPromptMessage = data.message;
                    } else if (data.requiresPasswordUpdate) {
                        initialPromptMessage = 'Votre profil (mot de passe et/ou matricule) doit être mis à jour.';
                    }

                    if (data.requiresMatriculePrompt) {
                        await handleMatriculePrompt(initialPromptMessage, password);
                    } else if (data.requiresPasswordUpdate) {
                        await handleProfileUpdatePrompt(initialPromptMessage, data.user?.matricule || '', password);
                    } else {
                        Swal.fire({
                            title: 'Erreur',
                            text: data.message || 'Erreur inconnue.',
                            icon: 'error',
                            customClass: { popup: 'animated-popup' }
                        });
                    }
                } else {
                    Swal.fire({
                        title: 'Erreur',
                        text: data.message || 'Nom d\'utilisateur ou mot de passe incorrect.',
                        icon: 'error',
                        customClass: { popup: 'animated-popup' }
                    });
                    setError(data.message || 'Identifiants invalides.');
                }
            } else {
                login(data.token, data.user);
                localStorage.removeItem('tempToken');
                navigate('/');
            }
        } catch (err) {
            Swal.fire({
                title: 'Erreur',
                text: 'Impossible de contacter le serveur.',
                icon: 'error',
                customClass: { popup: 'animated-popup' }
            });
            setError('Impossible de contacter le serveur.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-container d-flex flex-column min-vh-100">
           <Navbar bg="dark" variant="dark" expand="lg" className="gespa-navbar">
    <Container fluid>
        {/* GESPA à gauche */}
        <Navbar.Brand as={Link} to="/login" className="gespa-brand">
            <div className="brand-container">
                <span className="brand-title">GESPA</span>
                <span className="brand-version">v1.0</span>
            </div>
        </Navbar.Brand>

        {/* Toggle pour mobile */}
        <Navbar.Toggle aria-controls="basic-navbar-nav" />

        {/* Liens à droite */}
        <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
                <Nav.Link as={Link} to="/documentation/library" className="nav-link-custom">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-book-fill me-2" viewBox="0 0 16 16">
                        <path d="M8 1.782a1.75 1.75 0 0 0-1.045.393L6 2.6V15.5a.5.5 0 0 0 .5.5c.197 0 .37-.06.5-.165l.61-.413a1.75 1.75 0 0 1 2.784 0l.61.413c.13.105.303.165.5.165a.5.5 0 0 0 .5-.5V2.6l-.955-.425A1.75 1.75 0 0 0 8 1.782"/>
                    </svg>
                    Bibliothèque
                </Nav.Link>
                <Nav.Link as={Link} to="/documentation" className="nav-link-custom">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-file-earmark-text-fill me-2" viewBox="0 0 16 16">
                        <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1M4.5 9a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM4.5 11a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM4.5 13a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1z"/>
                    </svg>
                    Documentation
                </Nav.Link>
            </Nav>
        </Navbar.Collapse>
    </Container>
</Navbar>

            <div className="d-flex justify-content-center align-items-center flex-grow-1 login-background-overlay">
                <div className="card p-4 login-card enhanced-card">
                    <div className="card-body">
                        {/* ✨ ICÔNE UTILISATEUR AMÉLIORÉE */}
                        <div className="user-icon-circle bg-primary text-white mx-auto mb-4 d-flex justify-content-center align-items-center enhanced-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-person-circle" viewBox="0 0 16 16">
                                <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/>
                                <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1"/>
                            </svg>
                        </div>

                        {/* ✨ TITRE DE CONNEXION */}
                        <h4 className="text-center mb-4 login-title">
                            <i className="bi bi-shield-lock me-2"></i>
                            Connexion Sécurisée
                        </h4>

                        {/* ✨ ALERTE D'ERREUR AMÉLIORÉE */}
                        {error && (
                            <div className="alert alert-danger enhanced-alert" role="alert">
                                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="enhanced-form">
                            {/* ✨ CHAMP UTILISATEUR AMÉLIORÉ */}
                            <div className="mb-3 input-group enhanced-input-group">
                                <span className="input-group-text enhanced-input-addon">
                                    <i className="bi bi-person-fill"></i>
                                </span>
                                <input
                                    type="text"
                                    className="form-control enhanced-input"
                                    placeholder="Nom d'utilisateur"
                                    value={username}
                                    onChange={handleUsernameChange}
                                    required
                                />
                            </div>

                            {/* ✨ CHAMP MOT DE PASSE AVEC TOGGLE VISIBILITÉ */}
                            <div className="mb-3 input-group enhanced-input-group">
                                <span className="input-group-text enhanced-input-addon">
                                    <i className="bi bi-lock-fill"></i>
                                </span>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="form-control enhanced-input"
                                    placeholder="Mot de passe"
                                    value={password}
                                    onChange={handlePasswordChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary password-toggle-btn"
                                    onClick={togglePasswordVisibility}
                                    tabIndex="-1"
                                >
                                    <i className={`bi bi-eye${showPassword ? '-slash' : ''}-fill`}></i>
                                </button>
                            </div>

                            {/* ✨ CHECKBOX AMÉLIORÉE */}
                            <div className="form-check mb-4 enhanced-checkbox">
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={handleRememberMeChange}
                                    id="rememberMe"
                                />
                                <label className="form-check-label" htmlFor="rememberMe">
                                    <i className="bi bi-bookmark-heart me-2"></i>
                                    Se souvenir de moi
                                </label>
                            </div>

                            {/* ✨ BOUTON DE CONNEXION AMÉLIORÉ */}
                            <button
                                type="submit"
                                className="btn btn-primary w-100 enhanced-submit-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                        Connexion en cours...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-box-arrow-in-right me-2"></i>
                                        Se connecter
                                    </>
                                )}
                            </button>
                        </form>


                    </div>
                </div>
            </div>

            {/* ✨ FOOTER DE LA PAGE */}
            <div className="login-page-footer text-center py-3">
                <small className="text-muted">
                    © 2025 GESPA v1.0 - EGNA/DI/SIT-INFO
                </small>
            </div>
        </div>
    );
}

export default LoginPage;