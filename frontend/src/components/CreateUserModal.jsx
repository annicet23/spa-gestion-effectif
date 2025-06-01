import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function CreateUserModal({ show, handleClose, onUserCreated }) {
  // States existants
  const [currentStep, setCurrentStep] = useState(1);
  const [role, setRole] = useState('');
  const [matriculeInput, setMatriculeInput] = useState('');
  const [selectedCadreDetails, setSelectedCadreDetails] = useState(null);
  const [cadreIdToLink, setCadreIdToLink] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSearchingCadre, setIsSearchingCadre] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [submitMessage, setSubmitMessage] = useState('');
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nouveaux states pour les escadrons
  const [needsEscadronSpec, setNeedsEscadronSpec] = useState(false);
  const [escadronSpecification, setEscadronSpecification] = useState('');
  const [availableSpecifications] = useState(['1er escadron', '2ème escadron', '3ème escadron', '4ème escadron','5ème escadron','4ème escadron','5ème escadron','6ème escadron','7ème escadron','8ème escadron','10ème escadron']);

  // Réinitialisation lors de la fermeture du modal
  useEffect(() => {
    if (!show) {
      setCurrentStep(1);
      setRole('');
      setMatriculeInput('');
      setSelectedCadreDetails(null);
      setCadreIdToLink('');
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setIsSearchingCadre(false);
      setSearchError(null);
      setSubmitMessage('');
      setIsSubmitSuccess(false);
      setIsSubmitting(false);
      setNeedsEscadronSpec(false);
      setEscadronSpecification('');
    }
  }, [show]);

  // Gestion de la navigation entre les étapes
  const handleNext = async () => {
    setSubmitMessage('');
    setSearchError(null);

    if (currentStep === 1) { // Étape 1 : Sélection du rôle
      if (!role) {
        Swal.fire('Attention', 'Veuillez sélectionner un rôle.', 'warning');
        return;
      }
      setCurrentStep(currentStep + 1);

    } else if (currentStep === 2) { // Étape 2 : Saisie Matricule
      if (!matriculeInput.trim()) {
        Swal.fire('Attention', 'Veuillez entrer le matricule du cadre.', 'warning');
        return;
      }

      setIsSearchingCadre(true);
      setSearchError(null);
      setSelectedCadreDetails(null);
      setCadreIdToLink('');

      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setSearchError("Erreur : Utilisateur non authentifié. Connexion requise.");
          setIsSearchingCadre(false);
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };

        const response = await axios.get(`${API_BASE_URL}api/cadres/matricule/${encodeURIComponent(matriculeInput.trim())}`, { headers });

        if (response.data && response.data.id) {
          setSelectedCadreDetails(response.data);
          setCadreIdToLink(response.data.id);

          // Vérifier si c'est un escadron
          if (response.data.entite === 'Escadron') {
            setNeedsEscadronSpec(true);
            setCurrentStep(currentStep + 1);
          } else {
            setNeedsEscadronSpec(false);
            setEscadronSpecification('');
            setCurrentStep(currentStep + 1);
          }
        } else {
          setSearchError(`Aucun cadre trouvé avec le matricule : ${matriculeInput.trim()}`);
        }

      } catch (error) {
        console.error("Erreur lors de la recherche du cadre :", error);
        let errorMessage = "Erreur lors de la recherche du cadre.";
        if (error.response) {
          if (error.response.status === 404) {
            errorMessage = `Aucun cadre trouvé avec le matricule : ${matriculeInput.trim()}`;
          } else if (error.response.status === 401 || error.response.status === 403) {
            errorMessage = "Vous n'êtes pas autorisé à effectuer cette recherche.";
          } else if (error.response.data && error.response.data.message) {
            errorMessage = "Erreur API : " + error.response.data.message;
          } else {
            errorMessage = `Erreur serveur : ${error.response.status} ${error.response.statusText}`;
          }
        } else if (error.request) {
          errorMessage = "Erreur réseau : Impossible de joindre le serveur.";
        }
        setSearchError(errorMessage);

      } finally {
        setIsSearchingCadre(false);
      }
      return;

    } else if (currentStep === 3) { // Étape 3 : Confirmation Cadre + Spécification Escadron
      if (!selectedCadreDetails || !cadreIdToLink) {
        Swal.fire('Attention', "Aucun cadre sélectionné ou validé. Veuillez revenir à l'étape précédente.", 'warning');
        return;
      }

      // Validation spécification escadron
      if (needsEscadronSpec) {
        if (!escadronSpecification) {
          Swal.fire('Attention', 'Veuillez sélectionner une spécification d\'escadron.', 'warning');
          return;
        }
      }

      setCurrentStep(currentStep + 1);

    } else if (currentStep === 4) { // Étape 4 : Nom d'utilisateur
      if (!username.trim()) {
        Swal.fire('Attention', "Veuillez entrer un nom d'utilisateur.", 'warning');
        return;
      }
      if (username.length < 3) {
        Swal.fire('Attention', "Le nom d'utilisateur doit contenir au moins 3 caractères.", 'warning');
        return;
      }
      setCurrentStep(currentStep + 1);

    } else if (currentStep === 5) { // Étape 5 : Mot de passe
      if (!password || !confirmPassword) {
        Swal.fire('Attention', 'Veuillez entrer et confirmer le mot de passe.', 'warning');
        return;
      }
      if (password !== confirmPassword) {
        Swal.fire('Attention', 'Les mots de passe ne correspondent pas.', 'warning');
        setPassword('');
        setConfirmPassword('');
        return;
      }
      if (password.length < 6) {
        Swal.fire('Attention', "Le mot de passe doit contenir au moins 6 caractères.", 'warning');
        return;
      }
      setCurrentStep(currentStep + 1);
    }
  };

  // Gestion du retour
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep - 1 === 2) {
        setSelectedCadreDetails(null);
        setCadreIdToLink('');
        setSearchError(null);
        setIsSearchingCadre(false);
        setNeedsEscadronSpec(false);
        setEscadronSpecification('');
      }
      setSubmitMessage('');
    }
  };

  // Soumission finale
  const handleSubmit = async () => {
    setSubmitMessage('');
    setIsSubmitSuccess(false);
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setSubmitMessage("Erreur : Utilisateur non authentifié. Opération annulée.");
        setIsSubmitSuccess(false);
        setIsSubmitting(false);
        return;
      }

      // Préparer les données à envoyer au backend
      const newUser = {
        username: username,
        password: password,
        role: role,
        matricule: selectedCadreDetails.matricule,
      };

      // Ajouter la spécification escadron si nécessaire
      if (needsEscadronSpec && escadronSpecification) {
        newUser.escadron_specification = escadronSpecification;
      }

      console.log('Données envoyées pour création utilisateur:', newUser);

      // Appel API pour créer l'utilisateur
      const response = await axios.post(`${API_BASE_URL}api/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setSubmitMessage(response.data.message || 'Utilisateur créé avec succès !');
      setIsSubmitSuccess(true);
      onUserCreated();

    } catch (error) {
      console.error("Erreur lors de la création de l'utilisateur :", error);
      let errorMessage = "Erreur lors de la création de l'utilisateur.";
      if (error.response) {
        if (error.response.status === 400 && error.response.data && error.response.data.message) {
          errorMessage = "Erreur API : " + error.response.data.message;
        } else if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = "Vous n'êtes pas autorisé à créer des utilisateurs.";
        } else if (error.response.status === 409) {
          errorMessage = "Erreur API : " + (error.response.data.message || "Conflit de données.");
        } else if (error.response.data && error.response.data.message) {
          errorMessage = "Erreur API : " + error.response.data.message;
        } else {
          errorMessage = `Erreur serveur : ${error.response.status} ${error.response.statusText}`;
        }
      } else if (error.request) {
        errorMessage = "Erreur réseau : Impossible de joindre le serveur.";
      } else {
        errorMessage = "Erreur inattendue lors de la requête.";
      }
      setSubmitMessage(errorMessage);
      setIsSubmitSuccess(false);

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>Créer un Nouvel Utilisateur - Étape {currentStep}/6</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {/* Étape 1: Sélection du rôle */}
        {currentStep === 1 && (
          <div>
            <h5>Étape 1: Sélection du Rôle</h5>
            <Form.Group className="mb-3">
              <Form.Label>Rôle de l'utilisateur *</Form.Label>
              <Form.Select value={role} onChange={(e) => setRole(e.target.value)} required>
                <option value="">-- Sélectionnez un rôle --</option>
                <option value="Admin">Administrateur</option>
                <option value="Standard">Standard</option>
                <option value="Consultant">Consultant</option>
              </Form.Select>
              <Form.Text className="text-muted">
                Choisissez le niveau d'accès pour ce nouvel utilisateur.
              </Form.Text>
            </Form.Group>
          </div>
        )}

        {/* Étape 2: Saisie du matricule */}
        {currentStep === 2 && (
          <div>
            <h5>Étape 2: Matricule du Cadre</h5>
            <Form.Group className="mb-3">
              <Form.Label>Matricule du cadre à lier *</Form.Label>
              <Form.Control
                type="text"
                value={matriculeInput}
                onChange={(e) => setMatriculeInput(e.target.value)}
                placeholder="Entrez le matricule du cadre"
                required
              />
              <Form.Text className="text-muted">
                L'utilisateur sera automatiquement lié à ce cadre.
              </Form.Text>
            </Form.Group>
            {isSearchingCadre && (
              <div className="d-flex align-items-center">
                <Spinner animation="border" size="sm" className="me-2" />
                <span>Recherche du cadre en cours...</span>
              </div>
            )}
            {searchError && (
              <Alert variant="danger" className="mt-3">
                {searchError}
              </Alert>
            )}
          </div>
        )}

        {/* Étape 3: Confirmation du cadre + Spécification Escadron */}
        {currentStep === 3 && (
          <div>
            <h5>Étape 3: Confirmation du Cadre</h5>
            {selectedCadreDetails && (
              <div>
                <Alert variant="success">
                  <strong>Cadre trouvé :</strong><br />
                  <strong>Nom :</strong> {selectedCadreDetails.nom} {selectedCadreDetails.prenom}<br />
                  <strong>Grade :</strong> {selectedCadreDetails.grade}<br />
                  <strong>Matricule :</strong> {selectedCadreDetails.matricule}<br />
                  <strong>Entité :</strong> {selectedCadreDetails.entite}<br />
                  {selectedCadreDetails.service && <><strong>Service :</strong> {selectedCadreDetails.service}<br /></>}
                  {selectedCadreDetails.EscadronResponsable && (
                    <><strong>Escadron :</strong> {selectedCadreDetails.EscadronResponsable.nom}<br /></>
                  )}
                </Alert>

                {/* Section Spécification Escadron */}
                {needsEscadronSpec && (
                  <div className="mt-3">
                    <Alert variant="info">
                      <strong>Spécification Escadron Requise</strong><br />
                      Ce cadre appartient à un escadron. Veuillez spécifier quelle partie de l'escadron cet utilisateur supervisera :
                    </Alert>
                    <Form.Group>
                      <Form.Label>Spécification d'Escadron *</Form.Label>
                      <Form.Select
                        value={escadronSpecification}
                        onChange={(e) => setEscadronSpecification(e.target.value)}
                        required
                      >
                        <option value="">-- Sélectionnez une spécification --</option>
                        {availableSpecifications.map((spec, index) => (
                          <option key={index} value={spec}>{spec}</option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Précisez quelle partie de l'escadron supervise cet utilisateur (ex: 1er escadron, 2ème escadron...).
                      </Form.Text>
                    </Form.Group>
                  </div>
                )}

                <p className="mt-3 text-muted">
                  Confirmer la liaison de cet utilisateur avec ce cadre ?
                </p>
              </div>
            )}
          </div>
        )}

        {/* Étape 4: Nom d'utilisateur */}
        {currentStep === 4 && (
          <div>
            <h5>Étape 4: Nom d'Utilisateur</h5>
            <Form.Group className="mb-3">
              <Form.Label>Nom d'utilisateur *</Form.Label>
              <Form.Control
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Entrez le nom d'utilisateur"
                required
              />
              <Form.Text className="text-muted">
                Au moins 3 caractères. Ce nom sera utilisé pour la connexion.
              </Form.Text>
            </Form.Group>
            {selectedCadreDetails && (
              <Alert variant="info">
                <strong>Suggestion :</strong> Vous pourriez utiliser quelque chose comme "{selectedCadreDetails.prenom?.toLowerCase()}.{selectedCadreDetails.nom?.toLowerCase()}" ou "{selectedCadreDetails.matricule}"
              </Alert>
            )}
          </div>
        )}

        {/* Étape 5: Mot de passe */}
        {currentStep === 5 && (
          <div>
            <h5>Étape 5: Mot de Passe</h5>
            <Form.Group className="mb-3">
              <Form.Label>Mot de passe *</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Entrez le mot de passe"
                required
              />
              <Form.Text className="text-muted">
                Au moins 6 caractères.
              </Form.Text>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Confirmer le mot de passe *</Form.Label>
              <Form.Control
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmez le mot de passe"
                required
              />
            </Form.Group>
          </div>
        )}

        {/* Étape 6: Récapitulatif et soumission */}
        {currentStep === 6 && (
          <div>
            <h5>Étape 6: Récapitulatif</h5>
            <Alert variant="light">
              <strong>Récapitulatif de l'utilisateur à créer :</strong><br />
              <strong>Rôle :</strong> {role}<br />
              <strong>Nom d'utilisateur :</strong> {username}<br />
              <strong>Cadre associé :</strong> {selectedCadreDetails?.grade} {selectedCadreDetails?.nom} {selectedCadreDetails?.prenom}<br />
              <strong>Matricule :</strong> {selectedCadreDetails?.matricule}<br />
              <strong>Entité :</strong> {selectedCadreDetails?.entite}<br />
              {selectedCadreDetails?.service && <><strong>Service :</strong> {selectedCadreDetails.service}<br /></>}
              {selectedCadreDetails?.EscadronResponsable && (
                <><strong>Escadron :</strong> {selectedCadreDetails.EscadronResponsable.nom}<br /></>
              )}
              {needsEscadronSpec && escadronSpecification && (
                <><strong>Spécification :</strong> {escadronSpecification}<br /></>
              )}
            </Alert>

            {submitMessage && (
              <Alert variant={isSubmitSuccess ? "success" : "danger"} className="mt-3">
                {submitMessage}
              </Alert>
            )}

            {!isSubmitSuccess && (
              <p className="text-muted">
                Vérifiez les informations ci-dessus et cliquez sur "Créer l'utilisateur" pour finaliser.
              </p>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div>
            {currentStep > 1 && !isSubmitSuccess && (
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
                Précédent
              </Button>
            )}
          </div>
          <div>
            {currentStep < 6 ? (
              <Button variant="primary" onClick={handleNext} disabled={isSearchingCadre}>
                {isSearchingCadre ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Recherche...
                  </>
                ) : (
                  'Suivant'
                )}
              </Button>
            ) : (
              <div>
                {!isSubmitSuccess ? (
                  <Button variant="success" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Création...
                      </>
                    ) : (
                      'Créer l\'utilisateur'
                    )}
                  </Button>
                ) : (
                  <Button variant="primary" onClick={handleClose}>
                    Fermer
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
}

export default CreateUserModal;