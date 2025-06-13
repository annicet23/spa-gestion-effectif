// src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';

// Import your page components
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import HistoriquePage from './pages/HistoriquePage';

// Pages des sous-menus Mise à Jours SPA
import MisesAJourSousMenu1Page from './pages/MisesAJourSousMenu1Page';
import MisesAJourSousMenu2Page from './pages/MisesAJourSousMenu2Page';

// Pages de création
import CreateCadrePage from './pages/CreateCadrePage';
import CreateElevePage from './pages/CreateElevePage';

// Pages de liste existantes
import ListElevesPage from './pages/ListElevesPage';
import ListCadresPage from './pages/ListCadresPage';

// Pages Paramètres
import ComptesListPage from './pages/ComptesListPage';
import ConsultantUpdateProfilePage from './components/ConsultantUpdateProfilePage';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min';

// MainLayout and auth context
import MainLayout from './components/MainLayout';
import { AuthProvider, useAuth } from './context/AuthContext';

import './App.css';
import OrgChartPage from './pages/OrgChartPage';
import RepartitionCadresPage from './pages/RepartitionCadresPage';
import LibraryPage from './components/LibraryPage';
import AdminLibraryPage from './pages/AdminLibraryPage';
import SuiviPermissions from './pages/SuiviPermissions';
import SuiviResumePermissions from './pages/SuiviResumePermissions';

// --- NOUVEL IMPORT POUR LA PAGE DE CHAT ---
import ChatPage from './pages/ChatPage'; // Assurez-vous de créer ce fichier
// --- FIN NOUVEL IMPORT ---
import DatabaseAdminPage from './pages/DatabaseAdminPage';
// --- Protected and Public Route Components ---
const ProtectedRoute = ({ element }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation(); // Correct ici car ProtectedRoute est rendu DANS <Routes>

    useEffect(() => {
        console.log(`[ProtectedRoute] Chemin actuel: ${location.pathname}, Authentifié: ${isAuthenticated}, Chargement: ${loading}`);
    }, [location.pathname, isAuthenticated, loading]);

    if (loading) {
        console.log("[ProtectedRoute] Chargement en cours...");
        return null; // Ou un spinner de chargement si vous préférez
    }

    if (!isAuthenticated) {
        console.log("[ProtectedRoute] Non authentifié, redirection vers /login");
        return <Navigate to="/login" />;
    }

    console.log(`[ProtectedRoute] Authentifié, rend le composant pour le chemin: ${location.pathname}`);
    return element;
};

const PublicRoute = ({ element }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = useLocation(); // Correct ici car PublicRoute est rendu DANS <Routes>

    useEffect(() => {
        console.log(`[PublicRoute] Chemin actuel: ${location.pathname}, Authentifié: ${isAuthenticated}, Chargement: ${loading}`);
    }, [location.pathname, isAuthenticated, loading]);

    if (loading) {
        console.log("[PublicRoute] Chargement en cours...");
        return null;
    }

    // Si déjà authentifié et essaie d'accéder à une PublicRoute (comme login), redirige vers l'accueil.
    // Pour la bibliothèque, nous ne voulons PAS cette redirection, donc nous allons la gérer différemment.
    // C'est pourquoi la LibraryPage ne sera pas enveloppée par PublicRoute.
    if (isAuthenticated && location.pathname !== "/documentation/library" && location.pathname !== "/admin/library") {
        console.log("[PublicRoute] Déjà authentifié sur une route publique (non-bibliothèque), redirection vers /");
        return <Navigate to="/" />;
    }

    console.log(`[PublicRoute] Rend le composant public pour le chemin: ${location.pathname}`);
    return element;
};
// --- End Protected and Public Route Components ---

// Nouveau composant pour le débogage de la route, placé à l'intérieur du Router
const RouteDebugger = () => {
    const location = useLocation();
    useEffect(() => {
        console.log(`[RouteDebugger] Le chemin de l'URL a changé: ${location.pathname}`);
    }, [location.pathname]);
    return null; // Ce composant ne rend rien visuellement
};

function App() {
    return (
        <Router>
            {/* Le RouteDebugger est maintenant à l'intérieur du Router, donc useLocation est valide */}
            <RouteDebugger />
            <AuthProvider>
                <div className="App">
                    <Routes>
                        {/* --- ROUTES PUBLIQUES (PAS besoin de connexion, PAS de MainLayout) --- */}
                        <Route
                            path="/login"
                            element={<PublicRoute element={<LoginPage />} />}
                        />
                        <Route
                            path="/consultant-update-profile"
                            element={<PublicRoute element={<ConsultantUpdateProfilePage />} />}
                        />

                        <Route
                            path="/documentation/library"
                            element={<LibraryPage />}
                        />

                        {/* IMPORTANT : Placez la route de l'administration AVANT la route de capture (*) */}
                        <Route path="/admin/library" element={<AdminLibraryPage />} />

                        {/* --- ROUTES PROTÉGÉES (Requérant MainLayout) --- */}
                        {/* --- NOUVEL ORDRE : Mettre /chat AVANT / --- */}
                        <Route
                            path="/chat"
                            element={<ProtectedRoute element={<MainLayout><ChatPage /></MainLayout>} />}
                        />
                        <Route
                            path="/"
                            element={<ProtectedRoute element={<MainLayout><HomePage /></MainLayout>} />}
                        />
                        {/* --- FIN NOUVEL ORDRE --- */}

                        <Route
                            path="/historique"
                            element={<ProtectedRoute element={<MainLayout><HistoriquePage /></MainLayout>} />}
                        />
                        <Route
                            path="/parametres/comptes"
                            element={<ProtectedRoute element={<MainLayout><ComptesListPage /></MainLayout>} />}
                        />
                        <Route
                            path="/mises-a-jour/cadre"
                            element={<ProtectedRoute element={<MainLayout><MisesAJourSousMenu1Page /></MainLayout>} />}
                        />
                        <Route
                            path="/mises-a-jour/eleve"
                            element={<ProtectedRoute element={<MainLayout><MisesAJourSousMenu2Page /></MainLayout>} />}
                        />
                        <Route
                            path="/create/cadre"
                            element={<ProtectedRoute element={<MainLayout><CreateCadrePage /></MainLayout>} />}
                        />
                        <Route
                            path="/create/eleve"
                            element={<ProtectedRoute element={<MainLayout><CreateElevePage /></MainLayout>} />}
                        />
                        <Route
                            path="/eleves"
                            element={<ProtectedRoute element={<MainLayout><ListElevesPage /></MainLayout>} />}
                        />
                        <Route
                            path="/cadres"
                            element={<ProtectedRoute element={<MainLayout><ListCadresPage /></MainLayout>} />}
                        />
                        <Route
                            path="/divers/staff"
                            element={<ProtectedRoute element={<MainLayout><OrgChartPage /></MainLayout>} />}
                        />
                        <Route
                            path="/divers/repartition-cadres"
                            element={<ProtectedRoute element={<MainLayout><RepartitionCadresPage /></MainLayout>} />}
                        />
                        {/* ROUTES POUR LE SUIVI ET RÉSUMÉ DES PERMISSIONS */}
                        <Route
                            path="/suivi-permissions"
                            element={<ProtectedRoute element={<MainLayout><SuiviPermissions /></MainLayout>} />}
                        />
                        <Route
                            path="/suivi-permissions/summary"
                            element={<ProtectedRoute element={<MainLayout><SuiviResumePermissions /></MainLayout>} />}
                        />
                        <Route path="/db-admin" element={<DatabaseAdminPage />} />

                        {/* Route de capture pour les chemins non trouvés (redirige vers l'accueil si protégé, sinon gère publiquement) */}
                        {/* IMPORTANT : Cette route doit être la dernière pour ne pas capturer les routes précédentes */}
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    </Routes>
                </div>
            </AuthProvider>
        </Router>
    );
}

export default App;