import React from 'react';
import PropTypes from 'prop-types';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2'; // Importez SweetAlert2 ici


const OrgChartNode = ({ node }) => { // 'category' retiré des props car ce composant est pour les cadres
    if (!node) {
        console.warn("OrgChartNode a reçu une prop 'node' invalide");
        return null;
    }

    // Fonction pour extraire les valeurs avec fallback, gérant les noms de clés potentiels
    const getValue = (keys, fallback = '-') => {
        for (const key of keys) {
            if (node[key] !== undefined && node[key] !== null && node[key] !== '') {
                return node[key];
            }
        }
        return fallback;
    };

    // Déterminer les valeurs pour un cadre
    const name = getValue(['nom_complet', 'name', 'prenom_nom', 'prenom', 'nom'], 'Nom inconnu'); // Ajout de 'prenom' et 'nom'
    const grade = getValue(['grade', 'grade_actuel', 'position']);
    const photo = getValue(['photo', 'photo_url', 'imageUrl']);
    const entity = getValue(['entite', 'entity', 'service', 'escadron']); // escadron est pertinent si vos données cadres peuvent l'inclure comme une "entité"

    return (
        <div className="org-node card h-100" style={{
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s',

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
                        // Masquer l'image si elle ne se charge pas
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

// Validation des props pour OrgChartNode
OrgChartNode.propTypes = {
    node: PropTypes.object.isRequired,
};


function PersonList({ listTitle, data = [], displayMode = 'table' }) {
    if (!data || data.length === 0) {
        return null; // Retourne null si aucune donnée, ce qui est géré en amont dans HomePage
    }

    // Fonction pour afficher les détails d'une personne via SweetAlert2
    const showPersonDetails = (person) => {
        // Préparer les données pour l'affichage
        const grade = person.grade || 'N/A';
        const nom = person.nom || 'N/A';
        const prenom = person.prenom || 'N/A';
        const service = person.service || 'N/A';
        const telephone = person.telephone || 'N/A';
        const photoUrl = person.photoUrl || 'https://via.placeholder.com/150/0000FF/FFFFFF?text=No+Image'; // Image par défaut plus grande

        // Utilisation du champ 'mise_a_jour_par' pour le nom de l'utilisateur
        const miseAJourPar = person.mise_a_jour_par || 'Inconnu';

        // Utilisation du champ 'timestamp_derniere_maj_statut' pour la date et l'heure
        let dateMiseAJour = 'N/A';
        if (person.timestamp_derniere_maj_statut) {
            const date = new Date(person.timestamp_derniere_maj_statut);
            if (!isNaN(date)) { // Vérifier si la date est valide
                dateMiseAJour = date.toLocaleString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    // second: '2-digit', // Décommentez si vous voulez les secondes
                    // timeZone: 'Africa/Antananarivo' // Activez si nécessaire
                });
            }
        }

        Swal.fire({
            title: `<h5 style="margin-bottom: 0;">Détails du Personnel</h5>`,
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; text-align: left; padding: 10px;">
                    <a href="${photoUrl}" target="_blank" rel="noopener noreferrer" style="cursor: zoom-in;">
                        <img src="${photoUrl}" alt="Photo de ${prenom} ${nom}"
                             style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover;
                                    margin-bottom: 15px; border: 3px solid #007bff; cursor: zoom-in;">
                    </a>
                    <p style="margin: 5px 0;"><strong>Grade:</strong> ${grade}</p>
                    <p style="margin: 5px 0;"><strong>Nom:</strong> ${nom}</p>
                    <p style="margin: 5px 0;"><strong>Prénom:</strong> ${prenom}</p>
                    <p style="margin: 5px 0;"><strong>Service:</strong> ${service}</p>
                    <p style="margin: 5px 0;"><strong>Téléphone:</strong> ${telephone}</p>
                    <p style="margin: 5px 0; font-size: 0.9em; color: #555;">
                        <small>Mis à jour par: ${miseAJourPar}</small><br/>
                        <small>Le: ${dateMiseAJour}</small>
                    </p>
                </div>
            `,
            icon: 'info',
            showCloseButton: true,
            focusConfirm: false,
            confirmButtonText: 'Fermer',
            customClass: {
                container: 'swal2-container',
                popup: 'swal2-popup',
                header: 'swal2-header',
                title: 'swal2-title',
                closeButton: 'swal2-close-button',
                content: 'swal2-content',
                actions: 'swal2-actions',
                confirmButton: 'swal2-confirm',
                cancelButton: 'swal2-cancel',
                footer: 'swal2-footer'
            }
        });
    };

    // Configuration des colonnes pour les cadres (ajout de la colonne Actions)
    const tableConfig = {
        headers: ['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Entité', 'Service', 'Statut', 'Motif', 'Dernière Maj. Statut', 'Actions'], // Ajout de 'Actions'
        // Assurez-vous que ces noms de champs correspondent exactement à vos données
        fields: ['grade', 'nom', 'prenom', 'matricule', 'entite', 'service', 'statut_absence', 'motif_absence', 'timestamp_derniere_maj_statut']
    };

    // Rendu en mode tableau
    if (displayMode === 'table') {
        return (
            // La classe 'table-responsive' de Bootstrap gère le défilement horizontal sur petits écrans.
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
                            // Utilisation d'un ID unique si disponible, sinon l'index (moins idéal pour les listes dynamiques)
                            <tr key={item.id || item.matricule || index}>
                                <td>{index + 1}</td>
                                {tableConfig.fields.map((field, fieldIndex) => {
                                    if (field === 'timestamp_derniere_maj_statut') { // Formatage du timestamp pour le tableau
                                        const date = item[field] ? new Date(item[field]) : null;
                                        return (
                                            <td key={fieldIndex}>
                                                {date && !isNaN(date) ? date.toLocaleString('fr-FR', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                    // timeZone: 'Africa/Antananarivo' // Activez si vous avez besoin d'un fuseau horaire spécifique
                                                }) : '-'}
                                            </td>
                                        );
                                    }
                                    // Affichage des autres champs, avec '-' si la valeur est nulle/vide
                                    return <td key={fieldIndex}>{item[field] || '-'}</td>;
                                })}
                                {/* Nouvelle colonne pour le bouton Détails */}
                                <td>
                                    <button
                                        className="btn btn-info btn-sm"
                                        onClick={() => showPersonDetails(item)}
                                    >
                                        Détails
                                    </button>
                                </td>
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
                    <div key={item.id || item.matricule || index} className="col">
                        <OrgChartNode node={item} /> {/* Appel à OrgChartNode sans la prop 'category' */}
                    </div>
                ))}
            </div>
        </div>
    );
}

// Validation des props pour PersonList
PersonList.propTypes = {
    listTitle: PropTypes.string,
    data: PropTypes.arrayOf(PropTypes.object),
    displayMode: PropTypes.oneOf(['table', 'cards'])
};

export default PersonList;