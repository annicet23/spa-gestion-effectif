// src/components/Sidebar.jsx
import React, { useState } from 'react';
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
  FaRandom
} from 'react-icons/fa';

function Sidebar() {
  const location = useLocation();
  const [openSubmenuId, setOpenSubmenuId] = useState(null);

  const handleToggleClick = (submenuId) => {
    setOpenSubmenuId(openSubmenuId === submenuId ? null : submenuId);
  };

  const handleLinkClick = () => {
    setOpenSubmenuId(null);
  };

  const isActive = (pathname) => location.pathname === pathname;
  const isSubmenuOpen = (submenuId) => openSubmenuId === submenuId;

  return (
    <div className="d-flex flex-column flex-shrink-0 p-3 bg-dark sidebar-custom" style={{ minHeight: '100vh' }}>
      <hr />
      <ul className="nav nav-pills flex-column mb-auto">
        {/* Tableau de bord */}
        <li className="nav-item">
          <Link
            to="/"
            className={`nav-link link-darkt d-flex align-items-center ${isActive('/') ? 'active-sidebar' : ''}`}
            aria-current="page"
            onClick={handleLinkClick}
          >
            <FaHome className="bi me-2" size={16} />
            <span className="d-none d-md-inline">Tableau de bord</span>
          </Link>
        </li>

        {/* SRH (Gestion de personnel) */}
        <li className="nav-item">
          <a
            className={`nav-link link-darkt d-flex align-items-center ${isSubmenuOpen('#submenu-srh') ? 'active-sidebar' : ''}`}
            href="#submenu-srh"
            role="button"
            aria-expanded={isSubmenuOpen('#submenu-srh')}
            aria-controls="submenu-srh"
            onClick={() => handleToggleClick('#submenu-srh')}
          >
            <FaUsers className="bi me-2" size={16} />
            <span className="d-none d-md-inline">SRH</span>
          </a>
          <div className={`collapse ${isSubmenuOpen('#submenu-srh') ? 'show' : ''}`} id="submenu-srh">
            <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
              <li>
                <Link
                  to="/cadres"
                  className={`nav-link link-darkt d-flex align-items-center ${isActive('/cadres') ? 'active-sidebar' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUsers className="bi me-2" size={16} />
                  <span className="d-none d-md-inline">Liste Personnel</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/create/cadre"
                  className={`nav-link link-darkt d-flex align-items-center ${isActive('/create/cadre') ? 'active-sidebar' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUserPlus className="bi me-2" size={16} />
                  <span className="d-none d-md-inline">Insertion Personnel</span>
                </Link>
              </li>
            </ul>
          </div>
        </li>

        {/* Mise à Jours SPA */}
        <li className="nav-item">
          <a
            className={`nav-link link-darkt d-flex align-items-center ${isSubmenuOpen('#submenu-misesajour') ? 'active-sidebar' : ''}`}
            href="#submenu-misesajour"
            role="button"
            aria-expanded={isSubmenuOpen('#submenu-misesajour')}
            aria-controls="submenu-misesajour"
            onClick={() => handleToggleClick('#submenu-misesajour')}
          >
            <FaUserEdit className="bi me-2" size={16} />
            <span className="d-none d-md-inline">Mise à Jours SPA</span>
          </a>
          <div className={`collapse ${isSubmenuOpen('#submenu-misesajour') ? 'show' : ''}`} id="submenu-misesajour">
            <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
              <li>
                <Link
                  to="/mises-a-jour/cadre"
                  className={`nav-link link-darkt d-flex align-items-center ${isActive('/mises-a-jour/cadre') ? 'active-sidebar' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUserEdit className="bi me-2" size={16} />
                  <span className="d-none d-md-inline">Cadre</span>
                </Link>
              </li>
            </ul>
          </div>
        </li>

        {/* Paramètres */}
        <li className="nav-item">
          <a
            className={`nav-link link-darkt d-flex align-items-center ${isSubmenuOpen('#submenu-parametres') ? 'active-sidebar' : ''}`}
            href="#submenu-parametres"
            role="button"
            aria-expanded={isSubmenuOpen('#submenu-parametres')}
            aria-controls="submenu-parametres"
            onClick={() => handleToggleClick('#submenu-parametres')}
          >
            <FaCog className="bi me-2" size={16} />
            <span className="d-none d-md-inline">Paramètres</span>
          </a>
          <div className={`collapse ${isSubmenuOpen('#submenu-parametres') ? 'show' : ''}`} id="submenu-parametres">
            <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
              <li>
                <Link
                  to="/parametres/comptes"
                  className={`nav-link link-darkt d-flex align-items-center ${isActive('/parametres/comptes') ? 'active-sidebar' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUserCircle className="bi me-2" size={16} />
                  <span className="d-none d-md-inline">Compte</span>
                </Link>
              </li>
            </ul>
          </div>
        </li>

        {/* Historique */}
        <li className="nav-item">
          <Link
            to="/historique"
            className={`nav-link link-darkt d-flex align-items-center ${isActive('/historique') ? 'active-sidebar' : ''}`}
            onClick={handleLinkClick}
          >
            <FaHistory className="bi me-2" size={16} />
            <span className="d-none d-md-inline">Historique</span>
          </Link>
        </li>

        {/* DIVERS */}
        <li className="nav-item">
          <a
            className={`nav-link link-darkt d-flex align-items-center ${isSubmenuOpen('#submenu-divers') ? 'active-sidebar' : ''}`}
            href="#submenu-divers"
            role="button"
            aria-expanded={isSubmenuOpen('#submenu-divers')}
            aria-controls="submenu-divers"
            onClick={() => handleToggleClick('#submenu-divers')}
          >
            <FaTools className="bi me-2" size={16} />
            <span className="d-none d-md-inline">DIVERS</span>
          </a>
          <div className={`collapse ${isSubmenuOpen('#submenu-divers') ? 'show' : ''}`} id="submenu-divers">
            <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
              <li>
                <Link
                  to="/divers/staff"
                  className={`nav-link link-darkt d-flex align-items-center ${isActive('/divers/staff') ? 'active-sidebar' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaUsersCog className="bi me-2" size={16} />
                  <span className="d-none d-md-inline">STAFF</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/divers/repartition-cadres"
                  className={`nav-link link-darkt d-flex align-items-center ${isActive('/divers/repartition-cadres') ? 'active-sidebar' : ''}`}
                  onClick={handleLinkClick}
                >
                  <FaRandom className="bi me-2" size={16} />
                  <span className="d-none d-md-inline">Répartition Cadres</span>
                </Link>
              </li>
            </ul>
          </div>
        </li>
      </ul>
      <hr />
    </div>
  );
}

export default Sidebar;