import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Form, Pagination, Table, Nav, Alert } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import {
    FaSearch,
    FaFilter,
    FaFileExcel,
    FaFilePdf,
    FaEye,
    FaEdit,
    FaTimes,
    FaTrash,
    FaPrint,
    FaUpload,
    FaHistory,
    FaUser,
    FaCalendarAlt,
    FaInfoCircle,
    FaUserShield,
    FaUserTie
} from 'react-icons/fa';
import './CadresList.css';

// Nouveaux composants
import HistoriqueAbsenceModal from './HistoriqueAbsenceModal';
import PhotoUpload from './PhotoUpload';
import RoleBasedButton from './RoleBasedButton';

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
    const { token, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    // États pour les données
    const [cadres, setCadres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // États pour les filtres améliorés
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
    const [showHistoriqueModal, setShowHistoriqueModal] = useState(false);
    const [cadreToEdit, setCadreToEdit] = useState(null);
    const [cadreToDetail, setCadreToDetail] = useState(null);
    const [cadreForHistorique, setCadreForHistorique] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);

    // États pour l'onglet du modal de détail
    const [activeDetailTab, setActiveDetailTab] = useState('informations');

    // États pour l'export
    const [isExporting, setIsExporting] = useState(false);

    const detailModalBodyRef = useRef(null);

    const userRole = user?.role || 'Standard';
    const isAdmin = userRole === 'Admin';
    const isConsultant = userRole === 'Consultant';
    const isStandard = userRole === 'Standard';

    // ✅ FONCTION CORRIGÉE pour l'affichage des photos
    const getPhotoUrl = (photoUrl) => {
        if (!photoUrl) return '/default-avatar.png';

        console.log('Photo URL brute:', photoUrl);

        // Si l'URL commence par /uploads/, enlever le / initial
        const cleanPath = photoUrl.startsWith('/uploads/') ? photoUrl.substring(1) : `uploads/${photoUrl}`;
        const fullUrl = `${API_BASE_URL}${cleanPath}`;

        console.log('URL complète construite:', fullUrl);
        return fullUrl;
    };

    // ✅ CORRIGÉ : Fonction pour vérifier les permissions de modification
    const canModifyCadre = useCallback((cadre) => {
        console.log('=== DEBUG canModifyCadre ===');
        console.log('userRole:', `"${userRole}"`);
        console.log('cadre:', cadre.nom, cadre.prenom);
        console.log('Test Admin:', userRole === 'Admin');
        console.log('Test Consultant:', userRole === 'Consultant');
        console.log('Test Standard:', userRole === 'Standard');
        console.log('============================');

        // Admin peut tout faire sans restriction
        if (userRole === 'Admin') {
            console.log('✅ Admin - Accès autorisé');
            return true;
        }

        // Consultant ne peut rien modifier
        if (userRole === 'Consultant') {
            console.log('❌ Consultant - Accès refusé');
            return false;
        }

        // Standard peut modifier seulement son entité
        if (userRole === 'Standard') {
            const canModify = user?.service === cadre.service || user?.escadron_id === cadre.cours;
            console.log('Standard - Peut modifier:', canModify);
            return canModify;
        }

        console.log('❌ Rôle non reconnu');
        return false;
    }, [userRole, user]);

    // Fonction pour obtenir le badge de rôle
    const getRoleBadge = () => {
        if (isAdmin) {
            return <span className="badge bg-success ms-2"><FaUserShield className="me-1" />Administrateur</span>;
        }
        if (isConsultant) {
            return <span className="badge bg-info ms-2"><FaEye className="me-1" />Consultation seule</span>;
        }
        if (isStandard) {
            return <span className="badge bg-warning ms-2"><FaUserTie className="me-1" />Vue limitée</span>;
        }
        return null;
    };

    // Extraire le terme de recherche de l'URL
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const searchParam = urlParams.get('search');
        if (searchParam) {
            setSearchTerm(searchParam);
            console.log(`🔍 Terme de recherche détecté dans l'URL: "${searchParam}"`);
        }

        // Charger les filtres sauvegardés (pas pour standard)
        if (!isStandard) {
            const savedFilters = localStorage.getItem('cadres_filters');
            if (savedFilters) {
                const filters = JSON.parse(savedFilters);
                if (filters.filterEntite) setFilterEntite(filters.filterEntite);
                if (filters.filterService) setFilterService(filters.filterService);
                if (filters.filterEscadron) setFilterEscadron(filters.filterEscadron);
                if (filters.filterStatut) setFilterStatut(filters.filterStatut);
            }
        }
    }, [location, isStandard]);

    // Sauvegarder les filtres (pas pour standard)
    useEffect(() => {
        if (!isStandard) {
            const filters = {
                filterEntite,
                filterService,
                filterEscadron,
                filterStatut,
                filterCours
            };
            localStorage.setItem('cadres_filters', JSON.stringify(filters));
        }
    }, [filterEntite, filterService, filterEscadron, filterStatut, filterCours, isStandard]);

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

    // Charger les options de filtres
    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!token) return;

            setServicesLoading(true);
            try {
                // Récupérer les services
                const servicesResponse = await fetch(`${API_BASE_URL}api/cadres/services`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (servicesResponse.ok) {
                    const services = await servicesResponse.json();
                    setAllServices(services);
                    console.log(`✅ ${services.length} services chargés`);
                } else {
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
                console.error('❌ Erreur chargement options de filtres:', error);
                setServicesError('Erreur lors du chargement des services');
            } finally {
                setServicesLoading(false);
            }
        };

        fetchFilterOptions();
    }, [token]);

    // Charger les cadres
    const fetchCadres = useCallback(async () => {
        if (!token) return;

        console.log('🔄 Chargement des cadres...');
        setLoading(true);
        setError(null);

        try {
            let endpoint = `${API_BASE_URL}api/cadres`;
            const params = new URLSearchParams();

            // Appliquer les filtres selon le rôle
            if (filterEntite && !isStandard) params.append('entite', filterEntite);
            if (filterService && !isStandard) params.append('service', filterService);
            if (filterEscadron && !isStandard) params.append('escadron', filterEscadron);
            if (filterStatut) params.append('statut', filterStatut);
            if (filterCours && !isStandard) params.append('cours', filterCours);

            if (params.toString()) {
                endpoint += `?${params.toString()}`;
            }

            console.log('📡 Endpoint final:', endpoint);

            const response = await fetch(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Erreur API:', response.status, errorText);
                throw new Error(`Erreur ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('✅ Données reçues:', data.length, 'cadres');

            setCadres(Array.isArray(data) ? data : []);

        } catch (error) {
            console.error('❌ Erreur lors du chargement des cadres:', error);
            setError('Erreur lors du chargement des données');
        } finally {
            setLoading(false);
        }
    }, [token, filterEntite, filterService, filterEscadron, filterStatut, filterCours, isStandard]);

    // Charger les cadres au montage et quand les filtres changent
    useEffect(() => {
        fetchCadres();
    }, [fetchCadres]);

    // Fonction de recherche et filtrage côté client
    const filteredAndSearchedCadres = useMemo(() => {
        if (!Array.isArray(cadres)) return [];

        let filtered = [...cadres];

        // Appliquer la recherche textuelle
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(cadre =>
                (cadre.nom && cadre.nom.toLowerCase().includes(searchLower)) ||
                (cadre.prenom && cadre.prenom.toLowerCase().includes(searchLower)) ||
                (cadre.matricule && cadre.matricule.toLowerCase().includes(searchLower)) ||
                (cadre.grade && cadre.grade.toLowerCase().includes(searchLower)) ||
                (cadre.fonction && cadre.fonction.toLowerCase().includes(searchLower)) ||
                (cadre.service && cadre.service.toLowerCase().includes(searchLower))
            );
        }

        // Trier selon la hiérarchie des grades
        return sortByGradeAndNominationDate(filtered);
    }, [cadres, searchTerm, sortByGradeAndNominationDate]);

    // Données de pagination
    const paginationData = useMemo(() => {
        const totalItems = filteredAndSearchedCadres.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;
        const currentItems = filteredAndSearchedCadres.slice(indexOfFirstItem, indexOfLastItem);

        return {
            totalItems,
            totalPages,
            indexOfLastItem,
            indexOfFirstItem,
            currentItems
        };
    }, [filteredAndSearchedCadres, currentPage, itemsPerPage]);

    // Fonctions de gestion des modales et actions
    const handleEdit = (cadre) => {
        setCadreToEdit(cadre);
        setEditFormData({...cadre});
        setShowEditModal(true);
        setEditError(null);
    };

    const handleDetail = (cadre) => {
        setCadreToDetail(cadre);
        setShowDetailModal(true);
        setActiveDetailTab('informations');
    };

    const handleHistorique = (cadre) => {
        setCadreForHistorique(cadre);
        setShowHistoriqueModal(true);
    };

    const handleDelete = async (cadre) => {
        const result = await Swal.fire({
            title: 'Confirmer la suppression',
            text: `Êtes-vous sûr de vouloir supprimer ${cadre.grade} ${cadre.nom} ${cadre.prenom} (${cadre.matricule}) ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}api/cadres/${cadre.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    await Swal.fire({
                        title: 'Supprimé !',
                        text: 'Le cadre a été supprimé avec succès.',
                        icon: 'success',
                        timer: 2000,
                        showConfirmButton: false
                    });
                    fetchCadres(); // Recharger la liste
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Erreur lors de la suppression');
                }
            } catch (error) {
                console.error('Erreur suppression:', error);
                await Swal.fire({
                    title: 'Erreur',
                    text: error.message || 'Erreur lors de la suppression du cadre',
                    icon: 'error'
                });
            }
        }
    };

    const handleSaveEdit = async () => {
        setEditLoading(true);
        setEditError(null);

        try {
            const response = await fetch(`${API_BASE_URL}api/cadres/${cadreToEdit.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(editFormData)
            });

            if (response.ok) {
                setShowEditModal(false);
                await Swal.fire({
                    title: 'Succès',
                    text: 'Cadre modifié avec succès',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false
                });
                fetchCadres(); // Recharger la liste
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur lors de la modification');
            }
        } catch (error) {
            console.error('Erreur modification:', error);
            setEditError(error.message || 'Erreur lors de la modification du cadre');
        } finally {
            setEditLoading(false);
        }
    };

    const handlePhotoUpdate = (newPhotoUrl) => {
        setEditFormData(prev => ({
            ...prev,
            photo_url: newPhotoUrl
        }));
    };

    const handleResetFilters = () => {
        setSearchTerm('');
        setFilterEntite('');
        setFilterService('');
        setFilterEscadron('');
        setFilterStatut('');
        setFilterCours('');
        setCurrentPage(1);
    };

    // Fonctions d'export
    const handleExportExcel = () => {
        setIsExporting(true);
        try {
            const dataToExport = filteredAndSearchedCadres.map((cadre, index) => ({
                '#': index + 1,
                'Grade': cadre.grade || '-',
                'Nom': cadre.nom || '-',
                'Prénom': cadre.prenom || '-',
                'Matricule': cadre.matricule || '-',
                'Date de nomination': cadre.date_nomination || '-',
                'Entité': cadre.entite || '-',
                'Service': cadre.service || '-',
                'Escadron': cadre.EscadronResponsable?.nom || '-',
                'Téléphone': cadre.numero_telephone || '-'
            }));

            const ws = XLSX.utils.json_to_sheet(dataToExport);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Liste des Cadres');
            XLSX.writeFile(wb, `liste_cadres_${new Date().toISOString().split('T')[0]}.xlsx`);

            Swal.fire({
                title: 'Export réussi',
                text: 'Le fichier Excel a été téléchargé',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Erreur export Excel:', error);
            Swal.fire({
                title: 'Erreur',
                text: 'Erreur lors de l\'export Excel',
                icon: 'error'
            });
        } finally {
            setIsExporting(false);
        }
    };

    const handleGeneratePdf = () => {
        const doc = new jsPDF();
        doc.text('Liste des Cadres', 14, 20);

        const tableData = filteredAndSearchedCadres.map((cadre, index) => [
            index + 1,
            cadre.grade || '-',
            cadre.nom || '-',
            cadre.prenom || '-',
            cadre.matricule || '-',
            cadre.date_nomination || '-',
            cadre.entite || '-',
            cadre.service || '-',
            cadre.EscadronResponsable?.nom || '-',
            cadre.numero_telephone || '-'
        ]);

        doc.autoTable({
            head: [['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Date nom.', 'Entité', 'Service', 'Escadron', 'Téléphone']],
            body: tableData,
            startY: 30,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185] }
        });

        doc.save(`liste_cadres_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleExportFicheIndividuelle = async () => {
        if (!cadreToDetail) return;

        try {
            const element = detailModalBodyRef.current;
            if (!element) return;

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF();
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
        } catch (error) {
            console.error('Erreur export fiche:', error);
            Swal.fire({
                title: 'Erreur',
                text: 'Erreur lors de l\'export de la fiche',
                icon: 'error'
            });
        }
    };

    // Ajout des styles d'impression
    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.type = "text/css";
        styleSheet.innerText = printStyles;
        document.head.appendChild(styleSheet);

        return () => {
            document.head.removeChild(styleSheet);
        };
    }, []);

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    {/* En-tête */}
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2>
                                <FaUser className="me-2" />
                                Liste des Cadres
                                {getRoleBadge()}
                            </h2>
                            <p className="text-muted">
                                {loading ? 'Chargement...' : `${filteredAndSearchedCadres.length} cadre(s) affiché(s)`}
                            </p>
                        </div>
                    </div>

                    {/* Section des filtres améliorée */}
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

                                {/* Filtre Entité - masqué pour STANDARD */}
                                {!isStandard && (
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
                                )}

                                {/* Filtre Service - masqué pour STANDARD */}
                                {!isStandard && (
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
                                )}

                                {/* Filtre Escadron - masqué pour STANDARD */}
                                {!isStandard && (
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
                                )}

                                {/* Affichage pour STANDARD */}
                                {isStandard && (
                                    <div className="col-md-4">
                                        <Alert variant="info" className="mb-0">
                                            <small>
                                                <FaInfoCircle className="me-1" />
                                                Filtres automatiques : {user?.service && `Service: ${user.service}`}
                                                {user?.escadron_name && ` | Escadron: ${user.escadron_name}`}
                                            </small>
                                        </Alert>
                                    </div>
                                )}

                                {/* Filtre Cours - pour tous */}
                                <div className="col-md-1">
                                    <Form.Group>
                                        <Form.Label>Cours</Form.Label>
                                        <Form.Control
                                            type="number"
                                            placeholder="ID"
                                            value={filterCours}
                                            onChange={(e) => setFilterCours(e.target.value)}
                                            disabled={isStandard}
                                        />
                                    </Form.Group>
                                </div>

                                {/* Boutons d'action */}
                                <div className="col-md-2 d-flex align-items-end gap-1">
                                    <Button
                                        variant="outline-secondary"
                                        size="sm"
                                        onClick={handleResetFilters}
                                        title="Réinitialiser"
                                        disabled={isStandard}
                                    >
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
                                            <th>Date de nom.</th>
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
                                                            onClick={() => handleHistorique(cadre)}
                                                            title="Historique d'absence (consultation)"
                                                        >
                                                            <FaHistory />
                                                        </Button>
                                                        {/* ✅ CORRIGÉ : Boutons de modification avec permissions */}
                                                        <RoleBasedButton
                                                            variant="warning"
                                                            size="sm"
                                                            onClick={() => handleEdit(cadre)}
                                                            title="Modifier"
                                                            canAccess={canModifyCadre(cadre)}
                                                            icon={<FaEdit />}
                                                        />
                                                        <RoleBasedButton
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => handleDelete(cadre)}
                                                            title="Supprimer"
                                                            canAccess={canModifyCadre(cadre)}
                                                            icon={<FaTrash />}
                                                        />
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
                                    : 'Aucun cadre disponible.'}
                            </p>
                        </div>
                    )}

                    {/* Modal d'édition */}
                    <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
                        <Modal.Header closeButton>
                            <Modal.Title>
                                <FaEdit className="me-2" />
                                Modifier le cadre
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body>
                            {editError && <div className="alert alert-danger">{editError}</div>}
                            <Form>
                                <div className="row">
                                    <div className="col-md-4">
                                        <PhotoUpload
                                            currentPhotoUrl={editFormData.photo_url}
                                            onPhotoUpdate={handlePhotoUpdate}
                                            entityType="cadre"
                                            entityId={editFormData.id}
                                        />
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

                                <div className="row">
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Fonction</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={editFormData.fonction}
                                                onChange={(e) => setEditFormData({...editFormData, fonction: e.target.value})}
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Entité</Form.Label>
                                            <Form.Select
                                                value={editFormData.entite}
                                                onChange={(e) => setEditFormData({...editFormData, entite: e.target.value})}
                                            >
                                                <option value="">Sélectionner</option>
                                                <option value="Service">Service</option>
                                                <option value="Escadron">Escadron</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Service</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={editFormData.service}
                                                onChange={(e) => setEditFormData({...editFormData, service: e.target.value})}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>

                                <div className="row">
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Téléphone</Form.Label>
                                            <Form.Control
                                                type="text"
                                                value={editFormData.numero_telephone}
                                                onChange={(e) => setEditFormData({...editFormData, numero_telephone: e.target.value})}
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-6">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Email</Form.Label>
                                            <Form.Control
                                                type="email"
                                                value={editFormData.email}
                                                onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                                            />
                                        </Form.Group>
                                    </div>
                                </div>
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                                Annuler
                            </Button>
                            <Button variant="primary" onClick={handleSaveEdit} disabled={editLoading}>
                                {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                        </Modal.Footer>
                    </Modal>

                    {/* Modal de détail amélioré avec onglets */}
                    <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
                        <Modal.Header closeButton>
                            <Modal.Title>
                                <FaUser className="me-2" />
                                Détails du cadre
                            </Modal.Title>
                        </Modal.Header>
                        <Modal.Body ref={detailModalBodyRef}>
                            {cadreToDetail && (
                                <div className="container-fluid">
                                    {/* Navigation par onglets */}
                                    <Nav variant="tabs" className="mb-3">
                                        <Nav.Item>
                                            <Nav.Link
                                                active={activeDetailTab === 'informations'}
                                                onClick={() => setActiveDetailTab('informations')}
                                            >
                                                <FaUser className="me-1" />
                                                Informations
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item>
                                            <Nav.Link
                                                active={activeDetailTab === 'historique'}
                                                onClick={() => setActiveDetailTab('historique')}
                                            >
                                                <FaCalendarAlt className="me-1" />
                                                Historique d'absence
                                            </Nav.Link>
                                        </Nav.Item>
                                    </Nav>

                                    {/* Contenu des onglets */}
                                    {activeDetailTab === 'informations' && (
                                        <div className="row">
                                            <div className="col-md-3 text-center">
                                                <img
                                                    src={getPhotoUrl(cadreToDetail.photo_url)}
                                                    alt={`${cadreToDetail.nom} ${cadreToDetail.prenom}`}
                                                    className="rounded-circle mb-3"
                                                    style={{ width: '150px', height: '150px', objectFit: 'cover' }}
                                                    onError={(e) => {
                                                        console.log('❌ Erreur chargement image pour:', cadreToDetail.nom, cadreToDetail.prenom);
                                                        console.log('❌ URL tentée:', e.target.src);
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
                                                <div className="d-flex align-items-center">
                                                    <p className="mb-0"><strong>Statut actuel :</strong></p>
                                                    <span className={`badge ms-2 ${
                                                        cadreToDetail.statut_absence === 'Présent' ? 'bg-success' :
                                                        cadreToDetail.statut_absence === 'Absent' ? 'bg-danger' :
                                                        cadreToDetail.statut_absence === 'Indisponible' ? 'bg-warning' :
                                                        'bg-secondary'
                                                    }`}>
                                                        {cadreToDetail.statut_absence || 'Présent'}
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="outline-primary"
                                                        className="ms-2"
                                                        onClick={() => handleHistorique(cadreToDetail)}
                                                    >
                                                        <FaHistory className="me-1" />
                                                        Historique
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeDetailTab === 'historique' && (
                                        <div>
                                            <h5>Historique des absences</h5>
                                            <p className="text-muted">Cliquez sur le bouton "Historique d'absence" pour voir le détail complet</p>
                                            <Button
                                                variant="primary"
                                                onClick={() => handleHistorique(cadreToDetail)}
                                            >
                                                <FaHistory className="me-1" />
                                                Voir l'historique complet
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </Modal.Body>
                        <Modal.Footer className="no-print">
                            <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                                Fermer
                            </Button>
                            <Button variant="primary" onClick={handleExportFicheIndividuelle}>
                                <FaFilePdf className="me-1" />
                                Exporter en PDF
                            </Button>
                        </Modal.Footer>
                    </Modal>

                    {/* Modal historique d'absence */}
                    {showHistoriqueModal && cadreForHistorique && (
                        <HistoriqueAbsenceModal
                            show={showHistoriqueModal}
                            onHide={() => setShowHistoriqueModal(false)}
                            cadre={cadreForHistorique}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default CadresList;