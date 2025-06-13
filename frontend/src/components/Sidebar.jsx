// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FaHome,
  FaUsers,
  FaUserPlus,
  FaUserEdit,
  FaCog,
  FaUserCircle,
  FaHistory,
  FaTools,
  FaUsersCog,
  FaRandom,
  FaBars,
  FaTimes,
  FaCalendarAlt,
  FaDatabase, // Icône pour DB Admin
} from 'react-icons/fa';
import './Sidebar.css'; // Importer le CSS

function Sidebar() {
  const location = useLocation();
  const [openSubmenuId, setOpenSubmenuId] = useState(null);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState(null); // State local pour l'utilisateur

  // Récupérer l'utilisateur depuis localStorage
  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleToggleClick = (submenuId) => {
    setOpenSubmenuId(openSubmenuId === submenuId ? null : submenuId);
  };

  const handleLinkClick = () => {
    setOpenSubmenuId(null);
    // Fermer sur mobile
    setIsMobileOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const isActive = (pathname) => location.pathname === pathname;
  const isSubmenuOpen = (submenuId) => openSubmenuId === submenuId;

  // ✅ FONCTION - Vérifier si l'utilisateur peut voir les paramètres
  const canSeeParametres = () => {
    // Afficher Paramètres si :
    // 1. L'utilisateur peut voir "Compte" (tous les utilisateurs connectés)
    // 2. OU si c'est un Admin (pour voir Admin DB)
    return user && (user.role === 'Admin' || user.role === 'Standard' || user.role === 'Consultant');
  };

  return (
    <>
      {/* Bouton mobile */}
      <button
        className="mobile-toggle-btn"
        onClick={toggleMobileMenu}
      >
        {isMobileOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>

      {/* Sidebar */}
      <div className={`custom-sidebar ${isMobileOpen ? 'mobile-visible' : ''}`}>

        <div className="sidebar-content">
          {/* Tableau de bord */}
          <div className="nav-item">
            <Link
              to="/"
              className={`nav-link ${isActive('/') ? 'active' : ''}`}
              onClick={handleLinkClick}
            >
              <FaHome className="nav-icon" />
              <span className="nav-text">Tableau de bord</span>
            </Link>
          </div>

          {/* Gestion personnel */}
          <div className="nav-item">
            <a
              className={`nav-link ${isSubmenuOpen('srh') ? 'active' : ''}`}
              onClick={() => handleToggleClick('srh')}
            >
              <FaUsers className="nav-icon" />
              <span className="nav-text">Gestion personnel</span>
            </a>
            {isSubmenuOpen('srh') && (
              <div className="submenu">
                <Link
                  to="/cadres"
                  className={`submenu-link ${isActive('/cadres') ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUsers className="nav-icon" />
                  <span className="nav-text">Liste Personnel</span>
                </Link>
                <Link
                  to="/create/cadre"
                  className={`submenu-link ${isActive('/create/cadre') ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUserPlus className="nav-icon" />
                  <span className="nav-text">Insertion Personnel</span>
                </Link>
                <Link
                  to="/suivi-permissions"
                  className={`submenu-link ${isActive('/suivi-permissions') ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaCalendarAlt className="nav-icon" />
                  <span className="nav-text">Suivi de Permission</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mise à jour SPA */}
          <div className="nav-item">
            <a
              className={`nav-link ${isSubmenuOpen('maj') ? 'active' : ''}`}
              onClick={() => handleToggleClick('maj')}
            >
              <FaUserEdit className="nav-icon" />
              <span className="nav-text">Mise à Jours SPA</span>
            </a>
            {isSubmenuOpen('maj') && (
              <div className="submenu">
                <Link
                  to="/mises-a-jour/cadre"
                  className={`submenu-link ${isActive('/mises-a-jour/cadre') ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUserEdit className="nav-icon" />
                  <span className="nav-text">Cadre</span>
                </Link>
              </div>
            )}
          </div>

          {/* ✅ PARAMÈTRES - Avec protection d'affichage */}
          {canSeeParametres() && (
            <div className="nav-item">
              <a
                className={`nav-link ${isSubmenuOpen('params') ? 'active' : ''}`}
                onClick={() => handleToggleClick('params')}
              >
                <FaCog className="nav-icon" />
                <span className="nav-text">Paramètres</span>
              </a>
              {isSubmenuOpen('params') && (
                <div className="submenu">
                  {/* ✅ COMPTE - Visible pour tous les utilisateurs connectés */}
                  <Link
                    to="/parametres/comptes"
                    className={`submenu-link ${isActive('/parametres/comptes') ? 'active' : ''}`}
                    onClick={handleLinkClick}
                  >
                    <FaUserCircle className="nav-icon" />
                    <span className="nav-text">Compte</span>
                  </Link>

                  {/* ✅ ADMIN DB - Visible SEULEMENT pour les admins */}
                  {user?.role === 'Admin' && (
                    <Link
                      to="/db-admin"
                      className={`submenu-link ${isActive('/db-admin') ? 'active' : ''}`}
                      onClick={handleLinkClick}
                    >
                      <FaDatabase className="nav-icon" />
                      <span className="nav-text">Admin Base de Données</span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Historique */}
          <div className="nav-item">
            <Link
              to="/historique"
              className={`nav-link ${isActive('/historique') ? 'active' : ''}`}
              onClick={handleLinkClick}
            >
              <FaHistory className="nav-icon" />
              <span className="nav-text">Historique</span>
            </Link>
          </div>

          {/* DIVERS */}
          <div className="nav-item">
            <a
              className={`nav-link ${isSubmenuOpen('divers') ? 'active' : ''}`}
              onClick={() => handleToggleClick('divers')}
            >
              <FaTools className="nav-icon" />
              <span className="nav-text">DIVERS</span>
            </a>
            {isSubmenuOpen('divers') && (
              <div className="submenu">
                <Link
                  to="/divers/staff"
                  className={`submenu-link ${isActive('/divers/staff') ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUsersCog className="nav-icon" />
                  <span className="nav-text">STAFF</span>
                </Link>
                <Link
                  to="/divers/repartition-cadres"
                  className={`submenu-link ${isActive('/divers/repartition-cadres') ? 'active' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaRandom className="nav-icon" />
                  <span className="nav-text">Répartition Cadres</span>
                </Link>
              </div>
            )}
          </div>

          {/* Chat */}
          <div className="nav-item">
            <Link
              to="/chat"
              className={`nav-link ${isActive('/chat') ? 'active' : ''}`}
              onClick={handleLinkClick}
            >
              <i className="bi bi-chat-dots-fill nav-icon"></i>
              <span className="nav-text">Chat</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default Sidebar;