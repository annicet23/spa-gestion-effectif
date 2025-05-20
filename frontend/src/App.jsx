// src/App.jsx
import React from 'react';
// Importer les composants nécessaires de react-router-dom


// Importer vos composants de page existants
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage'; // Assurez-vous que le chemin est correct


import HistoriquePage from './pages/HistoriquePage'; // Importez la page Historique

// --- IMPORTS : Pages des sous-menus Mise à Jours SPA ---
// MisesAJourSousMenu1Page est pour la mise à jour des CADRES (comme analysé)
import MisesAJourSousMenu1Page from './pages/MisesAJourSousMenu1Page';
// MisesAJourSousMenu2Page est pour la mise à jour des ELEVES (comme analysé)
import MisesAJourSousMenu2Page from './pages/MisesAJourSousMenu2Page';
// --- FIN IMPORTS ---

// --- IMPORTS : Pages de création ---
import CreateCadrePage from './pages/CreateCadrePage';
import CreateElevePage from './pages/CreateElevePage';
// --- FIN IMPORTS ---

// --- IMPORTS DES PAGES DE LISTE EXISTANTES ---
import ListElevesPage from './pages/ListElevesPage'; // Page pour afficher la liste des élèves
import ListCadresPage from './pages/ListCadresPage'; // Page pour afficher la liste des cadres
// --- FIN IMPORTS DES PAGES DE LISTE EXISTANTES ---
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
// --- NOUVEAUX IMPORTS POUR LES PAGES PARAMÈTRES ---
import ComptesListPage from './pages/ComptesListPage'; // Importez le composant Liste Compte (QUE NOUS AVONS ÉBAUCHÉ)


import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';
// Importer le MainLayout et les composants de route protégée/publique
import MainLayout from './components/MainLayout';
// CORRECTION : Changer le chemin d'importation pour AuthContext si le dossier 'context' est DANS 'src'
import { AuthProvider, useAuth } from './context/AuthContext'; // <<< Chemin corrigé ici

import './App.css'; // Importer votre fichier CSS global
import OrgChartPage from './pages/OrgChartPage';
import RepartitionCadresPage from './pages/RepartitionCadresPage'; // Adaptez le chemin si nécessaire
// Composant qui gère les routes protégées (nécessite authentification)
const ProtectedRoute = ({ element }) => {
  const { isAuthenticated, loading } = useAuth();

  // Si le chargement initial est en cours, on ne rend rien (ou un loader)
  if (loading) {
      return null; // Ou un composant de chargement si vous préférez
  }

  // Si l'utilisateur est authentifié, afficher l'élément (le composant de page)
  // Sinon, rediriger vers la page de connexion
  return isAuthenticated ? element : <Navigate to="/login" />;
};

// Composant qui gère la route de connexion (publique, redirige si déjà authentifié)
const PublicRoute = ({ element }) => {
  const { isAuthenticated, loading } = useAuth();

   // Si le chargement initial est en cours
  if (loading) {
       return null; // Ou un composant de chargement si vous préférez
  }

  // Si l'utilisateur est authentifié, rediriger vers la page d'accueil
  // Sinon, afficher l'élément (la page de connexion)
  return isAuthenticated ? <Navigate to="/" /> : element;
};


function App() {
  return (
    // BrowserRouter enveloppe toute l'application pour activer le routage
    // AuthProvider enveloppe les routes pour fournir le contexte d'authentification
    <Router>
      <AuthProvider> {/* Enveloppe les Routes avec le AuthProvider */}
        <div className="App">
          {/* Définir les différentes routes de l'application */}
          <Routes>
            {/* Route pour la page de connexion (publique, redirige si authentifié) */}
            <Route
              path="/login"
              element={<PublicRoute element={<LoginPage />} />} // Utilise PublicRoute
            />

            {/* Routes protégées qui utilisent le MainLayout */}

            {/* Route pour la page d'accueil */}
            <Route
              path="/"
              element={<ProtectedRoute element={<MainLayout><HomePage /></MainLayout>} />}
            />

            {/* NOTE: La route /parametres "générique" peut rester si vous avez une page d'accueil pour les paramètres,
               mais les liens spécifiques doivent pointer vers les routes ci-dessous */}
            {/* Si vous avez une page spécifique pour /parametres : */}
            {/* <Route path="/parametres" element={<ProtectedRoute element={<MainLayout><ParametresPage /></MainLayout>} />} /> */}


            {/* --- ROUTES POUR LES SOUS-MENUS PARAMÈTRES --- */}

            {/* Route pour la page "Liste compte" */}
            <Route
              path="/parametres/comptes" // <--- Chemin exact !
              element={<ProtectedRoute element={<MainLayout><ComptesListPage /></MainLayout>} />} // <--- Rendre le bon composant
            />

            

            {/* Vos autres routes existantes... */}
            <Route path="/historique" element={<ProtectedRoute element={<MainLayout><HistoriquePage /></MainLayout>} />} />

            {/* Routes pour les sous-menus Mise à Jours SPA */}
            {/* CORRECTION : Ajuster les chemins pour correspondre aux liens de la sidebar */}
            <Route path="/mises-a-jour/cadre" element={<ProtectedRoute element={<MainLayout><MisesAJourSousMenu1Page /></MainLayout>} />} /> {/* Chemin corrigé */}
            <Route path="/mises-a-jour/eleve" element={<ProtectedRoute element={<MainLayout><MisesAJourSousMenu2Page /></MainLayout>} />} /> {/* Chemin corrigé */}

            {/* Routes pour les pages de création */}
            <Route path="/create/cadre" element={<ProtectedRoute element={<MainLayout><CreateCadrePage /></MainLayout>} />} />
            <Route path="/create/eleve" element={<ProtectedRoute element={<MainLayout><CreateElevePage /></MainLayout>} />} />

            {/* Routes pour les pages de liste (autres que comptes) */}
            <Route path="/eleves" element={<ProtectedRoute element={<MainLayout><ListElevesPage /></MainLayout>} />} />
            <Route path="/cadres" element={<ProtectedRoute element={<MainLayout><ListCadresPage /></MainLayout>} />} />
            <Route path="/divers/staff" element={<ProtectedRoute element={<MainLayout><OrgChartPage /></MainLayout>} />} />
               <Route path="/divers/repartition-cadres" element={<RepartitionCadresPage />} /> 

            {/* La route catch-all DOIT rester la dernière ! Si aucune route précédente ne matche, redirige vers / */}
            <Route path="*" element={<Navigate to="/" replace />} />


          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
