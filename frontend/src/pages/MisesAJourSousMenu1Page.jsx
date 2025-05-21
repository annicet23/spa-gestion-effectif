import React, { useState, useEffect } from 'react';
import './MisesAJourSousMenu1Page.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = 'http://10.87.63.23:3000';

const INDISPONSIBLE_MOTIFS = [
  'garde', 'surveillance reboisement Ankofa', 'Permanence', 'repos de service',
  'patrouille du jour', 'consultant', 'garde malade', 'exempt station debout',
  'repos sanitaire', 'exempt port de chaussure', 'exempt port tenue',
  'cas social', 'patrouille de nuit',
];

const ABSENT_MOTIFS = [
  'stage', 'perm', 'PATC', 'consultant externe', 'Perme liberable',
  'Congé de Maternité', 'EVASAN', 'garde malade', 'mise en non activité',
  'Controle', 'Mission', 'concours', 'ANM',
];

const MOTIFS_REQUIRING_OU = ['garde malade', 'Controle'];
const AUTRE_MOTIF_VALUE = 'Autre'; // Valeur spéciale pour l'option 'Autre'

// Helper function to calculate the start date based on the 16:00 rule
const calculateCustomStartDate = () => {
  const now = new Date();
  const currentHour = now.getHours();
  const effectiveStartDate = new Date(now); // Start with today's date

  // If current time is before 4 PM (16:00), the custom day started yesterday
  if (currentHour < 16) {
    effectiveStartDate.setDate(effectiveStartDate.getDate() - 1);
  }

  // Format date as YYYY-MM-DD for the input value
  const year = effectiveStartDate.getFullYear();
  const month = String(effectiveStartDate.getMonth() + 1).padStart(2, '0');
  const day = String(effectiveStartDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


function MisesAJourSousMenu1Page() {
  const { user, token } = useAuth();

  const [userCadresList, setUserCadresList] = useState([]);
  const [loadingCadresList, setLoadingCadresList] = useState(true);
  const [errorCadresList, setErrorCadresList] = useState(null);

  const [selectedCadreId, setSelectedCadreId] = useState('');
  const [selectedCadreData, setSelectedCadreData] = useState(null);

  const [statutAbsence, setStatutAbsence] = useState('');
  const [dateDebutAbsence, setDateDebutAbsence] = useState(''); // This will now be set automatically
  const [motifAbsence, setMotifAbsence] = useState('');
  const [motifOuDetails, setMotifOuDetails] = useState('');
  const [customMotif, setCustomMotif] = useState('');

  const [misesAJourTemporaires, setMisesAJourTemporaires] = useState([]);
  const [loadingGroupUpdate, setLoadingGroupUpdate] = useState(false);
  const [groupUpdateMessage, setGroupUpdateMessage] = useState(null);

  useEffect(() => {
    const fetchUserCadres = async () => {
      if (!token || !user || user.role !== 'Standard') {
        setLoadingCadresList(false);
        setUserCadresList([]);
        return;
      }

      setLoadingCadresList(true);
      setErrorCadresList(null);

      try {
        const response = await fetch(`${API_BASE_URL}/api/cadres`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
          throw new Error(errorBody.message || `Erreur réseau ou serveur, statut: ${response.status}`);
        }

        const data = await response.json();
        setUserCadresList(data);

      } catch (error) {
        console.error("Erreur lors du chargement de la liste des cadres:", error);
        setErrorCadresList(`Impossible de charger la liste des cadres : ${error.message}`);
        setUserCadresList([]);
      } finally {
        setLoadingCadresList(false);
      }
    };

    fetchUserCadres();
  }, [token, user]);

  const handleSelectCadre = (event) => {
    const cadreId = event.target.value;
    setSelectedCadreId(cadreId);

    const cadre = userCadresList.find(c => c.id === parseInt(cadreId));
    setSelectedCadreData(cadre);
    // Reset form fields when a new cadre is selected
    setStatutAbsence('');
    setDateDebutAbsence(''); // Clear date
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setGroupUpdateMessage(null);
  };

  const handleMotifChange = (event) => {
    const selectedMotif = event.target.value;
    setMotifAbsence(selectedMotif);
    setMotifOuDetails(''); // Always reset OU details when motif changes
    setCustomMotif(''); // Always reset custom motif when motif changes (unless 'Autre' is selected, which is handled below)
  };

  const handleStatutChange = (e) => {
      const newStatut = e.target.value;
      setStatutAbsence(newStatut);
      setMotifAbsence(''); // Réinitialise le motif quand le statut change
      setMotifOuDetails(''); // Réinitialise les détails OU
      setCustomMotif(''); // Réinitialise le motif personnalisé

      if (newStatut === 'Indisponible' || newStatut === 'Absent') {
        // Calculate and set the date based on the custom concept
        setDateDebutAbsence(calculateCustomStartDate());
      } else {
        // Clear date if status is not Absent/Indisponible (should only happen when selecting the initial empty state)
        setDateDebutAbsence('');
      }
  };


  const handleAddToTemporaryList = () => {
    setGroupUpdateMessage(null);

    if (!selectedCadreData || !statutAbsence) {
      setGroupUpdateMessage({ type: 'error', text: 'Veuillez sélectionner un cadre et un statut.' });
      return;
    }

    // Since "Présent" is removed and date is auto-calculated for Indisponible/Absent,
    // we only need to validate presence of date and motif if a status is selected
    if (!dateDebutAbsence) { // This should ideally always be true if statutAbsence is set
       setGroupUpdateMessage({ type: 'error', text: 'La date de début est manquante (calcul automatique échoué?).' });
       return;
    }
    if (!motifAbsence) {
      setGroupUpdateMessage({ type: 'error', text: 'Veuillez sélectionner un motif.' });
      return;
    }
    // Validation du motif personnalisé
    if (motifAbsence === AUTRE_MOTIF_VALUE && !customMotif.trim()) {
      setGroupUpdateMessage({ type: 'error', text: `Veuillez préciser le motif personnalisé.` });
      return;
    }
    // Validation des détails OU (uniquement si le motif n'est PAS 'Autre' ET qu'il est dans la liste requérant OU)
    if (motifAbsence !== AUTRE_MOTIF_VALUE && MOTIFS_REQUIRING_OU.includes(motifAbsence) && !motifOuDetails.trim()) {
      setGroupUpdateMessage({ type: 'error', text: `Veuillez préciser le lieu/détails ("OU") pour le motif "${motifAbsence}".` });
      return;
    }


    const dejaPresent = misesAJourTemporaires.some(item => item.cadreId === selectedCadreData.id);
    if (dejaPresent) {
      setGroupUpdateMessage({ type: 'warning', text: `Une mise à jour pour ${selectedCadreData.nom} ${selectedCadreData.prenom} (${selectedCadreData.matricule}) est déjà en attente.` });
      return;
    }
    const now = new Date(); // Obtenez la date et l'heure actuelles
  const timestampMiseAJour = now.toISOString(); // Formatez-le en chaîne ISO

    const nouvelleMiseAJour = {
      cadreId: selectedCadreData.id,
      matricule: selectedCadreData.matricule,
      nom: selectedCadreData.nom,
      prenom: selectedCadreData.prenom,
      statut_absence: statutAbsence, // Will be 'Indisponible' or 'Absent'
      date_debut_absence: dateDebutAbsence, // This is now the auto-calculated date
      // Logique pour le motif : soit le motif prédéfini, soit le motif personnalisé si 'Autre' est sélectionné
      motif_absence: motifAbsence === AUTRE_MOTIF_VALUE ? customMotif.trim() : motifAbsence,
      // Logique pour les détails OU : uniquement si le motif n'est PAS 'Autre' ET qu'il est dans la liste requérant OU
      motif_details: motifAbsence === AUTRE_MOTIF_VALUE || !MOTIFS_REQUIRING_OU.includes(motifAbsence) ? null : motifOuDetails.trim(),timestamp_mise_a_jour_statut: timestampMiseAJour,
    };

    setMisesAJourTemporaires([...misesAJourTemporaires, nouvelleMiseAJour]);
    setGroupUpdateMessage({ type: 'success', text: `Mise à jour pour ${selectedCadreData.nom} ${selectedCadreData.prenom} ajoutée au tableau.` });

    // Réinitialiser le formulaire après ajout
    setSelectedCadreId('');
    setSelectedCadreData(null);
    setStatutAbsence('');
    setDateDebutAbsence(''); // Clear date
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
  };

  const handleRemoveFromTemporaryList = (cadreIdToRemove) => {
    setMisesAJourTemporaires(misesAJourTemporaires.filter(item => item.cadreId !== cadreIdToRemove));
    setGroupUpdateMessage({ type: 'info', text: `Mise à jour pour le cadre retirée de la liste.` });
  };

  const handleGroupUpdate = async () => {
    if (misesAJourTemporaires.length === 0) {
      setGroupUpdateMessage({ type: 'info', text: "Aucune mise à jour à valider." });
      return;
    }

    setLoadingGroupUpdate(true);
    setGroupUpdateMessage(null);

    const authToken = token || localStorage.getItem('token');

    if (!authToken) {
      setGroupUpdateMessage({ type: 'error', text: 'Erreur d\'authentification : Vous devez être connecté pour valider les mises à jour.' });
      setLoadingGroupUpdate(false);
      return;
    }

    const updatePromises = misesAJourTemporaires.map(item => {
      const payload = {
        statut_absence: item.statut_absence,
        date_debut_absence: item.date_debut_absence, // Use the calculated date
        motif_absence: item.motif_absence,
        motif_details: item.motif_details,timestamp_mise_a_jour_statut: item.timestamp_mise_a_jour_statut,
      };
      return fetch(`${API_BASE_URL}/api/cadres/${item.cadreId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload),
      }).then(async response => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            matricule: item.matricule,
            message: errorData.message || `Erreur HTTP : ${response.status}`
          };
        }
        return { success: true, matricule: item.matricule, data: await response.json().catch(() => ({})) };
      }).catch(error => {
        return { success: false, matricule: item.matricule, message: error.message || `Erreur réseau pour ${item.matricule}` };
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
          const failedItem = misesAJourTemporaires.find(item => item.matricule === (result.value?.matricule || result.reason?.matricule));
          const identifier = failedItem ? `${failedItem.matricule} (ID: ${failedItem.cadreId})` : (result.value?.matricule || 'un cadre');
          errorMessages.push(result.status === 'fulfilled' ? `${identifier}: ${result.value.message}` : `Échec requête pour ${identifier}: ${result.reason?.message || 'Erreur inconnue'}`);
        }
      });

      let finalMessageText = '';
      let finalMessageType = 'info';

      if (successCount > 0) {
        finalMessageText += `Succès : ${successCount} mise(s) à jour cadre validée(s).`;
        finalMessageType = 'success';
      }
      if (errorCount > 0) {
        const errorSnippet = errorMessages.slice(0, 3).join('; ') + (errorMessages.length > 3 ? '...' : '');
        finalMessageText += `${successCount > 0 ? ' | ' : ''}Échec(s) : ${errorCount} cadre(s) n'ont pas pu être mis à jour (${errorSnippet}).`;
        finalMessageType = successCount > 0 ? 'warning' : 'error';
      }

      // Logique d'enregistrement de la soumission quotidienne
      if (successCount > 0 && user && user.role === 'Standard') {
        try {
          // The date used for the submission record itself might still be the standard calendar date,
          // depending on how you want to track the *day the submission was made*.
          // If it should also follow the 16:00 rule for the submission date,
          // you would calculate todayDateString using calculateCustomStartDate() here.
          // For now, assuming submission date is standard calendar date of submission action.
          const today = new Date();
          const yyyy = today.getFullYear();
          const mm = String(today.getMonth() + 1).padStart(2, '0');
          const dd = String(today.getDate()).padStart(2, '0');
          const todayDateString = `${yyyy}-${mm}-${dd}`;


          // Utilise l'ID du premier cadre réussi pour la soumission
          const firstSuccessfulUpdate = results.find(r => r.status === 'fulfilled' && r.value.success);
          const cadreIdForSubmission = firstSuccessfulUpdate ? misesAJourTemporaires.find(item => item.matricule === firstSuccessfulUpdate.value.matricule)?.cadreId : null;

          if (cadreIdForSubmission) { // N'enregistre la soumission que s'il y a eu au moins un succès
            const submitResponse = await fetch(`${API_BASE_URL}/api/mises-a-jour/submit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                update_date: todayDateString, // Standard calendar date for submission record
                cadre_id: cadreIdForSubmission, // Utilise l'ID du premier cadre réussi
                submitted_by_id: user.id
              }),
            });

            if (!submitResponse.ok) {
              const submitErrorBody = await submitResponse.json().catch(() => ({ message: `Erreur HTTP : ${submitResponse.status}` }));
              console.error('Échec de l\'enregistrement de la soumission quotidienne :', submitErrorBody);
              finalMessageText += ` | Attention : Échec de l'enregistrement de la soumission quotidienne (${submitErrorBody.message || 'erreur inconnue'}).`;
              finalMessageType = finalMessageType === 'error' ? 'error' : 'warning';
            } else {
              const submitSuccessData = await submitResponse.json();
              console.log('Soumission quotidienne enregistrée avec succès :', submitSuccessData);
              finalMessageText += ` | Soumission quotidienne enregistrée.`;
              // Vider la liste temporaire seulement si TOUTES les updates ont réussi et la soumission quotidienne aussi
              if (successCount === misesAJourTemporaires.length && errorCount === 0) {
                setMisesAJourTemporaires([]);
                setSelectedCadreId('');
                setSelectedCadreData(null);
                setStatutAbsence('');
                setDateDebutAbsence(''); // Clear date state
                setMotifAbsence('');
                setMotifOuDetails('');
                setCustomMotif('');
              }
            }
          }
        } catch (submitError) {
          console.error('Erreur inattendue lors de l\'enregistrement de la soumission quotidienne :', submitError);
          finalMessageText += ` | Attention : Erreur technique lors de l'enregistrement de la soumission quotidienne.`;
          finalMessageType = finalMessageType === 'error' ? 'error' : 'warning';
        }
      }


      setGroupUpdateMessage({ type: finalMessageType, text: finalMessageText });

    } catch (error) {
      console.error("Erreur inattendue lors de la validation groupée :", error);
      setGroupUpdateMessage({ type: 'error', text: `Erreur inattendue lors de la validation groupée : ${error.message}` });
    } finally {
      setLoadingGroupUpdate(false);
    }
  };

  return (
    <div className="container mt-4 mb-5">
      <h1 className="text-center mb-4">Mise à Jour Absence Cadre</h1>

      <div className="row">
        <div className="col-md-6 mb-3 mb-md-0">
          <div className="card">
            <div className="card-header">
              Informations et Mise à Jour du Cadre
            </div>
            <div className="card-body">
              {loadingCadresList && <div className="alert alert-info">Chargement de la liste des cadres...</div>}
              {errorCadresList && <div className="alert alert-danger">{errorCadresList}</div>}
              {!loadingCadresList && !errorCadresList && (!user || user.role !== 'Standard') && (
                <div className="alert alert-warning">Vous devez être connecté avec un compte Standard pour effectuer des mises à jour.</div>
              )}

              {!loadingCadresList && !errorCadresList && user && user.role === 'Standard' && userCadresList.length > 0 && (
                <>
                  <div className="mb-3">
                    <label htmlFor="selectCadre" className="form-label">Sélectionner un Cadre :</label>
                    <select
                      className="form-select"
                      id="selectCadre"
                      value={selectedCadreId}
                      onChange={handleSelectCadre}
                      disabled={loadingGroupUpdate}
                      required
                    >
                      <option value="">-- Sélectionner --</option>
                      {userCadresList.map(cadre => (
                        <option key={cadre.id} value={cadre.id}>
                          {cadre.nom} {cadre.prenom} ({cadre.matricule})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCadreData && (
                    <div className="card mb-3">
                      <div className="card-header">Informations du Cadre</div>
                      <div className="card-body">
                        <p><strong>Matricule :</strong> {selectedCadreData.matricule}</p>
                        <p><strong>Nom :</strong> {selectedCadreData.nom}</p>
                        <p><strong>Prénom :</strong> {selectedCadreData.prenom}</p>
                        <p><strong>Grade :</strong> {selectedCadreData.grade}</p>
                        <p><strong>Entité/Service :</strong> {selectedCadreData.entite === 'Service' ? selectedCadreData.service : (selectedCadreData.entite === 'Escadron' ? selectedCadreData.EscadronResponsable?.nom || 'N/A' : selectedCadreData.entite || 'N/A')}</p>
                        <p><strong>Statut Actuel :</strong> {selectedCadreData.statut_absence || 'Non défini'}</p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedCadreData && (
                <>
                  <hr />
                  <h5>Nouvelle mise à jour pour {selectedCadreData.nom} {selectedCadreData.prenom}</h5>

                  <div className="mb-3">
                    <label htmlFor="statutAbsence" className="form-label">Nouveau Statut :</label>
                    <select
                      className="form-select"
                      id="statutAbsence"
                      value={statutAbsence}
                      onChange={handleStatutChange} // Use the new handler
                      required
                      disabled={loadingGroupUpdate}
                    >
                      <option value="">Sélectionner statut</option>
                      <option value="Indisponible">Indisponible</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>

                  {/* Date and Motif fields are shown when statutAbsence is 'Indisponible' or 'Absent' */}
                  {(statutAbsence === 'Indisponible' || statutAbsence === 'Absent') && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="dateDebutAbsence" className="form-label">Date de Début (auto-calculée) :</label>
                        <input
                          type="date"
                          className="form-control"
                          id="dateDebutAbsence"
                          value={dateDebutAbsence}
                          readOnly // Make the input read-only
                          required // Still required as per validation
                          disabled={loadingGroupUpdate}
                        />
                         {/* Optional: Add helper text explaining the date */}
                         <small className="form-text text-muted">La date correspond au début de la période de 24h (à partir de 16h00 du jour précédent) où la mise à jour est enregistrée.</small>
                      </div>
                      <div className="mb-3">
                        <label htmlFor="motifAbsence" className="form-label">Motif :</label>
                        <select
                          className="form-select"
                          id="motifAbsence"
                          value={motifAbsence}
                          onChange={handleMotifChange}
                          required
                          disabled={loadingGroupUpdate}
                        >
                          <option value="">Sélectionner motif</option>
                          {statutAbsence === 'Indisponible' && INDISPONSIBLE_MOTIFS.map(motif => (
                            <option key={motif} value={motif}>{motif}</option>
                          ))}
                          {statutAbsence === 'Absent' && ABSENT_MOTIFS.map(motif => (
                            <option key={motif} value={motif}>{motif}</option>
                          ))}
                          <option value={AUTRE_MOTIF_VALUE}>-- Autre / Préciser --</option>
                        </select>
                      </div>

                      {/* Champ pour le motif personnalisé */}
                      {motifAbsence === AUTRE_MOTIF_VALUE && (
                        <div className="mb-3">
                          <label htmlFor="customMotif" className="form-label">Préciser le motif :</label>
                          <input
                            type="text"
                            className="form-control"
                            id="customMotif"
                            value={customMotif}
                            onChange={(e) => setCustomMotif(e.target.value)}
                            placeholder="Entrez le motif exact"
                            required={motifAbsence === AUTRE_MOTIF_VALUE}
                            disabled={loadingGroupUpdate}
                          />
                        </div>
                      )}

                      {/* Champ pour les détails OU */}
                      {motifAbsence !== AUTRE_MOTIF_VALUE && MOTIFS_REQUIRING_OU.includes(motifAbsence) && (
                        <div className="mb-3">
                          <label htmlFor="motifOuDetails" className="form-label">OU :</label>
                          <input
                            type="text"
                            className="form-control"
                            id="motifOuDetails"
                            value={motifOuDetails}
                            onChange={(e) => setMotifOuDetails(e.target.value)}
                            placeholder="Préciser le lieu ou la personne"
                            required={true}
                            disabled={loadingGroupUpdate}
                          />
                        </div>
                      )}
                    </>
                  )}

                  {selectedCadreData && (
                    <button
                      type="button"
                      className="btn btn-primary mt-2 w-100"
                      onClick={handleAddToTemporaryList}
                       disabled={
                        !statutAbsence || // Statut (Indisponible/Absent) obligatoire
                        !dateDebutAbsence || // Date obligatoire (auto-calculated, but check if it's set)
                        !motifAbsence || // Motif obligatoire
                        (motifAbsence === AUTRE_MOTIF_VALUE && !customMotif.trim()) || // Motif personnalisé obligatoire si "Autre"
                        (motifAbsence !== AUTRE_MOTIF_VALUE && MOTIFS_REQUIRING_OU.includes(motifAbsence) && !motifOuDetails.trim()) || // Détails OU obligatoires si motif spécifique et pas "Autre"
                        loadingGroupUpdate // Désactivé pendant la soumission groupée
                      }
                    >
                      Ajouter à la liste de validation
                    </button>
                  )}
                </>
              )}

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
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              Mises à jour en attente de validation
            </div>
            <div className="card-body">
              {misesAJourTemporaires.length > 0 ? (
                <>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-sm">
                      <thead>
                        <tr>
                          <th>Matricule</th>
                          <th>Nom</th>
                          <th>Statut</th>
                          <th>Date Début</th>
                          <th>Motif (OU)</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {misesAJourTemporaires.map((item) => (
                          <tr key={item.cadreId}>
                            <td>{item.matricule}</td>
                            <td>{item.nom} {item.prenom}</td>
                            <td>{item.statut_absence}</td>
                            <td>{item.date_debut_absence || '-'}</td>
                            <td>{item.motif_absence ? (item.motif_details ? `${item.motif_absence} (${item.motif_details})` : item.motif_absence) : '-'}</td>
                            <td>
                              <button
                                className="btn btn-danger btn-sm"
                                onClick={() => handleRemoveFromTemporaryList(item.cadreId)}
                                title="Retirer de la liste"
                                disabled={loadingGroupUpdate}
                              >
                                <i className="bi bi-trash"></i>
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
                    onClick={handleGroupUpdate}
                    disabled={loadingGroupUpdate || misesAJourTemporaires.length === 0}
                  >
                    {loadingGroupUpdate ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        <span>Validation en cours...</span>
                      </>
                    ) : `Valider les ${misesAJourTemporaires.length} mise(s) à jour`}
                  </button>
                </>
              ) : (
                <div className="alert alert-light text-center" role="alert">
                  Aucune mise à jour en attente.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MisesAJourSousMenu1Page;