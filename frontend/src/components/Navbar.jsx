// src/components/Navbar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import './CustomNavbar.css';

// Importation des icônes de react-icons
import { FaSearch } from 'react-icons/fa';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef(null);
  const navbarCollapseRef = useRef(null);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);
  const [isNavbarOpen, setIsNavbarOpen] = useState(false);
  const [isLoggedInVisual, setIsLoggedInVisual] = useState(!!user);

  useEffect(() => {
    const handleResize = () => {
      const newIsLargeScreen = window.innerWidth >= 992;
      setIsLargeScreen(newIsLargeScreen);
      if (newIsLargeScreen) {
        setShowSearchInput(false);
        setIsNavbarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isLargeScreen) { // Seulement sur petits écrans
        // Si le menu de la navbar est ouvert et le clic est en dehors
        if (isNavbarOpen && navbarCollapseRef.current &&
            !navbarCollapseRef.current.contains(event.target) &&
            !event.target.closest('.navbar-toggler') &&
            !event.target.closest('.search-toggle-btn') &&
            !event.target.closest('.toggle-switch')) {
          const bsCollapse = new window.bootstrap.Collapse(navbarCollapseRef.current, { toggle: false });
          bsCollapse.hide();
          setIsNavbarOpen(false);
        }
        // Si la barre de recherche est ouverte et le clic est en dehors (et n'est pas le bouton de recherche lui-même)
        if (showSearchInput && searchInputRef.current &&
            !searchInputRef.current.contains(event.target) &&
            !event.target.closest('.search-form-small-screen') && // Ajouté pour le conteneur de la barre de recherche
            !event.target.closest('.search-toggle-btn')) {
          setShowSearchInput(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNavbarOpen, isLargeScreen, showSearchInput]); // Ajout de showSearchInput aux dépendances

  const handleNavbarToggle = () => {
    setIsNavbarOpen(prevState => !prevState);
    // Masquer le champ de recherche si on ouvre/ferme le menu principal
    if (showSearchInput) {
      setShowSearchInput(false);
    }
  };

  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    console.log('Recherche soumise avec la requête :', searchQuery);
    Swal.fire({
      icon: 'info',
      title: 'Recherche',
      text: `Vous avez recherché : "${searchQuery}"`,
      timer: 2000,
      showConfirmButton: false
    });
    // Masquer le champ de recherche après soumission si sur petit écran
    if (!isLargeScreen && showSearchInput) {
      setShowSearchInput(false);
    }
  };

  const handleSearchIconClick = () => {
    // Si sur grand écran, le champ est toujours visible, donc on fait juste focus/blur
    if (isLargeScreen) {
      setShowSearchInput(true);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else { // Sur petit écran, on le toggle et on gère les fermetures
      setShowSearchInput(prev => {
        const newState = !prev;
        if (newState) { // Si on est sur le point d'afficher la recherche
          if (isNavbarOpen) { // Fermer le menu si la recherche s'ouvre
            const bsCollapse = new window.bootstrap.Collapse(navbarCollapseRef.current, { toggle: false });
            bsCollapse.hide();
            setIsNavbarOpen(false);
          }
          setTimeout(() => { // Focus sur l'input
            if (searchInputRef.current) {
                searchInputRef.current.focus();
            }
          }, 0);
        } else { // Si on est sur le point de masquer la recherche
          setSearchQuery(''); // Effacer la requête
        }
        return newState;
      });
    }
  };

  const handleToggleLogout = () => {
    if (!user) return; // Ne rien faire si pas d'utilisateur connecté

    let timerInterval;
    Swal.fire({
      title: 'Déconnexion Imminente!',
      html: 'Vous serez déconnecté dans <b></b> secondes.',
      timer: 5000,
      timerProgressBar: true,
      didOpen: () => {
        Swal.showLoading();
        const b = Swal.getHtmlContainer().querySelector('b');
        timerInterval = setInterval(() => {
          b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
        }, 100);
      },
      willClose: () => {
        clearInterval(timerInterval);
      }
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.timer) {
        console.log('Déconnexion automatique après le compte à rebours');
        logout();
        setIsLoggedInVisual(false); // Met à jour l'état visuel du switch
        navigate('/login');
      } else if (result.dismiss === Swal.DismissReason.backdrop || result.dismiss === Swal.DismissReason.close || result.dismiss === Swal.DismissReason.esc) {
        console.log('Déconnexion annulée par l\'utilisateur');
      }
    });
  };

  return (
    <> {/* Fragment pour envelopper la Navbar et le champ de recherche flottant */}
      <nav className="navbar navbar-expand-lg navbar-dark navbar-custom">
        <div className="container-fluid">

          <Link className="navbar-brand d-flex align-items-center" to="/">
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" fill="currentColor" className="bi bi-app-indicator me-2" viewBox="0 0 16 16">
            </svg>
            EGNA
          </Link>

          {!isLargeScreen && (
              <div className="d-flex align-items-center order-lg-last ms-auto small-screen-nav-items">
                  <button
                      className="btn btn-outline-light me-2 search-toggle-btn"
                      type="button"
                      onClick={handleSearchIconClick}
                      aria-label="Toggle Search"
                  >
                      <FaSearch />
                  </button>

                  {user && (
                      <div
                          className={`toggle-switch ${isLoggedInVisual ? 'on' : 'off'} me-2`}
                          onClick={handleToggleLogout}
                      >
                          <span className="toggle-slider"></span>
                          <span className="toggle-text on-text">On</span>
                          <span className="toggle-text off-text">Off</span>
                      </div>
                  )}
              </div>
          )}

          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded={isNavbarOpen}
            aria-label="Toggle navigation"
            onClick={handleNavbarToggle}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Contenu du menu déplié pour grands écrans et petits écrans */}
          <div className={`collapse navbar-collapse ${isNavbarOpen && !isLargeScreen ? 'show' : ''}`}
               id="navbarNav"
               ref={navbarCollapseRef}
          >
            {isLargeScreen && ( // Formulaire de recherche sur grands écrans
              <form className="d-flex mx-auto my-2 my-lg-0" role="search" onSubmit={handleSearchSubmit}>
                <input
                  ref={searchInputRef}
                  className="form-control me-2"
                  type="search"
                  placeholder="Rechercher..."
                  aria-label="Search"
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                />
                <button className="btn btn-outline-light" type="submit">
                  Rechercher
                </button>
              </form>
            )}

            <ul className="navbar-nav mb-2 mb-lg-0 align-items-center">

              {user && isLargeScreen && (
                <li className="nav-item">
                  <span className="nav-link text-white user-info">
                    **{user.role}** {user.username}
                  </span>
                </li>
              )}

              {user && isLargeScreen && ( // Toggle Switch sur grands écrans
                <li className="nav-item">
                  <div className={`toggle-switch ${isLoggedInVisual ? 'on' : 'off'}`} onClick={handleToggleLogout}>
                      <span className="toggle-slider"></span>
                      <span className="toggle-text on-text">On</span>
                      <span className="toggle-text off-text">Off</span>
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {/* --- NOUVEAU PLACEMENT DU FORMULAIRE DE RECHERCHE POUR PETITS ÉCRANS --- */}
      {/* Ce formulaire est maintenant à l'extérieur de la <nav> pour se positionner en dessous */}
      {!isLargeScreen && (
          <form className={`search-form-dropdown ${showSearchInput ? 'show' : ''}`} role="search" onSubmit={handleSearchSubmit}>
              <div className="container-fluid d-flex align-items-center py-2">
                  <input
                      ref={searchInputRef}
                      className="form-control me-2"
                      type="search"
                      placeholder="Rechercher..."
                      aria-label="Search"
                      value={searchQuery}
                      onChange={handleSearchInputChange}
                  />
                  <button className="btn btn-outline-light" type="submit">Rechercher</button>
              </div>
          </form>
      )}
    </>
  );
}

export default Navbar;