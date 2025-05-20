// src/components/Navbar.jsx
import React, { useState } from 'react'; // Importer useState pour gérer l'état du champ de recherche
// Importer Link de react-router-dom pour la navigation SPA
import { Link, useNavigate } from 'react-router-dom';
// Importer le hook useAuth pour accéder aux infos utilisateur et à la fonction de déconnexion
import { useAuth } from '../context/AuthContext';

// Utilisation des classes Bootstrap pour la barre de navigation
function Navbar() {
  // Accéder aux informations utilisateur et à la fonction de déconnexion via le contexte
  const { user, logout } = useAuth();
  const navigate = useNavigate(); // Pour rediriger après la déconnexion

  // État local pour le champ de recherche
  const [searchQuery, setSearchQuery] = useState('');

  // Gère les changements dans le champ de recherche
  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
  };

  // Gère la soumission du formulaire de recherche
  const handleSearchSubmit = (event) => {
    event.preventDefault(); // Empêche le rechargement de la page par défaut

    // TODO: Implémenter la logique de recherche ici
    // Cela dépendra de la page sur laquelle l'utilisateur se trouve
    // Par exemple, rediriger vers une page de résultats de recherche ou
    // déclencher une action de filtrage dans le composant de page actuel.
    console.log('Recherche soumise avec la requête :', searchQuery);

    // Exemple simple : rediriger vers une URL de recherche (à adapter)
    // navigate(`/search?q=${encodeURIComponent(searchQuery)}`);

    // Pour l'instant, on peut juste afficher la requête dans la console
    // Remplacer alert() par une méthode plus conviviale si possible
    alert(`Recherche : ${searchQuery}`); // Utiliser une alerte pour le test rapide
  };


  // Gère la déconnexion de l'utilisateur
  const handleLogout = () => {
    logout(); // Appelle la fonction de déconnexion du contexte
    // Rediriger l'utilisateur vers la page de connexion après la déconnexion
    navigate('/login'); // Redirection
  };

  return (
    // Utilisation de la classe personnalisée navbar-custom pour le style fixe et l'apparence
    // et des classes Bootstrap pour la structure et le comportement responsive
    <nav className="navbar navbar-expand-lg navbar-dark navbar-custom"> {/* Remplacement de bg-primary par navbar-custom */}
      <div className="container-fluid">

        {/* --- Logo et Nom de l'application (à gauche) --- */}
        <Link className="navbar-brand d-flex align-items-center" to="/"> {/* d-flex et align-items-center pour aligner logo et texte */}
           {/* Espace pour le logo - Remplacez par votre image ou SVG */}
           {/* Exemple d'icône SVG simple (vous pouvez remplacer par votre logo réel) */}
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" className="bi bi-app-indicator me-2" viewBox="0 0 16 16">

           </svg>
           EGNA {/* Titre de l'application */}
        </Link>
        {/* --- Fin Logo et Nom de l'application --- */}


        {/* Bouton pour le menu responsive (pour les petits écrans) */}
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>

        {/* Contenu de la barre de navigation (liens, barre de recherche, infos utilisateur, déconnexion) */}
        <div className="collapse navbar-collapse" id="navbarNav">

          {/* --- Formulaire de recherche (Centré) --- */}
          {/* mx-auto centre l'élément horizontalement dans un conteneur flex */}
          {/* my-2 my-lg-0 pour ajuster la marge sur mobile vs desktop */}
            <form className="d-flex mx-auto my-2 my-lg-0" role="search" onSubmit={handleSearchSubmit}>
              <input
                className="form-control me-2" // me-2 ajoute une marge à droite du champ
                type="search"
                placeholder="Rechercher..."
                aria-label="Search"
                value={searchQuery}
                onChange={handleSearchInputChange}
              />
              <button className="btn btn-outline-light" type="submit">Rechercher</button> {/* Bouton de recherche blanc */}
            </form>
            {/* --- Fin Formulaire de recherche --- */}


          {/* Section à droite de la barre de navigation (infos utilisateur et déconnexion) */}
          <ul className="navbar-nav mb-2 mb-lg-0"> {/* mb-2 mb-lg-0 pour ajuster la marge sur mobile vs desktop */}
            {/* Afficher le nom et le rôle de l'utilisateur si connecté */}
            {user && (
              <li className="nav-item">
                {/* Utilisation de text-white pour que le nom soit blanc, car navbar-custom ne définit pas la couleur du texte */}
                <span className="nav-link text-white">
                  {/* Affichage modifié : Rôle Nom d'utilisateur */}
                  **{user.role}** {user.username}
                </span>
              </li>
            )}

            {/* Bouton de déconnexion */}
            <li className="nav-item">
              {/* Utilisation de la classe btn de Bootstrap */}
              <button className="btn btn-outline-light" onClick={handleLogout}> {/* btn-outline-light pour bouton blanc avec bordure */}
                Déconnexion
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
