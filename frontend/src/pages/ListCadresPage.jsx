// src/pages/CadresList.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Form, Pagination, Table } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { FaSearch, FaFilter, FaFileExcel, FaFilePdf, FaEye, FaEdit, FaTimes, FaTrash, FaPrint, FaImage } from 'react-icons/fa';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Hiérarchie des grades en ordre décroissant
const GRADE_HIERARCHY = [
    'COL', 'LCL', 'CEN', 'MDCT', 'CNE',
    'LTN', 'DLTN', 'MLTN', 'GPCE', 'GPHC',
    'GP1C', 'GP2C', 'GHC', 'G1C', 'G2C', 'GST'
];

const printStyles = `
    @media print {
        .no-print {
            display: none !important;
        }
        body {
            margin: 0;
            padding: 0;
        }
        .modal-body {
            background: white !important;
        }
    }
`;

const calculateDuration = (startDateString) => {
    if (!startDateString) return '-';

    const startDate = new Date(startDateString);
    const today = new Date();

    let years = today.getFullYear() - startDate.getFullYear();
    let months = today.getMonth() - startDate.getMonth();
    let days = today.getDate() - startDate.getDate();

    if (days < 0) {
        months--;
        days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    }

    if (months < 0) {
        years--;
        months += 12;
    }

    const parts = [];
    if (years > 0) parts.push(`${years} an${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} mois`);
    if (days > 0) parts.push(`${days} jour${days > 1 ? 's' : ''}`);

    return parts.length > 0 ? parts.join(' et ') : 'Moins d\'un jour';
};

function CadresList() {
    const { token } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // États pour les données
    const [cadres, setCadres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // NOUVEAU : États pour les filtres améliorés
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEntite, setFilterEntite] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterEscadron, setFilterEscadron] = useState('');
    const [filterStatut, setFilterStatut] = useState('');
    const [filterCours, setFilterCours] = useState('');

    // Options de filtres
    const [allServices, setAllServices] = useState([]);
    const [allEscadrons, setAllEscadrons] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [servicesError, setServicesError] = useState(null);

    // États pour la pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);

    // États pour les modales
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [cadreToEdit, setCadreToEdit] = useState(null);
    const [cadreToDetail, setCadreToDetail] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);

    // NOUVEAU : États pour l'export
    const [isExporting, setIsExporting] = useState(false);

    const detailModalBodyRef = useRef(null);

    // NOUVEAU : Extraire le terme de recherche de l'URL
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const searchParam = urlParams.get('search');
        if (searchParam) {
            setSearchTerm(searchParam);
            console.log(`🔍 Terme de recherche détecté dans l'URL: "${searchParam}"`);
        }
    }, [location]);

    // Fonction de tri des grades selon la hiérarchie puis par date de nomination
    const sortByGradeAndNominationDate = useCallback((data) => {
        return [...data].sort((a, b) => {
            const gradeA = a.grade?.toUpperCase() || '';
            const gradeB = b.grade?.toUpperCase() || '';

            const indexA = GRADE_HIERARCHY.indexOf(gradeA);
            const indexB = GRADE_HIERARCHY.indexOf(gradeB);

            if (indexA !== indexB) {
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return gradeA.localeCompare(gradeB);
            }

            const dateNominationA = a.date_nomination ? new Date(a.date_nomination) : null;
            const dateNominationB = b.date_nomination ? new Date(b.date_nomination) : null;

            if (dateNominationA && dateNominationB) {
                return dateNominationA.getTime() - dateNominationB.getTime();
            }

            if (dateNominationA) return -1;
            if (dateNominationB) return 1;
            return 0;
        });
    }, []);

    // NOUVEAU : Charger les options de filtres
    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!token) return;

            setServicesLoading(true);
            try {
                // Récupérer les services via la nouvelle route
                const servicesResponse = await fetch(`${API_BASE_URL}api/cadres/services`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (servicesResponse.ok) {
                    const services = await servicesResponse.json();
                    setAllServices(services);
                    console.log(`✅ ${services.length} services chargés`);
                } else {
                    // Fallback vers l'ancienne méthode
                    const response = await fetch(`${API_BASE_URL}api/cadres?entite=Service`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const uniqueServices = [...new Set(data.map(c => c.service).filter(s => s))];
                        setAllServices(uniqueServices.sort());
                    }
                }

                // Récupérer les escadrons
                const escadronsResponse = await fetch(`${API_BASE_URL}api/escadrons`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (escadronsResponse.ok) {
                    const escadrons = await escadronsResponse.json();
                    setAllEscadrons(escadrons);
                    console.log(`✅ ${escadrons.length} escadrons chargés`);
                }
            } catch (error) {
                console.error('❌ Erreur lors du chargement des options de filtres:', error);
                setServicesError(error.message);
            } finally {
                setServicesLoading(false);
            }
        };

        fetchFilterOptions();
    }, [token]);

    // Chargement des cadres avec filtres
    useEffect(() => {
        const fetchCadres = async () => {
            if (!token) {
                setError("Authentification requise");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const queryParams = new URLSearchParams();

                if (filterEntite) queryParams.append('entite', filterEntite);
                if (filterService) queryParams.append('service', filterService);
                if (filterCours) queryParams.append('cours', filterCours);
                if (filterEscadron) queryParams.append('escadron', filterEscadron);
                if (filterStatut) queryParams.append('statut', filterStatut);

                const url = `${API_BASE_URL}api/cadres?${queryParams.toString()}`;
                console.log("🔄 Chargement des cadres depuis:", url);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });

                if (!response.ok) {
                    throw new Error(`Erreur ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                setCadres(sortByGradeAndNominationDate(data));
                setCurrentPage(1);
                console.log(`✅ ${data.length} cadres chargés et triés`);

            } catch (err) {
                console.error("❌ Erreur lors du chargement des cadres:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCadres();
    }, [token, filterEntite, filterService, filterCours, filterEscadron, filterStatut, sortByGradeAndNominationDate]);

    // NOUVEAU : Filtrage côté client avec recherche
    const filteredAndSearchedCadres = useMemo(() => {
        let filtered = [...cadres];

        // Appliquer la recherche textuelle
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            filtered = filtered.filter(cadre =>
                cadre.nom?.toLowerCase().includes(term) ||
                cadre.prenom?.toLowerCase().includes(term) ||
                cadre.matricule?.toLowerCase().includes(term) ||
                cadre.grade?.toLowerCase().includes(term) ||
                cadre.service?.toLowerCase().includes(term) ||
                cadre.fonction?.toLowerCase().includes(term) ||
                cadre.entite?.toLowerCase().includes(term) ||
                cadre.numero_telephone?.toLowerCase().includes(term) ||
                cadre.email?.toLowerCase().includes(term) ||
                cadre.EscadronResponsable?.nom?.toLowerCase().includes(term)
            );
        }

        return filtered;
    }, [cadres, searchTerm]);

    // Gestion pagination mise à jour
    const paginationData = useMemo(() => {
        const totalItems = filteredAndSearchedCadres.length;
        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;

        return {
            currentItems: filteredAndSearchedCadres.slice(indexOfFirstItem, indexOfLastItem),
            totalPages: Math.ceil(totalItems / itemsPerPage),
            indexOfFirstItem,
            indexOfLastItem,
            totalItems
        };
    }, [filteredAndSearchedCadres, currentPage, itemsPerPage]);

    // NOUVEAU : Fonction d'export Excel
    const handleExportExcel = useCallback(() => {
        setIsExporting(true);
        try {
            const headers = [
                'Grade', 'Nom', 'Prénom', 'Matricule', 'Téléphone', 'Email',
                'Service', 'Escadron', 'Fonction', 'Entité', 'Statut', 'Sexe',
                'Date Nomination', 'Date Séjour EGNA'
            ];

            const excelData = [headers];

            filteredAndSearchedCadres.forEach(cadre => {
                excelData.push([
                    cadre.grade || '',
                    cadre.nom || '',
                    cadre.prenom || '',
                    cadre.matricule || '',
                    cadre.numero_telephone || '',
                    cadre.email || '',
                    cadre.service || '',
                    cadre.EscadronResponsable?.nom || '',
                    cadre.fonction || '',
                    cadre.entite || '',
                    cadre.statut_absence || 'Présent',
                    cadre.sexe || '',
                    cadre.date_nomination || '',
                    cadre.date_sejour_egna || ''
                ]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Cadres');

            let fileName = `liste_cadres_${new Date().toISOString().split('T')[0]}`;
            if (searchTerm) fileName += `_recherche_${searchTerm.replace(/\s+/g, '_')}`;
            if (filterService) fileName += `_${filterService}`;
            if (filterEntite) fileName += `_${filterEntite}`;
            fileName += '.xlsx';

            XLSX.writeFile(workbook, fileName);

            Swal.fire({
                icon: 'success',
                title: 'Export Excel réussi',
                text: `${filteredAndSearchedCadres.length} cadres exportés`,
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error('❌ Erreur lors de l\'export Excel:', error);
            Swal.fire('Erreur', 'Impossible d\'exporter les données', 'error');
        } finally {
            setIsExporting(false);
        }
    }, [filteredAndSearchedCadres, searchTerm, filterService, filterEntite]);

    // Génération PDF mise à jour
    const handleGeneratePdf = useCallback(async () => {
        if (filteredAndSearchedCadres.length === 0) {
            Swal.fire("Info", "Aucun cadre à imprimer", "info");
            return;
        }

        const swal = Swal.fire({
            title: 'Génération PDF',
            text: 'Préparation du document...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const doc = new jsPDF('landscape');
            doc.setFontSize(16);

            let titre = `Liste des cadres`;
            if (searchTerm) titre += ` - Recherche: "${searchTerm}"`;
            if (filterEntite) titre += ` - ${filterEntite}`;

            doc.text(titre, 148, 15, { align: 'center' });

            // Informations sur les filtres
            let filterInfo = '';
            if (filterService) filterInfo += `Service: ${filterService} | `;
            if (filterEscadron) {
                const escadron = allEscadrons.find(e => e.id.toString() === filterEscadron);
                if (escadron) filterInfo += `Escadron: ${escadron.nom} | `;
            }
            if (filterStatut) filterInfo += `Statut: ${filterStatut} | `;

            if (filterInfo) {
                doc.setFontSize(10);
                doc.text(`Filtres: ${filterInfo.slice(0, -3)}`, 148, 22, { align: 'center' });
            }

            doc.autoTable({
                startY: filterInfo ? 30 : 25,
                head: [['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Téléphone', 'Service', 'Escadron']],
                body: filteredAndSearchedCadres.map((cadre, index) => [
                    index + 1,
                    cadre.grade || '-',
                    cadre.nom || '-',
                    cadre.prenom || '-',
                    cadre.matricule || '-',
                    cadre.numero_telephone || '-',
                    cadre.service || '-',
                    cadre.EscadronResponsable?.nom || '-'
                ]),
                margin: { top: 20 },
                styles: { fontSize: 10 },
                headStyles: { fillColor: [41, 128, 185] }
            });

            let fileName = `liste_cadres_${new Date().toISOString().slice(0,10)}`;
            if (searchTerm) fileName += `_recherche_${searchTerm.replace(/\s+/g, '_')}`;
            fileName += '.pdf';

            doc.save(fileName);
            await swal.close();

            Swal.fire({
                icon: 'success',
                title: 'PDF généré',
                text: `${filteredAndSearchedCadres.length} cadres exportés`,
                timer: 2000,
                showConfirmButton: false
            });

        } catch (error) {
            console.error("❌ Erreur génération PDF:", error);
            await swal.close();
            Swal.fire("Erreur", "Échec de la génération du PDF", "error");
        }
    }, [filteredAndSearchedCadres, searchTerm, filterEntite, filterService, filterEscadron, filterStatut, allEscadrons]);

    // NOUVEAU : Fonction pour réinitialiser les filtres
    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterEntite('');
        setFilterService('');
        setFilterEscadron('');
        setFilterStatut('');
        setFilterCours('');
        navigate('/cadres', { replace: true });
    };

    // Fonction d'édition
    const handleEdit = (cadre) => {
        setCadreToEdit(cadre);
        setEditFormData({
            id: cadre.id,
            nom: cadre.nom || '',
            prenom: cadre.prenom || '',
            matricule: cadre.matricule || '',
            grade: cadre.grade || '',
            fonction: cadre.fonction || '',
            entite: cadre.entite || 'None',
            service: cadre.service || '',
            cours: cadre.cours || null,
            sexe: cadre.sexe || '',
            numero_telephone: cadre.numero_telephone || '',

        });
        setShowEditModal(true);
    };

    // Soumission du formulaire d'édition
    const handleEditSubmit = async () => {
        setEditLoading(true);
        setEditError(null);

        try {
            const response = await fetch(`${API_BASE_URL}api/cadres/${editFormData.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editFormData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la mise à jour');
            }

            const updatedCadre = await response.json();

            setCadres(prevCadres =>
                prevCadres.map(cadre =>
                    cadre.id === editFormData.id ? updatedCadre.cadre : cadre
                )
            );

            setShowEditModal(false);
            Swal.fire('Succès', 'Cadre mis à jour avec succès', 'success');
        } catch (err) {
            setEditError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    // Fonction de suppression
    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: 'Confirmer la suppression',
            text: "Cette action est irréversible!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}api/cadres/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Échec de la suppression');
                }

                setCadres(cadres.filter(c => c.id !== id));
                Swal.fire('Supprimé!', 'Le cadre a été supprimé.', 'success');
            } catch (err) {
                Swal.fire('Erreur!', err.message, 'error');
            }
        }
    };

    const handleDetail = (cadre) => {
        setCadreToDetail(cadre);
        setShowDetailModal(true);
    };

    const handlePrintDetail = useCallback(async () => {
        const input = detailModalBodyRef.current;
        if (!input || !cadreToDetail) {
            Swal.fire("Erreur", "Contenu à imprimer non disponible.", "error");
            return;
        }

        const swal = Swal.fire({
            title: 'Génération PDF Fiche',
            text: 'Préparation du document...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        try {
            const canvas = await html2canvas(input, {
                scale: 2,
                useCORS: true,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            const imgWidth = 210;
            const pageHeight = 295;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`fiche_${cadreToDetail.nom}_${cadreToDetail.prenom}.pdf`);
            await swal.close();
        } catch (error) {
            console.error("Erreur génération PDF:", error);
            await swal.close();
            Swal.fire("Erreur", "Échec de la génération du PDF", "error");
        }
    }, [cadreToDetail]);

    return (
        <div className="container-fluid">
            <style>{printStyles}</style>
            <div className="row">
                <div className="col-12">
                    <h1 className="mb-4 d-flex align-items-center">
                        <FaSearch className="me-2" />
                        Liste des Cadres
                        <span className="badge bg-primary ms-2">{filteredAndSearchedCadres.length}</span>
                        {searchTerm && <small className="text-muted ms-2">- Recherche: "{searchTerm}"</small>}
                    </h1>

                    {/* NOUVEAU : Section des filtres améliorée */}
                    <div className="card mb-4">
                        <div className="card-header">
                            <h5 className="mb-0">
                                <FaFilter className="me-2" />
                                Filtres de recherche
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                {/* Champ de recherche */}
                                <div className="col-md-3">
                                    <Form.Group>
                                        <Form.Label>
                                            <FaSearch className="me-1" />
                                            Recherche
                                        </Form.Label>
                                        <Form.Control
                                            type="text"
                                            placeholder="Nom, prénom, matricule, grade..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </Form.Group>
                                </div>

                                {/* Filtre Entité */}
                                <div className="col-md-2">
                                    <Form.Group>
                                        <Form.Label>Entité</Form.Label>
                                        <Form.Select
                                            value={filterEntite}
                                            onChange={(e) => setFilterEntite(e.target.value)}
                                        >
                                            <option value="">Toutes</option>
                                            <option value="Service">Service</option>
                                            <option value="Escadron">Escadron</option>
                                            <option value="None">Aucune</option>
                                        </Form.Select>
                                    </Form.Group>
                                </div>

                                {/* Filtre Service */}
                                <div className="col-md-2">
                                    <Form.Group>
                                        <Form.Label>Service</Form.Label>
                                        <Form.Select
                                            value={filterService}
                                            onChange={(e) => setFilterService(e.target.value)}
                                            disabled={servicesLoading}
                                        >
                                            <option value="">Tous</option>
                                            {allServices.map(service => (
                                                <option key={service} value={service}>{service}</option>
                                            ))}
                                        </Form.Select>
                                        {servicesError && <small className="text-danger">{servicesError}</small>}
                                    </Form.Group>
                                </div>

                                {/* Filtre Escadron */}
                                <div className="col-md-2">
                                    <Form.Group>
                                        <Form.Label>Escadron</Form.Label>
                                        <Form.Select
                                            value={filterEscadron}
                                            onChange={(e) => setFilterEscadron(e.target.value)}
                                        >
                                            <option value="">Tous</option>
                                            {allEscadrons.map(escadron => (
                                                <option key={escadron.id} value={escadron.id}>
                                                    {escadron.nom}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </div>

                                {/* Filtre Cours */}
                                <div className="col-md-1">
                                    <Form.Group>
                                        <Form.Label>Cours</Form.Label>
                                        <Form.Control
                                            type="number"
                                            placeholder="ID"
                                            value={filterCours}
                                            onChange={(e) => setFilterCours(e.target.value)}
                                        />
                                    </Form.Group>
                                </div>

                                {/* Boutons d'action */}
                                <div className="col-md-2 d-flex align-items-end gap-1">
                                    <Button variant="outline-secondary" size="sm" onClick={handleResetFilters} title="Réinitialiser">
                                        <FaTimes />
                                    </Button>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        onClick={handleExportExcel}
                                        disabled={isExporting || filteredAndSearchedCadres.length === 0}
                                        title="Export Excel"
                                    >
                                        <FaFileExcel />
                                    </Button>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        onClick={handleGeneratePdf}
                                        disabled={filteredAndSearchedCadres.length === 0}
                                        title="Export PDF"
                                    >
                                        <FaFilePdf />
                                    </Button>
                                </div>
                            </div>

                            {/* Affichage des filtres actifs */}
                            {(searchTerm || filterEntite || filterService || filterEscadron || filterCours) && (
                                <div className="mt-3">
                                    <small className="text-muted">
                                        <strong>Filtres actifs:</strong>
                                        {searchTerm && <span className="badge bg-info ms-1">Recherche: {searchTerm}</span>}
                                        {filterEntite && <span className="badge bg-primary ms-1">Entité: {filterEntite}</span>}
                                        {filterService && <span className="badge bg-success ms-1">Service: {filterService}</span>}
                                        {filterEscadron && <span className="badge bg-warning ms-1">Escadron: {allEscadrons.find(e => e.id.toString() === filterEscadron)?.nom}</span>}
                                        {filterCours && <span className="badge bg-secondary ms-1">Cours: {filterCours}</span>}
                                    </small>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tableau */}
                    {loading ? (
                        <div className="text-center my-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Chargement...</span>
                            </div>
                            <p className="mt-2">Chargement des données...</p>
                        </div>
                    ) : error ? (
                        <div className="alert alert-danger">{error}</div>
                    ) : filteredAndSearchedCadres.length > 0 ? (
                        <>
                            <div className="table-responsive">
                                <Table striped bordered hover>
                                    <thead className="table-dark">
                                        <tr>
                                            <th>#</th>

                                            <th>Grade</th>
                                            <th>Nom</th>
                                            <th>Prénom</th>
                                            <th>Matricule</th>
                                            <th>Date de nom...</th>
                                            <th>Entité</th>
                                            <th>Service</th>
                                            <th>Escadron</th>
                                            <th>Téléphone</th>
                                            <th className="no-print">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginationData.currentItems.map((cadre, index) => (
                                            <tr key={cadre.id || index}>
                                                <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>

                                                <td>
                                                    <span className="badge bg-secondary">{cadre.grade || '-'}</span>
                                                </td>
                                                <td>{cadre.nom || '-'}</td>
                                                <td>{cadre.prenom || '-'}</td>
                                                <td>{cadre.matricule || '-'}</td>
                                                <td>{cadre.date_nomination || '-'}</td>
                                                <td>{cadre.entite || '-'}</td>
                                                <td>{cadre.service || '-'}</td>
                                                <td>{cadre.EscadronResponsable?.nom || '-'}</td>
                                                <td>{cadre.numero_telephone || '-'}</td>
                                                <td className="no-print">
                                                    <div className="btn-group" role="group">
                                                        <Button
                                                            variant="info"
                                                            size="sm"
                                                            onClick={() => handleDetail(cadre)}
                                                            title="Voir détails"
                                                        >
                                                            <FaEye />
                                                        </Button>
                                                        <Button
                                                            variant="warning"
                                                            size="sm"
                                                            onClick={() => handleEdit(cadre)}
                                                            title="Modifier"
                                                        >
                                                            <FaEdit />
                                                        </Button>
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => handleDelete(cadre.id)}
                                                            title="Supprimer"
                                                        >
                                                            <FaTrash />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {paginationData.totalPages > 1 && (
                                <div className="d-flex justify-content-between align-items-center mt-3 no-print">
                                    <div>
                                        Affichage de {paginationData.indexOfFirstItem + 1} à {Math.min(paginationData.indexOfLastItem, paginationData.totalItems)} sur {paginationData.totalItems} cadres
                                    </div>
                                    <Pagination>
                                        <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
                                        <Pagination.Prev onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} />
                                        {Array.from({length: Math.min(5, paginationData.totalPages)}, (_, i) => {
                                            let pageNum;
                                            if (paginationData.totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= paginationData.totalPages - 2) {
                                                pageNum = paginationData.totalPages - 4 + i;
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
                                        <Pagination.Next onClick={() => setCurrentPage(p => Math.min(paginationData.totalPages, p + 1))} disabled={currentPage === paginationData.totalPages} />
                                        <Pagination.Last onClick={() => setCurrentPage(paginationData.totalPages)} disabled={currentPage === paginationData.totalPages} />
                                    </Pagination>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="alert alert-info">
                            <h6>Aucun cadre trouvé</h6>
                            <p className="mb-0">
                                {searchTerm || filterEntite || filterService || filterEscadron || filterCours
                                    ? 'Aucun cadre ne correspond aux critères de recherche.'
                                    : 'La liste des cadres est vide.'
                                }
                            </p>
                        </div>
                    )}

                    {/* MISE À JOUR : Modal d'édition avec photo */}
                    <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
                        <Modal.Header closeButton>
                            <Modal.Title>Modifier le cadre</Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            {editError && <div className="alert alert-danger">{editError}</div>}
                            <Form>
                                <div className="row">
                                    <div className="col-md-4">
                                        {/* NOUVEAU : Section photo */}
                                        <div className="text-center mb-3">
                                            <img
                                                src={editFormData.photo_url || '/default-avatar.png'}
                                                alt="Photo du cadre"
                                                className="rounded-circle mb-2"
                                                style={{ width: '120px', height: '120px', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.target.src = '/default-avatar.png';
                                                }}
                                            />
                                            <Form.Group>
                                                <Form.Label>
                                                    <FaImage className="me-1" />
                                                    URL de la photo
                                                </Form.Label>
                                                <Form.Control
                                                    type="url"
                                                    placeholder="https://exemple.com/photo.jpg"
                                                    value={editFormData.photo_url}
                                                    onChange={(e) => setEditFormData({...editFormData, photo_url: e.target.value})}
                                                />
                                            </Form.Group>
                                        </div>
                                    </div>
                                    <div className="col-md-8">
                                        <div className="row">
                                            <div className="col-md-6">
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Nom</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={editFormData.nom}
                                                        onChange={(e) => setEditFormData({...editFormData, nom: e.target.value})}
                                                    />
                                                </Form.Group>
                                            </div>
                                            <div className="col-md-6">
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Prénom</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={editFormData.prenom}
                                                        onChange={(e) => setEditFormData({...editFormData, prenom: e.target.value})}
                                                    />
                                                </Form.Group>
                                            </div>
                                        </div>
                                        <div className="row">
                                            <div className="col-md-6">
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Matricule</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={editFormData.matricule}
                                                        onChange={(e) => setEditFormData({...editFormData, matricule: e.target.value})}
                                                    />
                                                </Form.Group>
                                            </div>
                                            <div className="col-md-6">
                                                <Form.Group className="mb-3">
                                                    <Form.Label>Grade</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        value={editFormData.grade}
                                                        onChange={(e) => setEditFormData({...editFormData, grade: e.target.value})}
                                                    />
                                                </Form.Group>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Fonction</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editFormData.fonction}
                                        onChange={(e) => setEditFormData({...editFormData, fonction: e.target.value})}
                                    />
                                </Form.Group>

                                <div className="row">
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Entité</Form.Label>
                                            <Form.Select
                                                value={editFormData.entite}
                                                onChange={(e) => setEditFormData({...editFormData, entite: e.target.value})}
                                            >
                                                <option value="None">Aucun</option>
                                                <option value="Service">Service</option>
                                                <option value="Escadron">Escadron</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-4">
                                        {editFormData.entite === 'Service' && (
                                            <Form.Group className="mb-3">
                                                <Form.Label>Service</Form.Label>
                                                <Form.Select
                                                    value={editFormData.service}
                                                    onChange={(e) => setEditFormData({...editFormData, service: e.target.value})}
                                                >
                                                    <option value="">Sélectionner</option>
                                                    {allServices.map(service => (
                                                        <option key={service} value={service}>{service}</option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        )}
                                        {editFormData.entite === 'Escadron' && (
                                            <Form.Group className="mb-3">
                                                <Form.Label>Cours (ID Escadron)</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    value={editFormData.cours || ''}
                                                    onChange={(e) => setEditFormData({...editFormData, cours: parseInt(e.target.value) || null})}
                                                />
                                            </Form.Group>
                                        )}
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Sexe</Form.Label>
                                            <Form.Select
                                                value={editFormData.sexe}
                                                onChange={(e) => setEditFormData({...editFormData, sexe: e.target.value})}
                                            >
                                                <option value="">Sélectionner</option>
                                                <option value="Masculin">Masculin</option>
                                                <option value="Féminin">Féminin</option>
                                                <option value="Autre">Autre</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </div>
                                </div>

                                <Form.Group className="mb-3">
                                    <Form.Label>Numéro de téléphone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editFormData.numero_telephone}
                                        onChange={(e) => setEditFormData({...editFormData, numero_telephone: e.target.value})}
                                    />
                                </Form.Group>
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                                Annuler
                            </Button>
                            <Button variant="primary" onClick={handleEditSubmit} disabled={editLoading}>
                                {editLoading ? 'Mise à jour...' : 'Mettre à jour'}
                            </Button>
                        </Modal.Footer>
                    </Modal>

                    {/* MISE À JOUR : Modal de détail avec photo */}
                    <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
                        <Modal.Header closeButton>
                            <Modal.Title>Détails du cadre</Modal.Title>
                        </Modal.Header>
                        <Modal.Body ref={detailModalBodyRef}>
                            {cadreToDetail && (
                                <div className="container-fluid">
                                    <div className="row">
                                        <div className="col-md-3 text-center">
                                            {/* NOUVEAU : Photo dans la modale de détails */}
                                            <img
                                                src={cadreToDetail.photo_url || '/default-avatar.png'}
                                                alt={`${cadreToDetail.nom} ${cadreToDetail.prenom}`}
                                                className="rounded-circle mb-3"
                                                style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    e.target.src = '/default-avatar.png';
                                                }}
                                            />
                                            <h5>{cadreToDetail.grade} {cadreToDetail.nom} {cadreToDetail.prenom}</h5>
                                        </div>
                                        <div className="col-md-4">
                                            <h5>Informations personnelles</h5>
                                            <p><strong>Nom :</strong> {cadreToDetail.nom || '-'}</p>
                                            <p><strong>Prénom :</strong> {cadreToDetail.prenom || '-'}</p>
                                            <p><strong>Grade :</strong> {cadreToDetail.grade || '-'}</p>
                                            <p><strong>Matricule :</strong> {cadreToDetail.matricule || '-'}</p>
                                            <p><strong>Sexe :</strong> {cadreToDetail.sexe || '-'}</p>
                                            <p><strong>Date de naissance :</strong> {cadreToDetail.date_naissance || '-'}</p>
                                            <p><strong>Statut matrimonial :</strong> {cadreToDetail.statut_matrimonial || '-'}</p>
                                            <p><strong>Nombre d'enfants :</strong> {cadreToDetail.nombre_enfants || 0}</p>
                                            <p><strong>Email :</strong> {cadreToDetail.email || '-'}</p>
                                        </div>
                                        <div className="col-md-5">
                                            <h5>Informations professionnelles</h5>
                                            <p><strong>Fonction :</strong> {cadreToDetail.fonction || '-'}</p>
                                            <p><strong>Entité :</strong> {cadreToDetail.entite || '-'}</p>
                                            <p><strong>Service :</strong> {cadreToDetail.service || '-'}</p>
                                            <p><strong>Escadron :</strong> {cadreToDetail.EscadronResponsable?.nom || '-'}</p>
                                            <p><strong>Téléphone :</strong> {cadreToDetail.numero_telephone || '-'}</p>
                                            <p><strong>Date de nomination :</strong> {cadreToDetail.date_nomination || '-'}</p>
                                            <p><strong>Date de séjour EGNA :</strong> {cadreToDetail.date_sejour_egna || '-'}</p>
                                            {cadreToDetail.date_sejour_egna && (
                                                <p><strong>Durée de service :</strong> {calculateDuration(cadreToDetail.date_sejour_egna)}</p>
                                            )}
                                            <p><strong>Statut :</strong>
                                                <span className={`badge ms-1 ${
                                                    cadreToDetail.statut_absence === 'Présent' ? 'bg-success' :
                                                    cadreToDetail.statut_absence === 'Absent' ? 'bg-danger' :
                                                    cadreToDetail.statut_absence === 'Indisponible' ? 'bg-warning' :
                                                    'bg-secondary'
                                                }`}>
                                                    {cadreToDetail.statut_absence || 'Présent'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="primary" onClick={handlePrintDetail}>
                                <FaPrint className="me-1" />
                                Exporter PDF
                            </Button>
                            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                                Fermer
                            </Button>
                        </Modal.Footer>
                    </Modal>
                </div>
            </div>
        </div>
    );
}

export default CadresList;