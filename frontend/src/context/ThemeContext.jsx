// src/context/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Créez le Contexte. Il contiendra le thème actuel et une fonction pour le changer.
const ThemeContext = createContext();

// Créez un hook personnalisé pour facilement accéder au contexte dans les composants.
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Lance une erreur si useTheme est appelé en dehors du ThemeProvider
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Créez le composant Provider qui fournira le contexte à toute l'application.
export const ThemeProvider = ({ children }) => {
  // State pour le thème actuel.
  // On essaie de lire le thème depuis le localStorage pour persister le choix.
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    // Renvoie le thème sauvegardé s'il existe, sinon 'light' par défaut.
    return savedTheme || 'light';
  });

  // useEffect pour appliquer une classe sur le body et sauvegarder dans localStorage
  // chaque fois que le thème change.
  useEffect(() => {
    // Applique la classe 'dark-theme' au <body> si le thème est 'dark', sinon retire la classe.
    document.body.className = theme === 'dark' ? 'dark-theme' : '';
    // Sauvegarde le thème actuel dans le localStorage.
    localStorage.setItem('theme', theme);
  }, [theme]); // Ce useEffect s'exécute quand 'theme' change.

  // Fonction pour basculer entre 'light' et 'dark'.
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  // Le ThemeContext.Provider rend les 'children' (l'application)
  // et leur fournit la valeur actuelle du contexte (le thème et la fonction pour le basculer).
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};