import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Button, Table, Form, Alert, Pagination } from 'react-bootstrap';
import { FaPlus, FaEdit, FaTrash, FaFileExcel, FaCalendarAlt, FaHistory } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const HistoriqueAbsenceModal = ({ show, onHide, cadre, canModify = false }) => {
    const { token } = useAuth();
    const [historique, setHistorique] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingAbsence, setEditingAbsence] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Form data pour ajouter/modifier une absence
    const [formData, setFormData] = useState({
        date_debut: '',
        date_fin: '',
        statut: 'Absent',
        motif: ''
    });

    // Charger l'historique des absences
    const loadHistorique = useCallback(async () => {
        if (!cadre || !token) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}api/absences/cadre/${cadre.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error('Erreur lors du chargement de l\'historique');
            }

            const data = await response.json();
            setHistorique(data);
        } catch (err) {
            console.error('Erreur chargement historique:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [cadre, token]);

    useEffect(() => {
        if (show && cadre) {
            loadHistorique();
        }
    }, [show, cadre, loadHistorique]);

    // Calculer la durée d'une absence
    const calculerDuree = (dateDebut, dateFin) => {
        if (!dateDebut || !dateFin) return '-';

        const debut = new Date(dateDebut);
        const fin = new Date(dateFin);
        const diffTime = Math.abs(fin - debut);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de début

        return `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = historique.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(historique.length / itemsPerPage);

    // Gestion du formulaire
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.date_debut || !formData.date_fin || !formData.motif.trim()) {
            Swal.fire('Erreur', 'Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }

        if (new Date(formData.date_fin) < new Date(formData.date_debut)) {
            Swal.fire('Erreur', 'La date de fin doit être postérieure à la date de début', 'error');
            return;
        }

        try {
            const method = editingAbsence ? 'PUT' : 'POST';
            const url = editingAbsence
                ? `${API_BASE_URL}api/absences/${editingAbsence.id}`
                : `${API_BASE_URL}api/absences`;

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    cadre_id: cadre.id
                })
            });

            if (!response.ok) {
                throw new Error('Erreur lors de la sauvegarde');
            }

            await loadHistorique();
            resetForm();

            Swal.fire(
                'Succès',
                `Absence ${editingAbsence ? 'modifiée' : 'ajoutée'} avec succès`,
                'success'
            );
        } catch (err) {
            Swal.fire('Erreur', err.message, 'error');
        }
    };

    const resetForm = () => {
        setFormData({
            date_debut: '',
            date_fin: '',
            statut: 'Absent',
            motif: ''
        });
        setShowAddForm(false);
        setEditingAbsence(null);
    };

    const handleEdit = (absence) => {
        setEditingAbsence(absence);
        setFormData({
            date_debut: absence.date_debut?.split('T')[0] || '',
            date_fin: absence.date_fin?.split('T')[0] || '',
            statut: absence.statut || 'Absent',
            motif: absence.motif || ''
        });
        setShowAddForm(true);
    };

    const handleDelete = async (absence) => {
        const result = await Swal.fire({
            title: 'Confirmer la suppression',
            text: `Supprimer cette période d'absence (${absence.motif}) ?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Supprimer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            try {
                const response = await fetch(`${API_BASE_URL}api/absences/${absence.id}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error('Erreur lors de la suppression');
                }

                await loadHistorique();
                Swal.fire('Supprimé!', 'L\'absence a été supprimée.', 'success');
            } catch (err) {
                Swal.fire('Erreur!', err.message, 'error');
            }
        }
    };

    // Export Excel
    const handleExportExcel = () => {
        if (historique.length === 0) {
            Swal.fire('Info', 'Aucun historique à exporter', 'info');
            return;
        }

        const headers = ['N°', 'Date début', 'Date fin', 'Statut', 'Motif', 'Durée'];
        const excelData = [headers];

        historique.forEach((absence, index) => {
            excelData.push([
                index + 1,
                absence.date_debut ? new Date(absence.date_debut).toLocaleDateString('fr-FR') : '-',
                absence.date_fin ? new Date(absence.date_fin).toLocaleDateString('fr-FR') : '-',
                absence.statut || '-',
                absence.motif || '-',
                calculerDuree(absence.date_debut, absence.date_fin)
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(excelData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Historique Absences');

        const fileName = `historique_absences_${cadre.nom}_${cadre.prenom}_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);

        Swal.fire({
            icon: 'success',
            title: 'Export réussi',
            text: `${historique.length} absences exportées`,
            timer: 2000,
            showConfirmButton: false
        });
    };

    return (
        <Modal show={show} onHide={onHide} size="xl">
            <Modal.Header closeButton>
                <Modal.Title>
                    <FaHistory className="me-2" />
                    Historique d'absence - {cadre?.grade} {cadre?.nom} {cadre?.prenom}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {error && <Alert variant="danger">{error}</Alert>}

                {/* Boutons d'action */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h6>Total des absences : <span className="badge bg-primary">{historique.length}</span></h6>
                    </div>
                    <div>
                        <Button
                            variant="success"
                            size="sm"
                            onClick={handleExportExcel}
                            disabled={historique.length === 0}
                            className="me-2"
                        >
                            <FaFileExcel className="me-1" />
                            Export Excel
                        </Button>
                        {canModify && (
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => setShowAddForm(!showAddForm)}
                            >
                                <FaPlus className="me-1" />
                                {showAddForm ? 'Annuler' : 'Ajouter absence'}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Formulaire d'ajout/modification */}
                {showAddForm && canModify && (
                    <div className="card mb-3">
                        <div className="card-header">
                            <h6 className="mb-0">
                                {editingAbsence ? 'Modifier l\'absence' : 'Ajouter une absence'}
                            </h6>
                        </div>
                        <div className="card-body">
                            <Form onSubmit={handleSubmit}>
                                <div className="row">
                                    <div className="col-md-3">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Date début *</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={formData.date_debut}
                                                onChange={(e) => setFormData({...formData, date_debut: e.target.value})}
                                                required
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-3">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Date fin *</Form.Label>
                                            <Form.Control
                                                type="date"
                                                value={formData.date_fin}
                                                onChange={(e) => setFormData({...formData, date_fin: e.target.value})}
                                                required
                                            />
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-2">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Statut *</Form.Label>
                                            <Form.Select
                                                value={formData.statut}
                                                onChange={(e) => setFormData({...formData, statut: e.target.value})}
                                                required
                                            >
                                                <option value="Absent">Absent</option>
                                                <option value="Indisponible">Indisponible</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </div>
                                    <div className="col-md-4">
                                        <Form.Group className="mb-3">
                                            <Form.Label>Motif *</Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="Ex: Congé maladie, Mission, Congé annuel..."
                                                value={formData.motif}
                                                onChange={(e) => setFormData({...formData, motif: e.target.value})}
                                                required
                                            />
                                        </Form.Group>
                                    </div>
                                </div>
                                <div className="d-flex gap-2">
                                    <Button type="submit" variant="primary" size="sm">
                                        {editingAbsence ? 'Modifier' : 'Ajouter'}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={resetForm}
                                    >
                                        Annuler
                                    </Button>
                                </div>
                            </Form>
                        </div>
                    </div>
                )}

                {/* Tableau des absences */}
                {loading ? (
                    <div className="text-center my-4">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Chargement...</span>
                        </div>
                    </div>
                ) : historique.length > 0 ? (
                    <>
                        <div className="table-responsive">
                            <Table striped bordered hover>
                                <thead className="table-dark">
                                    <tr>
                                        <th>N°</th>
                                        <th>Date début</th>
                                        <th>Date fin</th>
                                        <th>Statut</th>
                                        <th>Motif</th>
                                        <th>Durée</th>
                                        {canModify && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentItems.map((absence, index) => (
                                        <tr key={absence.id}>
                                            <td>{indexOfFirstItem + index + 1}</td>
                                            <td>
                                                {absence.date_debut ?
                                                    new Date(absence.date_debut).toLocaleDateString('fr-FR') : '-'
                                                }
                                            </td>
                                            <td>
                                                {absence.date_fin ?
                                                    new Date(absence.date_fin).toLocaleDateString('fr-FR') : '-'
                                                }
                                            </td>
                                            <td>
                                                <span className={`badge ${
                                                    absence.statut === 'Absent' ? 'bg-danger' :
                                                    absence.statut === 'Indisponible' ? 'bg-warning' :
                                                    'bg-secondary'
                                                }`}>
                                                    {absence.statut || '-'}
                                                </span>
                                            </td>
                                            <td>{absence.motif || '-'}</td>
                                            <td>{calculerDuree(absence.date_debut, absence.date_fin)}</td>
                                            {canModify && (
                                                <td>
                                                    <div className="btn-group" role="group">
                                                        <Button
                                                            variant="warning"
                                                            size="sm"
                                                            onClick={() => handleEdit(absence)}
                                                            title="Modifier"
                                                        >
                                                            <FaEdit />
                                                        </Button>
                                                        <Button
                                                            variant="danger"
                                                            size="sm"
                                                            onClick={() => handleDelete(absence)}
                                                            title="Supprimer"
                                                        >
                                                            <FaTrash />
                                                        </Button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, historique.length)} sur {historique.length} absences
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
                    <Alert variant="info">
                        <FaCalendarAlt className="me-2" />
                        Aucun historique d'absence trouvé pour ce cadre.
                        {canModify && " Vous pouvez ajouter une absence en cliquant sur le bouton ci-dessus."}
                    </Alert>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Fermer
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default HistoriqueAbsenceModal;