import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUsernameChange = (event) => setUsername(event.target.value);
    const handlePasswordChange = (event) => setPassword(event.target.value);
    const handleRememberMeChange = (event) => setRememberMe(event.target.checked);

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
            inputValidator: (value) => {
                if (!value || value.trim() === '') {
                    return 'Le matricule est requis !';
                }
            }
        });

        if (dismiss) {
            Swal.fire('Annulé', 'Connexion annulée. Veuillez réessayer.', 'info');
            setLoading(false);
            localStorage.removeItem('tempToken');
            return;
        }

        if (matricule) {
            const tempToken = localStorage.getItem('tempToken');
            if (!tempToken) {
                Swal.fire('Erreur', 'Session expirée. Veuillez vous reconnecter.', 'error');
                navigate('/login');
                setLoading(false);
                return;
            }

            try {
                const apiUrl = import.meta.env.VITE_API_URL;
                const response = await fetch(`${apiUrl}/api/consultant/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tempToken}`
                    },
                    body: JSON.stringify({
                        matricule: matricule.trim(),
                        oldPassword: currentPassword,
                        newPassword: currentPassword, // Lors de la seule saisie du matricule, l'ancien mot de passe est utilisé comme nouveau pour valider
                        confirmNewPassword: currentPassword, // C'est le backend qui validera si un vrai changement est nécessaire
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire('Succès', data.message, 'success');
                    login(data.token, data.user);
                    localStorage.removeItem('tempToken');
                    navigate('/');
                } else {
                    const errorMessage = data.message || 'Erreur lors de la validation du matricule.';
                    Swal.fire('Erreur', errorMessage, 'error');
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
                Swal.fire('Erreur', 'Connexion au serveur échouée.', 'error');
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
            Swal.fire('Annulé', 'Mise à jour annulée.', 'info');
            localStorage.removeItem('tempToken');
            setLoading(false);
            return;
        }

        if (formValues) {
            const tempToken = localStorage.getItem('tempToken');
            if (!tempToken) {
                Swal.fire('Erreur', 'Session expirée. Veuillez vous reconnecter.', 'error');
                navigate('/login');
                setLoading(false);
                return;
            }

            try {
                const apiUrl = import.meta.env.VITE_API_URL;
                const response = await fetch(`${apiUrl}/api/consultant/update-profile`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${tempToken}`
                    },
                    body: JSON.stringify(formValues)
                });

                const data = await response.json();

                if (response.ok) {
                    Swal.fire('Succès', data.message, 'success');
                    login(data.token, data.user);
                    localStorage.removeItem('tempToken');
                    navigate('/');
                } else {
                    const errorMessage = data.message || 'Erreur de mise à jour du profil.';
                    Swal.fire('Erreur', errorMessage, 'error');
                    setError(errorMessage);

                    if (data.requiresMatriculeUpdate || data.requiresPasswordUpdate || data.requiresMatriculePrompt) {
                        await handleProfileUpdatePrompt(errorMessage, formValues.matricule, formValues.oldPassword);
                    } else {
                        localStorage.removeItem('tempToken');
                    }
                }
            } catch (err) {
                Swal.fire('Erreur', 'Connexion au serveur échouée.', 'error');
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
            const apiUrl = import.meta.env.VITE_API_URL;
            const response = await fetch(`${apiUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                if (data.tempToken) {
                    localStorage.setItem('tempToken', data.tempToken);

                    // Modifiez le message initial du prompt en fonction de la raison (si fournie par le backend)
                    let initialPromptMessage = data.message;
                    if (data.requiresPasswordUpdate && data.message.includes('expiré')) { // Adaptez cette condition si le backend renvoie un flag spécifique comme `data.passwordExpired: true`
                        initialPromptMessage = 'Votre mot de passe a expiré. Veuillez le changer.';
                    } else if (data.requiresMatriculePrompt) {
                        initialPromptMessage = data.message;
                    } else if (data.requiresPasswordUpdate) {
                        initialPromptMessage = 'Votre profil (mot de passe et/ou matricule) doit être mis à jour.';
                    }


                    if (data.requiresMatriculePrompt) {
                        await handleMatriculePrompt(initialPromptMessage, password);
                    } else if (data.requiresPasswordUpdate) {
                        // Passez le matricule existant (même s'il est vide) pour pré-remplir si nécessaire
                        await handleProfileUpdatePrompt(initialPromptMessage, data.user?.matricule || '', password);
                    } else {
                        Swal.fire('Erreur', data.message || 'Erreur inconnue.', 'error');
                    }
                } else {
                    Swal.fire('Erreur', data.message || 'Nom d\'utilisateur ou mot de passe incorrect.', 'error');
                    setError(data.message || 'Identifiants invalides.');
                }
            } else {
                login(data.token, data.user);
                localStorage.removeItem('tempToken');
                navigate('/');
            }
        } catch (err) {
            Swal.fire('Erreur', 'Impossible de contacter le serveur.', 'error');
            setError('Impossible de contacter le serveur.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page-container d-flex justify-content-center align-items-center min-vh-100">
            <div className="card p-4 login-card">
                <div className="card-body">
                    <div className="user-icon-circle bg-primary text-white mx-auto mb-4 d-flex justify-content-center align-items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
                            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
                        </svg>
                    </div>
                    {error && <div className="alert alert-danger">{error}</div>}
                    <form onSubmit={handleSubmit}>
                        <div className="mb-3 input-group">
                            <span className="input-group-text">
                                <i className="bi bi-person"></i>
                            </span>
                            <input type="text" className="form-control" placeholder="Nom d'utilisateur" value={username} onChange={handleUsernameChange} required />
                        </div>
                        <div className="mb-3 input-group">
                            <span className="input-group-text">
                                <i className="bi bi-lock"></i>
                            </span>
                            <input type="password" className="form-control" placeholder="Mot de passe" value={password} onChange={handlePasswordChange} required />
                        </div>
                        <div className="form-check mb-3">
                            <input className="form-check-input" type="checkbox" checked={rememberMe} onChange={handleRememberMeChange} id="rememberMe" />
                            <label className="form-check-label" htmlFor="rememberMe">Se souvenir de moi</label>
                        </div>
                        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                            {loading ? 'Connexion en cours...' : 'Se connecter'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default LoginPage;