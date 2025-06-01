import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import CreateUserModal from '../components/CreateUserModal';
import EditUserModal from '../components/EditUserModal';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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

      const response = await axios.get(`${API_BASE_URL}api/users`, {
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

  // ✅ FONCTION MODIFIÉE - Désactivation au lieu de suppression
  const handleDeactivateUser = async (userId, userToDeactivate) => {
    // Vérifier si l'utilisateur est déjà désactivé
    if (userToDeactivate.status === 'Inactive') {
      Swal.fire({
        title: 'Information',
        text: `L'utilisateur "${userToDeactivate.username}" est déjà désactivé.`,
        icon: 'info'
      });
      return;
    }

    const swalWithBootstrapButtons = Swal.mixin({
      customClass: {
        confirmButton: "btn btn-warning mx-2",
        cancelButton: "btn btn-secondary"
      },
      buttonsStyling: false
    });

    swalWithBootstrapButtons.fire({
      title: "Désactiver cet utilisateur ?",
      html: `
        <p><strong>Utilisateur :</strong> ${userToDeactivate.username}</p>
        <p><strong>Rôle :</strong> ${userToDeactivate.role}</p>
        <br>
        <p class="text-warning">⚠️ <strong>Cette action va :</strong></p>
        <ul class="text-start">
          <li>✅ Désactiver le compte (pas de suppression)</li>
          <li>✅ Conserver toutes les données (messages, soumissions)</li>
          <li>✅ Empêcher la connexion</li>
          <li>✅ Permettre une réactivation future</li>
        </ul>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Oui, désactiver !",
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

          console.log(`[FRONTEND] Désactivation de l'utilisateur ID: ${userId}`);

          // ✅ Appel à la même route DELETE qui désactive maintenant
          const response = await axios.delete(`${API_BASE_URL}api/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          console.log('[FRONTEND] Réponse de désactivation:', response.data);

          // ✅ Actualiser la liste des utilisateurs
          await fetchUsers();

          // ✅ Message de succès adapté
          swalWithBootstrapButtons.fire({
            title: 'Désactivé !',
            html: `
              <p><strong>${response.data.message}</strong></p>
              <hr>
              <small class="text-muted">
                <strong>Action :</strong> ${response.data.action || 'disabled'}<br>
                ${response.data.details ?
                  `<strong>Données conservées :</strong> ${response.data.details.preservedData?.submissions || 0} soumissions, ${response.data.details.preservedData?.messages || 'messages'}`
                  : ''}
              </small>
            `,
            icon: 'success'
          });

        } catch (err) {
          console.error(`[FRONTEND] Erreur lors de la désactivation de l'utilisateur ${userId} :`, err);

          let errorMessage = `Erreur lors de la désactivation de l'utilisateur.`;
          let errorDetails = '';

          if (err.response) {
            if (err.response.status === 401 || err.response.status === 403) {
              errorMessage = "Vous n'êtes pas autorisé à désactiver cet utilisateur.";
            } else if (err.response.status === 404) {
              errorMessage = `Utilisateur non trouvé.`;
            } else if (err.response.data && err.response.data.message) {
              errorMessage = err.response.data.message;
              if (err.response.data.suggestion) {
                errorDetails = `<br><small class="text-info">💡 ${err.response.data.suggestion}</small>`;
              }
            } else {
              errorMessage = `Erreur serveur : ${err.response.status} ${err.response.statusText}`;
            }
          } else if (err.request) {
            errorMessage = "Erreur réseau lors de la désactivation.";
          } else {
            errorMessage = "Erreur inattendue lors de la désactivation.";
          }

          swalWithBootstrapButtons.fire({
            title: 'Erreur !',
            html: errorMessage + errorDetails,
            icon: 'error'
          });
        }
      } else if (result.dismiss === Swal.DismissReason.cancel) {
        swalWithBootstrapButtons.fire(
          'Annulé',
          `La désactivation de l'utilisateur "${userToDeactivate.username}" a été annulée.`,
          'info'
        );
      }
    });
  };

  // ✅ NOUVELLE FONCTION - Réactiver un utilisateur
  const handleReactivateUser = async (userId, userToReactivate) => {
    const swalWithBootstrapButtons = Swal.mixin({
      customClass: {
        confirmButton: "btn btn-success mx-2",
        cancelButton: "btn btn-secondary"
      },
      buttonsStyling: false
    });

    swalWithBootstrapButtons.fire({
      title: "Réactiver cet utilisateur ?",
      html: `
        <p><strong>Utilisateur :</strong> ${userToReactivate.username}</p>
        <p><strong>Rôle :</strong> ${userToReactivate.role}</p>
        <br>
        <p class="text-success">✅ Cette action va réactiver le compte et permettre la connexion.</p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Oui, réactiver !",
      cancelButtonText: "Non, annuler"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = localStorage.getItem('token');
          const response = await axios.patch(`${API_BASE_URL}api/users/${userId}/reactivate`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });

          await fetchUsers();

          swalWithBootstrapButtons.fire(
            'Réactivé !',
            response.data.message,
            'success'
          );

        } catch (err) {
          console.error('Erreur lors de la réactivation:', err);
          let errorMessage = "Erreur lors de la réactivation.";
          if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
          }

          swalWithBootstrapButtons.fire(
            'Erreur !',
            errorMessage,
            'error'
          );
        }
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

      {/* ✅ Légende des statuts */}
      <div className="mb-3">
        <small className="text-muted">
          <strong>Statuts :</strong>
          <span className="badge bg-success ms-2">Active</span>
          <span className="badge bg-secondary ms-2">Inactive</span>
        </small>
      </div>

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
            {users.map((userData) => (
              <tr key={userData.id} className={userData.status === 'Inactive' ? 'table-secondary' : ''}>
                <td>{userData.id}</td>
                <td>
                  {userData.username}
                  {userData.status === 'Inactive' && (
                    <small className="text-muted d-block">(Désactivé)</small>
                  )}
                </td>
                <td>{userData.role}</td>
                <td>
                  <span className={`badge ${userData.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
                    {userData.status || 'N/A'}
                  </span>
                </td>
                <td>
                  <Button
                    variant="warning"
                    size="sm"
                    className="me-2"
                    onClick={() => handleShowEditModal(userData)}
                    disabled={userData.status === 'Inactive'}
                  >
                    Modifier
                  </Button>

                  {/* ✅ Bouton conditionnel selon le statut */}
                  {userData.status === 'Active' ? (
                    <button
                      className="btn btn-sm btn-warning"
                      onClick={() => handleDeactivateUser(userData.id, userData)}
                    >
                      <i className="bi bi-pause-circle me-1"></i>
                      Désactiver
                    </button>
                  ) : (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => handleReactivateUser(userData.id, userData)}
                    >
                      <i className="bi bi-play-circle me-1"></i>
                      Réactiver
                    </button>
                  )}
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