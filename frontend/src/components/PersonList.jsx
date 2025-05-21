import React from 'react';
import PropTypes from 'prop-types';
import 'bootstrap/dist/css/bootstrap.min.css';

/**
 * Composant OrgChartNode - Affiche un nœud individuel sous forme de carte
 * Ce composant peut être utilisé pour les cadres.
 */
const OrgChartNode = ({ node, category }) => {
  if (!node) {
    console.warn("OrgChartNode a reçu une prop 'node' invalide");
    return null;
  }

  // Fonction pour extraire les valeurs avec fallback
  const getValue = (keys, fallback = '-') => {
    for (const key of keys) {
      if (node[key] !== undefined && node[key] !== null && node[key] !== '') {
        return node[key];
      }
    }
    return fallback;
  };

  // Déterminer les valeurs pour un cadre
  // La catégorie est maintenant implicitement 'cadre' pour ce composant après la suppression des élèves
  const name = getValue(['nom_complet', 'name', 'prenom_nom'], 'Nom inconnu');
  const grade = getValue(['grade', 'grade_actuel', 'position']);
  const photo = getValue(['photo', 'photo_url', 'imageUrl']);
  const entity = getValue(['entite', 'entity', 'service', 'escadron']); // escadron pourrait être un champ pertinent pour l'entité si applicable

  return (
    <div className="org-node card h-100" style={{
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      transition: 'transform 0.2s',
      ':hover': {
        transform: 'scale(1.02)'
      }
    }}>
      <div className="card-body text-center">
        {photo && (
          <img
            src={photo}
            alt={`Photo de ${name}`}
            className="rounded-circle mb-3"
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'cover',
              border: '2px solid #dee2e6'
            }}
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
        <h5 className="card-title">{name}</h5>
        {grade && <p className="card-text text-muted">{grade}</p>}
        {entity && <p className="card-text"><small>{entity}</small></p>}
      </div>
    </div>
  );
};

/**
 * Composant PersonList - Affiche les données des cadres sous forme de tableau OU de cartes
 * La gestion des "élèves" a été supprimée.
 */
function PersonList({ listTitle, data = [], displayMode = 'table' }) { // 'category' retiré des props
  if (!data || data.length === 0) {
    return null;
  }

  // Configuration des colonnes pour les cadres (simplifiée car une seule catégorie)
  const tableConfig = {
    headers: ['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Entité', 'Service', 'Statut', 'Motif', 'Dernière Maj. Statut'],
    fields: ['grade', 'nom', 'prenom', 'matricule', 'entite', 'service', 'statut_absence', 'motif_absence', 'timestamp_derniere_maj_statut']
  };

  // Rendu en mode tableau
  if (displayMode === 'table') {
    return (
      <div className="table-responsive mt-4">
        {listTitle && <h4 className="mb-3">{listTitle}</h4>}
        <table className="table table-striped table-bordered table-hover">
          <thead className="thead-dark">
            <tr>
              {tableConfig.headers.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={item.id || index}>
                <td>{index + 1}</td>
                {tableConfig.fields.map((field, fieldIndex) => {
                  if (field === 'timestamp_derniere_maj_statut') { // Gérer le champ de timestamp
                    const date = item[field] ? new Date(item[field]) : null;
                    return (
                      <td key={fieldIndex}>
                        {date ? date.toLocaleString('fr-FR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          // Vous pouvez ajouter le fuseau horaire si nécessaire, ex: timeZone: 'Africa/Antananarivo'
                        }) : '-'}
                      </td>
                    );
                  }
                  // Pas besoin de gérer 'escadron' ici puisque nous sommes pour les cadres
                  return <td key={fieldIndex}>{item[field] || '-'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Rendu en mode cartes
  return (
    <div className="mt-4">
      {listTitle && <h4 className="mb-3">{listTitle}</h4>}
      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4">
        {data.map((item, index) => (
          <div key={item.id || index} className="col">
            {/* La prop 'category' n'est plus nécessaire ici pour OrgChartNode */}
            <OrgChartNode node={item} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Validation des props - 'category' est retiré car le composant gère uniquement les cadres
PersonList.propTypes = {
  listTitle: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.object),
  displayMode: PropTypes.oneOf(['table', 'cards'])
};

// Correction de l'avertissement defaultProps en utilisant les paramètres par défaut dans la fonction
// Les defaultProps statiques ne sont plus nécessaires et doivent être supprimés.
/*
PersonList.defaultProps = {
  data: [],
  displayMode: 'table'
};
*/

export default PersonList;