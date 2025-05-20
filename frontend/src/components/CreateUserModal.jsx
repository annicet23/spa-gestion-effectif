import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import axios from 'axios';
import Swal from 'sweetalert2';

// Assurez-vous que cette URL est correcte pour votre backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

/**
 * Modal pour la création de nouveaux utilisateurs (Admin ou Standard).
 * Gère un formulaire multi-étapes pour collecter les informations nécessaires.
 * Pour les utilisateurs Standard, permet de rechercher et lier un cadre existant par matricule.
 * Accessible uniquement aux utilisateurs autorisés (géré par le composant parent ou les routes backend).
 *
 * @param {object} props - Les propriétés du composant.
 * @param {boolean} props.show - Contrôle l'affichage du modal.
 * @param {function} props.handleClose - Fonction appelée pour fermer le modal.
 * @param {function} props.onUserCreated - Fonction appelée après la création réussie d'un utilisateur.
 */
function CreateUserModal({ show, handleClose, onUserCreated }) {
  // State pour gérer l'étape actuelle du formulaire. Commence à l'étape 1.
  const [currentStep, setCurrentStep] = useState(1);

  // State pour stocker les données du formulaire
  const [role, setRole] = useState(''); // Rôle de l'utilisateur ('Admin' ou 'Standard')

  // Champs spécifiques pour le lien avec un cadre (pour rôle Standard)
  const [matriculeInput, setMatriculeInput] = useState(''); // Input pour le matricule
  const [selectedCadreDetails, setSelectedCadreDetails] = useState(null); // Détails du cadre trouvé après recherche
  const [cadreIdToLink, setCadreIdToLink] = useState(''); // L'ID du cadre à envoyer au backend

  // Champs communs à tous les rôles
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // State pour gérer l'état de la recherche de cadre
  const [isSearchingCadre, setIsSearchingCadre] = useState(false); // Indique si une recherche est en cours
  const [searchError, setSearchError] = useState(null); // Stocke l'erreur de recherche si elle survient

  // State pour gérer l'état de la soumission finale du formulaire
  const [submitMessage, setSubmitMessage] = useState(''); // Message affiché après soumission (succès ou erreur)
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false); // Indique si la soumission a réussi
  const [isSubmitting, setIsSubmitting] = useState(false); // Indique si la soumission est en cours

  // Effet pour réinitialiser l'état du modal lorsque celui-ci est fermé
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
    }
  }, [show]); // Dépendance au prop 'show'

  // Gère le passage à l'étape suivante du formulaire
  // Cette fonction est asynchrone car l'étape 2 implique un appel API pour la recherche de cadre.
  const handleNext = async () => {
    // Réinitialiser les messages de soumission et les erreurs de recherche à chaque changement d'étape
    setSubmitMessage('');
    setSearchError(null);

    // Logique de validation et de navigation basée sur l'étape actuelle
    if (currentStep === 1) { // Étape 1 : Sélection du rôle
      if (!role) {
        Swal.fire('Attention', 'Veuillez sélectionner un rôle.', 'warning');
        return;
      }
      // Si le rôle est Admin, sauter les étapes spécifiques aux Standard (Matricule, Confirmation Cadre)
      if (role === 'Admin') {
          setCurrentStep(4); // Sauter de l'étape 1 à l'étape 4 (Nom d'utilisateur)
      } else {
          setCurrentStep(currentStep + 1); // Passer à l'étape 2 (Saisie Matricule) pour un utilisateur Standard
      }

    } else if (currentStep === 2) { // Étape 2 : Saisie Matricule (Standard uniquement)
       if (!matriculeInput.trim()) {
            Swal.fire('Attention', 'Veuillez entrer le matricule du cadre.', 'warning');
            return;
       }

        // Lancer la recherche du cadre par matricule avant de passer à l'étape 3
        setIsSearchingCadre(true); // Activer l'indicateur de chargement
        setSearchError(null); // Réinitialiser l'erreur de recherche précédente
        setSelectedCadreDetails(null); // Réinitialiser les détails du cadre précédent
        setCadreIdToLink(''); // Réinitialiser l'ID du cadre précédent

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                 setSearchError("Erreur : Utilisateur non authentifié. Connexion requise.");
                 setIsSearchingCadre(false);
                 return;
            }
             const headers = { Authorization: `Bearer ${token}` };

            // Appel API pour rechercher le cadre par matricule
            // Utilise l'endpoint GET /api/cadres/matricule/:mat
            const response = await axios.get(`${API_BASE_URL}/cadres/matricule/${encodeURIComponent(matriculeInput.trim())}`, { headers });

            // Le backend renvoie les détails du cadre s'il est trouvé (status 200)
            if (response.data && response.data.id) {
                 setSelectedCadreDetails(response.data); // Stocker les détails complets
                 setCadreIdToLink(response.data.id); // Stocker l'ID pour la soumission finale
                 setCurrentStep(currentStep + 1); // Passer à l'étape 3 (Confirmation Cadre)
            } else {
                // Si l'endpoint renvoie 200 mais sans données (cas peu probable si bien implémenté)
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
            setSearchError(errorMessage); // Afficher l'erreur de recherche

        } finally {
             setIsSearchingCadre(false); // Désactiver l'indicateur de chargement
        }

        // Ne pas passer a l'étape suivante ici; la recherche réussie le fera.
        // Si la recherche échoue, on reste sur l'étape 2 avec le message d'erreur.
        return;


    } else if (currentStep === 3) { // Étape 3 : Confirmation Cadre (Standard uniquement)
       // Validation : S'assurer qu'un cadre a bien été trouvé et sélectionné
       if (!selectedCadreDetails || !cadreIdToLink) {
            Swal.fire('Attention', "Aucun cadre sélectionné ou validé. Veuillez revenir à l'étape précédente.", 'warning');
            // On pourrait revenir à l'étape 2 ici si nécessaire: setCurrentStep(2);
            return;
       }
      setCurrentStep(currentStep + 1); // Passer à l'étape 4 (Nom d'utilisateur)

    } else if (currentStep === 4) { // Étape 4 : Nom d'utilisateur (Étape 4 pour Standard, 2 pour Admin)
        if (!username.trim()) {
             Swal.fire('Attention', "Veuillez entrer un nom d'utilisateur.", 'warning');
             return;
        }
         // Validation basique du nom d'utilisateur (longueur min)
         if (username.length < 3) {
              Swal.fire('Attention', "Le nom d'utilisateur doit contenir au moins 3 caractères.", 'warning');
              return;
         }
        setCurrentStep(currentStep + 1); // Passer à l'étape 5 (Mot de passe)

    } else if (currentStep === 5) { // Étape 5 : Mot de passe et confirmation (Étape 5 pour Standard, 3 pour Admin)
        if (!password || !confirmPassword) {
            Swal.fire('Attention', 'Veuillez entrer et confirmer le mot de passe.', 'warning');
            return;
        }
        if (password !== confirmPassword) {
            Swal.fire('Attention', 'Les mots de passe ne correspondent pas.', 'warning');
            setPassword(''); // Effacer les champs pour resaisie
            setConfirmPassword('');
            return;
        }
         // Validation basique du mot de passe (longueur min)
         if (password.length < 6) {
              Swal.fire('Attention', "Le mot de passe doit contenir au moins 6 caractères.", 'warning');
              return;
         }
        setCurrentStep(currentStep + 1); // Passer à l'étape 6 (finale : Confirmation et Soumission)
    }
     // Aucune validation n'est nécessaire pour l'étape finale (Étape 6) avant la soumission
  };

  // Gère le retour à l'étape précédente
  const handleBack = () => {
    if (currentStep > 1) {
       // Logique de retour ajustée pour le flux Standard (6 étapes) et Admin (4 étapes)
       if (role === 'Admin') {
            if (currentStep === 4) setCurrentStep(1); // Retour de Nom d'utilisateur (4) à Rôle (1)
            else if (currentStep === 5) setCurrentStep(4); // Retour de Mot de passe (5) à Nom d'utilisateur (4)
            else if (currentStep === 6) setCurrentStep(5); // Retour de Soumission (6) à Mot de passe (5)
             // Les étapes 2 et 3 sont sautées pour Admin, donc pas de retour vers elles depuis 4, 5, 6
       } else { // Utilisateur Standard
             setCurrentStep(currentStep - 1); // Retour simple à l'étape précédente
             // Si on revient à l'étape 2 (Saisie Matricule), réinitialiser les infos du cadre trouvé
             if (currentStep - 1 === 2) {
                 setSelectedCadreDetails(null);
                 setCadreIdToLink('');
                 setSearchError(null); // Effacer l'erreur de recherche
                 setIsSearchingCadre(false); // Arrêter l'indicateur de chargement
             }
       }
        setSubmitMessage(''); // Effacer le message de soumission en cas de retour
    }
  };

  // Gère la soumission finale du formulaire (appelée à la dernière étape)
  const handleSubmit = async () => {
    setSubmitMessage(''); // Réinitialiser les messages de soumission
    setIsSubmitSuccess(false);
    setIsSubmitting(true); // Activer l'état de soumission

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
        password: password, // Le backend doit hacher ce mot de passe
        role: role,
        // Inclure cadre_id UNIQUEMENT si le rôle est Standard
        // Utilise la syntaxe spread pour inclure conditionnellement
        ...(role === 'Standard' && { cadre_id: cadreIdToLink }) // <-- CORRECTION : Utilise "cadre_id"
        // Ajouter d'autres champs par défaut si nécessaire, ex: status: 'Active',
         // Note: Les champs nom, prenom, grade, etc. pour un Standard sont censés être
         // dérivés du cadre_id côté backend, ou gérés par le modèle User si vous y avez mis ces champs.
         // Si le modèle User a nom, prenom, etc., vous devriez les collecter dans le formulaire
         // ou les récupérer du 'selectedCadreDetails' et les ajouter ici pour les Standards.
         // Basé sur votre modèle User, il a nom, prenom, grade, service.
         // Pour un Standard, ces champs devraient idealement etre derives du cadre_id
         // soit a la creation, soit a la lecture. Si vous voulez les envoyer ici,
         // il faut les ajouter a l'objet newUser pour le role Standard:
         // ...(role === 'Standard' && selectedCadreDetails && {
         //     nom: selectedCadreDetails.nom,
         //     prenom: selectedCadreDetails.prenom,
         //     grade: selectedCadreDetails.grade, // Si le modele User a un champ grade
         //     service: selectedCadreDetails.service // Si le modele User a un champ service
         // })
      };

      console.log('Données envoyées pour création utilisateur:', newUser);

      // Appel API pour créer l'utilisateur
      const response = await axios.post(`${API_BASE_URL}/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Gérer la réponse succès
      setSubmitMessage(response.data.message || 'Utilisateur créé avec succès !');
      setIsSubmitSuccess(true);
      onUserCreated(); // Appeler le callback pour rafraîchir la liste dans le composant parent
      // Le modal ne se ferme pas automatiquement pour laisser l'utilisateur voir le message de succès.
      // Un bouton "Fermer" apparaîtra.

    } catch (error) {
      console.error("Erreur lors de la création de l'utilisateur :", error);
       let errorMessage = "Erreur lors de la création de l'utilisateur.";
       if (error.response) {
            // Gérer les erreurs spécifiques du backend (basé sur les messages d'erreur de votre backend)
            if (error.response.status === 400 && error.response.data && error.response.data.message) {
                 // Erreur 400 (Bad Request) du backend avec un message spécifique
                 errorMessage = "Erreur API : " + error.response.data.message;
            } else if (error.response.status === 401 || error.response.status === 403) {
                 errorMessage = "Vous n'êtes pas autorisé à créer des utilisateurs.";
            } else if (error.response.status === 409) { // Conflit (ex: nom d'utilisateur déjà utilisé)
                 errorMessage = "Erreur API : " + (error.response.data.message || "Conflit de données (ex: nom d'utilisateur déjà utilisé).");
             }
            else if (error.response.data && error.response.data.message) {
                 errorMessage = "Erreur API : " + error.response.data.message;
            } else {
                 errorMessage = `Erreur serveur : ${error.response.status} ${error.response.statusText}`;
            }
       } else if (error.request) {
            errorMessage = "Erreur réseau : Impossible de joindre le serveur.";
       } else {
           errorMessage = "Erreur inattendue lors de la requête.";
       }
      setSubmitMessage(errorMessage); // Afficher le message d'erreur
      setIsSubmitSuccess(false); // S'assurer que le succès est faux
    } finally {
      setIsSubmitting(false); // Désactiver l'état de soumission
    }
  };

    // Déterminer le nombre total d'étapes en fonction du rôle
    const totalSteps = role === 'Admin' ? 4 : 6; // 4 étapes pour Admin, 6 étapes pour Standard

    // Déterminer le numéro d'étape affiché (ajusté pour le saut des Admins)
    const getDisplayedStep = () => {
        if (role !== 'Admin') return currentStep; // Standard: étapes 1 à 6
        // Admin: Mapper les étapes internes (1, 4, 5, 6) aux étapes affichées (1, 2, 3, 4)
        if (currentStep === 1) return 1; // Rôle -> 1
        if (currentStep === 4) return 2; // Nom d'utilisateur -> 2
        if (currentStep === 5) return 3; // Mot de passe -> 3
        if (currentStep === 6) return 4; // Soumission -> 4
        return currentStep; // Ne devrait pas arriver dans le flux Admin
    };
    const displayedStep = getDisplayedStep();


  // Rendu conditionnel du contenu du modal en fonction de l'étape actuelle
  const renderStep = () => {
    switch (currentStep) {
      case 1: // Étape 1 : Sélection du rôle
        return (
          <>
            <Modal.Header closeButton>
                <Modal.Title>Étape {displayedStep}/{totalSteps} : Sélection du rôle</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group>
                <Form.Label>Quel rôle aura ce compte ?</Form.Label>
                <div>
                  <Form.Check
                    type="radio"
                    label="Administrateur"
                    name="roleOptions"
                    id="roleAdmin"
                    value="Admin"
                    checked={role === 'Admin'}
                    onChange={(e) => setRole(e.target.value)}
                    className="mb-2"
                  />
                  <Form.Check
                    type="radio"
                    label="Standard"
                    name="roleOptions"
                    id="roleStandard"
                    value="Standard"
                    checked={role === 'Standard'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleClose} disabled={isSubmitting || isSearchingCadre}>Annuler</Button>
              <Button variant="primary" onClick={handleNext} disabled={!role || isSubmitting || isSearchingCadre}>Suivant</Button>
            </Modal.Footer>
          </>
        );
      case 2: // Étape 2 : Saisie Matricule (Standard UNIQUEMENT)
        return (
          <>
            <Modal.Header closeButton>
                 <Modal.Title>Étape {displayedStep}/{totalSteps} : Saisie du Matricule du Cadre</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Entrez le matricule du cadre à lier</Form.Label>
                <Form.Control
                  type="text"
                  value={matriculeInput}
                  onChange={(e) => setMatriculeInput(e.target.value)}
                  required
                  disabled={isSubmitting || isSearchingCadre}
                />
              </Form.Group>

                {isSearchingCadre && <Spinner animation="border" size="sm" className="me-2" />}
                {searchError && <Alert variant="danger">{searchError}</Alert>}

            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting || isSearchingCadre}>Retour</Button>
              {/* Le bouton "Suivant" déclenche la recherche et passe à l'étape 3 si succès */}
              <Button
                variant="primary"
                onClick={handleNext} // handleNext contient maintenant la logique de recherche pour cette étape
                disabled={!matriculeInput.trim() || isSubmitting || isSearchingCadre}
              >
                 {isSearchingCadre ? 'Recherche...' : 'Rechercher et Suivant'}
              </Button>
            </Modal.Footer>
          </>
        );
      case 3: // Étape 3 : Confirmation Cadre (Standard UNIQUEMENT)
        return (
          <>
            <Modal.Header closeButton>
                 <Modal.Title>Étape {displayedStep}/{totalSteps} : Confirmer le Cadre</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {!selectedCadreDetails ? (
                    <Alert variant="warning">Aucun cadre trouvé pour le matricule saisi. Veuillez revenir à l'étape précédente.</Alert>
                 ) : (
                    <>
                        <p>Veuillez confirmer les informations du cadre trouvé :</p>
                        <ul>
                            <li>**Matricule :** {selectedCadreDetails.matricule}</li>
                            <li>**Nom :** {selectedCadreDetails.nom}</li>
                            <li>**Prénom :** {selectedCadreDetails.prenom}</li>
                            {/* Afficher d'autres champs pertinents du cadre pour confirmation */}
                            <li>**Service :** {selectedCadreDetails.service || 'Non spécifié'}</li>
                            <li>**Fonction :** {selectedCadreDetails.fonction || 'Non spécifié'}</li>
                            {/* Vous pourriez ajouter ici entite ou cours si pertinent */}
                        </ul>
                        <Alert variant="info">Ce compte utilisateur sera lié à ce cadre (ID: {cadreIdToLink}).</Alert>
                    </>
                 )}

            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting || isSearchingCadre}>Retour</Button>
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!selectedCadreDetails || isSubmitting || isSearchingCadre} // Désactivé si pas de cadre trouvé/confirmé
              >
                Suivant
              </Button>
            </Modal.Footer>
          </>
        );
      case 4: // Étape 4 : Nom d'utilisateur (Étape 4 pour Standard, 2 pour Admin)
        return (
          <>
             <Modal.Header closeButton>
                <Modal.Title>Étape {displayedStep}/{totalSteps} : Nom d'utilisateur</Modal.Title>
             </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Nom d'utilisateur</Form.Label>
                <Form.Control
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={isSubmitting || isSearchingCadre}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting || isSearchingCadre}>Retour</Button>
              <Button variant="primary" onClick={handleNext} disabled={!username.trim() || isSubmitting || isSearchingCadre}>Suivant</Button>
            </Modal.Footer>
          </>
        );
       case 5: // Étape 5 : Mot de passe et confirmation (Étape 5 pour Standard, 3 pour Admin)
        return (
          <>
            <Modal.Header closeButton>
                 <Modal.Title>Étape {displayedStep}/{totalSteps} : Mot de passe</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label>Mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting || isSearchingCadre}
                />
              </Form.Group>
               <Form.Group className="mb-3">
                <Form.Label>Confirmer le mot de passe</Form.Label>
                <Form.Control
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting || isSearchingCadre}
                />
              </Form.Group>
               {password && confirmPassword && password !== confirmPassword && (
                   <Alert variant="warning">Les mots de passe ne correspondent pas.</Alert>
               )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting || isSearchingCadre}>Retour</Button>
              <Button variant="primary" onClick={handleNext} disabled={!password || !confirmPassword || password !== confirmPassword || isSubmitting || isSearchingCadre}>Suivant</Button>
            </Modal.Footer>
          </>
        );
       case 6: // Étape 6 : Confirmation et Soumission (Étape 6 pour Standard, 4 pour Admin)
        return (
          <>
            <Modal.Header closeButton>
                <Modal.Title>Étape {displayedStep}/{totalSteps} : Confirmation et Création</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {!submitMessage && !isSubmitting && ( // Afficher le récapitulatif si aucune soumission n'est en cours et pas de message affiché
                 <>
                    <p>Veuillez vérifier les informations avant de créer le compte :</p>
                    <ul>
                      <li>**Rôle :** {role}</li>
                      {/* Afficher Cadre sélectionné uniquement pour les comptes Standard */}
                      {role === 'Standard' && selectedCadreDetails && (
                          <>
                             <li>**Cadre Associé :** {selectedCadreDetails.nom || 'Inconnu'} {selectedCadreDetails.prenom || ''} (Matricule: {selectedCadreDetails.matricule})</li>
                               <li>**Service du Cadre :** {selectedCadreDetails.service || 'Non spécifié'}</li>
                               {/* Afficher d'autres details du cadre si pertinents */}
                          </>
                      )}
                          {/* Message d'avertissement si le cadre n'a pas été correctement sélectionné pour un Standard */}
                          {role === 'Standard' && !selectedCadreDetails && (
                              <Alert variant="warning">Attention : Aucun cadre n'a été correctement associé à ce compte.</Alert>
                          )}
                       <li>**Nom d'utilisateur :** {username}</li>
                       <li>**Mot de passe :** *********</li> {/* Ne jamais afficher le mot de passe ici */}
                    </ul>
                 </>
              )}

                {/* Afficher le message de soumission (succès ou erreur) */}
                {submitMessage && (
                     <Alert variant={isSubmitSuccess ? 'success' : 'danger'}>{submitMessage}</Alert>
                )}
                 {/* Afficher le spinner pendant la soumission */}
                {isSubmitting && (
                    <div className="text-center">
                         <Spinner animation="border" role="status">
                            <span className="visually-hidden">Création en cours...</span>
                         </Spinner>
                         <p>Création du compte en cours...</p>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
              {/* Le bouton "Retour" est désactivé pendant la soumission et après succès */}
              {!isSubmitSuccess && !isSubmitting && (
                 <Button variant="secondary" onClick={handleBack} disabled={isSubmitting || isSearchingCadre}>Retour</Button>
              )}

              {/* Bouton de création final */}
              {!isSubmitSuccess && !isSubmitting && (
                <Button
                   variant="success"
                   onClick={handleSubmit}
                   // Désactivé pendant la soumission, recherche, ou si le cadre n'est pas confirmé pour un Standard
                   disabled={isSubmitting || isSearchingCadre || (role === 'Standard' && !selectedCadreDetails)}
                >
                   Créer le compte
                </Button>
              )}

               {/* Ajouter un bouton "Fermer" après un succès de soumission */}
              {isSubmitSuccess && !isSubmitting && (
                   <Button variant="secondary" onClick={handleClose}>Fermer</Button>
              )}
              {/* Ajouter un bouton "Fermer" en cas d'erreur de soumission pour permettre de réessayer */}
              {!isSubmitSuccess && submitMessage && !isSubmitting && (
                  <Button variant="secondary" onClick={handleClose}>Fermer</Button>
              )}

            </Modal.Footer>
          </>
        );
      default:
        return null; // Ne devrait normalement pas arriver
    }
  };

  // Le composant Modal enveloppe les étapes
  return (
    // backdrop="static" et keyboard={false} empêchent la fermeture en cliquant à l'extérieur ou avec Echap pendant le processus
    <Modal show={show} onHide={handleClose} backdrop="static" keyboard={false}>
       {/* Le contenu (Header, Body, Footer) est géré par la fonction renderStep */}
       {renderStep()}
    </Modal>
  );
}

export default CreateUserModal;
