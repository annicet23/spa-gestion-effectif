import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Form, Pagination, Table } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
    }
`;

function ListCadresPage() {
    const { token } = useAuth();
    const [cadres, setCadres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterResponsibilityScope, setFilterResponsibilityScope] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterEscadronId, setFilterEscadronId] = useState('');
    const [allServices, setAllServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(false);
    const [servicesError, setServicesError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);
    const [showEditModal, setShowEditModal] = useState(false);
    const [cadreToEdit, setCadreToEdit] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [cadreToDetail, setCadreToDetail] = useState(null);
    const detailModalBodyRef = useRef(null);

    // Fonction de tri des grades selon la hiérarchie puis par matricule croissant
    const sortByGradeAndMatricule = useCallback((data) => {
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

            const matriculeA = parseInt(a.matricule) || 0;
            const matriculeB = parseInt(b.matricule) || 0;
            return matriculeA - matriculeB;
        });
    }, []);

    // Chargement des cadres avec tri
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
                if (filterResponsibilityScope) queryParams.append('responsibility_scope', filterResponsibilityScope);
                if (filterService) queryParams.append('service', filterService);
                if (filterEscadronId) queryParams.append('responsible_escadron_id', filterEscadronId);

                const url = `${API_BASE_URL}/api/cadres?${queryParams.toString()}`;
                console.log("Fetching cadres from URL:", url);

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
                setCadres(sortByGradeAndMatricule(data));
                setCurrentPage(1);
            } catch (err) {
                console.error("Erreur:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCadres();
    }, [token, filterResponsibilityScope, filterService, filterEscadronId, sortByGradeAndMatricule]);

    // Chargement des services
    useEffect(() => {
        const fetchServices = async () => {
            if (!token) return;
            setServicesLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/cadres?responsibility_scope=Service`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    },
                });
                if (!response.ok) throw new Error('Erreur chargement services');
                const data = await response.json();
                const uniqueServices = [...new Set(data.map(c => c.service).filter(s => s))];
                setAllServices(uniqueServices.sort());
            } catch (err) {
                setServicesError(err.message);
            } finally {
                setServicesLoading(false);
            }
        };
        fetchServices();
    }, [token]);

    // Génération PDF
    const handleGeneratePdf = useCallback(async () => {
        if (cadres.length === 0) {
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
            doc.text(`Liste des cadres (${filterResponsibilityScope || 'Tous'})`, 105, 15, { align: 'center' });

            doc.autoTable({
                startY: 25,
                head: [['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Téléphone', 'Service', 'Escadron']],
                body: cadres.map((cadre, index) => [
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

            doc.save(`liste_cadres_${new Date().toISOString().slice(0,10)}.pdf`);
            await swal.close();
        } catch (error) {
            console.error("Erreur génération PDF:", error);
            Swal.fire("Erreur", "Échec de la génération du PDF", "error");
        }
    }, [cadres, filterResponsibilityScope]);

    // Gestion pagination
    const paginationData = useMemo(() => {
        const totalItems = cadres.length;
        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;

        return {
            currentItems: cadres.slice(indexOfFirstItem, indexOfLastItem),
            totalPages: Math.ceil(totalItems / itemsPerPage),
            indexOfFirstItem,
            indexOfLastItem,
            totalItems
        };
    }, [cadres, currentPage, itemsPerPage]);

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
            responsibility_scope: cadre.responsibility_scope || 'None',
            service: cadre.service || '',
            responsible_escadron_id: cadre.responsible_escadron_id || null,
            sexe: cadre.sexe || '',
            numero_telephone: cadre.numero_telephone || ''
        });
        setShowEditModal(true);
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
            confirmButtonText: 'Supprimer'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}/cadres/${id}`, {
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
                windowWidth: input.scrollWidth,
                windowHeight: input.scrollHeight
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');

            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = canvas.height * imgWidth / canvas.width;
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

            const fileName = `fiche_cadre_${cadreToDetail.nom?.toUpperCase() || ''}_${cadreToDetail.prenom || ''}_${new Date().toISOString().slice(0,10)}.pdf`;
            pdf.save(fileName);

            await swal.close();
            Swal.fire("Succès", "Fiche PDF générée avec succès.", "success");
        } catch (error) {
            console.error("Erreur génération PDF fiche:", error);
            await swal.close();
            Swal.fire("Erreur", "Échec de la génération du PDF de la fiche.", "error");
        }
    }, [cadreToDetail]);

    return (
        <div className="main-content-container">
            <style>{printStyles}</style>
            <div className="container-fluid mt-4">
                <h1 className="mb-4">Liste des Cadres</h1>

                {/* Filtres */}
                <div className="card mb-4 no-print">
                    <div className="card-body">
                        <h5 className="card-title">Filtres</h5>
                        <div className="row g-3">
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Scope de responsabilité</Form.Label>
                                    <Form.Select
                                        value={filterResponsibilityScope}
                                        onChange={(e) => {
                                            setFilterResponsibilityScope(e.target.value);
                                            setFilterService('');
                                            setFilterEscadronId('');
                                        }}
                                    >
                                        <option value="">Tous</option>
                                        <option value="Service">Service</option>
                                        <option value="Escadron">Escadron</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>

                            {filterResponsibilityScope === 'Service' && (
                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label>Service</Form.Label>
                                        {servicesLoading ? (
                                            <Form.Control as="div">Chargement...</Form.Control>
                                        ) : (
                                            <Form.Select
                                                value={filterService}
                                                onChange={(e) => setFilterService(e.target.value)}
                                            >
                                                <option value="">Tous les services</option>
                                                {allServices.map(service => (
                                                    <option key={service} value={service}>{service}</option>
                                                ))}
                                            </Form.Select>
                                        )}
                                    </Form.Group>
                                </div>
                            )}

                            {filterResponsibilityScope === 'Escadron' && (
                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label>ID Escadron</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={filterEscadronId}
                                            onChange={(e) => setFilterEscadronId(e.target.value)}
                                        />
                                    </Form.Group>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Boutons d'action */}
                <div className="mb-4 no-print">
                    <Button variant="primary" onClick={handleGeneratePdf} className="me-2">
                        <i className="bi bi-file-earmark-pdf me-1"></i> Exporter PDF
                    </Button>
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
                ) : cadres.length > 0 ? (
                    <>
                        <div className="table-responsive">
                            <Table striped bordered hover>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Grade</th>
                                        <th>Nom</th>
                                        <th>Prénom</th>
                                        <th>Matricule</th>
                                        <th>Scope</th>
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
                                            <td>{cadre.grade || '-'}</td>
                                            <td>{cadre.nom || '-'}</td>
                                            <td>{cadre.prenom || '-'}</td>
                                            <td>{cadre.matricule || '-'}</td>
                                            <td>{cadre.responsibility_scope || '-'}</td>
                                            <td>{cadre.service || '-'}</td>
                                            <td>{cadre.EscadronResponsable?.nom || '-'}</td>
                                            <td>{cadre.numero_telephone || '-'}</td>
                                            <td className="no-print">
                                                <Button
                                                    variant="warning"
                                                    size="sm"
                                                    onClick={() => handleEdit(cadre)}
                                                    className="me-2"
                                                >
                                                    Modifier
                                                </Button>
                                                <Button
                                                    variant="info"
                                                    size="sm"
                                                    onClick={() => handleDetail(cadre)}
                                                    className="me-2"
                                                >
                                                    Détail
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    onClick={() => handleDelete(cadre.id)}
                                                >
                                                    Supprimer
                                                </Button>
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
                        Aucun cadre trouvé correspondant aux critères de recherche
                    </div>
                )}

                {/* Modal d'édition */}
                <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>Modifier le cadre</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {editError && <div className="alert alert-danger">{editError}</div>}
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label>Nom</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="nom"
                                    value={editFormData.nom}
                                    onChange={(e) => setEditFormData({...editFormData, nom: e.target.value})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Prénom</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="prenom"
                                    value={editFormData.prenom}
                                    onChange={(e) => setEditFormData({...editFormData, prenom: e.target.value})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Matricule</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="matricule"
                                    value={editFormData.matricule}
                                    onChange={(e) => setEditFormData({...editFormData, matricule: e.target.value})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Grade</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="grade"
                                    value={editFormData.grade}
                                    onChange={(e) => setEditFormData({...editFormData, grade: e.target.value})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Fonction</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="fonction"
                                    value={editFormData.fonction}
                                    onChange={(e) => setEditFormData({...editFormData, fonction: e.target.value})}
                                />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Scope de responsabilité</Form.Label>
                                <Form.Select
                                    name="responsibility_scope"
                                    value={editFormData.responsibility_scope}
                                    onChange={(e) => setEditFormData({...editFormData, responsibility_scope: e.target.value})}
                                >
                                    <option value="None">Aucun</option>
                                    <option value="Service">Service</option>
                                    <option value="Escadron">Escadron</option>
                                </Form.Select>
                            </Form.Group>
                            {editFormData.responsibility_scope === 'Service' && (
                                <Form.Group className="mb-3">
                                    <Form.Label>Service</Form.Label>
                                    <Form.Select
                                        name="service"
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
                            {editFormData.responsibility_scope === 'Escadron' && (
                                <Form.Group className="mb-3">
                                    <Form.Label>ID Escadron</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="responsible_escadron_id"
                                        value={editFormData.responsible_escadron_id || ''}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setEditFormData({
                                                ...editFormData,
                                                responsible_escadron_id: value === '' ? null : (isNaN(parseInt(value)) ? value : parseInt(value))
                                            })
                                        }}
                                    />
                                </Form.Group>
                            )}
                            <Form.Group className="mb-3">
                                <Form.Label>Sexe</Form.Label>
                                <Form.Select
                                    name="sexe"
                                    value={editFormData.sexe}
                                    onChange={(e) => setEditFormData({...editFormData, sexe: e.target.value})}
                                >
                                    <option value="">Sélectionner</option>
                                    <option value="Masculin">Masculin</option>
                                    <option value="Féminin">Féminin</option>
                                </Form.Select>
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Téléphone</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="numero_telephone"
                                    value={editFormData.numero_telephone}
                                    onChange={(e) => setEditFormData({...editFormData, numero_telephone: e.target.value})}
                                />
                            </Form.Group>
                            <div className="d-flex justify-content-end">
                                <Button
                                    variant="primary"
                                    onClick={async () => {
                                        try {
                                            setEditLoading(true);
                                            setEditError(null);

                                            console.log("Données envoyées au backend:", editFormData);
                                            const response = await fetch(`${API_BASE_URL}/cadres/${editFormData.id}`, {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                body: JSON.stringify(editFormData)
                                            });

                                            if (!response.ok) {
                                                const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                                                throw new Error(errorData.message || `Échec de la mise à jour (${response.status})`);
                                            }

                                            const responseData = await response.json();
                                            const updatedCadre = responseData.cadre;

                                            setCadres(cadres.map(c => c.id === updatedCadre.id ? updatedCadre : c));
                                            setShowEditModal(false);
                                            Swal.fire('Succès!', 'Cadre mis à jour', 'success');
                                        } catch (err) {
                                            console.error("Erreur lors de la mise à jour:", err);
                                            setEditError(err.message);
                                            Swal.fire('Erreur!', err.message, 'error');
                                        } finally {
                                            setEditLoading(false);
                                        }
                                    }}
                                    disabled={editLoading}
                                >
                                    {editLoading ? 'Enregistrement...' : 'Enregistrer'}
                                </Button>
                            </div>
                        </Form>
                    </Modal.Body>
                </Modal>

                {/* Modal de Détail */}
                <Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
                    <Modal.Header closeButton>
                        <Modal.Title>Fiche Individuelle</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {cadreToDetail ? (
                            <div ref={detailModalBodyRef} style={{ fontFamily: 'Arial, sans-serif', padding: '15px', lineHeight: '1.6', color: '#333' }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                                    <div style={{ flexGrow: 1 }}>
                                        <h2 style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                                            {cadreToDetail.nom?.toUpperCase() || 'NOM'} {cadreToDetail.prenom || 'Prénom'}
                                        </h2>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '18px', color: '#555' }}>
                                            {cadreToDetail.grade || 'Grade non spécifié'} - {cadreToDetail.fonction || 'Fonction non spécifiée'}
                                        </p>
                                        <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#777' }}>
                                            Matricule: {cadreToDetail.matricule || '-'}
                                        </p>
                                    </div>
                                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#eee', marginLeft: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '50px', color: '#777', overflow: 'hidden', flexShrink: 0 }}>
                                        <i className="bi bi-person-fill"></i>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                                    <h3 style={{ fontSize: '20px', marginBottom: '15px', textDecoration: 'underline', color: '#000' }}>Informations</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 30px' }}>
                                        <div>
                                            <p><strong>Date de naissance:</strong> -</p>
                                            <p><strong>Lieu de naissance:</strong> -</p>
                                            <p><strong>Sexe:</strong> {cadreToDetail.sexe || '-'}</p>
                                            <p><strong>Situation:</strong> -</p>
                                            <p><strong>Nombre d'enfants:</strong> -</p>
                                        </div>
                                        <div>
                                            <p><strong>Scope:</strong> {cadreToDetail.responsibility_scope || '-'}</p>
                                            {cadreToDetail.responsibility_scope === 'Service' && <p><strong>Service:</strong> {cadreToDetail.service || '-'}</p>}
                                            {cadreToDetail.responsibility_scope === 'Escadron' && (
                                                <p><strong>Escadron:</strong> {cadreToDetail.EscadronResponsable?.nom || '-'}</p>
                                            )}
                                            <p><strong>CFEG:</strong> -</p>
                                            <p><strong>Date de séjour à EGNA:</strong> -</p>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                                    <h3 style={{ fontSize: '20px', marginBottom: '15px', textDecoration: 'underline', color: '#000' }}>Contact</h3>
                                    <p><strong>Numéro de téléphone:</strong> {cadreToDetail.numero_telephone || '-'}</p>
                                    <p>
                                        <i className="bi bi-whatsapp me-2" style={{ fontSize: '1.2em', color: '#25D366' }}></i>
                                        <strong>WhatsApp:</strong> -
                                    </p>
                                    <p>
                                        <i className="bi bi-envelope-fill me-2" style={{ fontSize: '1.2em', color: '#D14836' }}></i>
                                        <strong>Email:</strong> -
                                    </p>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '20px', marginBottom: '15px', textDecoration: 'underline', color: '#000' }}>Historique des Absences</h3>
                                    {cadreToDetail.statut_absence ? (
                                        <div>
                                            <p><strong>Statut Actuel:</strong> {cadreToDetail.statut_absence}</p>
                                            <p><strong>Date de début:</strong> {cadreToDetail.date_debut_absence ? new Date(cadreToDetail.date_debut_absence).toLocaleDateString('fr-FR') : '-'}</p>
                                            <p><strong>Motif:</strong> {cadreToDetail.motif_absence || '-'}</p>
                                            <p style={{ fontStyle: 'italic', color: '#777', marginTop: '10px' }}>
                                                (Historique complet non disponible dans les données actuelles)
                                            </p>
                                        </div>
                                    ) : (
                                        <p>Aucune absence ou indisponibilité actuelle enregistrée.</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <p>Chargement des détails...</p>
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={handlePrintDetail} className="me-2">
                            <i className="bi bi-printer me-1"></i> Imprimer
                        </Button>
                        <Button variant="secondary" onClick={() => setShowDetailModal(false)}>
                            Fermer
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        </div>
    );
}

export default ListCadresPage;