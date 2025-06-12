import React from 'react';
import PropTypes from 'prop-types';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';

// ✅ FONCTION POUR CONSTRUIRE L'URL DE LA PHOTO
const getPhotoUrl = (photo) => {
    if (!photo) return null;

    // Si c'est déjà une URL complète
    if (photo.startsWith('http')) return photo;

    // Si c'est un chemin local, construire l'URL complète
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

    // Si le chemin commence par /uploads/, utiliser directement
    if (photo.startsWith('/uploads/')) {
        return `${API_BASE_URL.replace(/\/$/, '')}${photo}`;
    }

    // Sinon, ajouter le préfixe /uploads/
    return `${API_BASE_URL.replace(/\/$/, '')}/uploads/${photo}`;
};

const OrgChartNode = ({ node }) => {
    if (!node) {
        console.warn("OrgChartNode a reçu une prop 'node' invalide");
        return null;
    }

    const getValue = (keys, fallback = '-') => {
        for (const key of keys) {
            if (node[key] !== undefined && node[key] !== null && node[key] !== '') {
                return node[key];
            }
        }
        return fallback;
    };

    const name = getValue(['nom_complet', 'name', 'prenom_nom', 'prenom', 'nom'], 'Nom inconnu');
    const grade = getValue(['grade', 'grade_actuel', 'position']);
    const photo = getValue(['photo', 'photo_url', 'imageUrl']);
    const entity = getValue(['entite', 'entity', 'service', 'escadron']);

    // ✅ UTILISER LA FONCTION getPhotoUrl
    const photoUrl = getPhotoUrl(photo);

    return (
        <div className="org-node card h-100" style={{
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'transform 0.2s',
        }}>
            <div className="card-body text-center">
                {photoUrl ? (
                    <img
                        src={photoUrl}
                        alt={`Photo de ${name}`}
                        className="rounded-circle mb-3"
                        style={{
                            width: '80px',
                            height: '80px',
                            objectFit: 'cover',
                            border: '2px solid #dee2e6'
                        }}
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                            console.log('❌ Erreur chargement photo:', photoUrl);
                        }}
                    />
                ) : null}

                {/* Fallback pour "Pas encore de photo" */}
                <div
                    className="rounded-circle mb-3 d-flex align-items-center justify-content-center"
                    style={{
                        width: '80px',
                        height: '80px',
                        backgroundColor: '#f8f9fa',
                        border: '2px dashed #dee2e6',
                        color: '#6c757d',
                        fontSize: '10px',
                        textAlign: 'center',
                        display: photoUrl ? 'none' : 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16" style={{ marginBottom: '4px' }}>
                        <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                        <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                    </svg>
                    <span style={{ fontWeight: '500', lineHeight: '1.1' }}>Pas de<br/>photo</span>
                </div>

                <h5 className="card-title">{name}</h5>
                {grade && <p className="card-text text-muted">{grade}</p>}
                {entity && <p className="card-text"><small>{entity}</small></p>}
            </div>
        </div>
    );
};

OrgChartNode.propTypes = {
    node: PropTypes.object.isRequired,
};

function PersonList({ listTitle, data = [], displayMode = 'table' }) {
    if (!data || data.length === 0) {
        return null;
    }

    // ✅ FONCTION MODIFIÉE AVEC MESSAGE "PAS ENCORE DE PHOTO"
    const showPersonDetails = (person) => {
        const grade = person.grade || 'N/A';
        const nom = person.nom || 'N/A';
        const prenom = person.prenom || 'N/A';
        const service = person.service || 'N/A';
        const telephone = person.telephone || 'N/A';
        const miseAJourPar = person.mise_a_jour_par || 'Inconnu';

        // ✅ UTILISER LE SYSTÈME DE PHOTOS EXISTANT
        const photo = person.photo || person.photo_url || person.photoUrl;
        const photoUrl = getPhotoUrl(photo);

        console.log('🖼️ Photo détails:', {
            original: photo,
            constructed: photoUrl,
            hasPhoto: !!photoUrl
        });

        let dateMiseAJour = 'N/A';
        if (person.timestamp_derniere_maj_statut) {
            const date = new Date(person.timestamp_derniere_maj_statut);
            if (!isNaN(date)) {
                dateMiseAJour = date.toLocaleString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                });
            }
        }

        // ✅ DIFFÉRENT AFFICHAGE SELON SI PHOTO EXISTE OU NON
        const photoSection = photoUrl ?
            `<div style="margin-bottom: 15px;">
                <img src="${photoUrl}" alt="Photo de ${prenom} ${nom}"
                     style="width: 150px; height: 150px; border-radius: 50%; object-fit: cover;
                            border: 3px solid #007bff; cursor: pointer;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onclick="window.open('${photoUrl}', '_blank');"
                     title="Cliquer pour agrandir">
                <div style="display: none; width: 150px; height: 150px; border-radius: 50%;
                            background-color: #f8f9fa; border: 2px dashed #dee2e6;
                            align-items: center; justify-content: center; flex-direction: column;
                            color: #6c757d; font-size: 14px; text-align: center; margin: 0 auto;">
                    <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16" style="margin-bottom: 8px;">
                        <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                        <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                    </svg>
                    <span style="font-weight: 500;">Pas encore<br>de photo</span>
                </div>
            </div>`
            :
            `<div style="margin-bottom: 15px;">
                <div style="width: 150px; height: 150px; border-radius: 50%;
                            background-color: #f8f9fa; border: 2px dashed #dee2e6;
                            display: flex; align-items: center; justify-content: center; flex-direction: column;
                            color: #6c757d; font-size: 14px; text-align: center; margin: 0 auto;">
                    <svg width="32" height="32" fill="currentColor" viewBox="0 0 16 16" style="margin-bottom: 8px;">
                        <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4z"/>
                        <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5m0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3 6.5a.5.5 0 1 1-1 0 .5.5 0 0 1 1 0"/>
                    </svg>
                    <span style="font-weight: 500;">Pas encore<br>de photo</span>
                </div>
            </div>`;

        Swal.fire({
            title: `<h5 style="margin-bottom: 0;">Détails du Personnel</h5>`,
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; text-align: left; padding: 10px;">
                    ${photoSection}
                    <div style="width: 100%;">
                        <p style="margin: 5px 0;"><strong>Grade:</strong> ${grade}</p>
                        <p style="margin: 5px 0;"><strong>Nom:</strong> ${nom}</p>
                        <p style="margin: 5px 0;"><strong>Prénom:</strong> ${prenom}</p>
                        <p style="margin: 5px 0;"><strong>Service:</strong> ${service}</p>
                        <p style="margin: 5px 0;"><strong>Téléphone:</strong> ${telephone}</p>
                        <hr style="margin: 10px 0;">
                        <p style="margin: 5px 0; font-size: 0.9em; color: #555;">
                            <small><strong>Mis à jour par:</strong> ${miseAJourPar}</small><br/>
                            <small><strong>Le:</strong> ${dateMiseAJour}</small>
                        </p>
                    </div>
                </div>
            `,
            icon: 'info',
            showCloseButton: true,
            focusConfirm: false,
            confirmButtonText: 'Fermer',
            width: '400px',
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

    const tableConfig = {
        headers: ['#', 'Grade', 'Nom', 'Prénom', 'Matricule', 'Entité', 'Service', 'Statut', 'Motif', 'Dernière Maj. Statut', 'Actions'],
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
                            <tr key={item.id || item.matricule || index}>
                                <td>{index + 1}</td>
                                {tableConfig.fields.map((field, fieldIndex) => {
                                    if (field === 'timestamp_derniere_maj_statut') {
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
                                                }) : '-'}
                                            </td>
                                        );
                                    }
                                    return <td key={fieldIndex}>{item[field] || '-'}</td>;
                                })}
                                <td>
                                    <button
                                        className="btn btn-info btn-sm"
                                        onClick={() => showPersonDetails(item)}
                                    >
                                        📄 Détails
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
                        <OrgChartNode node={item} />
                    </div>
                ))}
            </div>
        </div>
    );
}

PersonList.propTypes = {
    listTitle: PropTypes.string,
    data: PropTypes.arrayOf(PropTypes.object),
    displayMode: PropTypes.oneOf(['table', 'cards'])
};

export default PersonList;