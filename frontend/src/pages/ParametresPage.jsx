// src/pages/ParametresPage.jsx
import React from 'react';
// Importer les hooks nécessaires si besoin (ex: useAuth)
// import { useAuth } from '../context/AuthContext'; // Chemin correct si besoin du contexte

// Utilisation des classes Bootstrap pour le style

function ParametresPage() {
  // const { user } = useAuth(); // Accéder aux infos utilisateur si nécessaire

  return (
    // Le contenu de cette page sera rendu à l'intérieur du main-content-container du MainLayout
    <div className="container mt-4"> {/* Ajout d'une marge en haut */}
      <h1 className="text-center">Paramètres</h1>
      <p className="text-center">Contenu de la page Paramètres (en construction).</p>

      {/* TODO: Ajouter ici les options de paramètres (profil utilisateur, etc.) */}

    </div>
  );
}

export default ParametresPage;
