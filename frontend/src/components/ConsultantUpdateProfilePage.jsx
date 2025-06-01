// src/components/ConsultantUpdateProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { Form, Button, Spinner, Alert, Card } from 'react-bootstrap';

// Assurez-vous que VITE_API_URL est défini dans votre fichier .env (par exemple, VITE_API_URL=http://localhost:3000)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function ConsultantUpdateProfilePage() {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [matricule, setMatricule] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const tempToken = localStorage.getItem('tempToken');
        if (!tempToken) {
            Swal.fire({
                title: 'Accès non autorisé',
                text: 'Veuillez vous connecter d\'abord pour mettre à jour votre profil. Votre session de mise à jour a expiré ou n\'a pas été initiée correctement.',
                icon: 'warning',
                confirmButtonText: 'OK'
            }).then(() => {
                navigate('/login');
            });
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (newPassword !== confirmNewPassword) {
            setError('Les nouveaux mots de passe ne correspondent pas.');
            setLoading(false);
            return;
        }
        if (!newPassword || newPassword.length < 6) {
            setError('Le nouveau mot de passe doit contenir au moins 6 caractères.');
            setLoading(false);
            return;
        }
        if (!matricule.trim()) {
            setError('Le matricule est obligatoire.');
            setLoading(false);
            return;
        }

        const tempToken = localStorage.getItem('tempToken');
        if (!tempToken) {
            setError("Session de mise à jour expirée ou non autorisée. Veuillez vous reconnecter.");
            Swal.fire('Erreur de session', 'Veuillez vous reconnecter.', 'error');
            setLoading(false);
            navigate('/login');
            return;
        }

        try {
            const response = await axios.post(`${API_BASE_URL}/api/consultant/update-profile`,
                {
                    oldPassword,
                    newPassword,
                    confirmNewPassword,
                    matricule
                },
                {
                    headers: {
                        Authorization: `Bearer ${tempToken}`
                    }
                }
            );

            Swal.fire({
                title: 'Profil mis à jour !',
                text: response.data.message || 'Vos informations ont été mises à jour avec succès.',
                icon: 'success',
                confirmButtonText: 'OK'
            }).then(() => {
                localStorage.removeItem('tempToken');
                localStorage.setItem('token', response.data.token);
                if (response.data.user) {
                    localStorage.setItem('userInfo', JSON.stringify(response.data.user));
                }
                navigate('/');
            });

        } catch (err) {
            console.error('Erreur lors de la mise à jour du profil Consultant:', err);
            const errorMessage = err.response?.data?.message || 'Erreur lors de la mise à jour du profil. Veuillez réessayer.';
            setError(errorMessage);
            Swal.fire('Erreur', errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="d-flex justify-content-center align-items-center min-vh-100 bg-light">
            <Card style={{ width: '28rem' }} className="shadow-lg">
                <Card.Body>
                    <Card.Title className="text-center mb-4">Mise à jour de votre profil Consultant</Card.Title>
                    <Alert variant="info" className="mb-4">
                        Pour activer pleinement votre compte et l'associer à votre profil de cadre, veuillez confirmer votre ancien mot de passe, définir un nouveau, et entrer votre matricule.
                    </Alert>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3" controlId="formOldPassword">
                            <Form.Label>Ancien mot de passe</Form.Label>
                            <Form.Control
                                type="password"
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="formNewPassword">
                            <Form.Label>Nouveau mot de passe</Form.Label>
                            <Form.Control
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="formConfirmNewPassword">
                            <Form.Label>Confirmer le nouveau mot de passe</Form.Label>
                            <Form.Control
                                type="password"
                                value={confirmNewPassword}
                                onChange={(e) => setConfirmNewPassword(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="formMatricule">
                            <Form.Label>Votre Matricule (pour l'association)</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Entrez votre matricule de cadre"
                                value={matricule}
                                onChange={(e) => setMatricule(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </Form.Group>

                        {error && <Alert variant="danger">{error}</Alert>}

                        <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                            {loading ? <Spinner animation="border" size="sm" className="me-2" /> : 'Mettre à jour et accéder'}
                        </Button>
                    </Form>
                </Card.Body>
            </Card>
        </div>
    );
}

export default ConsultantUpdateProfilePage;