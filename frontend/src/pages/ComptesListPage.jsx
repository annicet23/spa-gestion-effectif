import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Button, Spinner, Alert, Form } from 'react-bootstrap';
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

  // 🆕 NOUVEAU STATE POUR FILTRER LES COMPTES DÉSACTIVÉS
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);

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

  // 🆕 FONCTION POUR FILTRER LES UTILISATEURS
  const getFilteredUsers = () => {
    if (showInactiveUsers) {
      // Montrer tous les utilisateurs (actifs + inactifs)
      return users;
    } else {
      // Cacher les comptes désactivés (montrer seulement les actifs)
      return users.filter(userData => userData.status === 'Active');
    }
  };

  // ✅ FONCTION FETCHUSERS IDENTIQUE
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setError("Aucun token d'authentification trouvé. Veuillez vous connecter.");
        setLoading(false);
        return;
      }

      console.log('🔍 Récupération des utilisateurs...');
      console.log('🔍 API URL:', `${API_BASE_URL}api/users`);
      console.log('🔍 Token présent:', !!token);

      const response = await axios.get(`${API_BASE_URL}api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('✅ Utilisateurs récupérés:', response.data);
      setUsers(response.data || []);
      setError(null);

    } catch (err) {
      console.error("❌ Erreur lors de la récupération des utilisateurs :", err);
      console.error("❌ Détails:", err.response?.data);

      setUsers([]);
      let errorMessage = "Erreur lors du chargement des utilisateurs.";

      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = "❌ Session expirée : Veuillez vous reconnecter.";
        } else if (err.response.status === 403) {
          errorMessage = "❌ Accès refusé : Vous devez être administrateur pour voir cette liste.";
        } else if (err.response.data && err.response.data.message) {
          errorMessage = "Erreur API : " + err.response.data.message;
        } else {
          errorMessage = `Erreur serveur : ${err.response.status} ${err.response.statusText}`;
        }
      } else if (err.request) {
        errorMessage = "❌ Erreur réseau : Impossible de joindre le serveur.";
      } else {
        errorMessage = "❌ Erreur inattendue lors de la requête.";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FONCTION DÉSACTIVATION IDENTIQUE
  const handleDeactivateUser = async (userId, userToDeactivate) => {
    if (user && user.id === userId) {
      Swal.fire({
        title: 'Action impossible',
        text: 'Vous ne pouvez pas désactiver votre propre compte.',
        icon: 'warning'
      });
      return;
    }

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
        <div class="text-start">
          <p><strong>Utilisateur :</strong> ${userToDeactivate.username}</p>
          <p><strong>Rôle :</strong> ${userToDeactivate.role}</p>
          ${userToDeactivate.cadre ? `<p><strong>Cadre :</strong> ${userToDeactivate.cadre.nom} ${userToDeactivate.cadre.prenom}</p>` : ''}
          <br>
          <div class="alert alert-warning">
            <strong>⚠️ Cette action va :</strong>
            <ul class="mb-0 mt-2">
              <li>✅ Désactiver le compte (pas de suppression)</li>
              <li>✅ Conserver toutes les données</li>
              <li>✅ Empêcher la connexion</li>
              <li>✅ Permettre une réactivation future</li>
            </ul>
          </div>
        </div>
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
              text: "Token manquant. Veuillez vous reconnecter.",
              icon: 'error'
            });
            return;
          }

          console.log(`[FRONTEND] Désactivation de l'utilisateur ID: ${userId}`);

          const response = await axios.delete(`${API_BASE_URL}api/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          console.log('[FRONTEND] Réponse de désactivation:', response.data);

          await fetchUsers();

          swalWithBootstrapButtons.fire({
            title: 'Désactivé !',
            html: `
              <p><strong>${response.data.message}</strong></p>
              <hr>
              <small class="text-muted">
                <strong>Action :</strong> ${response.data.action || 'disabled'}<br>
                ${response.data.details ?
                  `<strong>Données conservées :</strong> ${response.data.details.preservedData?.submissions || 0} soumissions`
                  : ''}
              </small>
            `,
            icon: 'success'
          });

        } catch (err) {
          console.error(`[FRONTEND] Erreur lors de la désactivation :`, err);

          let errorMessage = `Erreur lors de la désactivation.`;
          if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
          } else if (err.response?.status === 403) {
            errorMessage = "Accès refusé : Vous n'êtes pas autorisé à désactiver cet utilisateur.";
          } else if (err.response?.status === 404) {
            errorMessage = "Utilisateur non trouvé.";
          }

          swalWithBootstrapButtons.fire({
            title: 'Erreur !',
            text: errorMessage,
            icon: 'error'
          });
        }
      }
    });
  };

  // ✅ FONCTION RÉACTIVATION IDENTIQUE
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
        <div class="text-start">
          <p><strong>Utilisateur :</strong> ${userToReactivate.username}</p>
          <p><strong>Rôle :</strong> ${userToReactivate.role}</p>
          <br>
          <div class="alert alert-success">
            <strong>✅ Cette action va :</strong>
            <ul class="mb-0 mt-2">
              <li>Réactiver le compte</li>
              <li>Permettre la connexion</li>
              <li>Restaurer tous les accès</li>
            </ul>
          </div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Oui, réactiver !",
      cancelButtonText: "Non, annuler"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            Swal.fire('Erreur', 'Token manquant. Veuillez vous reconnecter.', 'error');
            return;
          }

          console.log(`[FRONTEND] Réactivation de l'utilisateur ID: ${userId}`);

          const response = await axios.patch(`${API_BASE_URL}api/users/${userId}/reactivate`, {}, {
            headers: { Authorization: `Bearer ${token}` },
          });

          console.log('[FRONTEND] Réponse de réactivation:', response.data);

          await fetchUsers();

          swalWithBootstrapButtons.fire(
            'Réactivé !',
            response.data.message,
            'success'
          );

        } catch (err) {
          console.error('❌ Erreur lors de la réactivation:', err);

          let errorMessage = "Erreur lors de la réactivation.";
          if (err.response?.data?.message) {
            errorMessage = err.response.data.message;
          } else if (err.response?.status === 400 && err.response.data?.suggestion) {
            errorMessage = err.response.data.message + "\n\n💡 " + err.response.data.suggestion;
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

  // ✅ USEEFFECT IDENTIQUE
  useEffect(() => {
    console.log('🔄 ComptesListPage - useEffect:', { authLoading, user: user?.role });

    if (!authLoading) {
      if (user && user.role === 'Admin') {
        fetchUsers();
      } else if (user && user.role !== 'Admin') {
        setError("❌ Accès refusé : Seuls les administrateurs peuvent voir cette page.");
        setLoading(false);
      }
    }
  }, [authLoading, user]);

  // ✅ VÉRIFICATION DES PERMISSIONS IDENTIQUE
  if (authLoading) {
    return (
      <div className="container mt-4">
        <div className="d-flex justify-content-center">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Chargement...</span>
          </Spinner>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'Admin') {
    return (
      <div className="container mt-4">
        <Alert variant="danger">
          <h4>❌ Accès refusé</h4>
          <p>Seuls les administrateurs peuvent accéder à cette page.</p>
          <hr />
          <p className="mb-0">
            <strong>Votre rôle actuel :</strong> {user?.role || 'Non défini'}
          </p>
        </Alert>
      </div>
    );
  }

  // 🆕 UTILISER LES UTILISATEURS FILTRÉS
  const filteredUsers = getFilteredUsers();

  return (
    <div className="container mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>
          <i className="bi bi-people me-2"></i>
          Liste des Comptes Utilisateurs
        </h1>
        <Button
          variant="primary"
          onClick={handleShowCreateModal}
          disabled={loading}
        >
          <i className="bi bi-person-plus me-2"></i>
          Créer un nouveau compte
        </Button>
      </div>

      {/* 🆕 NOUVEAU : FILTRE POUR AFFICHER/CACHER LES COMPTES DÉSACTIVÉS */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-md-8">
              <h6 className="card-title mb-2">
                <i className="bi bi-funnel me-2"></i>
                Options d'affichage
              </h6>
              <Form.Check
                type="switch"
                id="show-inactive-switch"
                label={
                  <span>
                    <i className="bi bi-eye me-1"></i>
                    Afficher les comptes désactivés
                    <small className="text-muted ms-2">
                      ({users.filter(u => u.status === 'Inactive').length} compte(s) désactivé(s))
                    </small>
                  </span>
                }
                checked={showInactiveUsers}
                onChange={(e) => setShowInactiveUsers(e.target.checked)}
              />
            </div>
            <div className="col-md-4 text-end">
              <small className="text-muted">
                <strong>Affichés :</strong> {filteredUsers.length} / {users.length} comptes
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ Statistiques rapides - MISES À JOUR AVEC LES FILTRES */}
      {users.length > 0 && (
        <div className="row mb-3">
          <div className="col-md-3">
            <div className="card bg-primary text-white">
              <div className="card-body">
                <h5 className="card-title">
                  <i className="bi bi-list-ul me-1"></i>
                  Affichés
                </h5>
                <h3>{filteredUsers.length}</h3>
                <small>sur {users.length} total</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-success text-white">
              <div className="card-body">
                <h5 className="card-title">
                  <i className="bi bi-check-circle me-1"></i>
                  Actifs
                </h5>
                <h3>{users.filter(u => u.status === 'Active').length}</h3>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-secondary text-white">
              <div className="card-body">
                <h5 className="card-title">
                  <i className="bi bi-pause-circle me-1"></i>
                  Inactifs
                </h5>
                <h3>{users.filter(u => u.status === 'Inactive').length}</h3>
                <small>{showInactiveUsers ? 'Visibles' : 'Cachés'}</small>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card bg-info text-white">
              <div className="card-body">
                <h5 className="card-title">
                  <i className="bi bi-shield me-1"></i>
                  Admins
                </h5>
                <h3>{users.filter(u => u.role === 'Admin').length}</h3>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 ALERTE INFORMATIVE QUAND LES COMPTES INACTIFS SONT CACHÉS */}
      {!showInactiveUsers && users.filter(u => u.status === 'Inactive').length > 0 && (
        <Alert variant="info" className="d-flex align-items-center">
          <i className="bi bi-info-circle me-2"></i>
          <div>
            <strong>Information :</strong> {users.filter(u => u.status === 'Inactive').length} compte(s) désactivé(s)
            sont actuellement cachés.
            <Button
              variant="link"
              className="p-0 ms-1"
              onClick={() => setShowInactiveUsers(true)}
            >
              Cliquez ici pour les afficher
            </Button>
          </div>
        </Alert>
      )}

      {/* ✅ Légende des statuts */}
      <div className="mb-3">
        <small className="text-muted">
          <strong>Statuts :</strong>
          <span className="badge bg-success ms-2">
            <i className="bi bi-check-circle me-1"></i>
            Active
          </span>
          {showInactiveUsers && (
            <span className="badge bg-secondary ms-2">
              <i className="bi bi-pause-circle me-1"></i>
              Inactive
            </span>
          )}
        </small>
      </div>

      {/* ✅ Gestion du loading */}
      {loading && (
        <div className="text-center py-4">
          <Spinner animation="border" role="status" className="me-2" />
          <span>Chargement des utilisateurs...</span>
        </div>
      )}

      {/* ✅ Gestion des erreurs */}
      {!loading && error && (
        <Alert variant="danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {/* ✅ Tableau des utilisateurs - UTILISE filteredUsers AU LIEU DE users */}
      {!loading && !error && filteredUsers.length > 0 && (
        <div className="table-responsive">
          <table className="table table-striped table-hover">
            <thead className="table-dark">
              <tr>
                <th scope="col">
                  <i className="bi bi-hash me-1"></i>
                  ID
                </th>
                <th scope="col">
                  <i className="bi bi-person me-1"></i>
                  Nom d'utilisateur
                </th>
                <th scope="col">
                  <i className="bi bi-shield me-1"></i>
                  Rôle
                </th>
                <th scope="col">
                  <i className="bi bi-activity me-1"></i>
                  Statut
                </th>
                <th scope="col">
                  <i className="bi bi-building me-1"></i>
                  Cadre associé
                </th>
                <th scope="col">
                  <i className="bi bi-gear me-1"></i>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((userData) => (
                <tr
                  key={userData.id}
                  className={userData.status === 'Inactive' ? 'table-secondary' : ''}
                >
                  <td>
                    <strong>#{userData.id}</strong>
                  </td>
                  <td>
                    <div>
                      <strong>{userData.username}</strong>
                      {userData.status === 'Inactive' && (
                        <small className="text-muted d-block">
                          <i className="bi bi-pause-circle me-1"></i>
                          (Compte désactivé)
                        </small>
                      )}
                      {userData.nom && userData.prenom && (
                        <small className="text-muted d-block">
                          {userData.nom} {userData.prenom}
                        </small>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${
                      userData.role === 'Admin' ? 'bg-danger' :
                      userData.role === 'Standard' ? 'bg-primary' :
                      'bg-info'
                    }`}>
                      {userData.role}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${
                      userData.status === 'Active' ? 'bg-success' : 'bg-secondary'
                    }`}>
                      <i className={`bi ${
                        userData.status === 'Active' ? 'bi-check-circle' : 'bi-pause-circle'
                      } me-1`}></i>
                      {userData.status || 'N/A'}
                    </span>
                  </td>
                  <td>
                    {userData.cadre ? (
                      <div>
                        <strong>{userData.cadre.grade} {userData.cadre.nom} {userData.cadre.prenom}</strong>
                        <small className="text-muted d-block">
                          <i className="bi bi-card-text me-1"></i>
                          {userData.cadre.matricule}
                        </small>
                        {userData.cadre.service && (
                          <small className="text-muted d-block">
                            <i className="bi bi-building me-1"></i>
                            {userData.cadre.service}
                          </small>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">
                        <i className="bi bi-dash"></i>
                        Aucun cadre associé
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="btn-group" role="group">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => handleShowEditModal(userData)}
                        disabled={userData.status === 'Inactive'}
                        title="Modifier l'utilisateur"
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>

                      {userData.status === 'Active' ? (
                        <Button
                          variant="outline-warning"
                          size="sm"
                          onClick={() => handleDeactivateUser(userData.id, userData)}
                          disabled={user && user.id === userData.id}
                          title="Désactiver l'utilisateur"
                        >
                          <i className="bi bi-pause-circle"></i>
                        </Button>
                      ) : (
                        <Button
                          variant="outline-success"
                          size="sm"
                          onClick={() => handleReactivateUser(userData.id, userData)}
                          title="Réactiver l'utilisateur"
                        >
                          <i className="bi bi-play-circle"></i>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ✅ Message si aucun utilisateur - ADAPTÉ AUX FILTRES */}
      {!loading && !error && filteredUsers.length === 0 && users.length === 0 && (
        <Alert variant="info">
          <i className="bi bi-info-circle me-2"></i>
          <strong>Aucun utilisateur trouvé.</strong>
          <p className="mb-0 mt-2">
            Cliquez sur "Créer un nouveau compte" pour ajouter le premier utilisateur.
          </p>
        </Alert>
      )}

      {/* 🆕 Message spécial quand tous les comptes visibles sont cachés par le filtre */}
      {!loading && !error && filteredUsers.length === 0 && users.length > 0 && (
        <Alert variant="warning">
          <i className="bi bi-filter me-2"></i>
          <strong>Aucun compte visible avec les filtres actuels.</strong>
          <p className="mb-2 mt-2">
            Tous les comptes ({users.length}) sont actuellement cachés par les filtres.
          </p>
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setShowInactiveUsers(true)}
          >
            <i className="bi bi-eye me-1"></i>
            Afficher tous les comptes
          </Button>
        </Alert>
      )}

      {/* ✅ Modaux */}
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