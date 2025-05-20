// src/pages/ListCadresPage.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'; // Ajoutez useRef ici
import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal, Button, Form, Pagination, Table } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import jsPDF from 'jspdf';

import 'jspdf-autotable';

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
    const [filterEntite, setFilterEntite] = useState('');
    const [filterService, setFilterService] = useState('');
    const [filterCoursId, setFilterCoursId] = useState('');
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


    const handleDetail = (cadre) => {
    setCadreToDetail(cadre);
    setShowDetailModal(true);};

    // Fonction de tri des grades selon la hiérarchie puis par matricule croissant
    const sortByGradeAndMatricule = useCallback((data) => {
        return [...data].sort((a, b) => {
            const gradeA = a.grade?.toUpperCase() || '';
            const gradeB = b.grade?.toUpperCase() || '';
            
            const indexA = GRADE_HIERARCHY.indexOf(gradeA);
            const indexB = GRADE_HIERARCHY.indexOf(gradeB);
            
            // Si les grades sont différents, tri selon la hiérarchie
            if (indexA !== indexB) {
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return gradeA.localeCompare(gradeB);
            }
            
            // Pour les mêmes grades, tri par matricule croissant
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
                if (filterEntite) queryParams.append('entite', filterEntite);
                if (filterEntite === 'Service' && filterService) queryParams.append('service', filterService);
                if (filterEntite === 'Escadron' && filterCoursId) queryParams.append('cours', filterCoursId);

                const response = await fetch(`${API_BASE_URL}/cadres?${queryParams.toString()}`, {
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
    }, [token, filterEntite, filterService, filterCoursId, sortByGradeAndMatricule]);

    // Chargement des services
    useEffect(() => {
        const fetchServices = async () => {
            if (!token) return;
            setServicesLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}/cadres?entite=Service`, {
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
            doc.text(`Liste des cadres (${filterEntite || 'Tous'})`, 105, 15, { align: 'center' });

            doc.autoTable({startY: 25,
                            head: [['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Téléphone', 'Service']],
    body: cadres.map((cadre, index) => [
        index + 1,
        cadre.grade || '-',
        cadre.nom || '-',
        cadre.prenom || '-',
        cadre.matricule || '-',
        cadre.numero_telephone || '-',
        cadre.service || '-'
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
    }, [cadres, filterEntite]);

    // Gestion pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCadres = useMemo(() => cadres.slice(indexOfFirstItem, indexOfLastItem), 
        [cadres, indexOfFirstItem, indexOfLastItem]);
    const totalPages = useMemo(() => Math.ceil(cadres.length / itemsPerPage), 
        [cadres.length, itemsPerPage]);

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
            entite: cadre.entite || '',
            service: cadre.service || '',
            cours: cadre.entite === 'Escadron' ? (cadre.EscadronResponsable?.id || cadre.cours || null) : null,
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
    const handlePrintDetail = useCallback(async () => {
    const input = detailModalBodyRef.current; // L'élément DOM à capturer
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
        // Utilisez html2canvas pour capturer le contenu
        const canvas = await html2canvas(input, {
            scale: 2, // Augmente la résolution pour une meilleure qualité
            useCORS: true, // Important si vous avez des images externes (comme une photo)
            windowWidth: input.scrollWidth, // Capture la largeur totale si le contenu dépasse
            windowHeight: input.scrollHeight // Capture la hauteur totale
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4'); // Format A4, portrait

        const imgWidth = 210; // Largeur A4 en mm
        const pageHeight = 297; // Hauteur A4 en mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Ajoute l'image au PDF, en gérant les pages si le contenu est long
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        // Nom du fichier PDF
        const fileName = `fiche_cadre_${cadreToDetail.nom?.toUpperCase() || ''}_${cadreToDetail.prenom || ''}_${new Date().toISOString().slice(0,10)}.pdf`;

        pdf.save(fileName);

        await swal.close();
        Swal.fire("Succès", "Fiche PDF générée avec succès.", "success");

    } catch (error) {
        console.error("Erreur génération PDF fiche:", error);
        await swal.close();
        Swal.fire("Erreur", "Échec de la génération du PDF de la fiche.", "error");
    }
}, [cadreToDetail]); // Recalculer si cadreToDetail change
    
    return (
        <div className="main-content-container">
            <style>{printStyles}</style>
            <div className="container-fluid mt-4" >
                <h1 className="mb-4">Liste des Cadres</h1>

                {/* Filtres */}
                <div className="card mb-4 no-print">
                    <div className="card-body">
                        <h5 className="card-title">Filtres</h5>
                        <div className="row g-3">
                            <div className="col-md-4">
                                <Form.Group>
                                    <Form.Label>Entité</Form.Label>
                                    <Form.Select 
                                        value={filterEntite}
                                        onChange={(e) => {
                                            setFilterEntite(e.target.value);
                                            setFilterService('');
                                            setFilterCoursId('');
                                        }}
                                    >
                                        <option value="">Toutes les entités</option>
                                        <option value="Service">Service</option>
                                        <option value="Escadron">Escadron</option>
                                    </Form.Select>
                                </Form.Group>
                            </div>

                            {filterEntite === 'Service' && (
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

                            {filterEntite === 'Escadron' && (
                                <div className="col-md-4">
                                    <Form.Group>
                                        <Form.Label>ID Escadron</Form.Label>
                                        <Form.Control
                                            type="number"
                                            value={filterCoursId}
                                            onChange={(e) => setFilterCoursId(e.target.value)}
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

                                        <th>Entité</th>
                                        <th>Service</th>
                                       
                                        <th>Escadron</th>
                                        
                                        <th>Téléphone</th>
                                        <th className="no-print">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentCadres.map((cadre, index) => (
                                        <tr key={cadre.id || index}>
                                            <td>{(currentPage - 1) * itemsPerPage + index + 1}</td>
                                            <td>{cadre.grade || '-'}</td>
                                            <td>{cadre.nom || '-'}</td>
                                            <td>{cadre.prenom || '-'}</td>
                                            <td>{cadre.matricule || '-'}</td>
                                            
                                            <td>{cadre.entite || '-'}</td>
                                            <td>{cadre.service || '-'}</td>
                                            
                                            <td>{cadre.EscadronResponsable?.nom || cadre.cours || '-'}</td>
                                            
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
                                                    variant="info" // Ou une autre couleur de votre choix
                                                    size="sm"
                                                    onClick={() => handleDetail(cadre)} // Appel de la nouvelle fonction
                                                    className="me-2" // Marge à droite
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
                        {totalPages > 1 && (
                            <div className="d-flex justify-content-between align-items-center mt-3 no-print">
                                <div>
                                    Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, cadres.length)} sur {cadres.length} cadres
                                </div>
                                <Pagination>
                                    <Pagination.First onClick={() => setCurrentPage(1)} disabled={currentPage === 1} />
                                    <Pagination.Prev onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} />
                                    {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
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
                                    <Pagination.Next onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} />
                                    <Pagination.Last onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} />
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
                                <Form.Label>Entité</Form.Label>
                                <Form.Select
                                    name="entite"
                                    value={editFormData.entite}
                                    onChange={(e) => setEditFormData({...editFormData, entite: e.target.value})}
                                >
                                    <option value="">Sélectionner</option>
                                    <option value="Service">Service</option>
                                    <option value="Escadron">Escadron</option>
                                </Form.Select>
                            </Form.Group>
                            {editFormData.entite === 'Service' && (
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
                            {editFormData.entite === 'Escadron' && (
                                <Form.Group className="mb-3">
                                    <Form.Label>ID Escadron</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="cours"
                                        value={editFormData.cours}
                                        onChange={(e) => {const value = e.target.value;setEditFormData({...editFormData, cours: e.target.value === '' ? null : parseInt(value)})}}
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
                                            console.log("Données envoyées au backend:", editFormData);
                                           const response = await fetch(`${API_BASE_URL}/cadres/${editFormData.id}`, {
                                                method: 'PUT',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                    'Authorization': `Bearer ${token}`
                                                },
                                                body: JSON.stringify(editFormData)
                                            });

                                            // Gérer les erreurs de réponse
                                            if (!response.ok) {
                                                const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                                                throw new Error(errorData.message || `Échec de la mise à jour (${response.status})`);
                                            }

                                            // --- MODIFICATION ICI ---
                                            const responseData = await response.json(); // Récupère TOUT le corps de la réponse
                                            // Extrait l'objet cadre qui se trouve sous la clé 'cadre'
                                            const updatedCadre = responseData.cadre; 
                                            // --- FIN DE LA MODIFICATION ---

                                            // Utilise l'objet updatedCadre extrait pour mettre à jour l'état
                                            setCadres(cadres.map(c => c.id === updatedCadre.id ? updatedCadre : c));
                                            setShowEditModal(false);
                                            Swal.fire('Succès!', 'Cadre mis à jour', 'success');

                                        } catch (err) {
                                            // Amélioration : Afficher le message d'erreur du backend si disponible
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
            </div>
            {/* Modal de Détail - Placez ce bloc de code à la fin du JSX de votre composant ListCadresPage,
    juste avant la balise fermante de votre conteneur principal (ex: </div> de .main-content-container) */}
<Modal show={showDetailModal} onHide={() => setShowDetailModal(false)} size="lg">
    <Modal.Header closeButton>
        <Modal.Title>Fiche Individuelle </Modal.Title> {/* Titre de la modale */}
    </Modal.Header>
    <Modal.Body>
        {cadreToDetail ? (
            <div ref={detailModalBodyRef} style={{ fontFamily: 'Arial, sans-serif', padding: '15px', lineHeight: '1.6', color: '#333' }}> {/* Conteneur principal avec styles de base */}

                {/* Section En-tête (Nom, Grade/Fonction, Photo) */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                    <div style={{ flexGrow: 1 }}>
                        {/* Nom Complet */}
                        <h2 style={{ margin: '0', fontSize: '28px', fontWeight: 'bold', color: '#000' }}>
                            {cadreToDetail.nom?.toUpperCase() || 'NOM'} {cadreToDetail.prenom || 'Prénom'} {/* Nom en majuscules */}
                        </h2>
                        {/* Grade et Fonction */}
                        <p style={{ margin: '5px 0 0 0', fontSize: '18px', color: '#555' }}>
                            {cadreToDetail.grade || 'Grade non spécifié'} - {cadreToDetail.fonction || 'Fonction non spécifiée'}
                        </p>
                        {/* Matricule sous le nom */}
                         <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#777' }}>
                            Matricule: {cadreToDetail.matricule || '-'}
                        </p>
                    </div>
                    {/* Placeholder pour la photo */}
                    <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#eee', marginLeft: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '50px', color: '#777', overflow: 'hidden', flexShrink: 0 }}>
                         {/* Si vous avez une URL de photo, utilisez une balise img ici */}
                         {/* Exemple : <img src={cadreToDetail.photoUrl || 'url_image_par_defaut.png'} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> */}
                         <i className="bi bi-person-fill"></i> {/* Icône par défaut (nécessite Bootstrap Icons) */}
                    </div>
                </div>

                {/* Section Informations Personnelles et Professionnelles */}
                 <div style={{ marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                     <h3 style={{ fontSize: '20px', marginBottom: '15px', textDecoration: 'underline', color: '#000' }}>Informations</h3>

                     {/* Disposition en 2 colonnes pour les détails */}
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 30px' }}> {/* Adjusted gap */}
                         <div>
                            <p><strong>Date de naissance:</strong> {/* PlaceHolder */ '-'}</p> {/* Laissez vide ou mettez un tiret */}
                            <p><strong>Lieu de naissance:</strong> {/* PlaceHolder */ '-'}</p>
                            <p><strong>Sexe:</strong> {cadreToDetail.sexe || '-'}</p>
                             <p><strong>Situation:</strong> {/* PlaceHolder */ '-'}</p> {/* Marié/Célibataire etc. */}
                            <p><strong>Nombre d'enfants:</strong> {/* PlaceHolder */ '-'}</p>
                         </div>
                         <div>
                             <p><strong>Entité:</strong> {cadreToDetail.entite || '-'}</p>
                             {/* Afficher Service ou Cours/Escadron en fonction de l'entité */}
                             {cadreToDetail.entite === 'Service' && <p><strong>Service:</strong> {cadreToDetail.service || '-'}</p>}
                             {/* Si l'entité est Escadron, afficher "Cours" et l'info de l'escadron */}
                             {cadreToDetail.entite === 'Escadron' && (
                                  <p><strong>Cours:</strong> {cadreToDetail.EscadronResponsable?.nom || cadreToDetail.cours || '-'}</p>
                             )}

                             {/* Champ CFEG */}
                             <p><strong>CFEG:</strong> {/* PlaceHolder */ '-'}</p> {/* Laissez vide ou mettez un tiret */}

                             <p><strong>Date de séjour à EGNA:</strong> {/* PlaceHolder */ '-'}</p>
                         </div>
                     </div>
                 </div>

                {/* Section Contact */}
                <div style={{ marginBottom: '25px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
                    <h3 style={{ fontSize: '20px', marginBottom: '15px', textDecoration: 'underline', color: '#000' }}>Contact</h3>
                     <p><strong>Numéro de téléphone:</strong> {cadreToDetail.numero_telephone || '-'}</p>
                     <p>
                         {/* Logo WhatsApp (exemple avec Bootstrap Icons) */}
                         {/* Assurez-vous d'avoir les icônes Bootstrap installées et importées */}
                         <i className="bi bi-whatsapp me-2" style={{ fontSize: '1.2em', color: '#25D366' }}></i>
                         <strong>WhatsApp:</strong> {/* PlaceHolder ou champ spécifique si différent du numéro principal */ '-' }
                     </p>
                     <p>
                         {/* Logo Gmail (exemple avec Bootstrap Icons) */}
                         <i className="bi bi-envelope-fill me-2" style={{ fontSize: '1.2em', color: '#D14836' }}></i>
                         <strong>Email:</strong> {/* PlaceHolder ou champ email */ '-' }
                     </p>
                </div>

                {/* Section Historique des Absences (Actuellement juste le statut en cours) */}
                 <div>
                     <h3 style={{ fontSize: '20px', marginBottom: '15px', textDecoration: 'underline', color: '#000' }}>Historique des Absences</h3>
                     {cadreToDetail.statut_absence ? (
                         <div>
                             <p><strong>Statut Actuel:</strong> {cadreToDetail.statut_absence}</p>
                             <p><strong>Date de début:</strong> {cadreToDetail.date_debut_absence ? new Date(cadreToDetail.date_debut_absence).toLocaleDateString('fr-FR') : '-'}</p>
                             <p><strong>Motif:</strong> {cadreToDetail.motif_absence || '-'}</p>
                             {/* Pour afficher l'historique complet, il faudrait fetcher ces données séparément */}
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
    );
}


export default ListCadresPage;