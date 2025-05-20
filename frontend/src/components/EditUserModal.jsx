// src/components/EditUserModal.jsx
import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

function EditUserModal({ show, handleClose, user, onUserUpdated }) {
  const [formData, setFormData] = useState({
    username: '',
    role: '',
    status: '',
  });
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordChecked, setChangePasswordChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (user && show) {
      setFormData({
        username: user.username || '',
        role: user.role || '',
        status: user.status || '',
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setChangePasswordChecked(false);
      setError(null);
      setPasswordError('');
    } else if (!show) {
      setFormData({ username: '', role: '', status: '' });
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setChangePasswordChecked(false);
      setError(null);
      setPasswordError('');
      setLoading(false);
    }
  }, [user, show]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    if (name === 'oldPassword') {
      setOldPassword(value);
    } else if (name === 'newPassword') {
      setNewPassword(value);
    } else if (name === 'confirmNewPassword') {
      setConfirmNewPassword(value);
    }
    setPasswordError('');
  };

  const handleCheckboxChange = (e) => {
    setChangePasswordChecked(e.target.checked);
    if (!e.target.checked) {
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setPasswordError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("Aucun token d'authentification trouvé.");
        setLoading(false);
        return;
      }

      if (!user || !user.id) {
        setError("Aucun utilisateur sélectionné pour la modification.");
        setLoading(false);
        return;
      }

      const payload = { ...formData };

      if (changePasswordChecked) {
        if (!oldPassword || !newPassword || !confirmNewPassword) {
          setPasswordError("Veuillez remplir tous les champs de mot de passe si vous souhaitez le modifier.");
          setLoading(false);
          return;
        }
        if (newPassword !== confirmNewPassword) {
          setPasswordError("Les nouveaux mots de passe ne correspondent pas.");
          setLoading(false);
          return;
        }

        payload.oldPassword = oldPassword;
        payload.newPassword = newPassword;
      }

      const response = await axios.put(`${API_BASE_URL}/users/${user.id}`, payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      setLoading(false);
      onUserUpdated();
      handleClose();

      Swal.fire({
        title: 'Succès !',
        text: `L'utilisateur ${formData.username} a été mis à jour${changePasswordChecked ? ' (y compris le mot de passe)' : ''}.`,
        icon: 'success',
        timer: 3000,
        timerProgressBar: true,
      });

    } catch (err) {
      console.error("Erreur lors de la mise à jour de l'utilisateur :", err);
      setLoading(false);

      let errorMessage = "Erreur lors de la mise à jour de l'utilisateur.";
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          errorMessage = "Vous n'êtes pas autorisé à modifier cet utilisateur.";
        } else if (err.response.status === 404) {
          errorMessage = "Utilisateur non trouvé.";
        } else if (err.response.status === 400 && err.response.data && err.response.data.message === 'Incorrect old password') {
          errorMessage = "L'ancien mot de passe est incorrect.";
          setPasswordError(errorMessage);
          return;
        }
        else if (err.response.data && err.response.data.message) {
          errorMessage = "Erreur API : " + err.response.data.message;
        } else {
          errorMessage = `Erreur serveur : ${err.response.status} ${err.response.statusText}`;
        }
      } else if (err.request) {
        errorMessage = "Erreur réseau lors de la mise à jour.";
      } else {
        errorMessage = "Erreur inattendue lors de la mise à jour.";
      }

      if (!passwordError) {
        Swal.fire({
          title: 'Erreur !',
          text: errorMessage,
          icon: 'error',
        });
      }
    }
  };

  if (!show || !user) {
    return null;
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Modifier l'utilisateur {user.username}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="formUsername">
            <Form.Label>Nom d'utilisateur</Form.Label>
            <Form.Control
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="formRole">
            <Form.Label>Rôle</Form.Label>
            <Form.Control
              as="select"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </Form.Control>
          </Form.Group>

          <Form.Group className="mb-3" controlId="formStatus">
            <Form.Label>Statut</Form.Label>
            <Form.Control
              type="text"
              name="status"
              value={formData.status}
              onChange={handleChange}
            />
          </Form.Group>

          <hr/>

          <Form.Group className="mb-3" controlId="formChangePasswordCheck">
            <Form.Check
              type="checkbox"
              label="Modifier le mot de passe"
              checked={changePasswordChecked}
              onChange={handleCheckboxChange}
            />
          </Form.Group>

          {changePasswordChecked && (
            <>
              <Form.Group className="mb-3" controlId="formOldPassword">
                <Form.Label>Ancien mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  name="oldPassword"
                  value={oldPassword}
                  onChange={handlePasswordChange}
                  required={changePasswordChecked}
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="formNewPassword">
                <Form.Label>Nouveau mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  name="newPassword"
                  value={newPassword}
                  onChange={handlePasswordChange}
                  required={changePasswordChecked}
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="formConfirmNewPassword">
                <Form.Label>Confirmer nouveau mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  name="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={handlePasswordChange}
                  required={changePasswordChecked}
                />
                {passwordError && <Form.Text className="text-danger">{passwordError}</Form.Text>}
              </Form.Group>
            </>
          )}

          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />
                {' '}Chargement...
              </>
            ) : 'Enregistrer les modifications'}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

export default EditUserModal;