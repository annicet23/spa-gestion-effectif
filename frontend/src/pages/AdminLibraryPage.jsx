// frontend/src/pages/AdminLibraryPage.jsx
import React, { useState, useEffect } from 'react';
import { Container, Form, Button, Alert, Row, Col, Card, ListGroup, InputGroup } from 'react-bootstrap';
import { FaPlus, FaEdit, FaTrash, FaUpload, FaTimesCircle, FaCheckCircle, FaSearch, FaInfoCircle } from 'react-icons/fa';
import { Link } from 'react-router-dom';

import '../pages/LoginPage.css';
import '../components/LibraryPage.css';

// Définition des catégories et types (inchangés)
const allCategories = [
    'Français', 'Anglais', 'Roman', 'Bande Dessinée', 'Journal', 'Revue',
    'Actualités', 'Management', 'Développement Web', 'Informatique', 'Sciences',
    'Sciences Économiques', 'Littérature', 'Environnement', 'Design',
    'Cybersécurité', 'Histoire', 'Musique', 'Art', 'Santé', 'Voyage', 'Sport',
    'Documentaire', 'Manuel', 'Guide Technique', 'Essai', 'Article', 'Poésie', 'Schéma', 'Tutoriel', 'Lien Externe', 'Vidéo'
];

const allTypes = [
    'Roman', 'BD', 'Journal', 'Revue', 'Documentaire', 'Manuel', 'Guide Technique',
    'Tutoriel', 'Schéma', 'Lien Externe', 'Vidéo', 'Article', 'Essai', 'Poésie', 'Histoire', 'Autre'
];


function AdminLibraryPage() {
    const [formData, setFormData] = useState({
        id: '',
        title: '',
        description: '',
        type: '',
        category: '',
        tags: '', // Stocké comme une chaîne séparée par des virgules pour le formulaire
        file: null, // Pour le fichier à uploader
        // tempFileName: '', // <<< REMOVE THIS - Not needed with single-step upload
        externalUrl: '',
        videoUrl: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [message, setMessage] = useState(null);
    const [messageType, setMessageType] = useState('');
    const [libraryItems, setLibraryItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentFileUrl, setCurrentFileUrl] = useState(''); // To keep track of the existing file URL during edit

    const fetchLibraryItems = async () => {
        try {
            setLoading(true);
            setError(null);
            const queryParams = new URLSearchParams();
            if (searchTerm) {
                queryParams.append('search', searchTerm);
            }
            // MODIFICATION APPLIQUÉE ICI : Utilisation de VITE_API_BASE_URL
            const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}api/library-items?${queryParams.toString()}`);
            if (!response.ok) {
                throw new Error(`Erreur HTTP! statut: ${response.status}`);
            }
            const data = await response.json();
            setLibraryItems(data);
        } catch (e) {
            console.error("Erreur lors de la récupération des éléments:", e);
            setError("Impossible de charger les éléments: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLibraryItems();
    }, [searchTerm]);

    const handleChange = (e) => {
        const { name, value, files } = e.target;
        if (name === 'file') {
            setFormData({ ...formData, file: files[0] });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleFileChange = (e) => {
        // No need to reset tempFileName anymore as it's not used
        setFormData({ ...formData, file: e.target.files[0] });
    };

    const displayMessage = (msg, type) => {
        setMessage(msg);
        setMessageType(type);
        setTimeout(() => {
            setMessage(null);
            setMessageType('');
        }, 5000);
    };

    // REMOVE handleFileUpload - It's no longer needed with the single-step approach
    // const handleFileUpload = async () => { /* ... */ };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const tagsArray = formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');

        const dataToSend = new FormData(); // Use FormData for multipart/form-data
        dataToSend.append('id', formData.id);
        dataToSend.append('title', formData.title);
        dataToSend.append('description', formData.description);
        dataToSend.append('type', formData.type);
        dataToSend.append('category', formData.category);
        dataToSend.append('tags', JSON.stringify(tagsArray)); // Tags need to be stringified

        if (formData.file) {
            dataToSend.append('documentFile', formData.file); // Append the actual file
        } else if (isEditing && currentFileUrl) {
            // If no new file is selected during edit, send the existing fileUrl
            dataToSend.append('fileUrl', currentFileUrl);
        }

        if (formData.externalUrl) dataToSend.append('externalUrl', formData.externalUrl);
        if (formData.videoUrl) dataToSend.append('videoUrl', formData.videoUrl);

        const method = isEditing ? 'PUT' : 'POST';
        const url = isEditing ? `${import.meta.env.VITE_API_BASE_URL}api/library-items/${formData.id}` : `${import.meta.env.VITE_API_BASE_URL}api/library-items`;

        try {
            const response = await fetch(url, {
                method: method,
                // IMPORTANT: Do NOT set 'Content-Type': 'application/json' when using FormData.
                // The browser will automatically set 'Content-Type: multipart/form-data' with the correct boundary.
                body: dataToSend // Send the FormData object
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Erreur HTTP! statut: ${response.status}`);
            }

            displayMessage(`Document ${isEditing ? 'mis à jour' : 'ajouté'} avec succès !`, 'success');
            resetForm();
            fetchLibraryItems();
        } catch (error) {
            console.error('Erreur lors de la soumission du document:', error);
            displayMessage(`Erreur: ${error.message}`, 'danger');
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setFormData({
            id: item.id,
            title: item.title,
            description: item.description,
            type: item.type,
            category: item.category,
            tags: Array.isArray(item.tags) ? item.tags.join(', ') : item.tags,
            file: null, // Reset file input
            // tempFileName: '', // No longer needed
            externalUrl: item.externalUrl || '',
            videoUrl: item.videoUrl || ''
        });
        setCurrentFileUrl(item.fileUrl || ''); // Store the existing file URL
        setMessage(null);
        setMessageType('');
    };

    const handleDelete = async (idToDelete) => {
        if (window.confirm(`Êtes-vous sûr de vouloir supprimer le document avec l'ID: ${idToDelete} ?`)) {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}api/library-items/${idToDelete}`, {
                    method: 'DELETE'
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || `Erreur HTTP! statut: ${response.status}`);
                }

                displayMessage('Document supprimé avec succès !', 'success');
                fetchLibraryItems();
            } catch (error) {
                console.error('Erreur lors de la suppression:', error);
                displayMessage(`Erreur de suppression: ${error.message}`, 'danger');
            }
        }
    };

    const resetForm = () => {
        setFormData({
            id: '',
            title: '',
            description: '',
            type: '',
            category: '',
            tags: '',
            file: null,
            // tempFileName: '', // No longer needed
            externalUrl: '',
            videoUrl: ''
        });
        setIsEditing(false);
        setCurrentFileUrl(''); // Clear current file URL on form reset
    };

    return (
        <div className="library-page-container">
            <nav className="navbar navbar-expand-lg navbar-dark bg-dark gespa-navbar">
                <div className="container-fluid">
                    <Link className="navbar-brand gespa-brand" to="/login">GESPA</Link>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#adminNavbar" aria-controls="adminNavbar" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="adminNavbar">
                        <ul className="navbar-nav ms-auto mb-2 mb-lg-0">
                            <li className="nav-item">
                                <Link className="nav-link nav-link-custom" to="/documentation/library">Bibliothèque Publique</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link nav-link-custom active" to="/admin/library">Administration Bibliothèque</Link>
                            </li>
                            <li className="nav-item">
                                <Link className="nav-link nav-link-custom" to="/login">Déconnexion</Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </nav>

            <Container className="my-4">
                <h1 className="text-center mb-4">Administration de la Bibliothèque</h1>

                {message && <Alert variant={messageType}>{message}</Alert>}

                <Card className="mb-4 admin-form-card">
                    <Card.Header as="h5">{isEditing ? 'Modifier un Document' : 'Ajouter un Nouveau Document'}</Card.Header>
                    <Card.Body>
                        <Form onSubmit={handleSubmit}>
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>ID Document (Unique)</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="id"
                                            value={formData.id}
                                            onChange={handleChange}
                                            required
                                            disabled={isEditing}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Titre</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleChange}
                                            required
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Description</Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            name="description"
                                            rows={3}
                                            value={formData.description}
                                            onChange={handleChange}
                                        />
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Type de Document</Form.Label>
                                        <Form.Select name="type" value={formData.type} onChange={handleChange} required>
                                            <option value="">Sélectionner un type</option>
                                            {allTypes.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Catégorie</Form.Label>
                                        <Form.Select name="category" value={formData.category} onChange={handleChange} required>
                                            <option value="">Sélectionner une catégorie</option>
                                            {allCategories.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Tags (séparés par des virgules)</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="tags"
                                            value={formData.tags}
                                            onChange={handleChange}
                                            placeholder="Ex: react, javascript, frontend"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Fichier (.pdf, .doc, .png, etc.)</Form.Label>
                                        <InputGroup>
                                            <Form.Control type="file" name="file" onChange={handleFileChange} />
                                            {/* REMOVE the Uploader button and associated logic */}
                                            {/* <Button variant="outline-secondary" onClick={handleFileUpload}>
                                                <FaUpload className="me-2" /> Uploader
                                            </Button> */}
                                        </InputGroup>
                                        {formData.file && ( // Check if a file is selected
                                            <div className="mt-2 text-info">
                                                <FaInfoCircle className="me-1" /> Fichier sélectionné: {formData.file.name}. Il sera uploadé lors de la soumission.
                                            </div>
                                        )}
                                        {isEditing && currentFileUrl && !formData.file && (
                                            <div className="mt-2 text-muted">
                                                <FaCheckCircle className="me-1" /> Fichier existant: {currentFileUrl.split('/').pop()} (Laisser vide pour conserver)
                                            </div>
                                        )}
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Lien Externe (si applicable)</Form.Label>
                                        <Form.Control
                                            type="url"
                                            name="externalUrl"
                                            value={formData.externalUrl}
                                            onChange={handleChange}
                                            placeholder="Ex: https://example.com/doc"
                                        />
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>URL Vidéo (si applicable)</Form.Label>
                                        <Form.Control
                                            type="url"
                                            name="videoUrl"
                                            value={formData.videoUrl}
                                            onChange={handleChange}
                                            placeholder="Ex: http://youtube.com/watch?v=..."
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>

                            <div className="d-flex justify-content-end mt-4">
                                <Button variant="secondary" onClick={resetForm} className="me-2">
                                    <FaTimesCircle className="me-2" /> Annuler
                                </Button>
                                <Button variant="primary" type="submit">
                                    <FaPlus className="me-2" /> {isEditing ? 'Modifier Document' : 'Ajouter Document'}
                                </Button>
                            </div>
                        </Form>
                    </Card.Body>
                </Card>

                {/* Liste des Documents Existants */}
                <h2 className="mt-5 mb-3 text-center">Documents Existants</h2>
                <InputGroup className="mb-3">
                    <Form.Control
                        type="text"
                        placeholder="Rechercher un document dans la liste..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Button variant="outline-secondary" onClick={() => fetchLibraryItems()}>
                        <FaSearch />
                    </Button>
                </InputGroup>

                {loading ? (
                    <div className="text-center">Chargement des documents...</div>
                ) : error ? (
                    <Alert variant="danger">Erreur: {error}</Alert>
                ) : (
                    <ListGroup className="library-list-admin">
                        {libraryItems.length > 0 ? (
                            libraryItems.map(item => (
                                <ListGroup.Item key={item.id} className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <h5>{item.title} ({item.id})</h5>
                                        <p className="mb-1 text-muted">{item.category} - {item.type}</p>
                                        <small>{item.description ? item.description.substring(0, 100) + '...' : ''}</small>
                                        {item.fileUrl && (
                                            <div className="mt-1">
                                                <a href={`${import.meta.env.VITE_API_BASE_URL}${item.fileUrl}`} target="_blank" rel="noopener noreferrer">
                                                    <FaUpload className="me-1" /> Télécharger Fichier
                                                </a>
                                            </div>
                                        )}
                                        {item.externalUrl && (
                                            <div className="mt-1">
                                                <a href={item.externalUrl} target="_blank" rel="noopener noreferrer">
                                                    <FaInfoCircle className="me-1" /> Lien Externe
                                                </a>
                                            </div>
                                        )}
                                        {item.videoUrl && (
                                            <div className="mt-1">
                                                <a href={item.videoUrl} target="_blank" rel="noopener noreferrer">
                                                    <FaInfoCircle className="me-1" /> Lien Vidéo
                                                </a>
                                            </div>
                                        )}
                                        <div className="item-tags mt-1">
                                            {Array.isArray(item.tags) && item.tags.map(tag => (
                                                <span key={tag} className="badge bg-info text-dark me-1">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <Button variant="warning" size="sm" className="me-2" onClick={() => handleEdit(item)}>
                                            <FaEdit /> Modifier
                                        </Button>
                                        <Button variant="danger" size="sm" onClick={() => handleDelete(item.id)}>
                                            <FaTrash /> Supprimer
                                        </Button>
                                    </div>
                                </ListGroup.Item>
                            ))
                        ) : (
                            <Alert variant="info" className="text-center">Aucun document trouvé dans la bibliothèque.</Alert>
                        )}
                    </ListGroup>
                )}
            </Container>
        </div>
    );
}

export default AdminLibraryPage;