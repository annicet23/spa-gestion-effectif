import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './MisesAJourSousMenu1Page.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
const AUTRE_MOTIF_VALUE = 'Autre';

function MisesAJourSousMenu1Page() {
  const { user, token } = useAuth();

  // États pour la liste des cadres
  const [userCadresList, setUserCadresList] = useState([]);
  const [loadingCadresList, setLoadingCadresList] = useState(true);
  const [errorCadresList, setErrorCadresList] = useState(null);

  // États pour le cadre sélectionné
  const [selectedCadreId, setSelectedCadreId] = useState('');
  const [selectedCadreData, setSelectedCadreData] = useState(null);

  // États pour le formulaire
  const [statutAbsence, setStatutAbsence] = useState('');
  const [dateDebutAbsence, setDateDebutAbsence] = useState('');
  const [motifAbsence, setMotifAbsence] = useState('');
  const [motifOuDetails, setMotifOuDetails] = useState('');
  const [customMotif, setCustomMotif] = useState('');

  // États pour la gestion de la permission
  const [droitAnneePerm, setDroitAnneePerm] = useState('');
  const [dateDepartPerm, setDateDepartPerm] = useState('');
  const [dateArriveePerm, setDateArriveePerm] = useState('');
  const [referenceMessageDepart, setReferenceMessageDepart] = useState('');

  // États pour la gestion du droit annuel et des jours pris
  const [droitAnnuelDefault, setDroitAnnuelDefault] = useState(0);
  const [joursPermissionsPrisAnnee, setJoursPermissionsPrisAnnee] = useState(0);

  // État pour savoir si le cadre a une permission active
  const [cadreHasActivePermission, setCadreHasActivePermission] = useState(false);
  const [checkingActivePermission, setCheckingActivePermission] = useState(false);

  // États pour les mises à jour temporaires
  const [misesAJourTemporaires, setMisesAJourTemporaires] = useState([]);
  const [loadingGroupUpdate, setLoadingGroupUpdate] = useState(false);
  const [groupUpdateMessage, setGroupUpdateMessage] = useState(null);

  // États pour l'heure du serveur
  const [serverTime, setServerTime] = useState(null);
  const [loadingServerTime, setLoadingServerTime] = useState(true);
  const [serverTimeError, setServerTimeError] = useState(null);

  // Fonction pour gérer les messages avec useCallback
  const updateMessage = useCallback((message) => {
    setGroupUpdateMessage(message);
  }, []);

  // Fonction pour réinitialiser le formulaire
  const resetForm = useCallback(() => {
    setSelectedCadreId('');
    setSelectedCadreData(null);
    setStatutAbsence('');
    setDateDebutAbsence('');
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setDroitAnneePerm('');
    setDateDepartPerm('');
    setDateArriveePerm('');
    setReferenceMessageDepart('');
    setCadreHasActivePermission(false);
    setDroitAnnuelDefault(0);
    setJoursPermissionsPrisAnnee(0);
  }, []);

  // Calcul dynamique des jours restants
  const joursRestantsPerm = useMemo(() => {
    return droitAnnuelDefault - joursPermissionsPrisAnnee;
  }, [droitAnnuelDefault, joursPermissionsPrisAnnee]);

  // Helper function to calculate the difference in days between two dates
  const calculateDaysDifference = useCallback((startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }, []);

  // Calcul dynamique du total de jours de permission
  const totalJoursPermission = useMemo(() => {
    return calculateDaysDifference(dateDepartPerm, dateArriveePerm);
  }, [dateDepartPerm, dateArriveePerm, calculateDaysDifference]);

  // Helper function to calculate the start date based on the 16:00 rule
  const calculateCustomStartDate = useCallback(() => {
    if (!serverTime) {
      console.warn("Server time not available yet, using local fallback");
      // Fallback à la date locale si serverTime n'est pas disponible
      const fallbackDate = new Date();
      const currentHour = fallbackDate.getHours();
      if (currentHour < 16) {
        fallbackDate.setDate(fallbackDate.getDate() - 1);
      }
      return fallbackDate.toISOString().split('T')[0];
    }

    const effectiveDate = new Date(serverTime);
    const currentHour = effectiveDate.getHours();

    if (currentHour < 16) {
      effectiveDate.setDate(effectiveDate.getDate() - 1);
    }

    const year = effectiveDate.getFullYear();
    const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
    const day = String(effectiveDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }, [serverTime]);

  // Validation du formulaire avec useMemo
  const isFormValid = useMemo(() => {
    if (!statutAbsence || !dateDebutAbsence || !motifAbsence) return false;
    if (motifAbsence === AUTRE_MOTIF_VALUE && !customMotif.trim()) return false;
    if (motifAbsence !== AUTRE_MOTIF_VALUE && MOTIFS_REQUIRING_OU.includes(motifAbsence) && !motifOuDetails.trim()) return false;

    // Validation spécifique pour les permissions
    if (motifAbsence === 'perm') {
      if (cadreHasActivePermission) return false;
      if (!droitAnneePerm || !dateDepartPerm || !dateArriveePerm) return false;
      if (new Date(dateDepartPerm) > new Date(dateArriveePerm)) return false;
      if (totalJoursPermission > joursRestantsPerm) return false;
    }

    return true;
  }, [
    statutAbsence,
    dateDebutAbsence,
    motifAbsence,
    customMotif,
    motifOuDetails,
    cadreHasActivePermission,
    droitAnneePerm,
    dateDepartPerm,
    dateArriveePerm,
    totalJoursPermission,
    joursRestantsPerm
  ]);

  // Récupération de l'heure du serveur
  useEffect(() => {
    const fetchServerTime = async () => {
      setLoadingServerTime(true);
      setServerTimeError(null);
      try {
        const response = await fetch(`${API_BASE_URL}api/server-time`);
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        const data = await response.json();
        setServerTime(new Date(data.serverTime));
      } catch (error) {
        console.error("Erreur lors de la récupération de l'heure du serveur:", error);
        setServerTimeError("Impossible de récupérer l'heure du serveur. Utilisation de l'heure locale.");
        // En cas d'erreur, utiliser l'heure locale comme fallback
        setServerTime(new Date());
      } finally {
        setLoadingServerTime(false);
      }
    };
    fetchServerTime();
  }, []);

  // Charger la liste des cadres
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
        const response = await fetch(`${API_BASE_URL}api/cadres`, {
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

  // Vérifier si le cadre sélectionné a une permission active ET charger le résumé des permissions
  useEffect(() => {
    const checkCadrePermissionStatusAndSummary = async () => {
      if (!selectedCadreId || !token) {
        setCadreHasActivePermission(false);
        setDroitAnnuelDefault(0);
        setJoursPermissionsPrisAnnee(0);
        return;
      }

      setCheckingActivePermission(true);
      try {
        // 1. Vérification de la permission active
        const activePermResponse = await fetch(`${API_BASE_URL}api/permissions/active/${selectedCadreId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!activePermResponse.ok) {
          const errorBody = await activePermResponse.json().catch(() => ({}));
          console.error("Erreur lors de la vérification de la permission active:", errorBody);
          setCadreHasActivePermission(false);
          if (activePermResponse.status !== 404) {
            updateMessage({
              type: 'warning',
              text: `Impossible de vérifier le statut de permission. (${errorBody.message || activePermResponse.status})`
            });
          } else {
            updateMessage(null);
          }
        } else {
          const activePermData = await activePermResponse.json();
          setCadreHasActivePermission(activePermData.hasActivePermission);
          if (activePermData.hasActivePermission) {
            updateMessage({
              type: 'info',
              text: 'Ce cadre a actuellement une permission active.'
            });
          } else {
            updateMessage(null);
          }
        }

        // 2. Récupération du résumé des permissions
        const summaryResponse = await fetch(`${API_BASE_URL}api/permissions/cadre-summary/${selectedCadreId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        if (!summaryResponse.ok) {
          const errorBody = await summaryResponse.json().catch(() => ({}));
          console.error("Erreur lors de la récupération du résumé des permissions:", errorBody);
          setDroitAnnuelDefault(0);
          setJoursPermissionsPrisAnnee(0);
          updateMessage(prev => ({
            ...prev,
            type: 'warning',
            text: `${prev?.text || ''} Impossible de charger le résumé des permissions. (${errorBody.message || summaryResponse.status})`
          }));
        } else {
          const summaryData = await summaryResponse.json();
          setDroitAnnuelDefault(summaryData.droitAnnuel || 0);
          setJoursPermissionsPrisAnnee(summaryData.totalJoursPrisAnnee || 0);
        }

      } catch (error) {
        console.error("Erreur réseau lors de la vérification de la permission ou du résumé:", error);
        setCadreHasActivePermission(false);
        setDroitAnnuelDefault(0);
        setJoursPermissionsPrisAnnee(0);
        updateMessage({
          type: 'warning',
          text: `Erreur réseau lors de la vérification : ${error.message}`
        });
      } finally {
        setCheckingActivePermission(false);
      }
    };

    checkCadrePermissionStatusAndSummary();
  }, [selectedCadreId, token, updateMessage]);

  const handleSelectCadre = (event) => {
    const cadreId = event.target.value;
    setSelectedCadreId(cadreId);

    const cadre = userCadresList.find(c => c.id === parseInt(cadreId));
    setSelectedCadreData(cadre);

    // Reset form fields when a new cadre is selected
    setStatutAbsence('');
    setDateDebutAbsence('');
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setDroitAnneePerm('');
    setDateDepartPerm('');
    setDateArriveePerm('');
    setReferenceMessageDepart('');
    setCadreHasActivePermission(false);
    setDroitAnnuelDefault(0);
    setJoursPermissionsPrisAnnee(0);
    setGroupUpdateMessage(null);
  };

  const handleMotifChange = (event) => {
    const selectedMotif = event.target.value;
    setMotifAbsence(selectedMotif);
    setMotifOuDetails('');
    setCustomMotif('');

    if (selectedMotif !== 'perm') {
      setDroitAnneePerm('');
      setDateDepartPerm('');
      setDateArriveePerm('');
      setReferenceMessageDepart('');
    }
  };

  const handleStatutChange = (e) => {
    const newStatut = e.target.value;
    setStatutAbsence(newStatut);
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setDroitAnneePerm('');
    setDateDepartPerm('');
    setDateArriveePerm('');
    setReferenceMessageDepart('');

    if (newStatut === 'Indisponible' || newStatut === 'Absent') {
      setDateDebutAbsence(calculateCustomStartDate());
    } else {
      setDateDebutAbsence('');
    }
  };

  const handleAddToTemporaryList = () => {
    setGroupUpdateMessage(null);

    if (!selectedCadreData || !statutAbsence) {
      setGroupUpdateMessage({
        type: 'error',
        text: 'Veuillez sélectionner un cadre et un statut.'
      });
      return;
    }

    if (!serverTime) {
      setGroupUpdateMessage({
        type: 'error',
        text: 'Impossible de calculer la date. L\'heure du serveur n\'est pas encore disponible.'
      });
      return;
    }

    if (!isFormValid) {
      setGroupUpdateMessage({
        type: 'error',
        text: 'Veuillez remplir tous les champs requis correctement.'
      });
      return;
    }

    // Validation spécifique pour la permission active
    if (motifAbsence === 'perm' && cadreHasActivePermission) {
      setGroupUpdateMessage({
        type: 'warning',
        text: 'Ce cadre a déjà une permission active. Vous ne pouvez pas ajouter une nouvelle permission pour le moment.'
      });
      return;
    }

    // Validation des jours restants
    if (motifAbsence === 'perm' && totalJoursPermission > joursRestantsPerm) {
      setGroupUpdateMessage({
        type: 'error',
        text: `Impossible d'ajouter cette permission. Elle dépasse le droit annuel disponible (${joursRestantsPerm} jours restants).`
      });
      return;
    }

    const dejaPresent = misesAJourTemporaires.some(item => item.cadreId === selectedCadreData.id);
    if (dejaPresent) {
      setGroupUpdateMessage({
        type: 'warning',
        text: `Une mise à jour pour ${selectedCadreData.nom} ${selectedCadreData.prenom} (${selectedCadreData.matricule}) est déjà en attente.`
      });
      return;
    }

    const timestampMiseAJour = serverTime.toISOString();

    const nouvelleMiseAJour = {
      cadreId: selectedCadreData.id,
      matricule: selectedCadreData.matricule,
      nom: selectedCadreData.nom,
      prenom: selectedCadreData.prenom,
      statut_absence: statutAbsence,
      date_debut_absence: dateDebutAbsence,
      motif_absence: motifAbsence === AUTRE_MOTIF_VALUE ? customMotif.trim() : motifAbsence,
      motif_details: motifAbsence === AUTRE_MOTIF_VALUE || !MOTIFS_REQUIRING_OU.includes(motifAbsence) ? null : motifOuDetails.trim(),
      timestamp_mise_a_jour_statut: timestampMiseAJour,
    };

    // Ajouter les détails de permission si nécessaire
    if (motifAbsence === 'perm' && !cadreHasActivePermission) {
      nouvelleMiseAJour.permissionDetails = {
        droitAnnee: droitAnneePerm,
        dateDepart: dateDepartPerm,
        dateArrivee: dateArriveePerm,
        totalJours: totalJoursPermission,
        referenceMessageDepart: referenceMessageDepart,
      };
    }

    setMisesAJourTemporaires([...misesAJourTemporaires, nouvelleMiseAJour]);
    setGroupUpdateMessage({
      type: 'success',
      text: `Mise à jour pour ${selectedCadreData.nom} ${selectedCadreData.prenom} ajoutée au tableau.`
    });

    // Réinitialiser le formulaire après ajout
    resetForm();
  };

  const handleRemoveFromTemporaryList = (cadreIdToRemove) => {
    setMisesAJourTemporaires(misesAJourTemporaires.filter(item => item.cadreId !== cadreIdToRemove));
    setGroupUpdateMessage({
      type: 'info',
      text: `Mise à jour pour le cadre retirée de la liste.`
    });
  };

  const handleGroupUpdate = async () => {
    if (misesAJourTemporaires.length === 0) {
      setGroupUpdateMessage({
        type: 'info',
        text: "Aucune mise à jour à valider."
      });
      return;
    }

    setLoadingGroupUpdate(true);
    setGroupUpdateMessage(null);

    const authToken = token || localStorage.getItem('token');

    if (!authToken) {
      setGroupUpdateMessage({
        type: 'error',
        text: 'Erreur d\'authentification : Vous devez être connecté pour valider les mises à jour.'
      });
      setLoadingGroupUpdate(false);
      return;
    }

    const updatePromises = misesAJourTemporaires.map(item => {
      const payload = {
        statut_absence: item.statut_absence,
        date_debut_absence: item.date_debut_absence,
        motif_absence: item.motif_absence,
        motif_details: item.motif_details,
        timestamp_mise_a_jour_statut: item.timestamp_mise_a_jour_statut,
      };

      if (item.permissionDetails) {
        payload.permissionDetails = item.permissionDetails;
      }

      return fetch(`${API_BASE_URL}api/cadres/${item.cadreId}`, {
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
        return {
          success: true,
          matricule: item.matricule,
          data: await response.json().catch(() => ({}))
        };
      }).catch(error => {
        return {
          success: false,
          matricule: item.matricule,
          message: error.message || `Erreur réseau pour ${item.matricule}`
        };
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
          const failedItem = misesAJourTemporaires.find(item =>
            item.matricule === (result.value?.matricule || result.reason?.matricule)
          );
          const identifier = failedItem ?
            `${failedItem.matricule} (ID: ${failedItem.cadreId})` :
            (result.value?.matricule || 'un cadre');
          errorMessages.push(
            result.status === 'fulfilled' ?
              `${identifier}: ${result.value.message}` :
              `Échec requête pour ${identifier}: ${result.reason?.message || 'Erreur inconnue'}`
          );
        }
      });

      let finalMessageText = '';
      let finalMessageType = 'info';

      if (successCount > 0) {
        finalMessageText += `Succès : ${successCount} mise(s) à jour cadre validée(s).`;
        finalMessageType = 'success';
      }
      if (errorCount > 0) {
        const errorSnippet = errorMessages.slice(0, 3).join('; ') +
          (errorMessages.length > 3 ? '...' : '');
        finalMessageText += `${successCount > 0 ? ' | ' : ''}Échec(s) : ${errorCount} cadre(s) n'ont pas pu être mis à jour (${errorSnippet}).`;
        finalMessageType = successCount > 0 ? 'warning' : 'error';
      }

      // Logique d'enregistrement de la soumission quotidienne
      if (successCount > 0 && user && user.role === 'Standard') {
        try {
          const submissionDate = new Date(serverTime);
          const yyyy = submissionDate.getFullYear();
          const mm = String(submissionDate.getMonth() + 1).padStart(2, '0');
          const dd = String(submissionDate.getDate()).padStart(2, '0');
          const todayDateString = `${yyyy}-${mm}-${dd}`;

          const firstSuccessfulUpdate = results.find(r => r.status === 'fulfilled' && r.value.success);
          const cadreIdForSubmission = firstSuccessfulUpdate ?
            misesAJourTemporaires.find(item => item.matricule === firstSuccessfulUpdate.value.matricule)?.cadreId :
            null;

          if (cadreIdForSubmission) {
            const submitResponse = await fetch(`${API_BASE_URL}api/mises-a-jour/submit`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
              },
              body: JSON.stringify({
                update_date: todayDateString,
                cadre_id: cadreIdForSubmission,
                submitted_by_id: user.id
              }),
            });

            if (!submitResponse.ok) {
              const submitErrorBody = await submitResponse.json().catch(() => ({
                message: `Erreur HTTP : ${submitResponse.status}`
              }));
              console.error('Échec de l\'enregistrement de la soumission quotidienne :', submitErrorBody);
              finalMessageText += ` | Attention : Échec de l'enregistrement de la soumission quotidienne (${submitErrorBody.message || 'erreur inconnue'}).`;
              finalMessageType = finalMessageType === 'error' ? 'error' : 'warning';
            } else {
              const submitSuccessData = await submitResponse.json();
              console.log('Soumission quotidienne enregistrée avec succès :', submitSuccessData);
              finalMessageText += ` | Soumission quotidienne enregistrée.`;

              // Vider la liste temporaire seulement si TOUTES les updates ont réussi
              if (successCount === misesAJourTemporaires.length && errorCount === 0) {
                setMisesAJourTemporaires([]);
                resetForm();
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
      setGroupUpdateMessage({
        type: 'error',
        text: `Erreur inattendue lors de la validation groupée : ${error.message}`
      });
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
              {loadingCadresList && (
                <div className="alert alert-info">Chargement de la liste des cadres...</div>
              )}
              {errorCadresList && (
                <div className="alert alert-danger">{errorCadresList}</div>
              )}
              {!loadingCadresList && !errorCadresList && (!user || user.role !== 'Standard') && (
                <div className="alert alert-warning">
                  Vous devez être connecté avec un compte Standard pour effectuer des mises à jour.
                </div>
              )}

              {loadingServerTime && (
                <div className="alert alert-info">
                  Chargement de l'heure du serveur pour les calculs de date...
                </div>
              )}
              {serverTimeError && (
                <div className="alert alert-warning">{serverTimeError}</div>
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
                      disabled={loadingGroupUpdate || checkingActivePermission || loadingServerTime}
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

                  {checkingActivePermission && selectedCadreId && (
                    <div className="alert alert-info">Vérification de la permission en cours...</div>
                  )}

                  {selectedCadreData && (
                    <div className="card mb-3">
                      <div className="card-header">Informations du Cadre</div>
                      <div className="card-body">
                        <p><strong>Matricule :</strong> {selectedCadreData.matricule}</p>
                        <p><strong>Nom :</strong> {selectedCadreData.nom}</p>
                        <p><strong>Prénom :</strong> {selectedCadreData.prenom}</p>
                        <p><strong>Grade :</strong> {selectedCadreData.grade}</p>
                        <p><strong>Entité/Service :</strong> {selectedCadreData.entite === 'Service' ?
                          selectedCadreData.service :
                          (selectedCadreData.entite === 'Escadron' ?
                            selectedCadreData.EscadronResponsable?.nom || 'N/A' :
                            selectedCadreData.entite || 'N/A')}</p>
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
                      onChange={handleStatutChange}
                      required
                      disabled={loadingGroupUpdate || loadingServerTime}
                    >
                      <option value="">Sélectionner statut</option>
                      <option value="Indisponible">Indisponible</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>

                  {(statutAbsence === 'Indisponible' || statutAbsence === 'Absent') && (
                    <>
                      <div className="mb-3">
                        <label htmlFor="dateDebutAbsence" className="form-label">Date de Début (auto-calculée) :</label>
                        <input
                          type="date"
                          className="form-control"
                          id="dateDebutAbsence"
                          value={dateDebutAbsence}
                          readOnly
                          required
                          disabled={loadingGroupUpdate || loadingServerTime}
                        />
                        <small className="form-text text-muted">
                          La date correspond au début de la période de 24h (à partir de 16h00 du jour précédent)
                          où la mise à jour est enregistrée, basée sur l'heure du serveur.
                        </small>
                      </div>

                      <div className="mb-3">
                        <label htmlFor="motifAbsence" className="form-label">Motif :</label>
                        <select
                          className="form-select"
                          id="motifAbsence"
                          value={motifAbsence}
                          onChange={handleMotifChange}
                          required
                          disabled={loadingGroupUpdate || loadingServerTime}
                        >
                          <option value="">Sélectionner motif</option>
                          {statutAbsence === 'Indisponible' && (
                            <>
                              {INDISPONSIBLE_MOTIFS.map(motif => (
                                <option key={motif} value={motif}>{motif}</option>
                              ))}
                            </>
                          )}
                          {statutAbsence === 'Absent' && (
                            <>
                              {ABSENT_MOTIFS.map(motif => (
                                <option key={motif} value={motif}>{motif}</option>
                              ))}
                            </>
                          )}
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
                            disabled={loadingGroupUpdate || loadingServerTime}
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
                            disabled={loadingGroupUpdate || loadingServerTime}
                          />
                        </div>
                      )}

                      {/* Bloc pour les détails de permission si motif est 'perm' */}
                      {motifAbsence === 'perm' && (
                        <div className="permission-form-section mt-3 p-3 border rounded bg-light">
                          <h6>Détails de la Permission</h6>
                          {cadreHasActivePermission && (
                            <div className="alert alert-warning mt-1">
                              Ce cadre est actuellement en permission. Impossible de déclarer une **nouvelle** permission
                              tant que la précédente n'est pas terminée. Les champs de saisie sont désactivés.
                            </div>
                          )}
                          <div className="mb-3">
                            <p><strong>Droit annuel :</strong> {droitAnnuelDefault} jours</p>
                            <p><strong>Jours de permission déjà pris cette année :</strong> {joursPermissionsPrisAnnee} jours</p>
                            <p className={`font-weight-bold ${joursRestantsPerm < 0 ? 'text-danger' : 'text-success'}`}>
                              <strong>Jours restants cette année :</strong> {joursRestantsPerm} jours
                            </p>
                            {joursRestantsPerm <= 0 && !cadreHasActivePermission && (
                              <small className="form-text text-danger">
                                Attention : Le cadre n'a plus de jours de permission disponibles pour cette année.
                              </small>
                            )}
                          </div>

                          <div className="mb-3">
                            <label htmlFor="droitAnneePerm" className="form-label">Droit (Année) :</label>
                            <input
                              type="number"
                              className="form-control"
                              id="droitAnneePerm"
                              value={droitAnneePerm}
                              onChange={(e) => setDroitAnneePerm(e.target.value)}
                              placeholder="Ex: 2024"
                              required={motifAbsence === 'perm' && !cadreHasActivePermission}
                              disabled={loadingGroupUpdate || cadreHasActivePermission || loadingServerTime}
                            />
                          </div>

                          <div className="mb-3">
                            <label htmlFor="dateDepartPerm" className="form-label">Date de départ (Permission) :</label>
                            <input
                              type="date"
                              className="form-control"
                              id="dateDepartPerm"
                              value={dateDepartPerm}
                              onChange={(e) => setDateDepartPerm(e.target.value)}
                              required={motifAbsence === 'perm' && !cadreHasActivePermission}
                              disabled={loadingGroupUpdate || cadreHasActivePermission || loadingServerTime}
                            />
                          </div>

                          <div className="mb-3">
                            <label htmlFor="dateArriveePerm" className="form-label">Date d'arrivée prévue (Permission) :</label>
                            <input
                              type="date"
                              className="form-control"
                              id="dateArriveePerm"
                              value={dateArriveePerm}
                              onChange={(e) => setDateArriveePerm(e.target.value)}
                              required={motifAbsence === 'perm' && !cadreHasActivePermission}
                              disabled={loadingGroupUpdate || cadreHasActivePermission || loadingServerTime}
                            />
                          </div>

                          {/* Affichage du total de jours de permission */}
                          {(dateDepartPerm && dateArriveePerm && new Date(dateDepartPerm) <= new Date(dateArriveePerm) && !cadreHasActivePermission) && (
                            <div className="mb-3">
                              <p className="form-text text-muted">
                                <strong>Jours de cette permission :</strong> {totalJoursPermission} jour(s)
                              </p>
                            </div>
                          )}

                          <div className="mb-3">
                            <label htmlFor="referenceMessageDepart" className="form-label">Réf. message de départ :</label>
                            <input
                              type="text"
                              className="form-control"
                              id="referenceMessageDepart"
                              value={referenceMessageDepart}
                              onChange={(e) => setReferenceMessageDepart(e.target.value)}
                              placeholder="Référence du document/message"
                              disabled={loadingGroupUpdate || cadreHasActivePermission || loadingServerTime}
                            />
                          </div>
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
                        !isFormValid ||
                        loadingGroupUpdate ||
                        loadingServerTime ||
                        serverTimeError
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
                          <th>Jours Perm.</th>
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
                            <td>
                              {item.motif_absence ? (
                                item.motif_details ?
                                  `${item.motif_absence} (${item.motif_details})` :
                                  item.motif_absence
                              ) : '-'}
                            </td>
                            <td>
                              {item.motif_absence === 'perm' && item.permissionDetails
                                ? `${item.permissionDetails.totalJours}`
                                : '-'}
                            </td>
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