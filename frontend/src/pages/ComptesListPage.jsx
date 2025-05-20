import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import CreateUserModal from '../components/CreateUserModal';
import EditUserModal from '../components/EditUserModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

function ComptesListPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user, loading: authLoading } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);

  const handleShowCreateModal = () => setShowCreateModal(true);
  const handleCloseCreateModal = () => setShowCreateModal(false);

  const handleShowEditModal = (user) => {
    setUserToEdit(user);
    setShowEditModal(true);
  };
  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setUserToEdit(null);
  };

  const handleUserCreatedOrUpdated = () => {
     fetchUsers();
  };

  const fetchUsers = async () => {
    if (authLoading) return;
        setLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setError("Aucun token d'authentification trouvé. Veuillez vous connecter.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setUsers(response.data);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Erreur lors de la récupération des utilisateurs :", err);
      setUsers([]);
      setLoading(false);
      let errorMessage = "Erreur lors du chargement des utilisateurs.";
      if (err.response) {
          if (err.response.status === 401 || err.response.status === 403) {
               errorMessage = "Vous n'êtes pas autorisé à voir cette liste ou votre session a expiré. (Code: " + err.response.status + ")";
          } else if (err.response.data && err.response.data.message) {
               errorMessage = "Erreur API : " + err.response.data.message;
          } else {
               errorMessage = `Erreur serveur : ${err.response.status} ${err.response.statusText}`;
          }
      } else if (err.request) {
            errorMessage = "Erreur réseau : Impossible de joindre le serveur.";
      } else {
            errorMessage = "Erreur inattendue lors de la requête.";
      }
      setError(errorMessage);
    }
  };

   const handleDelete = async (userId) => {
        const swalWithBootstrapButtons = Swal.mixin({
            customClass: {
                confirmButton: "btn btn-danger mx-2",
                cancelButton: "btn btn-secondary"
            },
            buttonsStyling: false
        });

        swalWithBootstrapButtons.fire({
            title: "Êtes-vous sûr(e) ?",
            text: "Cette action est irréversible !",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Oui, supprimer !",
            cancelButtonText: "Non, annuler",
            reverseButtons: true
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    const token = localStorage.getItem('token');
                    if (!token) {
                         Swal.fire({
                            title: 'Erreur !',
                            text: "Aucun token d'authentification trouvé. Opération annulée.",
                            icon: 'error'
                        });
                        return;
                    }

                    await axios.delete(`${API_BASE_URL}/users/${userId}`, {
                        headers: { Authorization: `Bearer ${token}`, },
                    });

                    setUsers(users.filter(user => user.id !== userId));

                    swalWithBootstrapButtons.fire(
                        'Supprimé !',
                        `L'utilisateur ID ${userId} a été supprimé avec succès.`,
                        'success'
                    );

                } catch (err) {
                    console.error(`Erreur lors de la suppression de l'utilisateur ${userId} :`, err);
                    let errorMessage = `Erreur lors de la suppression de l'utilisateur ID ${userId}.`;
                    if (err.response) {
                        if (err.response.status === 401 || err.response.status === 403) {
                             errorMessage = "Vous n'êtes pas autorisé à supprimer cet utilisateur.";
                        } else if (err.response.status === 404) {
                             errorMessage = `Utilisateur ID ${userId} non trouvé.`;
                        } else if (err.response.data && err.response.data.message) {
                             errorMessage = "Erreur API : " + err.response.data.message;
                        } else {
                           errorMessage = `Erreur serveur : ${err.response.status} ${err.response.statusText}`;
                        }
                    } else if (err.request) {
                          errorMessage = "Erreur réseau lors de la suppression.";
                    } else {
                         errorMessage = "Erreur inattendue lors de la suppression.";
                    }

                    swalWithBootstrapButtons.fire(
                        'Erreur !',
                        errorMessage,
                        'error'
                    );
                }
            } else if (
                result.dismiss === Swal.DismissReason.cancel
            ) {
                swalWithBootstrapButtons.fire(
                    'Annulé',
                    `La suppression de l'utilisateur ID ${userId} a été annulée.`,
                    'error'
                );
            }
        });
    };

  useEffect(() => {
    if (!authLoading) {
       fetchUsers();
    }
  }, [authLoading]);

  return (
    <div className="container mt-4">
      <h1>Liste des Comptes Utilisateurs</h1>

      {user && user.role === 'Admin' && (
          <Button variant="primary" className="mb-3" onClick={handleShowCreateModal}>
              Créer un nouveau compte
          </Button>
      )}

      {(loading || authLoading) && <p>Chargement des utilisateurs...</p>}
      {!loading && !authLoading && error && <div className="alert alert-danger" role="alert">{error}</div>}

      {!loading && !authLoading && !error && users.length > 0 && (
        <table className="table table-striped">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Nom d'utilisateur</th>
              <th scope="col">Rôle</th>
              <th scope="col">Statut</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>{user.username}</td>
                <td>{user.role}</td>
                <td>{user.status || 'N/A'}</td>
                <td>
                  <Button variant="warning" size="sm" className="me-2" onClick={() => handleShowEditModal(user)}>Modifier</Button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(user.id)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
       {!loading && !authLoading && !error && users.length === 0 && (
           <p>Aucun utilisateur trouvé.</p>
       )}

       <CreateUserModal
           show={showCreateModal}
           handleClose={handleCloseCreateModal}
           onUserCreated={handleUserCreatedOrUpdated}
       />

       {userToEdit && (
         <EditUserModal
            show={showEditModal}
            handleClose={handleCloseEditModal}
            user={userToEdit}
            onUserUpdated={handleUserCreatedOrUpdated}
         />
       )}

    </div>
  );
}

export default ComptesListPage;