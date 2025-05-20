// src/pages/MisesAJourSousMenu2Page.jsx
import React, { useState } from 'react';
import './MisesAJourSousMenu2Page.css';
import 'bootstrap/dist/css/bootstrap.min.css';

const API_BASE_URL = 'http://localhost:3000';

function MisesAJourSousMenu2Page() {
  const [incorporationInput, setIncorporationInput] = useState('');
  const [eleveInfo, setEleveInfo] = useState(null);
  const [loadingEleve, setLoadingEleve] = useState(false);
  const [eleveError, setEleveError] = useState(null);
  const [statutAbsence, setStatutAbsence] = useState('');
  const [dateDebutAbsence, setDateDebutAbsence] = useState('');
  const [motifAbsence, setMotifAbsence] = useState('');
  const [misesAJourTemporairesEleves, setMisesAJourTemporairesEleves] = useState([]);
  const [loadingGroupUpdate, setLoadingGroupUpdate] = useState(false);
  const [groupUpdateMessage, setGroupUpdateMessage] = useState(null);

  const fetchEleveInfo = async (incorporation) => {
    if (!incorporation) {
      setEleveInfo(null);
      setEleveError(null);
      setStatutAbsence('');
      setDateDebutAbsence('');
      setMotifAbsence('');
      return;
    }

    setLoadingEleve(true);
    setEleveError(null);
    setEleveInfo(null);
    setStatutAbsence('');
    setDateDebutAbsence('');
    setMotifAbsence('');
    setGroupUpdateMessage(null);

    const token = localStorage.getItem('token');

    if (!token) {
      setEleveError('Erreur d\'authentification : Vous devez être connecté.');
      setLoadingEleve(false);
      return;
    }

    try {
      // This route is correct, it fetches by incorporation
      const response = await fetch(`${API_BASE_URL}/api/eleves/incorporation/${incorporation}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          setEleveError('Session expirée ou non autorisée. Veuillez vous reconnecter.');
        } else if (response.status === 404) {
          setEleveError('Numéro d\'incorporation non trouvé.');
        } else if (response.status === 403) {
          setEleveError('Accès refusé pour cet élève.');
        }
        else {
          const errorBody = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
          setEleveError(errorBody.message || `Erreur lors de la récupération: ${response.status}`);
        }
        return;
      }

      const data = await response.json();
      setEleveInfo(data);
      // Ensure date is formatted correctly for the input type="date"
      setStatutAbsence(data.statut || 'Présent');
      setDateDebutAbsence(data.date_debut_absence ? data.date_debut_absence.split('T')[0] : '');
      setMotifAbsence(data.motif || '');

    } catch (error) {
      console.error("Erreur lors de la récupération de l'élève:", error);
      setEleveError('Erreur technique lors de la récupération des informations de l\'élève.');
    } finally {
      setLoadingEleve(false);
    }
  };

  const handleAddToTemporaryListEleve = () => {
    setGroupUpdateMessage(null);

    if (!eleveInfo) {
      setGroupUpdateMessage({ type: 'error', text: 'Veuillez rechercher un élève avant d\'ajouter à la liste.' });
      return;
    }
    // Check if date is required based on status
    if (!statutAbsence || ((statutAbsence === 'Indisponible' || statutAbsence === 'Absent') && !dateDebutAbsence)) {
      setGroupUpdateMessage({ type: 'error', text: 'Veuillez sélectionner un statut et une date (si absence/indisponibilité) avant d\'ajouter.' });
      return;
    }

    const dejaPresent = misesAJourTemporairesEleves.some(item => item.eleveId === eleveInfo.id);
    if (dejaPresent) {
      setGroupUpdateMessage({ type: 'warning', text: `Une mise à jour pour ${eleveInfo.nom} ${eleveInfo.prenom} (${eleveInfo.incorporation}) est déjà en attente.` });
      return;
    }

    const nouvelleMiseAJour = {
      eleveId: eleveInfo.id, // Keep ID for internal list management if needed, but use incorporation for the PUT request
      incorporation: eleveInfo.incorporation, // Use incorporation for the PUT request
      nom: eleveInfo.nom,
      prenom: eleveInfo.prenom,
      statut: statutAbsence,
      date_debut_absence: statutAbsence === 'Présent' ? null : dateDebutAbsence, // Send null if status is Présent
      motif: statutAbsence === 'Présent' ? null : motifAbsence, // Send null if status is Présent
    };

    setMisesAJourTemporairesEleves([...misesAJourTemporairesEleves, nouvelleMiseAJour]);
    setGroupUpdateMessage({ type: 'success', text: `Mise à jour pour ${eleveInfo.nom} ${eleveInfo.prenom} (${eleveInfo.incorporation}) ajoutée au tableau.` });
  };

  const handleRemoveFromTemporaryListEleve = (eleveIdToRemove) => {
    setMisesAJourTemporairesEleves(misesAJourTemporairesEleves.filter(item => item.eleveId !== eleveIdToRemove));
    setGroupUpdateMessage({ type: 'info', text: `Mise à jour pour l'élève retirée de la liste.` });
  };

  const handleGroupUpdateEleves = async () => {
    if (misesAJourTemporairesEleves.length === 0) {
      setGroupUpdateMessage({ type: 'info', text: "Aucune mise à jour d'élève à valider." });
      return;
    }

    setLoadingGroupUpdate(true);
    setGroupUpdateMessage(null);

    const token = localStorage.getItem('token');

    if (!token) {
      setGroupUpdateMessage({ type: 'error', text: 'Erreur d\'authentification : Vous devez être connecté pour valider les mises à jour.' });
      setLoadingGroupUpdate(false);
      return;
    }

    const updatePromises = misesAJourTemporairesEleves.map(item => {
      const payload = {
        statut: item.statut,
        date_debut_absence: item.date_debut_absence,
        motif: item.motif,
      };
      // *** CORRECTED URL HERE ***
      // Use the incorporation number in the URL for the PUT request
      return fetch(`${API_BASE_URL}/api/eleves/incorporation/${item.incorporation}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      }).then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            incorporation: item.incorporation,
            message: errorData.message || `Erreur ${response.status} pour ${item.incorporation}`
          };
        }
        return { success: true, incorporation: item.incorporation, data: await response.json().catch(() => ({})) };
      }).catch(error => {
        return { success: false, incorporation: item.incorporation, message: error.message || `Erreur réseau pour ${item.incorporation}` };
      });
    });

    try {
      const results = await Promise.allSettled(updatePromises);

      let successCount = 0;
      let errorCount = 0;
      const errorMessages = [];

      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
        } else {
          errorCount++;
          // Use the incorporation number in the error message
          errorMessages.push(result.status === 'fulfilled' ? result.value.message : `Échec requête pour ${result.reason?.incorporation || 'un élève'}: ${result.reason?.message || 'Erreur inconnue'}`);
        }
      });

      if (errorCount > 0) {
        setGroupUpdateMessage({
          type: 'error',
          text: `${successCount} mise(s) à jour réussie(s). ${errorCount} échec(s): ${errorMessages.slice(0, 3).join('; ')}${errorMessages.length > 3 ? '...' : ''}`
        });
      } else {
        setGroupUpdateMessage({ type: 'success', text: `Succès: ${successCount} mise(s) à jour validée(s).` });
        setMisesAJourTemporairesEleves([]); // Clear the temporary list on full success
        // Optionally, clear the currently displayed eleveInfo if it was in the list
        // setEleveInfo(null);
        // setIncorporationInput('');
      }

    } catch (error) {
      console.error("Erreur inattendue lors de la validation groupée des élèves:", error);
      setGroupUpdateMessage({ type: 'error', text: `Erreur inattendue lors de la validation groupée: ${error.message}` });
    } finally {
      setLoadingGroupUpdate(false);
    }
  };

  return (
    <div className="container mt-4 mb-5">
      <h1 className="text-center mb-4">Valider les Mises à Jour Soumises</h1>
      <p className="text-center">
        Cette page permet de rechercher un élève par son numéro d'incorporation,
        de préparer la mise à jour de son statut d'absence, date et motif,
        et de valider les mises à jour en lot.
      </p>

      <div className="row">
        <div className="col-md-6 mb-3 mb-md-0">
          <div className="card">
            <div className="card-header">
              Rechercher et Préparer la Mise à Jour
            </div>
            <div className="card-body">
              <form onSubmit={(e) => { e.preventDefault(); fetchEleveInfo(incorporationInput); }}>
                <div className="mb-3">
                  <label htmlFor="incorporationInput" className="form-label">Numéro d'incorporation de l'Élève:</label>
                  <div className="input-group">
                    <input
                      type="text"
                      className="form-control"
                      id="incorporationInput"
                      value={incorporationInput}
                      onChange={(e) => setIncorporationInput(e.target.value)}
                      disabled={loadingEleve}
                      placeholder="Saisir numéro d'incorporation et Entrée/clic"
                    />
                    <button className="btn btn-outline-secondary" type="submit" disabled={loadingEleve || !incorporationInput}>
                      {loadingEleve ? <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> : 'Chercher'}
                    </button>
                  </div>
                  {eleveError && <div className="text-danger mt-2">{eleveError}</div>}
                </div>
              </form>

              {eleveInfo && (
                <div className="mt-4">
                  <h4>Informations de l'Élève</h4>
                  <p><strong>Nom:</strong> {eleveInfo.nom} {eleveInfo.prenom}</p>
                  <p><strong>Incorporation:</strong> {eleveInfo.incorporation}</p>
                   {/* Check if escadron exists before accessing its properties */}
                  <p><strong>Escadron:</strong> {eleveInfo.escadron ? eleveInfo.escadron.nom : 'N/A'}</p>
                  <p><strong>Peloton:</strong> {eleveInfo.peloton}</p>
                  <p><strong>Statut Actuel:</strong> {eleveInfo.statut || 'Non défini'}</p>
                  {/* Format date for display if it exists */}
                  <p><strong>Date Début Absence Actuelle:</strong> {eleveInfo.date_debut_absence ? new Date(eleveInfo.date_debut_absence).toLocaleDateString() : 'Non défini'}</p>
                  <p><strong>Motif Actuel:</strong> {eleveInfo.motif || 'Non défini'}</p>

                  <hr/>

                  <h4>Mettre à Jour l'Absence</h4>
                  <div className="mb-3">
                    <label htmlFor="statutAbsenceEleve" className="form-label">Nouveau Statut:</label>
                    <select
                      className="form-select"
                      id="statutAbsenceEleve"
                      value={statutAbsence}
                      onChange={(e) => setStatutAbsence(e.target.value)}
                    >
                      <option value="">Sélectionner statut</option>
                      <option value="Présent">Présent</option>
                      <option value="Indisponible">Indisponible</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>

                  {(statutAbsence === 'Indisponible' || statutAbsence === 'Absent') && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="dateDebutAbsenceEleve" className="form-label">Date de Début Absence/Indisponibilité:</label>
                        <input
                          type="date"
                          className="form-control"
                          id="dateDebutAbsenceEleve"
                          value={dateDebutAbsence}
                          onChange={(e) => setDateDebutAbsence(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label htmlFor="motifAbsenceEleve" className="form-label">Motif (optionnel):</label>
                        <textarea
                          className="form-control"
                          id="motifAbsenceEleve"
                          rows="2"
                          value={motifAbsence}
                          onChange={(e) => setMotifAbsence(e.target.value)}
                        ></textarea>
                      </div>
                    </>
                  )}
                   {/* Optional: Date field for Présent status if needed */}
                   {/*
                   {statutAbsence === 'Présent' && (
                     <div className="mb-3">
                       <label htmlFor="dateConstatPresenceEleve" className="form-label">Date de constat Présence (optionnel):</label>
                       <input
                         type="date"
                         className="form-control"
                         id="dateConstatPresenceEleve"
                         value={dateDebutAbsence} // Reusing dateDebutAbsence state, adjust if needed
                         onChange={(e) => setDateDebutAbsence(e.target.value)}
                       />
                     </div>
                   )}
                   */}


                  <button
                    type="button"
                    className="btn btn-primary mt-3 w-100"
                    onClick={handleAddToTemporaryListEleve}
                    // Disable if no eleveInfo, no status selected, or if status requires date and date is empty
                    disabled={!eleveInfo || !statutAbsence || ((statutAbsence === 'Indisponible' || statutAbsence === 'Absent') && !dateDebutAbsence)}
                  >
                    Ajouter à la liste de validation
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              Mises à jour Élèves en attente de validation
            </div>
            <div className="card-body">
              {misesAJourTemporairesEleves.length > 0 ? (
                <>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-sm">
                      <thead>
                        <tr>
                          <th>Incorporation</th>
                          <th>Nom</th>
                          <th>Statut</th>
                          <th>Date</th>
                          <th>Motif</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {misesAJourTemporairesEleves.map((item) => (
                          <tr key={item.eleveId}> {/* Use eleveId as key */}
                            <td>{item.incorporation}</td>
                            <td>{item.nom} {item.prenom}</td>
                            <td>{item.statut}</td>
                            <td>{item.date_debut_absence || '-'}</td>
                            <td>{item.motif || '-'}</td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRemoveFromTemporaryListEleve(item.eleveId)} // Remove by eleveId
                                title="Retirer de la liste"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-trash" viewBox="0 0 16 16">
                                  <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                                  <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    type="button"
                    className="btn btn-success mt-3 w-100"
                    onClick={handleGroupUpdateEleves}
                    disabled={loadingGroupUpdate || misesAJourTemporairesEleves.length === 0}
                  >
                    {loadingGroupUpdate ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Validation en cours...
                      </>
                    ) : `Valider les ${misesAJourTemporairesEleves.length} mise(s) à jour`}
                  </button>
                </>
              ) : (
                <div className="alert alert-light text-center" role="alert">
                  Aucune mise à jour d'élève en attente.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {groupUpdateMessage && !loadingGroupUpdate && (
          <div className={`alert ${
            groupUpdateMessage.type === 'success' ? 'alert-success' :
            groupUpdateMessage.type === 'error' ? 'alert-danger' :
            groupUpdateMessage.type === 'warning' ? 'alert-warning' : 'alert-info'
          } mt-3`} role="alert">
            {groupUpdateMessage.text}
          </div>
      )}
    </div>
  );
}

export default MisesAJourSousMenu2Page;
