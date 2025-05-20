// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Importations de Bootstrap
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap'; // Importe le JavaScript principal de Bootstrap
import '@popperjs/core'; // Importe Popper.js (nécessaire pour certains composants Bootstrap)


import './index.css' // Votre fichier CSS global par défaut créé par Vite

// Trouver l'élément racine dans index.html (le fichier index.html est créé automatiquement par Vite)
const rootElement = document.getElementById('root');

// Si l'élément racine existe, monter l'application React
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App /> {/* Rendre le composant App */}
    </React.StrictMode>,
  );
} else {
  console.error("L'élément avec l'ID 'root' n'a pas été trouvé dans le document.");
}
