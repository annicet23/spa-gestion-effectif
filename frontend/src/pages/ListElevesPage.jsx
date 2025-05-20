import React, { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

function ListElevesPage() {
    const { token } = useAuth();

    const [eleves, setEleves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedEscadron, setSelectedEscadron] = useState('');
    const [selectedPeloton, setSelectedPeloton] = useState('');

    const [showEditModal, setShowEditModal] = useState(false);
    const [eleveToEdit, setEleveToEdit] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState(null);

    const escadronOptions = [
        { value: '', label: 'Tous les escadrons' },
        { value: '1', label: 'Escadron 1' },
        { value: '2', label: 'Escadron 2' },
        { value: '3', label: 'Escadron 3' },
        // Add more escadrons as needed or fetch from API
    ];

    const pelotonOptions = [
        { value: '', label: 'Tous les pelotons' },
        { value: '1', label: 'Peloton 1' },
        { value: '2', label: 'Peloton 2' },
        { value: '3', label: 'Peloton 3' },
        // Add more pelotons as needed or fetch from API
    ];

    useEffect(() => {
        const fetchEleves = async () => {
            if (!token) {
                setError("Authentification requise pour afficher la liste des élèves.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const queryParams = new URLSearchParams();
                if (selectedEscadron) {
                    queryParams.append('escadron_id', selectedEscadron);
                }
                if (selectedPeloton) {
                    queryParams.append('peloton', selectedPeloton);
                }

                const url = `http://localhost:3000/api/eleves${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
                console.log("Fetching élèves from URL:", url);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                });

                if (!response.ok) {
                    let errorMessage = `Erreur lors du chargement des élèves (Statut ${response.status}: ${response.statusText})`;
                    try {
                        const errorBody = await response.json();
                        if (errorBody && errorBody.message) {
                            errorMessage += `: ${errorBody.message}`;
                        } else if (typeof errorBody === 'string' && errorBody.length > 0) {
                             const limitedRawText = errorBody.length > 150 ? errorBody.substring(0, 150) + '...' : errorBody;
                            errorMessage += `: ${limitedRawText}`;
                        }
                    } catch (jsonError) {
                        console.warn("Could not parse error response body as JSON:", jsonError);
                    }
                    throw new Error(errorMessage);
                }

                const data = await response.json();
                setEleves(data);
                console.log("Liste des élèves chargée avec succès (filtrée par backend):", data);

            } catch (err) {
                console.error("Erreur lors du chargement des élèves:", err);
                setError(`Échec du chargement des élèves: ${err.message || 'Erreur réseau'}`);
                setEleves([]);
            } finally {
                setLoading(false);
            }
        };

        fetchEleves();

    }, [token, selectedEscadron, selectedPeloton]);

    const groupedEleves = eleves.reduce((acc, eleve) => {
        const escadronId = eleve.escadron_id;
        if (!acc[escadronId]) {
            acc[escadronId] = [];
        }
        acc[escadronId].push(eleve);
        return acc;
    }, {});

    const sortedEscadronIds = Object.keys(groupedEleves).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    const handlePrint = () => {
        console.log("Fonction Imprimer déclenchée");
        window.print();
    };

    const handleEdit = (eleveId) => {
        console.log(`Préparation à la modification de l'élève avec ID: ${eleveId}`);
        const eleve = eleves.find(e => e.id === eleveId);
        if (eleve) {
            setEleveToEdit(eleve);
            setEditFormData({
                id: eleve.id,
                nom: eleve.nom || '',
                prenom: eleve.prenom || '',
                matricule: eleve.matricule || '',
                incorporation: eleve.incorporation || '',
                peloton: eleve.peloton || '',
                sexe: eleve.sexe || '',
                statut: eleve.statut || '',
                escadron_id: eleve.escadron_id || '',
            });
            setShowEditModal(true);
            setEditError(null);
            setEditLoading(false);
        } else {
            Swal.fire("Erreur", "Élève non trouvé pour la modification.", "error");
        }
    };

    const handleEditFormChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleCloseEditModal = () => {
        setShowEditModal(false);
        setEleveToEdit(null);
        setEditFormData({});
        setEditError(null);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();

        if (!eleveToEdit || !token) {
            setEditError("Impossible de sauvegarder : Élève ou token manquant.");
            Swal.fire("Erreur", "Impossible de sauvegarder les modifications.", "error");
            return;
        }

        setEditLoading(true);
        setEditError(null);

        try {
            const response = await fetch(`http://localhost:3000/api/eleves/${eleveToEdit.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editFormData),
            });

            if (!response.ok) {
                let errorDetail = 'Échec de la sauvegarde de l\'élève.';
                try {
                    const errorBody = await response.json();
                    if (errorBody && errorBody.message) {
                        errorDetail = errorBody.message;
                    } else if (typeof errorBody === 'string' && errorBody.length > 0) {
                         const limitedRawText = errorBody.length > 150 ? errorBody.substring(0, 150) + '...' : errorBody;
                         errorDetail = `Erreur serveur: ${limitedRawText}`;
                    }
                } catch (jsonError) {
                    console.warn("Could not parse error response body as JSON:", jsonError);
                     try {
                         const rawText = await response.text();
                         if (rawText.length > 0) {
                             const limitedRawText = rawText.length > 150 ? rawText.substring(0, 150) + '...' : rawText;
                             errorDetail = `Erreur serveur (statut ${response.status}): ${limitedRawText}`;
                         } else {
                             errorDetail = `Erreur serveur (statut ${response.status}).`;
                         }
                     } catch (textError) {
                          console.warn("Could not read error response body as text:", textError);
                         errorDetail = `Erreur serveur (statut ${response.status}, corps de réponse illisible).`;
                     }
                }
                console.error("API Error Response:", response.status, errorDetail);
                throw new Error(errorDetail);
            }

            const updatedEleve = await response.json();
            console.log("Élève mis à jour avec succès:", updatedEleve);

            setEleves(eleves.map(eleve =>
                eleve.id === updatedEleve.id ? updatedEleve : eleve
            ));

            Swal.fire(
                "Mis à jour !",
                `Les informations de l'élève "${updatedEleve.nom} ${updatedEleve.prenom}" ont été sauvegardées avec succès.`,
                "success"
            );

            handleCloseEditModal();

        } catch (apiError) {
            console.error("Erreur lors de l'appel API de sauvegarde:", apiError);
            setEditError(`Échec de la sauvegarde : ${apiError.message}`);
            Swal.fire(
                "Erreur !",
                `Échec de la sauvegarde : ${apiError.message}`,
                "error"
            );
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (eleveId) => {
        console.log(`Fonction Supprimer déclenchée pour l'élève ID: ${eleveId}`);

        const eleveToDelete = eleves.find(eleve => eleve.id === eleveId);

        if (!eleveToDelete) {
            Swal.fire("Erreur", "Élève non trouvé.", "error");
            return;
        }

        const swalWithBootstrapButtons = Swal.mixin({
            customClass: {
                confirmButton: "btn btn-danger ms-2",
                cancelButton: "btn btn-secondary"
            },
            buttonsStyling: false
        });

        const result = await swalWithBootstrapButtons.fire({
            title: "Êtes-vous sûr ?",
            text: `Vous allez supprimer l'élève ${eleveToDelete.nom} ${eleveToDelete.prenom} (Matricule: ${eleveToDelete.matricule || '-'}). Cette action est irréversible !`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Oui, supprimer !",
            cancelButtonText: "Non, annuler !",
            reverseButtons: true
        });

        if (result.isConfirmed) {
            console.log(`Confirmation de suppression pour l'élève ID: ${eleveId}`);

            try {
                const response = await fetch(`http://localhost:3000/api/eleves/${eleveId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                });

                if (!response.ok) {
                     let errorDetail = `Erreur lors de la suppression de l'élève (Statut ${response.status}: ${response.statusText})`;
                    try {
                         const errorBody = await response.json();
                         if(errorBody && errorBody.message) {
                              errorDetail += `: ${errorBody.message}`;
                         } else if (typeof errorBody === 'string' && errorBody.length > 0) {
                             const limitedRawText = errorBody.length > 150 ? errorBody.substring(0, 150) + '...' : errorBody;
                             errorDetail += `: ${limitedRawText}`;
                         }
                    } catch (jsonError) {
                         console.warn("Could not parse error response body as JSON during delete:", jsonError);
                         // Added fallback to reading as text in case JSON parsing fails but body exists
                         try {
                             const rawText = await response.text();
                             if (rawText.length > 0) {
                                  const limitedRawText = rawText.length > 150 ? rawText.substring(0, 150) + '...' : rawText;
                                  errorDetail = `Erreur serveur (statut ${response.status}): ${limitedRawText}`;
                             } else {
                                  errorDetail = `Erreur serveur (statut ${response.status}).`;
                             }
                         } catch (textError) {
                              console.warn("Could not read error response body as text during delete:", textError);
                              errorDetail = `Erreur serveur (statut ${response.status}, corps de réponse illisible).`;
                         }
                    }
                    throw new Error(errorDetail);
                }

                console.log(`Élève ID ${eleveId} supprimé avec succès du backend.`);

                setEleves(eleves.filter(eleve => eleve.id !== eleveId));

                swalWithBootstrapButtons.fire(
                    "Supprimé !",
                    `L'élève ${eleveToDelete.nom} ${eleveToDelete.prenom} a été supprimé.`,
                    "success"
                );

            } catch (deleteError) {
                console.error("Erreur lors de l'appel API de suppression:", deleteError);
                swalWithBootstrapButtons.fire(
                    "Erreur !",
                    `Échec de la suppression de l'élève : ${deleteError.message}`,
                    "error"
                );
            }

        } else if (result.dismiss === Swal.DismissReason.cancel) {
            console.log("Suppression annulée par l'utilisateur.");
            swalWithBootstrapButtons.fire(
                "Annulé",
                "La suppression a été annulée.",
                "error"
            );
        }
    };

    const handleEscadronChange = (e) => {
        setSelectedEscadron(e.target.value);
        setSelectedPeloton('');
    };

    const handlePelotonChange = (e) => {
        setSelectedPeloton(e.target.value);
    };

    return (
        <div className="container mt-4">
            <h2 className="mb-4">Liste des Élèves</h2>

            <div className="row mb-4 align-items-center no-print">
                <div className="col-md-3">
                    <Form.Group controlId="escadronFilter">
                        <Form.Label>Filtrer par Escadron :</Form.Label>
                        <Form.Select
                            value={selectedEscadron}
                            onChange={handleEscadronChange}
                        >
                            {escadronOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </div>
                <div className="col-md-3">
                    <Form.Group controlId="pelotonFilter">
                        <Form.Label>Filtrer par Peloton :</Form.Label>
                        <Form.Select
                            value={selectedPeloton}
                            onChange={handlePelotonChange}
                            disabled={!selectedEscadron}
                        >
                             {pelotonOptions.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                </div>
                <div className="col-md-6 text-md-end mt-3 mt-md-0">
                     {eleves.length > 0 && !loading && !error && (
                        <Button variant="secondary" onClick={handlePrint}>
                            Imprimer la liste
                        </Button>
                    )}
                </div>
            </div>

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {loading && (
                 <div className="text-center">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Chargement...</span>
                    </div>
                    <p>Chargement des élèves...</p>
                </div>
            )}

            {!loading && !error && (
                Object.keys(groupedEleves).length > 0 ? (
                    sortedEscadronIds.map(escadronId => (
                        <div key={escadronId} className="mb-4">
                            <h3>{escadronOptions.find(opt => opt.value === escadronId)?.label || `Escadron ${escadronId}`}</h3>
                            <div className="table-responsive">
                                <table className="table table-striped table-bordered table-hover">
                                    <thead className="thead-dark">
                                        <tr>
                                            <th>#</th>
                                            <th>Nom</th>
                                            <th>Prénom</th>
                                            <th>Matricule</th>
                                            <th>Incorporation</th>
                                            <th>Peloton</th>
                                            <th>Sexe</th>
                                            <th>Statut</th>
                                            <th className="no-print">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {groupedEleves[escadronId].map((eleve, index) => (
                                            <tr key={eleve.id || `${escadronId}-${index}`}>
                                                <td>{index + 1}</td>
                                                <td>{eleve.nom || '-'}</td>
                                                <td>{eleve.prenom || '-'}</td>
                                                <td>{eleve.matricule || '-'}</td>
                                                <td>{eleve.incorporation || '-'}</td>
                                                <td>{eleve.peloton || '-'}</td>
                                                <td>{eleve.sexe || '-'}</td>
                                                <td>{eleve.statut || '-'}</td>
                                                <td className="no-print">
                                                    <Button
                                                        variant="warning"
                                                        size="sm"
                                                        className="me-1"
                                                        onClick={() => handleEdit(eleve.id)}
                                                        title="Modifier cet élève"
                                                    >
                                                         Modifier
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => handleDelete(eleve.id)}
                                                        title="Supprimer cet élève"
                                                    >
                                                         Supprimer
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))
                ) : (
                     <div className="alert alert-info" role="alert">
                         Aucun élève trouvé pour les filtres sélectionnés.
                     </div>
                )
            )}

            <Modal show={showEditModal} onHide={handleCloseEditModal}>
                <Modal.Header closeButton>
                    <Modal.Title>Modifier l'élève</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editError && (
                        <div className="alert alert-danger" role="alert">
                            {editError}
                        </div>
                    )}
                    <Form onSubmit={handleSaveEdit}>
                        <Form.Group className="mb-3" controlId="editEleveNom">
                            <Form.Label>Nom</Form.Label>
                            <Form.Control
                                type="text"
                                name="nom"
                                value={editFormData.nom || ''}
                                onChange={handleEditFormChange}
                                required
                            />
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editElevePrenom">
                            <Form.Label>Prénom</Form.Label>
                            <Form.Control
                                type="text"
                                name="prenom"
                                value={editFormData.prenom || ''}
                                onChange={handleEditFormChange}
                                required
                            />
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editEleveMatricule">
                            <Form.Label>Matricule</Form.Label>
                            <Form.Control
                                type="text"
                                name="matricule"
                                value={editFormData.matricule || ''}
                                onChange={handleEditFormChange}
                            />
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editEleveIncorporation">
                            <Form.Label>Incorporation</Form.Label>
                            <Form.Control
                                type="text"
                                name="incorporation"
                                value={editFormData.incorporation || ''}
                                onChange={handleEditFormChange}
                            />
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editElevePeloton">
                            <Form.Label>Peloton</Form.Label>
                            <Form.Select
                                name="peloton"
                                value={editFormData.peloton || ''}
                                onChange={handleEditFormChange}
                                required
                            >
                                <option value="">Sélectionner</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </Form.Select>
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editEleveSexe">
                            <Form.Label>Sexe</Form.Label>
                            <Form.Select
                                name="sexe"
                                value={editFormData.sexe || ''}
                                onChange={handleEditFormChange}
                                required
                            >
                                <option value="">Sélectionner</option>
                                <option value="Masculin">Masculin</option>
                                <option value="Féminin">Féminin</option>
                                <option value="Autre">Autre</option>
                            </Form.Select>
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editEleveStatut">
                            <Form.Label>Statut</Form.Label>
                            <Form.Control
                                type="text"
                                name="statut"
                                value={editFormData.statut || ''}
                                onChange={handleEditFormChange}
                            />
                        </Form.Group>

                         <Form.Group className="mb-3" controlId="editEleveEscadronId">
                            <Form.Label>ID Escadron</Form.Label>
                            <Form.Control
                                type="number"
                                name="escadron_id"
                                value={editFormData.escadron_id || ''}
                                onChange={handleEditFormChange}
                                required
                            />
                        </Form.Group>

                        {/* Buttons are inside the form */}
                        <Button variant="primary" type="submit" disabled={editLoading}>
                            {editLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                                    Sauvegarde...
                                </>
                            ) : (
                                'Sauvegarder les modifications'
                            )}
                        </Button>
                         <Button variant="secondary" onClick={handleCloseEditModal} disabled={editLoading} className="ms-2">
                            Annuler
                        </Button>
                    </Form>
                </Modal.Body>
                {/* Modal Footer can be used for other actions not related to the form */}
                {/* <Modal.Footer>
                     Maybe add a "Reset Form" button here?
                </Modal.Footer> */}
            </Modal>
        </div>
    );
}

export default ListElevesPage;