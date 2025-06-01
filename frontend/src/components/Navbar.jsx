// src/components/Navbar.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import './CustomNavbar.css';

// Importation des icônes de react-icons
import { FaSearch, FaUser, FaCrown, FaUserShield } from 'react-icons/fa';

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const searchInputRef = useRef(null);

  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 992);
  const [isLoggedInVisual, setIsLoggedInVisual] = useState(!!user);

  useEffect(() => {
    const handleResize = () => {
      const newIsLargeScreen = window.innerWidth >= 992;
      setIsLargeScreen(newIsLargeScreen);
      if (newIsLargeScreen) {
        setShowSearchInput(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!isLargeScreen) {
        if (showSearchInput && searchInputRef.current &&
            !searchInputRef.current.contains(event.target) &&
            !event.target.closest('.search-form-dropdown') &&
            !event.target.closest('.search-toggle-btn')) {
          setShowSearchInput(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLargeScreen, showSearchInput]);

  const handleSearchInputChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    if (!searchQuery.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Recherche vide',
        text: 'Veuillez saisir un terme de recherche',
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    console.log('🔍 Recherche soumise avec la requête :', searchQuery);

    navigate(`/cadres?search=${encodeURIComponent(searchQuery.trim())}`);

    Swal.fire({
      icon: 'success',
      title: 'Recherche lancée',
      text: `Recherche de "${searchQuery}" dans la liste des cadres`,
      timer: 2000,
      showConfirmButton: false
    });

    if (!isLargeScreen && showSearchInput) {
      setShowSearchInput(false);
    }
  };

  const handleSearchIconClick = () => {
    if (isLargeScreen) {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    } else {
      setShowSearchInput(prev => {
        const newState = !prev;
        if (newState) {
          setTimeout(() => {
            if (searchInputRef.current) {
              searchInputRef.current.focus();
            }
          }, 100);
        } else {
          setSearchQuery('');
        }
        return newState;
      });
    }
  };

  // FONCTION MODIFIÉE POUR LE TOGGLE ROUGE OFF
  const handleToggleLogout = () => {
    if (!user) return;

    // Changer visuellement à OFF (rouge) immédiatement
    setIsLoggedInVisual(false);

    // Ajouter effet de clignotement temporaire
    const toggleElement = document.querySelector('.toggle-switch');
    if (toggleElement) {
      toggleElement.classList.add('blinking');
    }

    let timerInterval;
    Swal.fire({
      title: 'Déconnexion Imminente!',
      html: 'Vous serez déconnecté dans <b></b> secondes.',
      timer: 5000,
      timerProgressBar: true,
      allowOutsideClick: false, // Empêcher la fermeture par clic extérieur
      allowEscapeKey: false,    // Empêcher la fermeture par Escape
      didOpen: () => {
        Swal.showLoading();
        const b = Swal.getHtmlContainer().querySelector('b');
        timerInterval = setInterval(() => {
          b.textContent = Math.ceil(Swal.getTimerLeft() / 1000);
        }, 100);
      },
      willClose: () => {
        clearInterval(timerInterval);
        // Arrêter le clignotement
        if (toggleElement) {
          toggleElement.classList.remove('blinking');
        }
      }
    }).then((result) => {
      if (result.dismiss === Swal.DismissReason.timer) {
        // Déconnexion confirmée - garder OFF et déconnecter
        console.log('Déconnexion automatique après le compte à rebours');
        logout();
        navigate('/login');
      } else {
        // Si annulé d'une manière ou d'une autre, remettre à ON (vert)
        console.log('Déconnexion annulée - remise à ON');
        setIsLoggedInVisual(true);
      }
    });
  };

  // Fonction pour choisir l'icône selon le rôle
  const getRoleIcon = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'administrateur':
        return <FaCrown className="role-icon" />;
      case 'manager':
      case 'gestionnaire':
        return <FaUserShield className="role-icon" />;
      default:
        return <FaUser className="role-icon" />;
    }
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark navbar-custom">
        <div className="container-fluid">
          {/* Logo SANS FOND */}
          <Link className="navbar-brand d-flex align-items-center" to="/">
            <img
              src="/logo.jpg"
              alt="EGNA Logo"
              className="navbar-logo no-bg me-2"
              width="35"
              height="35"
              onError={(e) => {
                console.log('Erreur de chargement du logo');
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'inline';
              }}
              onLoad={() => {
                console.log('Logo chargé avec succès');
              }}
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="30"
              height="30"
              fill="currentColor"
              className="bi bi-app-indicator me-2 fallback-logo"
              viewBox="0 0 16 16"
              style={{ display: 'none' }}
            >
              <path d="M8 16a6 6 0 0 0 6-6c0-1.3-1.7-2-3-2 0 .5-1 1-1 1s-1-.5-1-1c-1.3 0-3 .7-3 2a6 6 0 0 0 2 4.472V16z"/>
              <circle cx="8" cy="6" r="2"/>
            </svg>
            EGNA
          </Link>

          {/* Section de droite - adaptative */}
          <div className="navbar-nav ms-auto d-flex flex-row align-items-center">

            {/* Barre de recherche sur grands écrans */}
            {isLargeScreen && (
              <form className="d-flex me-3" role="search" onSubmit={handleSearchSubmit}>
                <input
                  ref={searchInputRef}
                  className="form-control me-2 search-input-large"
                  type="search"
                  placeholder="Rechercher des cadres..."
                  aria-label="Search"
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                />
                <button className="btn btn-outline-light search-btn-large" type="submit" title="Rechercher dans la liste des cadres">
                  <FaSearch />
                </button>
              </form>
            )}

            {/* Bouton de recherche sur petits écrans */}
            {!isLargeScreen && (
              <button
                className="btn btn-outline-light me-2 search-toggle-btn"
                type="button"
                onClick={handleSearchIconClick}
                aria-label="Toggle Search"
                title="Rechercher des cadres"
              >
                <FaSearch />
              </button>
            )}

            {/* INFORMATIONS UTILISATEUR STYLÉES */}
            {user && isLargeScreen && (
              <div className="user-info-container me-3">
                <div className="user-card" data-role={user.role?.toLowerCase()}>
                  <div className="user-avatar">
                    {getRoleIcon(user.role)}
                  </div>
                  <div className="user-details">
                    <div className="user-role">
                      {user.role}
                    </div>
                    <div className="user-name">
                      {user.username}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Toggle de déconnexion AVEC EFFET ROUGE OFF */}
            {user && (
              <div
                className={`toggle-switch ${isLoggedInVisual ? 'on' : 'off'}`}
                onClick={handleToggleLogout}
                title={isLoggedInVisual ? 'Cliquez pour vous déconnecter' : 'Déconnexion en cours...'}
              >
                <span className="toggle-slider"></span>
                <span className="toggle-text on-text">ON</span>
                <span className="toggle-text off-text">OFF</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Dropdown de recherche pour petits écrans */}
      {!isLargeScreen && (
        <div className={`search-form-dropdown ${showSearchInput ? 'show' : ''}`}>
          <form role="search" onSubmit={handleSearchSubmit}>
            <div className="container-fluid d-flex align-items-center py-2">
              <input
                ref={searchInputRef}
                className="form-control me-2 search-input-small"
                type="search"
                placeholder="Rechercher des cadres..."
                aria-label="Search"
                value={searchQuery}
                onChange={handleSearchInputChange}
              />
              <button className="btn btn-outline-light search-btn-small" type="submit">
                <FaSearch />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

export default Navbar;