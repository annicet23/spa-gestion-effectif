// src/components/MainLayout.jsx
import React from 'react';
// Importer les composants Navbar, Sidebar, et le nouveau RightSidebar
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import RightSidebar from './RightSidebar'; // Importer le composant de droite

// Ce composant définit la structure de base des pages après connexion
// Il inclut la Navbar en haut, la Sidebar à gauche, le contenu principal au centre
// et la RightSidebar à droite.
function MainLayout({ children }) {
  return (
    <div className="d-flex flex-column vh-100"> {/* Flex vertical, prend toute la hauteur de la vue */}
      {/* Navbar en haut */}
      <Navbar />

      {/* Contenu principal (Sidebar + Centre + RightSidebar) */}
      {/* Ce conteneur prend l'espace restant en hauteur et arrange ses enfants horizontalement */}
      <div className="d-flex flex-grow-1">

        {/* Sidebar à gauche */}
        {/* La largeur sera définie par sidebar-custom */}
        <Sidebar />

        {/* Zone centrale : Contenu principal et Barre latérale droite */}
        {/* Ce conteneur prend TOUT l'espace horizontal restant après la Sidebar gauche */}
        {/* Il utilise Flexbox pour arranger le contenu de la page et la RightSidebar côte à côte */}
        <div className="d-flex flex-grow-1"> {/* Utilise Flexbox pour ses enfants (contenu + droite) */}

          {/* Zone du contenu de la page actuelle (au centre) */}
          {/* Utilise main-content-container pour le style (voir App.css) */}
          {/* flex-grow-1 pour prendre l'espace restant en largeur au MILIEU */}
          {/* overflow-y-auto pour permettre le défilement du contenu si nécessaire */}
          <div className="main-content-container flex-grow-1 overflow-y-auto">
            {/* Les composants de page (HomePage, CadresPage, etc.) seront rendus ici */}
            {children}
          </div>

          {/* Sidebar à droite */}
          {/* Sa largeur sera définie par right-sidebar-custom */}
          <RightSidebar /> {/* Inclure le composant de droite */}

        </div>
      </div>
    </div>
  );
}

export default MainLayout;