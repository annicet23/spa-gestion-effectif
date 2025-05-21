// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react'; // Import useEffect
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
} from 'react-icons/fa';

function Sidebar() {
  const location = useLocation();
  const [openSubmenuId, setOpenSubmenuId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // State for sidebar visibility

  // Close sidebar when screen size changes to large (desktop)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) { // md breakpoint of Bootstrap
        setIsSidebarOpen(true); // Always open on larger screens
      } else {
        setIsSidebarOpen(false); // Close on smaller screens by default
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial check
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleToggleClick = (submenuId) => {
    setOpenSubmenuId(openSubmenuId === submenuId ? null : submenuId);
  };

  const handleLinkClick = () => {
    setOpenSubmenuId(null);
    // Close the sidebar after clicking a link on small screens
    if (window.innerWidth < 768) { // md breakpoint of Bootstrap
      setIsSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const isActive = (pathname) => location.pathname === pathname;
  const isSubmenuOpen = (submenuId) => openSubmenuId === submenuId;

  return (
    <>
      {/* Hamburger button for small screens */}
      <button
        className="btn btn-primary d-md-none sidebar-toggle-button" // Visible only on screens < md
        onClick={toggleSidebar}
        aria-controls="sidebar-menu"
        aria-expanded={isSidebarOpen}
        aria-label="Toggle navigation"
      >
        {isSidebarOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
      </button>

      {/* The Sidebar itself */}
      <div
        className={`d-flex flex-column flex-shrink-0 p-3 bg-dark sidebar-custom
          ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`} // Classes for responsiveness
        style={{ minHeight: '100vh' }}
        id="sidebar-menu"
      >
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
              <span className="sidebar-text">Tableau de bord</span>
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
              <span className="sidebar-text">SRH</span>
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
                    <span className="sidebar-text">Liste Personnel</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/create/cadre"
                    className={`nav-link link-darkt d-flex align-items-center ${isActive('/create/cadre') ? 'active-sidebar' : ''}`}
                    onClick={handleLinkClick}
                  >
                    <FaUserPlus className="bi me-2" size={16} />
                    <span className="sidebar-text">Insertion Personnel</span>
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
              <span className="sidebar-text">Mise à Jours SPA</span>
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
                    <span className="sidebar-text">Cadre</span>
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
              <span className="sidebar-text">Paramètres</span>
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
                    <span className="sidebar-text">Compte</span>
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
              <span className="sidebar-text">Historique</span>
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
              <span className="sidebar-text">DIVERS</span>
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
                    <span className="sidebar-text">STAFF</span>
                  </Link>
                </li>
                <li>
                  <Link
                    to="/divers/repartition-cadres"
                    className={`nav-link link-darkt d-flex align-items-center ${isActive('/divers/repartition-cadres') ? 'active-sidebar' : ''}`}
                    onClick={handleLinkClick}
                  >
                    <FaRandom className="bi me-2" size={16} />
                    <span className="sidebar-text">Répartition Cadres</span>
                  </Link>
                </li>
              </ul>
            </div>
          </li>
        </ul>
        <hr />
      </div>
    </>
  );
}

export default Sidebar;