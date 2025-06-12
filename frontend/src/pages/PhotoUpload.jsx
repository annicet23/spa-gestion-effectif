import React, { useState, useCallback } from 'react';
import { Button, Form, Alert, Spinner } from 'react-bootstrap';
import { FaUpload, FaImage, FaTimes } from 'react-icons/fa';
import Swal from 'sweetalert2';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const PhotoUpload = ({ currentPhoto, onPhotoUpdate, token, disabled = false }) => {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(currentPhoto);
    const [error, setError] = useState(null);

    const handleFileSelect = useCallback(async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validation du fichier
        if (!file.type.startsWith('image/')) {
            setError('Veuillez sélectionner un fichier image valide');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB
            setError('La taille du fichier ne doit pas dépasser 5MB');
            return;
        }

        setError(null);
        setUploading(true);

        try {
            // Créer une prévisualisation
            const reader = new FileReader();
            reader.onload = (e) => setPreviewUrl(e.target.result);
            reader.readAsDataURL(file);

            // Préparer les données pour l'upload
            const formData = new FormData();
            formData.append('photo', file);

            // Envoyer vers votre API d'upload existante
            const response = await fetch(`${API_BASE_URL}api/upload/photo`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) {
                throw new Error('Échec de l\'upload de la photo');
            }

            const result = await response.json();

            // Mettre à jour l'URL de la photo
            onPhotoUpdate(result.photo_url);

            Swal.fire({
                icon: 'success',
                title: 'Photo uploadée',
                text: 'La photo a été mise à jour avec succès',
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error('Erreur upload photo:', error);
            setError('Erreur lors de l\'upload de la photo');
            setPreviewUrl(currentPhoto); // Remettre l'ancienne photo
        } finally {
            setUploading(false);
        }
    }, [token, onPhotoUpdate, currentPhoto]);

    const handleRemovePhoto = () => {
        setPreviewUrl('/default-avatar.png');
        onPhotoUpdate('');
    };

    return (
        <div className="text-center">
            <div className="mb-3">
                <img
                    src={previewUrl || '/default-avatar.png'}
                    alt="Photo du cadre"
                    className="rounded-circle mb-2"
                    style={{
                        width: '120px',
                        height: '120px',
                        objectFit: 'cover',
                        border: '2px solid #dee2e6'
                    }}
                    onError={(e) => {
                        e.target.src = '/default-avatar.png';
                    }}
                />
                {uploading && (
                    <div className="position-absolute" style={{ top: '45px', left: '45px' }}>
                        <Spinner animation="border" size="sm" />
                    </div>
                )}
            </div>

            {error && (
                <Alert variant="danger" className="mb-2">
                    {error}
                </Alert>
            )}

            <div className="d-grid gap-2">
                <Form.Group>
                    <Form.Label className="btn btn-outline-primary w-100" htmlFor="photo-upload">
                        <FaUpload className="me-2" />
                        {uploading ? 'Upload en cours...' : 'Choisir une photo'}
                    </Form.Label>
                    <Form.Control
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        disabled={disabled || uploading}
                        style={{ display: 'none' }}
                    />
                </Form.Group>

                {previewUrl && previewUrl !== '/default-avatar.png' && (
                    <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={handleRemovePhoto}
                        disabled={disabled || uploading}
                    >
                        <FaTimes className="me-1" />
                        Supprimer la photo
                    </Button>
                )}
            </div>

            <small className="text-muted d-block mt-2">
                Formats acceptés: JPG, PNG, GIF (max 5MB)
            </small>
        </div>
    );
};

export default PhotoUpload;