// src/pages/OrgChartPage.jsx
import React from 'react';
import Tree from 'react-d3-tree';
import { FaUserCircle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
// Assurez-vous que vos données orgChartData.js existent et exportent correctement un objet ou un tableau avec la structure attendue par react-d3-tree.
// Les nœuds doivent avoir une propriété 'name' et optionnellement 'children', '_children', et 'attributes'.
// L'objet attributes doit contenir type, numero/escadronNumero, nom, grade, poste, imageUrl etc. si vous les utilisez.
import orgChartData from '../data/orgChartData';
import 'bootstrap/dist/css/bootstrap.min.css';
// import '../styles/OrgChart.css'; // <- Cette ligne a été retirée car le fichier n'est pas trouvé.

// --- Définitions des couleurs et dégradés par type et numéro ---
// Utilisation de couleurs plus standard et un dégradé simple pour l'exemple
const customColors = {
    // Couleurs pour l'École (par défaut si pas d'Escadron/Peloton spécifié)
    'Ecole': { primary: '#bdc3c7', nameText: '#7f8c8d', photoBorder: '#bdc3c7' }, // Gris clair par défaut

    // 1er Escadron (Dégradé Rouge) et ses Pelotons (Rouge Uni - assumant "marron" était lié au rouge)
    'Escadron 1': { primary: 'url(#redGradient)', nameText: '#c0392b', photoBorder: 'url(#redGradient)' }, // Utilise le dégradé
    'Peloton 1': { primary: '#e74c3c', nameText: '#c0392b', photoBorder: '#e74c3c' }, // Rouge Uni

    // 3e Escadron (Vert) et ses Pelotons
    'Escadron 3': { primary: '#2ecc71', nameText: '#27ae60', photoBorder: '#2ecc71' },
    'Peloton 3': { primary: '#2ecc71', nameText: '#27ae60', photoBorder: '#2ecc71' },

    // 4e Escadron (Bleu) et ses Pelotons
    'Escadron 4': { primary: '#3498db', nameText: '#2980b9', photoBorder: '#3498db' },
    'Peloton 4': { primary: '#3498db', nameText: '#2980b9', photoBorder: '#3498db' },

    // 5e Escadron (Violet) et ses Pelotons
    'Escadron 5': { primary: '#9b59b6', nameText: '#8e44ad', photoBorder: '#9b59b6' },
    'Peloton 5': { primary: '#9b59b6', nameText: '#8e44ad', photoBorder: '#9b59b6' },

    // 6e Escadron (Gris) et ses Pelotons
    'Escadron 6': { primary: '#95a5a6', nameText: '#7f8c8d', photoBorder: '#95a5a6' },
    'Peloton 6': { primary: '#95a5a6', nameText: '#7f8c8d', photoBorder: '#95a5a6' },

    // 7e Escadron (Vert Fluorescent/Pastel) et ses Pelotons
    'Escadron 7': { primary: '#c1f0b4', nameText: '#9bcc85', photoBorder: '#c1f0b4' }, // Ajusté pour être moins agressif
    'Peloton 7': { primary: '#c1f0b4', nameText: '#9bcc85', photoBorder: '#c1f0b4' },

    // 8e Escadron (Jaune) et ses Pelotons
    'Escadron 8': { primary: '#f1c40f', nameText: '#f39c12', photoBorder: '#f1c40f' },
    'Peloton 8': { primary: '#f1c40f', nameText: '#f39c12', photoBorder: '#f1c40f' },

    // 9e Escadron (Grenat) et ses Pelotons
    'Escadron 9': { primary: '#800020', nameText: '#6a001a', photoBorder: '#800020' },
    'Peloton 9': { primary: '#800020', nameText: '#6a001a', photoBorder: '#800020' },

    // 10e Escadron (Beige/Crème) et ses Pelotons
    'Escadron 10': { primary: '#f5f5dc', nameText: '#dcdcdc', photoBorder: '#f5f5dc' }, // Beige plus clair
    'Peloton 10': { primary: '#f5f5dc', nameText: '#dcdcdc', photoBorder: '#f5f5dc' },

    // Couleur par défaut si le type ou le numéro n'est pas reconnu
    'default': { primary: '#bdc3c7', nameText: '#7f8c8d', photoBorder: '#bdc3c7' },
};


// Définitions SVG pour les dégradés et filtres.
// Ces définitions doivent être placées *dans* l'élément SVG principal du Tree,
// mais react-d3-tree ne fournit pas de prop directe pour cela.
// Une solution courante est de les inclure dans le premier nœud rendu
// ou de les ajouter manuellement à l'élément SVG créé par react-d3-tree
// après le rendu initial (ce qui est plus complexe).
// Pour simplifier, nous les incluons ici dans le renderCustomNodeElement,
// mais cela signifie qu'elles seront redéfinies pour chaque nœud (inefficace
// mais fonctionnel pour les petits/moyens arbres). Une meilleure approche
// pour les grands arbres serait d'ajouter ces <defs> une seule fois au SVG racine.
// Puisque react-d3-tree gère le SVG, l'inclure ici est une astuce.
const svgDefs = (
  <defs>
    {/* Dégradé Rouge pour le 1er Escadron */}
    <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style={{ stopColor: '#e74c3c' }} /> {/* Rouge vif */}
      <stop offset="100%" style={{ stopColor: '#c0392b' }} /> {/* Rouge plus foncé */}
    </linearGradient>

    {/* Filtre d'Ombre Portée légère */}
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


const renderCustomNodeElement = ({ nodeDatum, toggleNode }) => {
  // Vérifier si nodeDatum existe et a une structure de base attendue
  if (!nodeDatum) {
      console.error("nodeDatum is undefined or null for a node.", nodeDatum);
      return null; // Rendre quelque chose de vide ou un message d'erreur simple si les données sont corrompues
  }

  const hasChildren = nodeDatum.children || nodeDatum._children;
  const isCollapsed = nodeDatum.__rd3t && nodeDatum.__rd3t.collapsed;

  // --- Déterminer la couleur basée sur le type et le numéro ---
  let colorKey = 'default'; // Clé de couleur par défaut

  if (nodeDatum.attributes?.type === 'Ecole') {
      colorKey = 'Ecole';
  } else if (nodeDatum.attributes?.type === 'Escadron' && nodeDatum.attributes?.numero !== undefined) {
      // Assurez-vous que numero est bien un nombre ou une chaîne correspondante dans customColors
      colorKey = `Escadron ${nodeDatum.attributes.numero}`;
  } else if (nodeDatum.attributes?.type === 'Peloton' && nodeDatum.attributes?.escadronNumero !== undefined) {
      // Assurez-vous que escadronNumero est bien un nombre ou une chaîne correspondante
      colorKey = `Peloton ${nodeDatum.attributes.escadronNumero}`;
  }

  const colors = customColors[colorKey] || customColors.default; // Obtenir les couleurs, fallback au défaut


  // --- Dimensions et Positions des éléments du nœud ---
  // Augmentation de la taille du rectangle pour plus d'espace
  const nodeWidth = 300; // Augmenté de 250
  const nodeHeight = 220; // Augmenté de 180
  const nodeRx = 10; // Rayon des coins arrondis
  const nodeRy = 10;

  // Rectangle de fond
  const rectWidth = nodeWidth;
  const rectHeight = nodeHeight;
  const rectX = -rectWidth / 2; // Centré sur X
  const rectY = -rectHeight / 2; // Centré sur Y

  // Photo
  const photoSize = 70;
  const photoBorderWidth = 4; // Épaisseur de la bordure

  // --- Calcul des positions pour le layout centré verticalement avec photo en haut ---
  // La photo sera plus haute, utilisant le bord supérieur
   const photoX = -photoSize / 2; // Centré sur X par rapport au centre du nœud (0,0)
   const photoY = rectY + 20; // Petit padding supérieur pour la photo

   // Le cercle de bordure de la photo est centré sur la photo
   const photoBorderCircleCx = photoX + photoSize / 2;
   const photoBorderCircleCy = photoY + photoSize / 2;
   const photoBorderCircleR = photoSize / 2 + photoBorderWidth / 2;

  // Le bloc de texte sera en dessous de la photo
   const textBlockX = rectX + 15; // 15px de padding gauche
   const textBlockY = photoY + photoSize + 15; // Espace en dessous de la photo
   const textBlockWidth = rectWidth - 30; // 15px de padding gauche et 15px de padding droit
   const textBlockHeight = rectY + rectHeight - textBlockY - 10 - (hasChildren ? 40 : 10); // Hauteur restante moins padding bas et espace indicateur si présent

    // Position de l'indicateur de pliage (commun aux deux layouts)
    const indicatorSize = 25;
    const indicatorX = -indicatorSize / 2; // Centré sur X
    const indicatorY = rectY + rectHeight - indicatorSize - 10; // 10px du bas du rectangle


  return (
    // Le clic principal pour plier/déplier est géré par le groupe de l'indicateur
    <g>
      {/* Inclure les définitions SVG. Note: Ceci est redondant pour chaque nœud.
         Une meilleure approche serait de les ajouter une seule fois au SVG racine
         si react-d3-tree le permettait plus facilement. */}
      {svgDefs}

      {/* Rectangle de fond arrondi avec ombre portée */}
      <rect
        width={rectWidth}
        height={rectHeight}
        x={rectX}
        y={rectY}
        rx={nodeRx}
        ry={nodeRy}
        fill="#ffffff" // Fond blanc
        stroke="#dddddd" // Bordure gris clair
        strokeWidth="1"
        filter="url(#nodeDropShadow)" // Appliquer l'ombre portée
      />

       {/* Bordure de photo en cercle SVG (pour la couleur/dégradé spécifique) */}
       {/* Utilise la couleur/dégradé déterminé par la logique ci-dessus */}
       <circle
           cx={photoBorderCircleCx} // Centre X du cercle
           cy={photoBorderCircleCy} // Centre Y du cercle
           r={photoBorderCircleR} // Rayon incluant l'épaisseur de la bordure
           fill="none" // Pas de remplissage
           stroke={colors.photoBorder} // Appliquer la couleur/dégradé déterminé
           strokeWidth={photoBorderWidth} // Épaisseur du contour
       />


      {/* Image/Icône de profil (dans un foreignObject pour le contenu HTML) */}
      <foreignObject
        x={photoX}
        y={photoY}
        width={photoSize}
        height={photoSize}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          borderRadius: '50%', // Rendre circulaire
          overflow: 'hidden', // Cacher ce qui dépasse du cercle
          backgroundColor: '#e9ecef', // Fond très léger pour l'icône si pas d'image
          boxSizing: 'border-box', // Inclure padding/border dans la taille
        }}>
           {/* Afficher l'image si URL disponible, sinon l'icône par défaut */}
           {nodeDatum.attributes?.imageUrl ? (
             <img
               src={nodeDatum.attributes.imageUrl}
               alt="profile"
               style={{
                 width: '100%',
                 height: '100%',
                 objectFit: 'cover', // Couvrir la zone sans déformer
                 borderRadius: '50%' // S'assurer que l'image elle-même est aussi circulaire
               }}
             />
           ) : (
              // Utiliser FaUserCircle si pas d'image URL
              <FaUserCircle style={{ color: '#6c757d', fontSize: photoSize * 0.7 + 'px' }} />
            )
           }
        </div>
      </foreignObject>


      {/* Bloc de texte (Nom, Grade, Poste, Description) */}
      {/* Positionné en dessous de la photo et centré */}
      <foreignObject
        x={textBlockX}
        y={textBlockY}
        width={textBlockWidth}
        height={textBlockHeight}
      >
        <div style={{
          fontFamily: 'Arial, sans-serif',
          color: '#212529', // Couleur de texte par défaut
          fontSize: '14px',
          lineHeight: '1.3', // Augmenté légèrement l'interligne
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start', // Aligner en haut
          height: '100%',
          alignItems: 'center', // Centrer horizontalement le contenu du bloc de texte
          textAlign: 'center', // Centrer le texte
          paddingTop: '5px', // Petit padding en haut du bloc de texte
        }}>
          {/* Nom (Nom principal du nœud - peut être "Nom de l'Escadron" ou "Nom du Peloton") */}
          {/* La couleur est appliquée directement en CSS selon la logique de couleur */}
          {nodeDatum.name && (
            <div style={{
                fontWeight: 'bold',
                fontSize: '15px',
                textTransform: nodeDatum.attributes?.type === 'Ecole' ? 'uppercase' : 'none', // Nom École en majuscules, autres non
                color: colors.nameText, // Couleur déterminée par la logique
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
            }}>
              {nodeDatum.name}
            </div>
          )}
           {/* Nom Complet de la personne (si applicable, ex: pour Pelotons) */}
            {/* Assumant que le nom de la personne est dans attributes.nom */}
            {nodeDatum.attributes?.nom && (
                 <div style={{
                     fontSize: '14px',
                     color: '#212529',
                     whiteSpace: 'nowrap',
                     overflow: 'hidden',
                     textOverflow: 'ellipsis',
                 }}>
                    {nodeDatum.attributes.nom}
                 </div>
            )}
           {/* Grade (si existe) */}
           {nodeDatum.attributes?.grade && (
             <div style={{ fontSize: '12px', color: '#495057', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
               {nodeDatum.attributes.grade}
             </div>
          )}
          {/* Poste (si existe) */}
           {nodeDatum.attributes?.poste && (
             <div style={{ fontSize: '12px', color: '#495057', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
               {nodeDatum.attributes.poste}
             </div>
          )}
          {/* Si une description courte était nécessaire, elle irait ici */}
        </div>
      </foreignObject>


      {/* Indicateur de pliage (positionné en bas centré) */}
      {hasChildren && (
        <g
          onClick={toggleNode} // Le clic est sur ce groupe G
          style={{ cursor: 'pointer' }}
        >
          {/* Cercle de fond pour l'indicateur */}
           <circle
              cx={indicatorX + indicatorSize / 2}
              cy={indicatorY + indicatorSize / 2}
              r={indicatorSize / 2}
              fill="#ffffff" // Fond blanc
              stroke="#cccccc" // Bordure gris clair
              strokeWidth="1"
              filter="url(#nodeDropShadow)" // Ombre légère
           />
          {/* Icône à l'intérieur (dans un foreignObject) */}
          <foreignObject
            x={indicatorX}
            y={indicatorY}
            width={indicatorSize}
            height={indicatorSize}
          >
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              color: isCollapsed ? '#28a745' : '#dc3545', // Vert si plié, Rouge si déplié
              fontSize: indicatorSize * 0.8 + 'px',
            }}>
              {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
};

// --- Composant principal de la page ---
export default function OrgChartPage() {
  // Define a variable for sidebar width for easier adjustment
  const sidebarWidth = 80; // Adjust this value to the actual width of your sidebar(s)

  const containerStyles = {
    width: '100%', // This width is of the container holding the tree visualization
    height: 'calc(100vh - 150px)', // Utilise calc pour une meilleure adaptation
    border: '1px solid #dee2e6',
    backgroundColor: '#f0f0f0', // Fond gris très clair
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
  };

  // Styles for the outer container div to manage margins from sidebars
  const outerContainerStyles = {
    marginLeft: `${sidebarWidth}px`, // Margin on the left for the left sidebar
    marginRight: `${sidebarWidth}px`, // Margin on the right for a potential right sidebar
    // Add padding if needed, but Bootstrap's container-fluid usually handles horizontal padding
    paddingLeft: '15px',
    paddingRight: '15px',
  };


  // Ajuster la translation initiale pour centrer l'arbre horizontalement dans l'espace disponible
  // Prend en compte la largeur totale de l'écran moins les marges des sidebars.
  const availableWidth = window.innerWidth - (sidebarWidth * 2); // Total width minus left and right margins
  const initialTranslate = { x: availableWidth / 2 + sidebarWidth, y: 100 }; // Center in available space and offset by left sidebar


  return (
    // Appliquer les styles de marge sur le div extérieur
    <div className="container-fluid mt-4" style={outerContainerStyles}>
      {/* Diminution de la taille du titre */}
      <h1 className="mb-4 text-center" style={{ fontSize: '24px' }}>ORGANIGRAMME ÉCOLE DE LA GENDARMERIE NATIONALE AMBOSITRA</h1>

      <div style={containerStyles}> {/* L'inner div maintient les styles de la boîte de l'arbre */}
        <Tree
          data={orgChartData} // Vos données d'organigramme
          orientation="vertical"
          translate={initialTranslate} // Position de départ
          pathFunc="elbow" // Lignes coudées
          zoomable={true}
          collapsible={true}
          renderCustomNodeElement={renderCustomNodeElement} // Notre composant de nœud personnalisé
          // Ajuster la nodeSize et separation pour l'espacement
          // Augmenté pour correspondre à la nouvelle taille des nœuds
          nodeSize={{ x: 350, y: 300}} // Ajustez ces valeurs pour contrôler l'espacement
          separation={{ siblings: 1.2, nonSiblings: 1.8 }} // Ajustez ces valeurs si nécessaire pour l'espacement horizontal
          allowForeignObjects={true} // Nécessaire pour les foreignObjects
          // Pour personnaliser les connecteurs (lignes), vous auriez besoin de linkComponent ici
          // linkComponent={CustomLinkComponent} // Exemple si vous créez CustomLinkComponent
        />
        {/* Inclure les définitions SVG ici si possible pour ne pas les dupliquer par nœud.
         Actuellement, elles sont dans renderCustomNodeElement par commodité. */}
      </div>
       {/* Un espace réservé pour les définitions SVG si on voulait les sortir du nœud
        <svg style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0 }}>
          {svgDefs}
        </svg>
        */}
    </div>
  );
}