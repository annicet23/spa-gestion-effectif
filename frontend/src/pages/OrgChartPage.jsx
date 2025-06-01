import React, { useState, useRef, useCallback, useEffect } from 'react';
import Tree from 'react-d3-tree';
import { FaUserCircle, FaChevronDown, FaChevronUp, FaEdit, FaPlus, FaTrash, FaSearch, FaDownload, FaExpand, FaSave, FaFilePdf, FaFileWord, FaTimes, FaCompress, FaSpinner } from 'react-icons/fa';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../data/OrgChartPage.css';

// ✅ Imports pour l'exportation
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, ImageRun } from 'docx';

// ✅ Configuration API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;
const FRONT='';

// ✅ Configuration des couleurs par escadron
const customColors = {
  'Ecole': { primary: '#bdc3c7', nameText: '#7f8c8d', photoBorder: '#bdc3c7' },
  'Escadron 1': { primary: 'url(#redGradient)', nameText: '#c0392b', photoBorder: 'url(#redGradient)' },
  'Peloton 1': { primary: '#e74c3c', nameText: '#c0392b', photoBorder: '#e74c3c' },
  'Escadron 3': { primary: '#2ecc71', nameText: '#27ae60', photoBorder: '#2ecc71' },
  'Peloton 3': { primary: '#2ecc71', nameText: '#27ae60', photoBorder: '#2ecc71' },
  'Escadron 4': { primary: '#3498db', nameText: '#2980b9', photoBorder: '#3498db' },
  'Peloton 4': { primary: '#3498db', nameText: '#2980b9', photoBorder: '#3498db' },
  'Escadron 5': { primary: '#9b59b6', nameText: '#8e44ad', photoBorder: '#9b59b6' },
  'Peloton 5': { primary: '#9b59b6', nameText: '#8e44ad', photoBorder: '#9b59b6' },
  'Escadron 6': { primary: '#95a5a6', nameText: '#7f8c8d', photoBorder: '#95a5a6' },
  'Peloton 6': { primary: '#95a5a6', nameText: '#7f8c8d', photoBorder: '#95a5a6' },
  'Escadron 7': { primary: '#c1f0b4', nameText: '#9bcc85', photoBorder: '#c1f0b4' },
  'Peloton 7': { primary: '#c1f0b4', nameText: '#9bcc85', photoBorder: '#c1f0b4' },
  'Escadron 8': { primary: '#f1c40f', nameText: '#f39c12', photoBorder: '#f1c40f' },
  'Peloton 8': { primary: '#f1c40f', nameText: '#f39c12', photoBorder: '#f1c40f' },
  'Escadron 9': { primary: '#800020', nameText: '#6a001a', photoBorder: '#800020' },
  'Peloton 9': { primary: '#800020', nameText: '#6a001a', photoBorder: '#800020' },
  'Escadron 10': { primary: '#f5f5dc', nameText: '#dcdcdc', photoBorder: '#f5f5dc' },
  'Peloton 10': { primary: '#f5f5dc', nameText: '#dcdcdc', photoBorder: '#f5f5dc' },
  'default': { primary: '#bdc3c7', nameText: '#7f8c8d', photoBorder: '#bdc3c7' },
};

// ✅ Définitions SVG pour dégradés
const svgDefs = (
  <defs>
    <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style={{ stopColor: '#e74c3c' }} />
      <stop offset="100%" style={{ stopColor: '#c0392b' }} />
    </linearGradient>
    <filter id="nodeDropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="4"/>
      <feOffset dx="3" dy="3" result="offsetblur"/>
      <feFlood floodColor="#000" floodOpacity="0.2"/>
      <feComposite in2="offsetblur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
);

export default function OrgChartPage() {
  // ✅ États de gestion principal
  const [treeData, setTreeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedNodes, setHighlightedNodes] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ✅ États pour la recherche de cadres
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [availablePersonnel, setAvailablePersonnel] = useState([]);
  const [selectedCadre, setSelectedCadre] = useState(null);
  const [searchingPersonnel, setSearchingPersonnel] = useState(false);

  // ✅ Formulaire simplifié
  const [formData, setFormData] = useState({
    fonction: ''
  });

  const treeRef = useRef(null);
  const orgChartRef = useRef(null);

  // ✅ Chargement initial de l'organigramme
  useEffect(() => {
    fetchOrgChart();
  }, []);

  const fetchOrgChart = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/organigramme`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors du chargement de l\'organigramme');
      }

      const result = await response.json();
      setTreeData(result.data);
    } catch (error) {
      console.error('Erreur chargement organigramme:', error);
      alert('Erreur lors du chargement de l\'organigramme');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Recherche de personnel avec filtrage automatique
  const searchPersonnel = async (searchTerm, parentNode) => {
    if (!searchTerm || searchTerm.length < 2) {
      setAvailablePersonnel([]);
      return;
    }

    try {
      setSearchingPersonnel(true);

      // Déterminer le filtre basé sur le nœud parent
      let filterParams = '';
      if (parentNode) {
        if (parentNode.attributes?.type === 'Service') {
          filterParams = `&service=${encodeURIComponent(parentNode.name)}`;
        } else if (parentNode.attributes?.type === 'Escadron') {
          filterParams = `&escadronNumero=${parentNode.attributes?.numero}`;
        } else if (parentNode.attributes?.type === 'Peloton') {
          filterParams = `&escadronNumero=${parentNode.attributes?.escadronNumero}`;
        }
      }

      const response = await fetch(
        `${API_BASE_URL}/api/organigramme/cadres/available?search=${encodeURIComponent(searchTerm)}${filterParams}&limit=10`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur lors de la recherche');
      }

      const result = await response.json();
      setAvailablePersonnel(result.data || []);
    } catch (error) {
      console.error('Erreur recherche personnel:', error);
      setAvailablePersonnel([]);
    } finally {
      setSearchingPersonnel(false);
    }
  };

  // ✅ Gestionnaire de recherche avec debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (personnelSearch && selectedNode) {
        searchPersonnel(personnelSearch, selectedNode);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [personnelSearch, selectedNode]);

  // ✅ Fonction de rendu personnalisé des nœuds
  const renderCustomNodeElement = useCallback(({ nodeDatum, toggleNode }) => {
    if (!nodeDatum) return null;

    const hasChildren = nodeDatum.children || nodeDatum._children;
    const isCollapsed = nodeDatum.__rd3t && nodeDatum.__rd3t.collapsed;
    const isHighlighted = highlightedNodes.includes(nodeDatum.name);

    // Détermination des couleurs
    let colorKey = 'default';
    if (nodeDatum.attributes?.type === 'Ecole') {
      colorKey = 'Ecole';
    } else if (nodeDatum.attributes?.type === 'Escadron' && nodeDatum.attributes?.numero !== undefined) {
      colorKey = `Escadron ${nodeDatum.attributes.numero}`;
    } else if (nodeDatum.attributes?.type === 'Peloton' && nodeDatum.attributes?.escadronNumero !== undefined) {
      colorKey = `Peloton ${nodeDatum.attributes.escadronNumero}`;
    }

    const colors = customColors[colorKey] || customColors.default;

    // Dimensions des nœuds
    const nodeWidth = 300;
    const nodeHeight = 220;
    const photoSize = 70;
    const photoBorderWidth = 4;

    // Positions
    const rectX = -nodeWidth / 2;
    const rectY = -nodeHeight / 2;
    const photoX = -photoSize / 2;
    const photoY = rectY + 20;
    const photoBorderCircleCx = photoX + photoSize / 2;
    const photoBorderCircleCy = photoY + photoSize / 2;
    const photoBorderCircleR = photoSize / 2 + photoBorderWidth / 2;
    const textBlockX = rectX + 15;
    const textBlockY = photoY + photoSize + 15;
    const textBlockWidth = nodeWidth - 30;
    const textBlockHeight = rectY + nodeHeight - textBlockY - 10 - (hasChildren ? 40 : 10);
    const indicatorSize = 25;
    const indicatorX = -indicatorSize / 2;
    const indicatorY = rectY + nodeHeight - indicatorSize - 10;

    return (
      <g>
        {svgDefs}

        {/* Rectangle de fond avec effet de surbrillance */}
        <rect
          width={nodeWidth}
          height={nodeHeight}
          x={rectX}
          y={rectY}
          rx={10}
          ry={10}
          fill={isHighlighted ? "#fff3cd" : "#ffffff"}
          stroke={isHighlighted ? "#ffc107" : "#dddddd"}
          strokeWidth={isHighlighted ? "3" : "1"}
          filter="url(#nodeDropShadow)"
        />

        {/* ✅ Boutons d'édition en mode édition */}
        {editMode && !isExporting && (
          <g>
            {/* Bouton Ajouter enfant - Seulement pour les nœuds structurels */}
            {nodeDatum.attributes?.type !== 'Personne' && (
              <g
                onClick={() => handleAddChild(nodeDatum)}
                style={{ cursor: 'pointer' }}
                transform={`translate(${rectX + nodeWidth - 40}, ${rectY + 10})`}
              >
                <rect width="25" height="25" rx="3" fill="#007bff" />
                <foreignObject x="0" y="0" width="25" height="25">
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white' }}>
                    <FaPlus size={12} />
                  </div>
                </foreignObject>
              </g>
            )}

            {/* Bouton Supprimer */}
            {nodeDatum.attributes?.type !== 'Ecole' && (
              <g
                onClick={() => handleDeleteNode(nodeDatum)}
                style={{ cursor: 'pointer' }}
                transform={`translate(${rectX + nodeWidth - 10}, ${rectY + 10})`}
              >
                <rect width="25" height="25" rx="3" fill="#dc3545" />
                <foreignObject x="0" y="0" width="25" height="25">
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'white' }}>
                    <FaTrash size={12} />
                  </div>
                </foreignObject>
              </g>
            )}
          </g>
        )}

        {/* Bordure de photo */}
        <circle
          cx={photoBorderCircleCx}
          cy={photoBorderCircleCy}
          r={photoBorderCircleR}
          fill="none"
          stroke={colors.photoBorder}
          strokeWidth={photoBorderWidth}
        />

        {/* Photo de profil */}
        <foreignObject x={photoX} y={photoY} width={photoSize} height={photoSize}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            overflow: 'hidden',
            backgroundColor: '#e9ecef',
            boxSizing: 'border-box',
          }}>
            {nodeDatum.attributes?.imageUrl ? (
              <img
                src={nodeDatum.attributes.imageUrl}
                alt="profile"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '50%'
                }}
              />
            ) : (
              <FaUserCircle style={{ color: '#6c757d', fontSize: photoSize * 0.7 + 'px' }} />
            )}
          </div>
        </foreignObject>

        {/* Bloc de texte */}
        <foreignObject x={textBlockX} y={textBlockY} width={textBlockWidth} height={textBlockHeight}>
          <div style={{
            fontFamily: 'Arial, sans-serif',
            color: '#212529',
            fontSize: '14px',
            lineHeight: '1.3',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            height: '100%',
            alignItems: 'center',
            textAlign: 'center',
            paddingTop: '5px',
          }}>
            {/* Nom */}
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: colors.nameText,
              marginBottom: '3px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%'
            }}>
              {nodeDatum.name || 'Nom non défini'}
            </div>

            {/* Grade */}
            {nodeDatum.attributes?.grade && (
              <div style={{
                fontSize: '13px',
                color: '#6c757d',
                marginBottom: '3px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {nodeDatum.attributes.grade}
              </div>
            )}

            {/* Poste/Fonction */}
            {nodeDatum.attributes?.poste && (
              <div style={{
                fontSize: '12px',
                color: '#495057',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {nodeDatum.attributes.poste}
              </div>
            )}

            {/* Matricule pour les personnes */}
            {nodeDatum.attributes?.matricule && (
              <div style={{
                fontSize: '11px',
                color: '#6c757d',
                fontStyle: 'italic'
              }}>
                Mat: {nodeDatum.attributes.matricule}
              </div>
            )}
          </div>
        </foreignObject>

        {/* Indicateur de pliage */}
        {hasChildren && (
          <g onClick={toggleNode} style={{ cursor: 'pointer' }}>
            <circle
              cx={indicatorX + indicatorSize / 2}
              cy={indicatorY + indicatorSize / 2}
              r={indicatorSize / 2}
              fill="#ffffff"
              stroke="#cccccc"
              strokeWidth="1"
              filter="url(#nodeDropShadow)"
            />
            <foreignObject x={indicatorX} y={indicatorY} width={indicatorSize} height={indicatorSize}>
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: isCollapsed ? '#28a745' : '#dc3545',
                fontSize: indicatorSize * 0.8 + 'px',
              }}>
                {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
              </div>
            </foreignObject>
          </g>
        )}
      </g>
    );
  }, [editMode, highlightedNodes, isExporting]);

  // ✅ Gestionnaires d'événements
  const handleAddChild = (parentNode) => {
    setSelectedNode(parentNode);
    setFormData({
      fonction: ''
    });
    setPersonnelSearch('');
    setAvailablePersonnel([]);
    setSelectedCadre(null);
    setShowAddModal(true);
  };

  const handleDeleteNode = async (nodeDatum) => {
    if (!nodeDatum.attributes?.id) {
      alert('Impossible de supprimer ce nœud');
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${nodeDatum.name} de l'organigramme ?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/organigramme/node/${nodeDatum.attributes.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        if (!response.ok) {
          throw new Error('Erreur lors de la suppression');
        }

        // Recharger l'organigramme
        await fetchOrgChart();
        alert('Nœud supprimé avec succès');
      } catch (error) {
        console.error('Erreur suppression:', error);
        alert('Erreur lors de la suppression');
      }
    }
  };

  const handleSelectCadre = (cadre) => {
    setSelectedCadre(cadre);
    setPersonnelSearch(`${cadre.grade} ${cadre.prenom} ${cadre.nom}`);
    setAvailablePersonnel([]);
  };

  const handleAddPersonToOrg = async () => {
    if (!selectedCadre || !formData.fonction.trim()) {
      alert('Veuillez sélectionner un cadre et saisir sa fonction');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/organigramme/node/cadre`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          cadreId: selectedCadre.id,
          parentId: selectedNode.attributes?.id,
          fonction: formData.fonction
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de l\'ajout');
      }

      // Recharger l'organigramme
      await fetchOrgChart();
      setShowAddModal(false);
      alert('Cadre ajouté avec succès à l\'organigramme');
    } catch (error) {
      console.error('Erreur ajout cadre:', error);
      alert(`Erreur: ${error.message}`);
    }
  };

  // ✅ Fonction de recherche dans l'organigramme
  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setHighlightedNodes([]);
      return;
    }

    const searchInTree = (node, found = []) => {
      if (node.name && node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        found.push(node.name);
      }
      if (node.attributes?.grade && node.attributes.grade.toLowerCase().includes(searchTerm.toLowerCase())) {
        found.push(node.name);
      }
      if (node.attributes?.poste && node.attributes.poste.toLowerCase().includes(searchTerm.toLowerCase())) {
        found.push(node.name);
      }
      if (node.attributes?.matricule && node.attributes.matricule.toLowerCase().includes(searchTerm.toLowerCase())) {
        found.push(node.name);
      }
      if (node.children) {
        node.children.forEach(child => searchInTree(child, found));
      }
      return found;
    };

    const found = searchInTree(treeData);
    setHighlightedNodes([...new Set(found)]);
  };

  // ✅ Export PDF
  const handleExportPDF = async () => {
    setIsExporting(true);

    try {
      const toolbar = document.querySelector('.org-chart-toolbar');
      const originalDisplay = toolbar ? toolbar.style.display : '';
      if (toolbar) toolbar.style.display = 'none';

      const canvas = await html2canvas(orgChartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: orgChartRef.current.scrollWidth,
        height: orgChartRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);

      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 30;

      pdf.setFontSize(16);
      pdf.text('ORGANIGRAMME ÉCOLE DE LA GENDARMERIE NATIONALE AMBOSITRA', pdfWidth / 2, 20, { align: 'center' });

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      pdf.save('organigramme-egna.pdf');

      if (toolbar) toolbar.style.display = originalDisplay;

    } catch (error) {
      console.error('Erreur lors de l\'export PDF:', error);
      alert('Erreur lors de l\'export PDF');
    }

    setIsExporting(false);
  };

  // ✅ Export Word
  const handleExportWord = async () => {
    setIsExporting(true);

    try {
      const toolbar = document.querySelector('.org-chart-toolbar');
      const originalDisplay = toolbar ? toolbar.style.display : '';
      if (toolbar) toolbar.style.display = 'none';

      const canvas = await html2canvas(orgChartRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width: orgChartRef.current.scrollWidth,
        height: orgChartRef.current.scrollHeight
      });

      const imgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const arrayBuffer = await imgBlob.arrayBuffer();

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: arrayBuffer,
                  transformation: {
                    width: 600,
                    height: (canvas.height / canvas.width) * 600,
                  },
                }),
              ],
            }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'organigramme-egna.docx';
      link.click();
      URL.revokeObjectURL(url);

      if (toolbar) toolbar.style.display = originalDisplay;

    } catch (error) {
      console.error('Erreur lors de l\'export Word:', error);
      alert('Erreur lors de l\'export Word');
    }

    setIsExporting(false);
  };

  // ✅ Export des données JSON
  const handleExportData = () => {
    const dataStr = JSON.stringify(treeData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'organigramme-egna.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  // ✅ Configuration du conteneur
  const containerStyles = {
    width: '100%',
    height: isFullscreen ? '100vh' : 'calc(100vh - 250px)',
    border: '1px solid #dee2e6',
    backgroundColor: '#f0f0f0',
    borderRadius: isFullscreen ? '0' : '8px',
    overflow: 'hidden',
    position: isFullscreen ? 'fixed' : 'relative',
    top: isFullscreen ? '0' : 'auto',
    left: isFullscreen ? '0' : 'auto',
    zIndex: isFullscreen ? '9999' : 'auto',
  };

  const outerContainerStyles = {
    marginLeft: isFullscreen ? '0' : '0px',
    marginRight: isFullscreen ? '0' : '0px',
    paddingLeft: isFullscreen ? '0' : '15px',
    paddingRight: isFullscreen ? '0' : '15px',
    maxWidth: '100%',
  };

  const availableWidth = isFullscreen ? window.innerWidth : window.innerWidth - 100;
  const initialTranslate = {
    x: availableWidth / 2,
    y: 100
  };

  // ✅ Affichage avec gestion du loading
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '400px' }}>
        <div className="text-center">
          <FaSpinner className="fa-spin" size={40} color="#007bff" />
          <p className="mt-3">Chargement de l'organigramme...</p>
        </div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="text-center mt-5">
        <p>Aucune donnée d'organigramme disponible</p>
        <button className="btn btn-primary" onClick={fetchOrgChart}>
          Recharger
        </button>
      </div>
    );
  }

  return (
    <div className="org-chart-container" style={outerContainerStyles}>
      {/* ✅ Titre et barre de recherche EN HAUT - Cachés en plein écran */}
      {!isFullscreen && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h1 className="org-chart-title" style={{ fontSize: '20px', margin: '0', flex: '1' }}>
            ORGANIGRAMME ÉCOLE DE LA GENDARMERIE NATIONALE AMBOSITRA
          </h1>

          {/* Barre de recherche à droite */}
          <div className="input-group" style={{ width: '300px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Rechercher par nom, grade, poste, matricule..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="btn btn-outline-primary" onClick={handleSearch}>
              <FaSearch />
            </button>
          </div>
        </div>
      )}

      {/* ✅ BOUTON DE FERMETURE PLEIN ÉCRAN */}
      {isFullscreen && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 10001,
          backgroundColor: 'rgba(0,0,0,0.7)',
          borderRadius: '50%',
          width: '50px',
          height: '50px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'white',
          fontSize: '20px',
          transition: 'all 0.3s ease'
        }}
        onClick={() => setIsFullscreen(false)}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = 'rgba(220,53,69,0.8)';
          e.target.style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = 'rgba(0,0,0,0.7)';
          e.target.style.transform = 'scale(1)';
        }}
        title="Quitter le plein écran"
        >
          <FaTimes />
        </div>
      )}

      {/* ✅ TITRE EN PLEIN ÉCRAN */}
      {isFullscreen && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10001,
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px 20px',
          borderRadius: '25px',
          fontSize: '18px',
          fontWeight: 'bold',
          textAlign: 'center',
          maxWidth: '80%'
        }}>
          ORGANIGRAMME ÉCOLE DE LA GENDARMERIE NATIONALE AMBOSITRA
        </div>
      )}

      {/* ✅ Zone de l'organigramme */}
      <div ref={orgChartRef} style={containerStyles}>
        <Tree
          data={treeData}
          orientation="vertical"
          translate={initialTranslate}
          pathFunc="elbow"
          zoomable={true}
          collapsible={true}
          renderCustomNodeElement={renderCustomNodeElement}
          nodeSize={{ x: 350, y: 300 }}
          separation={{ siblings: 1.2, nonSiblings: 1.8 }}
          allowForeignObjects={true}
          ref={treeRef}
        />
      </div>

      {/* ✅ TOUS LES BOUTONS EN BAS - Cachés en plein écran */}
      {!isFullscreen && (
        <div className="org-chart-toolbar d-flex justify-content-center align-items-center mt-3 gap-2 flex-wrap p-3 bg-light border rounded">
          {/* Bouton Mode édition */}
          <button
            className={`btn ${editMode ? 'btn-success' : 'btn-warning'}`}
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? <FaSave /> : <FaEdit />}
            <span className="ms-1">{editMode ? 'Terminer l\'édition' : 'Mode édition'}</span>
          </button>

          {/* Bouton Plein écran */}
          <button
            className="btn btn-info"
            onClick={() => setIsFullscreen(true)}
          >
            <FaExpand />
            <span className="ms-1">Plein écran</span>
          </button>

          {/* Bouton Export PDF */}
          <button
            className="btn btn-danger"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <FaFilePdf />
            <span className="ms-1">Export PDF</span>
          </button>

          {/* Bouton Export Word */}
          <button
            className="btn btn-primary"
            onClick={handleExportWord}
            disabled={isExporting}
          >
            <FaFileWord />
            <span className="ms-1">Export Word</span>
          </button>

          {/* Bouton Export JSON */}
          <button
            className="btn btn-secondary"
            onClick={handleExportData}
            disabled={isExporting}
          >
            <FaDownload />
            <span className="ms-1">Export JSON</span>
          </button>

          {/* Indicateur d'export en cours */}
          {isExporting && (
            <div className="d-flex align-items-center text-info">
              <div className="spinner-border spinner-border-sm me-2" role="status">
                <span className="visually-hidden">Chargement...</span>
              </div>
              <span>Export en cours...</span>
            </div>
          )}
        </div>
      )}

      {/* ✅ Modal d'ajout SIMPLIFIÉ - Recherche par matricule/nom avec filtrage intelligent */}
      {showAddModal && (
        <div className="modal fade show" style={{
          display: 'block',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 10000
        }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <FaPlus className="me-2" />
                  Ajouter un cadre sous {selectedNode?.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body">
                <div className="alert alert-info">
                  <i className="fas fa-info-circle me-2"></i>
                  Recherchez un cadre par <strong>nom</strong>, <strong>prénom</strong>, <strong>grade</strong> ou <strong>matricule</strong>
                  {selectedNode && selectedNode.attributes?.type && (
                    <span> - Filtré automatiquement pour <strong>{selectedNode.name}</strong></span>
                  )}
                </div>

                <form>
                  {/* ✅ Recherche de personnel */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      <FaSearch className="me-1" />
                      Rechercher un cadre *
                    </label>
                    <div className="position-relative">
                      <input
                        type="text"
                        className="form-control"
                        value={personnelSearch}
                        onChange={(e) => setPersonnelSearch(e.target.value)}
                        placeholder="Tapez nom, prénom, grade ou matricule..."
                        autoFocus
                      />
                      {searchingPersonnel && (
                        <div className="position-absolute top-50 end-0 translate-middle-y me-3">
                          <FaSpinner className="fa-spin" />
                        </div>
                      )}
                    </div>

                    {/* ✅ Liste des résultats */}
                    {availablePersonnel.length > 0 && (
                      <div className="mt-2 border rounded" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                        {availablePersonnel.map((cadre) => (
                          <div
                            key={cadre.id}
                            className={`p-2 cursor-pointer border-bottom ${selectedCadre?.id === cadre.id ? 'bg-primary text-white' : ''}`}
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleSelectCadre(cadre)}
                            onMouseEnter={(e) => {
                              if (selectedCadre?.id !== cadre.id) {
                                e.target.style.backgroundColor = '#f8f9fa';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (selectedCadre?.id !== cadre.id) {
                                e.target.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            <div className="d-flex align-items-center">
                              {cadre.photo_url ? (
                                <img
                                  src={cadre.photo_url}
                                  alt="Profile"
                                  className="rounded-circle me-2"
                                  style={{ width: '40px', height: '40px', objectFit: 'cover' }}
                                />
                              ) : (
                                <FaUserCircle size={40} className="text-muted me-2" />
                              )}
                              <div>
                                <div className="fw-bold">{cadre.nomComplet}</div>
                                <small className={selectedCadre?.id === cadre.id ? 'text-light' : 'text-muted'}>
                                  Mat: {cadre.matricule} | {cadre.fonction || 'Aucune fonction'}
                                  {cadre.escadron && ` | ${cadre.escadron}`}
                                </small>
                                {cadre.statut_absence !== 'Présent' && (
                                  <span className="badge bg-warning text-dark ms-1">
                                    {cadre.statut_absence}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {personnelSearch && !searchingPersonnel && availablePersonnel.length === 0 && (
                      <div className="text-muted mt-2">
                        <small>Aucun cadre trouvé pour "{personnelSearch}"</small>
                      </div>
                    )}
                  </div>

                  {/* ✅ Affichage du cadre sélectionné */}
                  {selectedCadre && (
                    <div className="mb-3">
                      <label className="form-label fw-bold text-success">
                        Cadre sélectionné
                      </label>
                      <div className="card">
                        <div className="card-body p-3">
                          <div className="d-flex align-items-center">
                            {selectedCadre.photo_url ? (
                              <img
                                src={selectedCadre.photo_url}
                                alt="Profile"
                                className="rounded-circle me-3"
                                style={{ width: '60px', height: '60px', objectFit: 'cover' }}
                              />
                            ) : (
                              <FaUserCircle size={60} className="text-muted me-3" />
                            )}
                            <div>
                              <h6 className="mb-1">{selectedCadre.nomComplet}</h6>
                              <div className="text-muted">
                                <small>Matricule: {selectedCadre.matricule}</small><br />
                                <small>Fonction actuelle: {selectedCadre.fonction || 'Non définie'}</small>
                                {selectedCadre.escadron && (
                                  <>
                                    <br />
                                    <small>Escadron: {selectedCadre.escadron}</small>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ✅ Fonction dans l'organigramme */}
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      Fonction dans l'organigramme *
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.fonction}
                      onChange={(e) => setFormData({ ...formData, fonction: e.target.value })}
                      placeholder="Ex: Commandant d'escadron, Chef de peloton, Instructeur..."
                      disabled={!selectedCadre}
                    />
                    <div className="form-text">
                      Cette fonction sera affichée dans l'organigramme (peut être différente de sa fonction administrative)
                    </div>
                  </div>
                </form>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  <FaTimes className="me-1" />
                  Annuler
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleAddPersonToOrg}
                  disabled={!selectedCadre || !formData.fonction.trim()}
                >
                  <FaPlus className="me-1" />
                  Ajouter à l'organigramme
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}