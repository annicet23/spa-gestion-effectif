// src/pages/LoginPage.jsx
import React, { useState } from 'react';
// Importer le hook useAuth pour accéder au contexte
import { useAuth } from '../context/AuthContext';
// Importer le hook useNavigate pour la redirection
import { useNavigate } from 'react-router-dom';


function LoginPage() {
  // Utiliser le hook useAuth pour accéder à la fonction login du contexte
  const { login } = useAuth();
  // Utiliser le hook useNavigate pour la redirection après connexion
  const navigate = useNavigate();

  // États locaux pour stocker le nom d'utilisateur et le mot de passe
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false); // Pour le checkbox "Se souvenir de moi"
  const [error, setError] = useState(''); // Pour afficher les messages d'erreur
  const [loading, setLoading] = useState(false); // Pour indiquer si la connexion est en cours

  // Gère les changements dans le champ nom d'utilisateur
  const handleUsernameChange = (event) => {
    setUsername(event.target.value);
  };

  // Gère les changements dans le champ mot de passe
  const handlePasswordChange = (event) => {
    setPassword(event.target.value);
  };

  // Gère le changement du checkbox "Se souvenir de moi"
  const handleRememberMeChange = (event) => {
    setRememberMe(event.target.checked);
  };

  // Gère la soumission du formulaire
  const handleSubmit = async (event) => {
    event.preventDefault(); // Empêche le rechargement de la page par défaut

    setError(''); // Réinitialiser les erreurs précédentes
    setLoading(true); // Activer l'indicateur de chargement

    try {
      // Effectuer l'appel API vers votre backend
      const response = await fetch('http://localhost:3000/api/auth/login', { // Adaptez l'URL si nécessaire
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Connexion réussie
        console.log('Connexion réussie:', data);
        // Utiliser la fonction login du contexte pour stocker le token et l'utilisateur
        login(data.token, data.user);
        // TODO: Gérer "Se souvenir de moi" (ex: stocker le token plus longtemps si coché)

        // Rediriger l'utilisateur vers la page d'accueil
        navigate('/');
      } else {
        // Connexion échouée (ex: identifiants invalides, compte inactif)
        console.error('Erreur de connexion:', data.message);
        setError(data.message || 'Erreur lors de la connexion.'); // Afficher le message d'erreur du backend
      }
    } catch (err) {
      console.error('Erreur réseau ou serveur:', err);
      setError('Impossible de se connecter au serveur.'); // Message pour les erreurs réseau
    } finally {
      setLoading(false); // Désactiver l'indicateur de chargement
    }
  };

  return (
    // Utilisation de classes Bootstrap pour centrer le formulaire et styliser
    // Ajout d'une classe custom pour le fond (voir App.css)
    <div className="login-page-container d-flex justify-content-center align-items-center min-vh-100">
      <div className="card p-4 login-card"> {/* Ajout classe login-card pour ombre/bordure */}
        <div className="card-body">
          {/* Cercle avec icône utilisateur */}
          <div className="user-icon-circle bg-primary text-white mx-auto mb-4 d-flex justify-content-center align-items-center">
            {/* Icône utilisateur (SVG simple ou Font Awesome si installé) */}
            {/* SVG simple pour l'exemple */}
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
              <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
            </svg>
          </div>

          {/* Titre de la carte - peut être retiré si l'icône suffit */}
          {/* <h2 className="card-title text-center mb-4">Connexion</h2> */}

          {/* Afficher les messages d'erreur */}
          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="mb-3 input-group"> {/* Utilisation de input-group pour l'icône */}
              <span className="input-group-text">
                 {/* Icône utilisateur pour le champ username */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person" viewBox="0 0 16 16">
                   <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
                 </svg>
              </span>
              <input
                type="text"
                className="form-control"
                id="usernameInput"
                placeholder="Nom d'utilisateur" // Placeholder comme dans l'image
                value={username}
                onChange={handleUsernameChange}
                required // Champ requis
                disabled={loading} // Désactiver pendant le chargement
              />
            </div>

            <div className="mb-3 input-group"> {/* Utilisation de input-group pour l'icône */}
              <span className="input-group-text">
                 {/* Icône cadenas pour le champ password */}
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-lock" viewBox="0 0 16 16">
                   <path d="M8 1a2 2 0 0 0-2 2v4H5a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H8V3a1 1 0 0 1 1-1h.5a.5.5 0 0 0 0-1H9a2 2 0 0 0-2 2v4h2v2H5V8h2V3a2 2 0 0 0 2-2z"/>
                 </svg>
              </span>
              <input
                type="password"
                className="form-control"
                id="passwordInput"
                placeholder="Mot de passe" // Placeholder comme dans l'image
                value={password}
                onChange={handlePasswordChange}
                required // Champ requis
                 disabled={loading} // Désactiver pendant le chargement
              />
            </div>

            {/* Section "Remember me" et "Forgot password?" */}
            <div className="d-flex justify-content-between align-items-center mb-4"> {/* Utilisation de flexbox pour aligner */}
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  value=""
                  id="rememberMeCheck"
                  checked={rememberMe}
                  onChange={handleRememberMeChange}
                   disabled={loading} // Désactiver pendant le chargement
                />
                <label className="form-check-label" htmlFor="rememberMeCheck">
                  Se souvenir de moi
                </label>
              </div>
              {/* Lien "Mot de passe oublié" - href="#" pour l'instant */}
              <a href="#" className="text-decoration-none text-primary">Mot de passe oublié ?</a>
            </div>

            {/* Bouton de connexion */}
            {/* Utilisation de btn-primary pour le fond bleu Bootstrap */}
            <button
              type="submit"
              className="btn btn-primary w-100 mb-3"
              disabled={loading} // Désactiver pendant le chargement
            >
              {loading ? 'Connexion...' : 'SE CONNECTER'} {/* Changer le texte pendant le chargement */}
            </button>

            {/* Lien "Register" / S'inscrire */}
            <div className="text-center">
               {/* Lien "S'inscrire" - href="#" pour l'instant */}
               <a href="#" className="text-decoration-none text-primary">S'inscrire</a>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
