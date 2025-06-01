import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Container, Row, Col, Card, Form, InputGroup, Button, Spinner, Badge, Modal, Pagination } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { Navbar, Nav } from 'react-bootstrap';
import {
    FaBook, FaFileAlt, FaLink, FaVideo, FaSearch, FaDownload,
    FaExternalLinkAlt, FaPlayCircle, FaUser, FaHeart, FaEye,
    FaFilter, FaTh, FaList, FaStar, FaShareAlt,
    FaCalendarAlt, FaClock, FaTag, FaBookmark, FaTimes
} from 'react-icons/fa';

import '../pages/LoginPage.css';
import './LibraryPage.css';

function LibraryPage() {
    // ===== ÉTATS DE BASE =====
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [libraryItems, setLibraryItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // ===== NOUVEAUX ÉTATS POUR AMÉLIORATIONS =====
    const [viewMode, setViewMode] = useState('grid');
    const [sortBy, setSortBy] = useState('recent');
    const [favorites, setFavorites] = useState(new Set());
    const [selectedItem, setSelectedItem] = useState(null);
    const [showPreview, setShowPreview] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [filterByDate, setFilterByDate] = useState('all');
    const [isSearching, setIsSearching] = useState(false);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

    // ===== DEBOUNCED SEARCH =====
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // ===== FONCTION POUR CONSTRUIRE LES URLs PROPREMENT =====
    const buildFileUrl = (path) => {
        if (path.startsWith('http')) {
            return path; // URL absolue, on garde tel quel
        }

        // Pour les chemins locaux comme /files/...
        if (path.startsWith('/files/')) {
            // API_BASE_URL finit par /, donc on enlève le / du début de path
            return `${API_BASE_URL}${path.substring(1)}`;
        }

        // Pour les autres chemins
        return `${API_BASE_URL}${path.startsWith('/') ? path.substring(1) : path}`;
    };

    // ===== FONCTION POUR IMAGES PAR DÉFAUT =====
    const getDefaultImage = (type) => {
        const bookImages = [
            'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1550399105-c4db5fb85c18?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1589998059171-988d887df646?w=300&h=400&fit=crop'
        ];

        const documentImages = [
            'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1568667256549-094345857637?w=300&h=400&fit=crop'
        ];

        const videoImages = [
            'https://images.unsplash.com/photo-1574267432553-4b4628081c31?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1533613220915-609f661a6fe1?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1616530940355-351fabd9524b?w=300&h=400&fit=crop',
            'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=300&h=400&fit=crop'
        ];

        switch (type) {
            case 'Roman':
            case 'Poésie':
            case 'Bande Dessinée':
            case 'Book':
                return bookImages[Math.floor(Math.random() * bookImages.length)];
            case 'Vidéo':
                return videoImages[Math.floor(Math.random() * videoImages.length)];
            default:
                return documentImages[Math.floor(Math.random() * documentImages.length)];
        }
    };

    // ===== FETCH AVEC AMÉLIORATIONS =====
    const fetchLibraryItems = useCallback(async () => {
        setLoading(true);
        setError(null);
        setIsSearching(!!debouncedSearchTerm);

        try {
            let url = `${API_BASE_URL}api/library-items`;
            const params = new URLSearchParams();

            if (debouncedSearchTerm) {
                params.append('search', debouncedSearchTerm);
            }
            if (selectedCategory && selectedCategory !== 'All') {
                params.append('category', selectedCategory);
            }
            if (filterByDate !== 'all') {
                params.append('dateFilter', filterByDate);
            }

            if (params.toString()) {
                url = `${url}?${params.toString()}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            // Simulation d'ajout de métadonnées si pas présentes
            const enhancedData = data.map(item => ({
                ...item,
                downloads: item.downloads || Math.floor(Math.random() * 1000),
                rating: item.rating || (Math.random() * 2 + 3).toFixed(1),
                dateAdded: item.dateAdded || new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
                views: item.views || Math.floor(Math.random() * 500),
                imageUrl: item.imageUrl || getDefaultImage(item.type),
                // ✅ CORRECTION: Utiliser file_url au lieu de fileUrl
                fileUrl: item.file_url || item.fileUrl
            }));

            setLibraryItems(enhancedData);
        } catch (err) {
            console.error("Failed to fetch library items:", err);
            setError(`Impossible de charger les éléments de la bibliothèque. Erreur: ${err.message}`);
        } finally {
            setLoading(false);
            setIsSearching(false);
        }
    }, [debouncedSearchTerm, selectedCategory, filterByDate, API_BASE_URL]);

    useEffect(() => {
        fetchLibraryItems();
    }, [fetchLibraryItems]);

    // ===== CATÉGORIES ÉTENDUES =====
    const allCategories = [
        'All', 'Français', 'Anglais', 'Roman', 'Bande Dessinée', 'Journal',
        'Revue', 'Actualités', 'Management', 'Développement Web', 'Informatique',
        'Sciences', 'Sciences Économiques', 'Littérature', 'Environnement',
        'Design', 'Cybersécurité', 'Histoire', 'Musique', 'Art', 'Santé', 'Voyage', 'Sport'
    ];

    // ===== TRI ET FILTRAGE =====
    const sortedAndFilteredItems = useMemo(() => {
        let filtered = [...libraryItems];

        switch (sortBy) {
            case 'popular':
                filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
                break;
            case 'alphabetical':
                filtered.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'rating':
                filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
                break;
            case 'recent':
            default:
                filtered.sort((a, b) => new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0));
                break;
        }

        return filtered;
    }, [libraryItems, sortBy]);

    // ===== PAGINATION =====
    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedAndFilteredItems.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedAndFilteredItems, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedAndFilteredItems.length / itemsPerPage);

    // ===== GESTION DES FAVORIS =====
    const toggleFavorite = (itemId) => {
        const newFavorites = new Set(favorites);
        if (newFavorites.has(itemId)) {
            newFavorites.delete(itemId);
        } else {
            newFavorites.add(itemId);
        }
        setFavorites(newFavorites);
        localStorage.setItem('libraryFavorites', JSON.stringify([...newFavorites]));
    };

    // ===== CHARGEMENT DES FAVORIS =====
    useEffect(() => {
        const savedFavorites = localStorage.getItem('libraryFavorites');
        if (savedFavorites) {
            setFavorites(new Set(JSON.parse(savedFavorites)));
        }
    }, []);

    // ===== GESTION DES TÉLÉCHARGEMENTS CORRIGÉE - VERSION COMPLÈTE =====
    const handleDownload = async (url, type, itemId) => {
        try {
            console.log('🔍 === DÉBUT TÉLÉCHARGEMENT ===');
            console.log('📥 URL originale reçue:', url);
            console.log('📁 Type:', type);
            console.log('🆔 Item ID:', itemId);

            let downloadUrl;
            let filename;

            // Extraire le nom de fichier de l'URL
            if (url.startsWith('/files/')) {
                filename = url.replace('/files/', '');
                console.log('📄 Fichier local détecté:', filename);

                // ✅ UTILISER LA NOUVELLE ROUTE API
                downloadUrl = `${API_BASE_URL}api/download/${filename}`;
                console.log('🔗 URL API générée:', downloadUrl);

            } else if (url.startsWith('http')) {
                // URL externe complète
                downloadUrl = url;
                filename = url.split('/').pop();
                console.log('🌐 URL externe détectée:', downloadUrl);

            } else {
                // URL relative ou autre format
                filename = url.split('/').pop();
                downloadUrl = buildFileUrl(url);
                console.log('🔄 URL relative convertie:', downloadUrl);
            }

            console.log('📥 URL finale de téléchargement:', downloadUrl);
            console.log('📄 Nom de fichier:', filename);

            // ✅ TESTER D'ABORD SI LE FICHIER EXISTE (pour les fichiers locaux)
            if (url.startsWith('/files/')) {
                try {
                    console.log('🔍 Test existence fichier...');
                    const testResponse = await fetch(`${API_BASE_URL}api/test-file/${filename}`);
                    const testResult = await testResponse.json();

                    console.log('📊 Résultat test fichier:', testResult);

                    if (!testResult.exists) {
                        console.log('❌ Fichier non trouvé sur le serveur!');
                        console.log('📋 Fichiers disponibles:', testResult.allFiles);

                        alert(`❌ Fichier "${filename}" non trouvé sur le serveur.\n\nFichiers disponibles: ${testResult.allFiles?.length || 0}`);
                        return;
                    }

                    console.log('✅ Fichier confirmé existant, procédure de téléchargement...');

                } catch (testError) {
                    console.warn('⚠️ Erreur test fichier (on continue quand même):', testError);
                }
            }

            // ✅ INCRÉMENTER LE COMPTEUR DE TÉLÉCHARGEMENTS DANS L'INTERFACE
            setLibraryItems(prev => prev.map(item =>
                item.id === itemId
                    ? { ...item, downloads: (item.downloads || 0) + 1 }
                    : item
            ));

            // ✅ MÉTHODE 1: Téléchargement via fetch + blob (recommandé pour API)
            if (url.startsWith('/files/')) {
                console.log('📥 Tentative téléchargement via fetch...');

                try {
                    const response = await fetch(downloadUrl);
                    console.log('📊 Statut réponse:', response.status);

                    if (!response.ok) {
                        throw new Error(`Erreur serveur: ${response.status} ${response.statusText}`);
                    }

                    const blob = await response.blob();
                    console.log('📦 Blob créé, taille:', blob.size, 'bytes');

                    // Créer un lien de téléchargement temporaire
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = filename;
                    link.style.display = 'none';

                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);

                    // Nettoyer l'URL blob
                    setTimeout(() => {
                        window.URL.revokeObjectURL(blobUrl);
                    }, 1000);

                    console.log('✅ Téléchargement réussi via fetch!');

                } catch (fetchError) {
                    console.log('❌ Échec fetch, tentative méthode alternative...', fetchError);
                    throw fetchError; // Passer à la méthode alternative
                }

            } else {
                // Pour les URLs externes, utiliser l'ouverture directe
                console.log('🌐 Ouverture URL externe...');
                window.open(downloadUrl, '_blank');
            }

        } catch (error) {
            console.error('❌ ERREUR TÉLÉCHARGEMENT:', error);

            // ✅ MÉTHODE ALTERNATIVE: Ouverture directe
            console.log('🔄 Tentative méthode alternative...');
            try {
                const fallbackUrl = url.startsWith('/files/')
                    ? `${API_BASE_URL}files/${url.replace('/files/', '')}`
                    : url;

                console.log('🔗 URL fallback:', fallbackUrl);

                const link = document.createElement('a');
                link.href = fallbackUrl;
                link.target = '_blank';
                link.download = '';
                link.style.display = 'none';

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                console.log('🔄 Tentative fallback effectuée');

            } catch (fallbackError) {
                console.error('❌ Échec complet du téléchargement:', fallbackError);
                alert(`❌ Erreur lors du téléchargement de "${filename || 'le fichier'}".\n\nDétails: ${error.message}\n\nVeuillez vérifier que le fichier existe sur le serveur.`);
            }
        }

        // ✅ NOTIFIER LE SERVEUR POUR LES STATISTIQUES (optionnel)
        try {
            await fetch(`${API_BASE_URL}api/library-items/${itemId}/stats`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'download' })
            });
            console.log('📊 Statistiques mises à jour');
        } catch (statError) {
            console.warn('⚠️ Erreur mise à jour stats (non critique):', statError);
        }

        console.log('🏁 === FIN TÉLÉCHARGEMENT ===\n');
    };

    // ===== PRÉVISUALISATION =====
    const handlePreview = (item) => {
        setSelectedItem(item);
        setShowPreview(true);

        // Incrémenter le compteur de vues
        setLibraryItems(prev => prev.map(i =>
            i.id === item.id
                ? { ...i, views: (i.views || 0) + 1 }
                : i
        ));
    };

    // ===== ICÔNES PAR TYPE =====
    const getTypeIcon = (type) => {
        switch (type) {
            case 'Document':
            case 'Manuel':
            case 'Guide Technique':
            case 'Essai':
            case 'Article':
            case 'Histoire':
                return <FaFileAlt className="me-2 text-primary" />;
            case 'Roman':
            case 'Poésie':
                return <FaBook className="me-2 text-success" />;
            case 'BD':
            case 'Bande Dessinée':
                return <FaBook className="me-2 text-warning" />;
            case 'Journal':
            case 'Revue':
                return <FaFileAlt className="me-2 text-info" />;
            case 'Lien Externe':
            case 'Tutoriel':
                return <FaLink className="me-2 text-secondary" />;
            case 'Vidéo':
                return <FaVideo className="me-2 text-danger" />;
            case 'Schéma':
                return <FaFileAlt className="me-2 text-dark" />;
            default:
                return <FaFileAlt className="me-2" />;
        }
    };

    // ===== PARTAGE =====
    const handleShare = async (item) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: item.title,
                    text: item.description,
                    url: window.location.href
                });
            } catch (err) {
                console.log('Erreur lors du partage:', err);
            }
        } else {
            navigator.clipboard.writeText(`${item.title} - ${window.location.href}`);
            alert('Lien copié dans le presse-papier !');
        }
    };

    return (
        <div className="library-page-container">
            {/* ===== NAVBAR ===== */}
            <Navbar bg="dark" variant="dark" expand="lg" className="gespa-navbar">
                <Container fluid>
                    <Navbar.Brand as={Link} to="/login" className="gespa-brand">
                        <div className="brand-container">
                            <span className="brand-title">GESPA</span>
                            <span className="brand-version">v1.0</span>
                        </div>
                    </Navbar.Brand>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="ms-auto">
                            <Nav.Link as={Link} to="/documentation/library" className="nav-link-custom active">
                                <FaBook className="me-2" />
                                Bibliothèque
                            </Nav.Link>
                            <Nav.Link as={Link} to="/login" className="nav-link-custom">
                                <FaUser className="me-2" />
                                Connexion
                            </Nav.Link>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            <Container className="my-4 flex-grow-1">
                {/* ===== HEADER AVEC STATISTIQUES ===== */}
                <div className="library-header mb-4">
                    <Row className="align-items-center">
                        <Col md={8}>
                            <h1 className="library-title">
                                <FaBook className="me-3" />
                                Bibliothèque de Ressources
                            </h1>
                            <p className="library-subtitle">
                                {sortedAndFilteredItems.length} ressources disponibles
                                {isSearching && <Spinner size="sm" className="ms-2" />}
                            </p>
                        </Col>
                        <Col md={4} className="text-end">
                            <div className="library-stats">
                                <Badge bg="primary" className="me-2">
                                    <FaDownload className="me-1" />
                                    {libraryItems.reduce((sum, item) => sum + (item.downloads || 0), 0)} téléchargements
                                </Badge>
                                <Badge bg="success">
                                    <FaHeart className="me-1" />
                                    {favorites.size} favoris
                                </Badge>
                            </div>
                        </Col>
                    </Row>
                </div>

                {/* ===== BARRE DE RECHERCHE ET FILTRES ===== */}
                <Card className="search-filter-card mb-4">
                    <Card.Body>
                        <Row className="g-3">
                            {/* Recherche */}
                            <Col md={6}>
                                <InputGroup>
                                    <Form.Control
                                        type="text"
                                        placeholder="Rechercher par titre, description ou tags..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input"
                                    />
                                    <Button variant="outline-primary" className="search-btn">
                                        <FaSearch />
                                    </Button>
                                </InputGroup>
                            </Col>

                            {/* Catégorie */}
                            <Col md={3}>
                                <Form.Select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="category-select"
                                >
                                    {allCategories.map(category => (
                                        <option key={category} value={category}>
                                            {category === 'All' ? 'Toutes les catégories' : category}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Col>

                            {/* Tri */}
                            <Col md={3}>
                                <Form.Select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="sort-select"
                                >
                                    <option value="recent">Plus récents</option>
                                    <option value="popular">Plus populaires</option>
                                    <option value="alphabetical">Alphabétique</option>
                                    <option value="rating">Mieux notés</option>
                                </Form.Select>
                            </Col>
                        </Row>

                        {/* Filtres secondaires */}
                        <Row className="mt-3 align-items-center">
                            <Col md={6}>
                                <div className="d-flex gap-2 flex-wrap">
                                    <Form.Select
                                        size="sm"
                                        value={filterByDate}
                                        onChange={(e) => setFilterByDate(e.target.value)}
                                        style={{ width: 'auto' }}
                                    >
                                        <option value="all">Toutes les dates</option>
                                        <option value="week">Cette semaine</option>
                                        <option value="month">Ce mois</option>
                                        <option value="year">Cette année</option>
                                    </Form.Select>
                                </div>
                            </Col>

                            {/* Mode d'affichage */}
                            <Col md={6} className="text-end">
                                <div className="view-mode-toggle">
                                    <Button
                                        variant={viewMode === 'grid' ? 'primary' : 'outline-primary'}
                                        size="sm"
                                        onClick={() => setViewMode('grid')}
                                        className="me-2"
                                    >
                                        <FaTh />
                                    </Button>
                                    <Button
                                        variant={viewMode === 'list' ? 'primary' : 'outline-primary'}
                                        size="sm"
                                        onClick={() => setViewMode('list')}
                                    >
                                        <FaList />
                                    </Button>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* ===== AFFICHAGE DES ÉLÉMENTS ===== */}
                {loading ? (
                    <div className="text-center mt-5 loading-section">
                        <Spinner animation="border" role="status" className="mb-3">
                            <span className="visually-hidden">Chargement...</span>
                        </Spinner>
                        <p>Chargement de la bibliothèque...</p>
                    </div>
                ) : error ? (
                    <div className="alert alert-danger text-center mt-5">
                        <h4>Erreur</h4>
                        <p>{error}</p>
                        <Button variant="primary" onClick={fetchLibraryItems}>
                            Réessayer
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Affichage en grille */}
                        {viewMode === 'grid' && (
                            <Row>
                                {paginatedItems.length > 0 ? (
                                    paginatedItems.map(item => (
                                        <Col key={item.id} sm={12} md={6} lg={4} xl={3} className="mb-4">
                                            <Card className="h-100 library-item-card enhanced-card">
                                                <div className="card-image-container">
                                                    <Card.Img
                                                        variant="top"
                                                        src={item.imageUrl}
                                                        className="card-image"
                                                        onError={(e) => {
                                                            e.target.src = getDefaultImage(item.type);
                                                        }}
                                                    />
                                                    <div className="image-overlay">
                                                        <Button
                                                            variant="light"
                                                            size="sm"
                                                            onClick={() => handlePreview(item)}
                                                            className="preview-btn"
                                                        >
                                                            <FaEye />
                                                        </Button>
                                                        <Button
                                                            variant={favorites.has(item.id) ? "danger" : "light"}
                                                            size="sm"
                                                            onClick={() => toggleFavorite(item.id)}
                                                            className="favorite-btn"
                                                        >
                                                            <FaHeart />
                                                        </Button>
                                                    </div>
                                                    <div className="rating-badge">
                                                        <FaStar className="text-warning me-1" />
                                                        {item.rating}
                                                    </div>
                                                </div>

                                                <Card.Body className="d-flex flex-column">
                                                    <div className="mb-2">
                                                        <Card.Title className="item-title">
                                                            {getTypeIcon(item.type)}
                                                            {item.title}
                                                        </Card.Title>
                                                        <Card.Subtitle className="item-category text-muted">
                                                            {item.category} • {item.type}
                                                        </Card.Subtitle>
                                                    </div>

                                                    <Card.Text className="item-description flex-grow-1">
                                                        {item.description}
                                                    </Card.Text>

                                                    <div className="item-tags mb-3">
                                                        {Array.isArray(item.tags) && item.tags.slice(0, 3).map(tag => (
                                                            <Badge key={tag} bg="secondary" className="me-1 mb-1">
                                                                <FaTag className="me-1" />
                                                                {tag}
                                                            </Badge>
                                                        ))}
                                                    </div>

                                                    <div className="item-stats mb-3">
                                                        <small className="text-muted d-flex justify-content-between">
                                                            <span>
                                                                <FaDownload className="me-1" />
                                                                {item.downloads || 0}
                                                            </span>
                                                            <span>
                                                                <FaEye className="me-1" />
                                                                {item.views || 0}
                                                            </span>
                                                            <span>
                                                                <FaClock className="me-1" />
                                                                {new Date(item.dateAdded).toLocaleDateString()}
                                                            </span>
                                                        </small>
                                                    </div>

                                                    <div className="item-actions">
                                                        {/* Boutons d'action */}
                                                        {item.fileUrl && (
                                                            <Button
                                                                variant="primary"
                                                                onClick={() => {
                                                                    console.log('🖱️ Clic téléchargement pour:', item.title);
                                                                    console.log('📄 URL fichier:', item.fileUrl);
                                                                    handleDownload(item.fileUrl, item.type, item.id);
                                                                }}
                                                                className="w-100 mb-2 download-btn"
                                                            >
                                                                <FaDownload className="me-2" />
                                                                Télécharger
                                                            </Button>
                                                        )}
                                                        {item.externalUrl && (
                                                            <Button
                                                                variant="info"
                                                                href={item.externalUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-100 mb-2 open-link-btn"
                                                            >
                                                                <FaExternalLinkAlt className="me-2" />
                                                                Ouvrir le Lien
                                                            </Button>
                                                        )}
                                                        {item.videoUrl && (
                                                            <Button
                                                                variant="warning"
                                                                href={item.videoUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="w-100 mb-2 watch-video-btn"
                                                            >
                                                                <FaPlayCircle className="me-2" />
                                                                Regarder
                                                            </Button>
                                                        )}

                                                        <Button
                                                            variant="outline-secondary"
                                                            size="sm"
                                                            onClick={() => handleShare(item)}
                                                            className="w-100"
                                                        >
                                                            <FaShareAlt className="me-2" />
                                                            Partager
                                                        </Button>
                                                    </div>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))
                                ) : (
                                    <Col className="text-center mt-5">
                                        <div className="no-results">
                                            <FaBook size={48} className="text-muted mb-3" />
                                            <h4>Aucune ressource trouvée</h4>
                                            <p className="text-muted">Essayez de modifier vos critères de recherche.</p>
                                        </div>
                                    </Col>
                                )}
                            </Row>
                        )}

                        {/* Affichage en liste */}
                        {viewMode === 'list' && (
                            <div className="list-view">
                                {paginatedItems.length > 0 ? (
                                    paginatedItems.map(item => (
                                        <Card key={item.id} className="mb-3 library-item-card list-item">
                                            <Row className="g-0">
                                                <Col md={2}>
                                                    <Card.Img
                                                        src={item.imageUrl}
                                                        className="list-image"
                                                        onError={(e) => {
                                                            e.target.src = getDefaultImage(item.type);
                                                        }}
                                                    />
                                                </Col>
                                                <Col md={7}>
                                                    <Card.Body>
                                                        <div className="d-flex justify-content-between align-items-start">
                                                            <div>
                                                                <Card.Title className="item-title">
                                                                    {getTypeIcon(item.type)}
                                                                    {item.title}
                                                                </Card.Title>
                                                                <Card.Subtitle className="text-muted mb-2">
                                                                    {item.category} • {item.type}
                                                                </Card.Subtitle>
                                                                <Card.Text className="item-description">
                                                                    {item.description}
                                                                </Card.Text>
                                                                <div className="item-tags">
                                                                    {Array.isArray(item.tags) && item.tags.slice(0, 5).map(tag => (
                                                                        <Badge key={tag} bg="secondary" className="me-1">
                                                                            {tag}
                                                                        </Badge>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="text-end">
                                                                <div className="rating-badge mb-2">
                                                                    <FaStar className="text-warning me-1" />
                                                                    {item.rating}
                                                                </div>
                                                                <small className="text-muted d-block">
                                                                    <FaDownload className="me-1" />
                                                                    {item.downloads || 0}
                                                                </small>
                                                                <small className="text-muted d-block">
                                                                    <FaEye className="me-1" />
                                                                    {item.views || 0}
                                                                </small>
                                                            </div>
                                                        </div>
                                                    </Card.Body>
                                                </Col>
                                                <Col md={3}>
                                                    <Card.Body className="text-center">
                                                        <div className="d-flex flex-column gap-2">
                                                            <Button
                                                                variant={favorites.has(item.id) ? "danger" : "outline-danger"}
                                                                size="sm"
                                                                onClick={() => toggleFavorite(item.id)}
                                                            >
                                                                <FaHeart className="me-1" />
                                                                {favorites.has(item.id) ? 'Favoris' : 'Favori'}
                                                            </Button>
                                                            <Button
                                                                variant="outline-secondary"
                                                                size="sm"
                                                                onClick={() => handlePreview(item)}
                                                            >
                                                                <FaEye className="me-1" />
                                                                Aperçu
                                                            </Button>
                                                        </div>
                                                    </Card.Body>
                                                </Col>
                                            </Row>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="text-center mt-5">
                                        <div className="no-results">
                                            <FaBook size={48} className="text-muted mb-3" />
                                            <h4>Aucune ressource trouvée</h4>
                                            <p className="text-muted">Essayez de modifier vos critères de recherche.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ===== PAGINATION ===== */}
                        {totalPages > 1 && (
                            <div className="d-flex justify-content-center mt-4">
                                <Pagination>
                                    <Pagination.First
                                        onClick={() => setCurrentPage(1)}
                                        disabled={currentPage === 1}
                                    />
                                    <Pagination.Prev
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                    />

                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        let pageNum;
                                        if (totalPages <= 5) {
                                            pageNum = i + 1;
                                        } else if (currentPage <= 3) {
                                            pageNum = i + 1;
                                        } else if (currentPage >= totalPages - 2) {
                                            pageNum = totalPages - 4 + i;
                                        } else {
                                            pageNum = currentPage - 2 + i;
                                        }

                                        return (
                                            <Pagination.Item
                                                key={pageNum}
                                                active={pageNum === currentPage}
                                                onClick={() => setCurrentPage(pageNum)}
                                            >
                                                {pageNum}
                                            </Pagination.Item>
                                        );
                                    })}

                                    <Pagination.Next
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    />
                                    <Pagination.Last
                                        onClick={() => setCurrentPage(totalPages)}
                                        disabled={currentPage === totalPages}
                                    />
                                </Pagination>
                            </div>
                        )}
                    </>
                )}

                {/* ===== MODAL DE PRÉVISUALISATION ===== */}
                <Modal show={showPreview} onHide={() => setShowPreview(false)} size="lg" centered>
                    <Modal.Header closeButton>
                        <Modal.Title>
                            {selectedItem && getTypeIcon(selectedItem.type)}
                            {selectedItem?.title}
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {selectedItem && (
                            <Row>
                                <Col md={4}>
                                    <img
                                        src={selectedItem.imageUrl}
                                        alt={selectedItem.title}
                                        className="img-fluid rounded"
                                        onError={(e) => {
                                            e.target.src = getDefaultImage(selectedItem.type);
                                        }}
                                    />
                                    <div className="mt-3">
                                        <div className="d-flex justify-content-between mb-2">
                                            <small className="text-muted">Note:</small>
                                            <div>
                                                <FaStar className="text-warning me-1" />
                                                {selectedItem.rating}
                                            </div>
                                        </div>
                                        <div className="d-flex justify-content-between mb-2">
                                            <small className="text-muted">Téléchargements:</small>
                                            <span>{selectedItem.downloads || 0}</span>
                                        </div>
                                        <div className="d-flex justify-content-between">
                                            <small className="text-muted">Vues:</small>
                                            <span>{selectedItem.views || 0}</span>
                                        </div>
                                    </div>
                                </Col>
                                <Col md={8}>
                                    <h5>Description</h5>
                                    <p>{selectedItem.description}</p>

                                    <h6>Catégorie</h6>
                                    <Badge bg="primary" className="mb-3">{selectedItem.category}</Badge>

                                    <h6>Tags</h6>
                                    <div className="mb-3">
                                        {Array.isArray(selectedItem.tags) && selectedItem.tags.map(tag => (
                                            <Badge key={tag} bg="secondary" className="me-1 mb-1">
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>

                                    <div className="d-flex gap-2 flex-wrap">
                                        {selectedItem.fileUrl && (
                                            <Button
                                                variant="primary"
                                                onClick={() => {
                                                    console.log('🖱️ Clic téléchargement modal pour:', selectedItem.title);
                                                    console.log('📄 URL fichier modal:', selectedItem.fileUrl);
                                                    handleDownload(selectedItem.fileUrl, selectedItem.type, selectedItem.id);
                                                }}
                                            >
                                                <FaDownload className="me-2" />
                                                Télécharger
                                            </Button>
                                        )}
                                        {selectedItem.externalUrl && (
                                            <Button
                                                variant="info"
                                                href={selectedItem.externalUrl}
                                                target="_blank"
                                            >
                                                <FaExternalLinkAlt className="me-2" />
                                                Ouvrir le Lien
                                            </Button>
                                        )}
                                        {selectedItem.videoUrl && (
                                            <Button
                                                variant="warning"
                                                href={selectedItem.videoUrl}
                                                target="_blank"
                                            >
                                                <FaPlayCircle className="me-2" />
                                                Regarder
                                            </Button>
                                        )}
                                        <Button
                                            variant={favorites.has(selectedItem.id) ? "danger" : "outline-danger"}
                                            onClick={() => toggleFavorite(selectedItem.id)}
                                        >
                                            <FaHeart className="me-2" />
                                            {favorites.has(selectedItem.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                        </Button>
                                        <Button
                                            variant="outline-secondary"
                                            onClick={() => handleShare(selectedItem)}
                                        >
                                            <FaShareAlt className="me-2" />
                                            Partager
                                        </Button>
                                    </div>
                                </Col>
                            </Row>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowPreview(false)}>
                            <FaTimes className="me-2" />
                            Fermer
                        </Button>
                    </Modal.Footer>
                </Modal>
            </Container>
        </div>
    );
}

export default LibraryPage;