// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// 1. Crée le Contexte d'Authentification
const AuthContext = createContext(null);

// 2. Hook personnalisé pour utiliser le Contexte d'Authentification
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un AuthProvider');
  }
  return context;
};

// 3. Composant Fournisseur d'Authentification (AuthProvider)
export const AuthProvider = ({ children }) => {
  // État de l'utilisateur
  const [user, setUser] = useState(null);
  // État du token - Initialisé en essayant de lire depuis localStorage (clé 'token')
  const [token, setToken] = useState(localStorage.getItem('token'));
  // État pour savoir si la vérification initiale est en cours
  const [loading, setLoading] = useState(true); // Commence à true car la vérification commence au montage

  // Effet qui s'exécute au montage du composant et quand le token change
  useEffect(() => {
    // Log au démarrage de l'effet
    console.log("AuthContext useEffect start. Token initial state:", token ? "present" : "absent", "Loading state:", loading);

    const verifyToken = async () => {
       // Relire depuis localStorage au cas où il aurait changé entre le useState initial et maintenant (rare mais possible)
       const storedToken = localStorage.getItem('token');
       console.log("AuthContext useEffect - Checking localStorage for token ('token'):", storedToken ? "present" : "absent", storedToken);


       if (storedToken) {
         // Si un token est trouvé dans le storage, mettez l'état 'token' à jour si ce n'est pas déjà fait
         // Cela gère le cas où l'état initial du useState n'aurait pas capturé le token
         if (token !== storedToken) {
            setToken(storedToken); // Met à jour l'état token si nécessaire
            console.log("AuthContext useEffect - Token state updated from storage.");
         }


         // TODO: IMPORTANT - Ajouter ici la logique pour vérifier si le token est toujours valide avec le backend
         // Idéalement, faites un appel API (ex: GET /api/me)
         // en envoyant le 'storedToken' dans l'en-tête Authorization.
         // Si le backend confirme que le token est valide et renvoie les infos utilisateur :
         //   try {
             //      const response = await fetch('/api/me', { headers: { 'Authorization': `Bearer ${storedToken}` } });
             //      if (response.ok) {
             //          const userData = await response.json();
             //          setUser(userData); // Met à jour l'état utilisateur avec les vraies données du backend
             //          console.log("AuthContext useEffect - Token validated by backend, user data set.");
             //      } else {
             //          // Token invalide ou expiré selon le backend
             //          console.warn("AuthContext useEffect - Token validation failed (backend status:", response.status, "). Logging out.");
             //          logout(); // Déconnecter l'utilisateur
             //      }
             //  } catch (error) {
             //      console.error("AuthContext useEffect - Network error during token validation:", error);
             //      logout(); // Traiter l'erreur réseau comme un token invalide
             //  }

         // SIMULATION (à remplacer par la logique backend ci-dessus) :
         try {
             // Petite pause pour simuler un appel réseau de validation
             await new Promise(resolve => setTimeout(resolve, 100));
             // Simulation: si un token existe, on suppose que l'utilisateur est valide (À REMPLACER)
               const storedUserInfo = localStorage.getItem('userInfo'); // Tente de lire aussi les infos utilisateur si stockées
               if (storedUserInfo) {
                   try {
                       setUser(JSON.parse(storedUserInfo)); // Utilise les infos utilisateur stockées si trouvées
                       console.log("AuthContext useEffect - SIMULATION: User data set from localStorage.");
                   } catch (e) {
                       console.error("AuthContext useEffect - SIMULATION: Failed to parse user info from storage", e);
                       // Si les infos utilisateur sont corrompues, on déconnecte
                       logout();
                   }
               } else {
                   // Si pas d'infos utilisateur stockées, on peut soit laisser user à null (si c'est géré comme ça),
                   // soit tenter de les récupérer via une API (mieux), soit déconnecter si infos user essentielles.
                   // Dans cette simulation simple, on met un placeholder.
                   setUser({ username: 'Utilisateur Connecté (Simulé)' }); // Placeholder si pas d'infos stockées
                   console.log("AuthContext useEffect - SIMULATION: User data set to placeholder.");
               }

         } catch (error) {
              console.error("AuthContext useEffect - Erreur lors de la vérification initiale SIMULÉE du token", error);
              // Si la simulation (ou la vraie vérification future) échoue, déconnectez l'utilisateur
              logout(); // Ceci appellera la fonction logout définie ci-dessous
         }

       } else {
           // Pas de token trouvé dans le storage
           console.log("AuthContext useEffect - No token found in storage.");
           setUser(null); // S'assurer que l'état utilisateur est null si pas de token
       }
       // Une fois la vérification initiale (avec simulation ou logique réelle) terminée
       setLoading(false);
       console.log("AuthContext useEffect - Verification finished. Loading set to false. isAuthenticated:", !!storedToken);

    };

    verifyToken();
    // Cet effet se ré-exécute si le token change dans l'état (par login ou logout)
  }, [token]); // Inclure 'token' dans les dépendances

    // Optionnel: Ajoutez un effet pour synchroniser localStorage quand l'état token ou user change
    // Ceci peut aider en cas de décalage, mais normalement login/logout gèrent déjà ça.
    // useEffect(() => {
    //     if (token) {
    //         localStorage.setItem('token', token);
    //         // Si vous stockez aussi user info dans localStorage
    //         // localStorage.setItem('userInfo', JSON.stringify(user));
    //     } else {
    //         localStorage.removeItem('token');
    //         // localStorage.removeItem('userInfo');
    //     }
    //     console.log("AuthContext useEffect - Token state changed, localStorage synced.");
    // }, [token, user]);


  // Fonction pour gérer la CONNEXION
  const login = async (newToken, userData) => {
    console.log("AuthContext login called with newToken:", newToken ? "present" : "absent", "userData:", userData);
    if (!newToken || !userData) {
        console.error("Login called with missing token or user data.");
        // Optionnel: traiter comme un échec de login
        return;
    }

    localStorage.setItem('token', newToken); // Sauvegarde le token dans localStorage (clé 'token')
    localStorage.setItem('userInfo', JSON.stringify(userData)); // Optionnel: Sauvegarde aussi les infos utilisateur
    setToken(newToken); // Met à jour l'état du token
    setUser(userData); // Met à jour l'état de l'utilisateur
    setLoading(false); // Assurez-vous que loading est faux après login
    console.log("AuthContext login - State and storage updated. Current token state:", newToken ? "present" : "absent", "isAuthenticated:", !!newToken);

    // TODO: Rediriger l'utilisateur vers la page d'accueil ou le dashboard après une connexion réussie
    // Utilisez useNavigate hook dans LoginPage.jsx pour cela.
  };

  // Fonction pour gérer la DÉCONNEXION
  const logout = () => {
    console.log("AuthContext logout called.");
    localStorage.removeItem('token'); // Supprime le token du storage (clé 'token')
    localStorage.removeItem('userInfo'); // Optionnel: Supprime aussi les infos utilisateur
    setToken(null); // Réinitialise l'état du token
    setUser(null); // Réinitialise l'état de l'utilisateur
    setLoading(false); // Assurez-vous que loading est faux après logout
    console.log("AuthContext logout - State and storage cleared. isAuthenticated:", false);

    // TODO: Rediriger l'utilisateur vers la page de connexion après la déconnexion
    // Utilisez useNavigate hook ou une logique de routage si nécessaire.
  };

  // L'objet 'value' contient toutes les données et fonctions que les consommateurs du contexte pourront utiliser.
  const value = {
    user, // Informations utilisateur
    token, // Le token (l'état actuel)
    isAuthenticated: !!token, // Vrai si token n'est pas null/undefined
    loading, // Si la vérification initiale est toujours en cours
    login, // La fonction pour se connecter
    logout // La fonction pour se déconnecter
  };

  // Le fournisseur enveloppe ses enfants. On peut conditionnellement afficher un loader
  // ou laisser ProtectedRoute gérer l'attente du loading.
  return (
    <AuthContext.Provider value={value}>
        {/* Optionnel: Afficher un loader si loading est vrai et vous ne voulez rien montrer d'autre */}
        {/* {loading ? <div>Chargement de l'authentification...</div> : children} */}
        {/* Ou laisser ProtectedRoute gérer le loading, et juste rendre children */}
        {children}
    </AuthContext.Provider>
  );
};