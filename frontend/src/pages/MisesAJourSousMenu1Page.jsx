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

  // États pour la liste des cadres et recherche
  const [allCadresList, setAllCadresList] = useState([]);
  const [loadingCadresList, setLoadingCadresList] = useState(true);
  const [errorCadresList, setErrorCadresList] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // États pour les filtres par entité
  const [filterEntite, setFilterEntite] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterEscadron, setFilterEscadron] = useState('');

  // États pour le cadre sélectionné
  const [selectedCadreId, setSelectedCadreId] = useState('');
  const [selectedCadreData, setSelectedCadreData] = useState(null);

  // États pour le formulaire
  const [statutAbsence, setStatutAbsence] = useState('');
  const [dateDebutAbsence, setDateDebutAbsence] = useState('');
  const [motifAbsence, setMotifAbsence] = useState('');
  const [motifOuDetails, setMotifOuDetails] = useState('');
  const [customMotif, setCustomMotif] = useState('');

  // États pour la gestion de la permission (simplifiés)
  const [dateDepartPerm, setDateDepartPerm] = useState('');
  const [dateArriveePerm, setDateArriveePerm] = useState('');
  const [referenceMessageDepart, setReferenceMessageDepart] = useState('');

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

  // États pour les listes d'entités (pour les filtres)
  const [servicesList, setServicesList] = useState([]);
  const [escadronsList, setEscadronsList] = useState([]);

  // 🔍 DÉBOGAGE INITIAL
  console.log('🔧 DEBUG - Environment variables:');
  console.log('   API_BASE_URL:', API_BASE_URL);
  console.log('   User:', user);
  console.log('   Token present:', !!token);

  // ✅ FONCTION POUR DÉTERMINER L'ENDPOINT SELON LE RÔLE
  const getCadresEndpoint = useCallback(() => {
    if (user?.role === 'Consultant') {
      return `${API_BASE_URL}api/cadres/all`;
    } else {
      return `${API_BASE_URL}api/cadres`;
    }
  }, [user?.role]);

  // ✅ VÉRIFICATION DES DROITS D'ACCÈS
  const canUpdateCadres = useMemo(() => {
    return user && (user.role === 'Standard' || user.role === 'Consultant');
  }, [user]);

  // ✅ FILTRAGE DES CADRES
  const filteredCadresList = useMemo(() => {
    let filtered = [...allCadresList];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(cadre =>
        cadre.matricule?.toLowerCase().includes(searchLower) ||
        cadre.nom?.toLowerCase().includes(searchLower) ||
        cadre.prenom?.toLowerCase().includes(searchLower) ||
        `${cadre.nom} ${cadre.prenom}`.toLowerCase().includes(searchLower)
      );
    }

    if (filterEntite) {
      filtered = filtered.filter(cadre => cadre.entite === filterEntite);
    }

    if (filterService) {
      filtered = filtered.filter(cadre => cadre.service === filterService);
    }

    if (filterEscadron) {
      filtered = filtered.filter(cadre =>
        cadre.EscadronResponsable?.nom === filterEscadron ||
        cadre.EscadronResponsable?.id === parseInt(filterEscadron)
      );
    }

    return filtered;
  }, [allCadresList, searchTerm, filterEntite, filterService, filterEscadron]);

  // ✅ FONCTION POUR GÉRER LES MESSAGES
  const updateMessage = useCallback((message) => {
    setGroupUpdateMessage(message);
  }, []);

  // ✅ FONCTION POUR RÉINITIALISER LE FORMULAIRE
  const resetForm = useCallback(() => {
    setSelectedCadreId('');
    setSelectedCadreData(null);
    setStatutAbsence('');
    setDateDebutAbsence('');
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setDateDepartPerm('');
    setDateArriveePerm('');
    setReferenceMessageDepart('');
    setCadreHasActivePermission(false);
  }, []);

  // ✅ CALCUL DE LA DIFFÉRENCE EN JOURS
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

  // ✅ CALCUL DYNAMIQUE DU TOTAL DE JOURS DE PERMISSION
  const totalJoursPermission = useMemo(() => {
    return calculateDaysDifference(dateDepartPerm, dateArriveePerm);
  }, [dateDepartPerm, dateArriveePerm, calculateDaysDifference]);

  // ✅ CALCUL DE LA DATE DE DÉBUT SELON LA RÈGLE 16H
  const calculateCustomStartDate = useCallback(() => {
    if (!serverTime) {
      console.warn("🔍 Server time not available yet, using local fallback");
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

  // ✅ VALIDATION DU FORMULAIRE
  const isFormValid = useMemo(() => {
    if (!statutAbsence || !dateDebutAbsence || !motifAbsence) return false;
    if (motifAbsence === AUTRE_MOTIF_VALUE && !customMotif.trim()) return false;
    if (motifAbsence !== AUTRE_MOTIF_VALUE && MOTIFS_REQUIRING_OU.includes(motifAbsence) && !motifOuDetails.trim()) return false;

    if (motifAbsence === 'perm') {
      if (cadreHasActivePermission) return false;
      if (!dateDepartPerm || !dateArriveePerm) return false;
      if (new Date(dateDepartPerm) > new Date(dateArriveePerm)) return false;
    }

    return true;
  }, [
    statutAbsence,
    dateDebutAbsence,
    motifAbsence,
    customMotif,
    motifOuDetails,
    cadreHasActivePermission,
    dateDepartPerm,
    dateArriveePerm
  ]);

  // ✅ GESTIONNAIRES D'ÉVÉNEMENTS (NETTOYÉS)
  const handleSelectCadre = useCallback((event) => {
    const cadreId = event.target.value;
    console.log(`🔍 Cadre sélectionné: ${cadreId}`);
    setSelectedCadreId(cadreId);

    const cadre = filteredCadresList.find(c => c.id === parseInt(cadreId));
    console.log(`🔍 Données cadre trouvées:`, cadre);
    setSelectedCadreData(cadre);

    // Reset form fields when a new cadre is selected
    setStatutAbsence('');
    setDateDebutAbsence('');
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setDateDepartPerm('');
    setDateArriveePerm('');
    setReferenceMessageDepart('');
    setCadreHasActivePermission(false);
    setGroupUpdateMessage(null);
  }, [filteredCadresList]);

  const handleMotifChange = useCallback((event) => {
    const selectedMotif = event.target.value;
    console.log(`🔍 Motif sélectionné: ${selectedMotif}`);
    setMotifAbsence(selectedMotif);
    setMotifOuDetails('');
    setCustomMotif('');

    if (selectedMotif !== 'perm') {
      setDateDepartPerm('');
      setDateArriveePerm('');
      setReferenceMessageDepart('');
    }
  }, []);

  const handleStatutChange = useCallback((e) => {
    const newStatut = e.target.value;
    console.log(`🔍 Statut sélectionné: ${newStatut}`);
    setStatutAbsence(newStatut);
    setMotifAbsence('');
    setMotifOuDetails('');
    setCustomMotif('');
    setDateDepartPerm('');
    setDateArriveePerm('');
    setReferenceMessageDepart('');

    if (newStatut === 'Indisponible' || newStatut === 'Absent') {
      const calculatedDate = calculateCustomStartDate();
      console.log(`🔍 Date calculée: ${calculatedDate}`);
      setDateDebutAbsence(calculatedDate);
    } else {
      setDateDebutAbsence('');
    }
  }, [calculateCustomStartDate]);

  const handleSearchChange = useCallback((e) => {
    const searchValue = e.target.value;
    console.log(`🔍 Recherche: "${searchValue}"`);
    setSearchTerm(searchValue);

    if (selectedCadreId) {
      const isStillVisible = filteredCadresList.some(cadre => cadre.id === parseInt(selectedCadreId));
      if (!isStillVisible) {
        console.log(`🔍 Cadre sélectionné plus visible, reset`);
        setSelectedCadreId('');
        setSelectedCadreData(null);
        resetForm();
      }
    }
  }, [selectedCadreId, filteredCadresList, resetForm]);

  const clearSearch = useCallback(() => {
    console.log(`🔍 Effacement recherche`);
    setSearchTerm('');
  }, []);

  const clearFilters = useCallback(() => {
    console.log(`🔍 Effacement filtres`);
    setFilterEntite('');
    setFilterService('');
    setFilterEscadron('');
    setSearchTerm('');
  }, []);

  const handleAddToTemporaryList = useCallback(() => {
    console.log(`🔍 Ajout à la liste temporaire`);
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

    if (motifAbsence === 'perm' && cadreHasActivePermission) {
      setGroupUpdateMessage({
        type: 'warning',
        text: 'Ce cadre a déjà une permission active. Vous ne pouvez pas ajouter une nouvelle permission pour le moment.'
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

    if (motifAbsence === 'perm' && !cadreHasActivePermission) {
      nouvelleMiseAJour.permissionDetails = {
        dateDepart: dateDepartPerm,
        dateArrivee: dateArriveePerm,
        totalJours: totalJoursPermission,
        referenceMessageDepart: referenceMessageDepart,
      };
    }

    console.log(`🔍 Nouvelle mise à jour:`, nouvelleMiseAJour);
    setMisesAJourTemporaires([...misesAJourTemporaires, nouvelleMiseAJour]);
    setGroupUpdateMessage({
      type: 'success',
      text: `Mise à jour pour ${selectedCadreData.nom} ${selectedCadreData.prenom} ajoutée au tableau.`
    });

    resetForm();
  }, [
    selectedCadreData,
    statutAbsence,
    serverTime,
    isFormValid,
    motifAbsence,
    cadreHasActivePermission,
    misesAJourTemporaires,
    dateDebutAbsence,
    customMotif,
    motifOuDetails,
    dateDepartPerm,
    dateArriveePerm,
    totalJoursPermission,
    referenceMessageDepart,
    resetForm
  ]);

  const handleRemoveFromTemporaryList = useCallback((cadreIdToRemove) => {
    console.log(`🔍 Suppression de la liste temporaire: ${cadreIdToRemove}`);
    setMisesAJourTemporaires(misesAJourTemporaires.filter(item => item.cadreId !== cadreIdToRemove));
    setGroupUpdateMessage({
      type: 'info',
      text: `Mise à jour pour le cadre retirée de la liste.`
    });
  }, [misesAJourTemporaires]);

  const handleGroupUpdate = useCallback(async () => {
    console.log(`🔍 Début validation groupée de ${misesAJourTemporaires.length} éléments`);

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
    console.log(`🔍 Token pour validation:`, !!authToken);

    if (!authToken) {
      setGroupUpdateMessage({
        type: 'error',
        text: 'Erreur d\'authentification : Vous devez être connecté pour valider les mises à jour.'
      });
      setLoadingGroupUpdate(false);
      return;
    }

    const updatePromises = misesAJourTemporaires.map((item, index) => {
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

      const updateUrl = `${API_BASE_URL}api/cadres/${item.cadreId}`;
      console.log(`🔍 Update ${index + 1}/${misesAJourTemporaires.length} - URL: ${updateUrl}`);
      console.log(`🔍 Payload:`, payload);

      return fetch(updateUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(payload),
      }).then(async response => {
        console.log(`🔍 Response ${index + 1} status: ${response.status}`);

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            const htmlText = await response.text();
            console.log(`🔴 HTML Response pour ${item.matricule}:`, htmlText.substring(0, 200));
            return {
              success: false,
              matricule: item.matricule,
              message: `Erreur: L'API retourne du HTML au lieu de JSON (Status: ${response.status})`
            };
          }

          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            matricule: item.matricule,
            message: errorData.message || `Erreur HTTP : ${response.status}`
          };
        }

        const responseData = await response.json().catch(() => ({}));
        console.log(`✅ Success ${index + 1}:`, responseData);
        return {
          success: true,
          matricule: item.matricule,
          data: responseData
        };
      }).catch(error => {
        console.log(`🔴 Network error ${index + 1}:`, error);
        return {
          success: false,
          matricule: item.matricule,
          message: error.message || `Erreur réseau pour ${item.matricule}`
        };
      });
    });

    try {
      const results = await Promise.allSettled(updatePromises);
      console.log(`🔍 Résultats validation:`, results);

      let successCount = 0;
      let errorCount = 0;
      const errorMessages = [];

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.success) {
          successCount++;
          console.log(`✅ Success ${index + 1}:`, result.value.matricule);
        } else {
          errorCount++;
          const failedItem = misesAJourTemporaires.find(item =>
            item.matricule === (result.value?.matricule || result.reason?.matricule)
          );
          const identifier = failedItem ?
            `${failedItem.matricule} (ID: ${failedItem.cadreId})` :
            (result.value?.matricule || 'un cadre');
          const errorMsg = result.status === 'fulfilled' ?
            `${identifier}: ${result.value.message}` :
            `Échec requête pour ${identifier}: ${result.reason?.message || 'Erreur inconnue'}`;

          console.log(`🔴 Error ${index + 1}:`, errorMsg);
          errorMessages.push(errorMsg);
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

      if (successCount > 0 && user && (user.role === 'Standard' || user.role === 'Consultant')) {
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
            const submitUrl = `${API_BASE_URL}api/mises-a-jour/submit`;
            console.log(`🔍 Soumission quotidienne URL: ${submitUrl}`);

            const submitResponse = await fetch(submitUrl, {
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
              console.error('🔴 Échec soumission quotidienne:', submitErrorBody);
              finalMessageText += ` | Attention : Échec de l'enregistrement de la soumission quotidienne (${submitErrorBody.message || 'erreur inconnue'}).`;
              finalMessageType = finalMessageType === 'error' ? 'error' : 'warning';
            } else {
              const submitSuccessData = await submitResponse.json();
              console.log('✅ Soumission quotidienne enregistrée:', submitSuccessData);
              finalMessageText += ` | Soumission quotidienne enregistrée.`;

              if (successCount === misesAJourTemporaires.length && errorCount === 0) {
                setMisesAJourTemporaires([]);
                resetForm();
              }
            }
          }
        } catch (submitError) {
          console.error('🔴 Erreur soumission quotidienne:', submitError);
          finalMessageText += ` | Attention : Erreur technique lors de l'enregistrement de la soumission quotidienne.`;
          finalMessageType = finalMessageType === 'error' ? 'error' : 'warning';
        }
      }

      setGroupUpdateMessage({ type: finalMessageType, text: finalMessageText });

    } catch (error) {
      console.error("🔴 Erreur inattendue validation groupée:", error);
      setGroupUpdateMessage({
        type: 'error',
        text: `Erreur inattendue lors de la validation groupée : ${error.message}`
      });
    } finally {
      setLoadingGroupUpdate(false);
    }
  }, [misesAJourTemporaires, token, user, serverTime, resetForm]);

  // ✅ EXTRACTION DES LISTES UNIQUES POUR LES FILTRES
  useEffect(() => {
    if (allCadresList.length > 0) {
      console.log(`🔍 Extraction des filtres à partir de ${allCadresList.length} cadres`);

      const uniqueServices = [...new Set(
        allCadresList
          .filter(cadre => cadre.service && cadre.entite === 'Service')
          .map(cadre => cadre.service)
      )].sort();
      console.log(`🔍 Services trouvés:`, uniqueServices);
      setServicesList(uniqueServices);

      const uniqueEscadrons = [...new Set(
        allCadresList
          .filter(cadre => cadre.EscadronResponsable?.nom && cadre.entite === 'Escadron')
          .map(cadre => cadre.EscadronResponsable.nom)
      )].sort();
      console.log(`🔍 Escadrons trouvés:`, uniqueEscadrons);
      setEscadronsList(uniqueEscadrons);
    }
  }, [allCadresList]);

  // 🔍 RÉCUPÉRATION DE L'HEURE DU SERVEUR AVEC DÉBOGAGE
  useEffect(() => {
    const fetchServerTime = async () => {
      setLoadingServerTime(true);
      setServerTimeError(null);

      const serverTimeUrl = `${API_BASE_URL}api/server-time`;
      console.log(`🔍 Fetching server time from: ${serverTimeUrl}`);

      try {
        const response = await fetch(serverTimeUrl);
        console.log(`🔍 Server time response status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const contentType = response.headers.get('content-type');
        console.log(`🔍 Server time content-type: ${contentType}`);

        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await response.text();
          console.log(`🔴 Server time non-JSON response:`, responseText.substring(0, 200));
          throw new Error(`L'API server-time retourne du ${contentType || 'contenu inconnu'} au lieu de JSON`);
        }

        const data = await response.json();
        console.log(`✅ Server time data:`, data);
        setServerTime(new Date(data.serverTime));
      } catch (error) {
        console.error("🔴 Erreur récupération heure serveur:", error);
        setServerTimeError("Impossible de récupérer l'heure du serveur. Utilisation de l'heure locale.");
        setServerTime(new Date());
      } finally {
        setLoadingServerTime(false);
      }
    };
    fetchServerTime();
  }, []);

  // 🔍 CHARGER LES CADRES SELON LE RÔLE AVEC DÉBOGAGE COMPLET
  useEffect(() => {
    const fetchCadres = async () => {
      console.log(`🔍 fetchCadres appelé - token: ${!!token}, canUpdateCadres: ${canUpdateCadres}`);

      if (!token || !canUpdateCadres) {
        console.log(`🔍 Pas de token ou droits insuffisants, arrêt`);
        setLoadingCadresList(false);
        setAllCadresList([]);
        return;
      }

      setLoadingCadresList(true);
      setErrorCadresList(null);

      try {
        const endpoint = getCadresEndpoint();
        console.log(`🔍 Fetching cadres from: ${endpoint}`);
        console.log(`🔑 Token présent: ${!!token}`);
        console.log(`👤 User role: ${user?.role}`);
        console.log(`🔧 API_BASE_URL: ${API_BASE_URL}`);

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response ok: ${response.ok}`);
        console.log(`📊 Response statusText: ${response.statusText}`);

        if (!response.ok) {
          // ✅ DÉBOGAGE : Vérifier le contenu de la réponse
          const contentType = response.headers.get('content-type');
          console.log(`📄 Content-Type: ${contentType}`);

          if (contentType && contentType.includes('text/html')) {
            const htmlText = await response.text();
            console.log(`🔴 HTML Response (first 500 chars):`, htmlText.substring(0, 500));

            // Vérifier si c'est une page d'erreur spécifique
            if (htmlText.includes('404') || htmlText.includes('Not Found')) {
              throw new Error(`Endpoint non trouvé (404). Vérifiez que l'API est démarrée et que la route existe: ${endpoint}`);
            } else if (htmlText.includes('401') || htmlText.includes('Unauthorized')) {
              throw new Error(`Non autorisé (401). Problème d'authentification avec le token.`);
            } else if (htmlText.includes('403') || htmlText.includes('Forbidden')) {
              throw new Error(`Accès interdit (403). L'utilisateur n'a pas les droits pour accéder à cette ressource.`);
            } else {
              throw new Error(`L'endpoint retourne du HTML au lieu de JSON. Status: ${response.status}. Vérifiez que le serveur API est démarré.`);
            }
          }

          const errorBody = await response.json().catch(() => ({
            message: `Erreur HTTP: ${response.status}`
          }));
          throw new Error(errorBody.message || `Erreur réseau ou serveur, statut: ${response.status}`);
        }

        // ✅ VÉRIFIER LE CONTENT-TYPE AVANT DE PARSER
        const contentType = response.headers.get('content-type');
        console.log(`📄 Success Content-Type: ${contentType}`);

        if (!contentType || !contentType.includes('application/json')) {
          const responseText = await response.text();
          console.log(`🔴 Non-JSON Success Response:`, responseText.substring(0, 500));
          throw new Error(`L'API retourne du ${contentType || 'contenu inconnu'} au lieu de JSON`);
        }

        const data = await response.json();
        console.log(`✅ Data received: ${Array.isArray(data) ? data.length : 'not array'} cadres`);
        console.log(`✅ Sample data:`, Array.isArray(data) ? data.slice(0, 2) : data);

        if (!Array.isArray(data)) {
          console.log(`🔴 Data is not an array:`, typeof data, data);
          throw new Error(`L'API ne retourne pas un tableau de cadres`);
        }

        setAllCadresList(data);

      } catch (error) {
        console.error("🔴 Erreur lors du chargement de la liste des cadres:", error);
        setErrorCadresList(`Impossible de charger la liste des cadres : ${error.message}`);
        setAllCadresList([]);
      } finally {
        setLoadingCadresList(false);
      }
    };

    fetchCadres();
  }, [token, canUpdateCadres, getCadresEndpoint, user?.role]);

  // 🔍 VÉRIFIER LES PERMISSIONS ACTIVES AVEC DÉBOGAGE
  useEffect(() => {
    const checkCadrePermissionStatus = async () => {
      console.log(`🔍 Vérification permission pour cadre: ${selectedCadreId}, token: ${!!token}`);

      if (!selectedCadreId || !token) {
        console.log(`🔍 Pas de cadre sélectionné ou token, skip permission check`);
        setCadreHasActivePermission(false);
        return;
      }

      setCheckingActivePermission(true);

      const permissionUrl = `${API_BASE_URL}api/permissions/active/${selectedCadreId}`;
      console.log(`🔍 Checking permission at: ${permissionUrl}`);

      try {
        const activePermResponse = await fetch(permissionUrl, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
        });

        console.log(`🔍 Permission response status: ${activePermResponse.status}`);

        if (!activePermResponse.ok) {
          if (activePermResponse.status === 404) {
            console.log(`🔍 Aucune permission active trouvée (404)`);
            setCadreHasActivePermission(false);
            updateMessage(null);
          } else {
            const contentType = activePermResponse.headers.get('content-type');
            if (contentType && contentType.includes('text/html')) {
              const htmlText = await activePermResponse.text();
              console.log(`🔴 Permission HTML Response:`, htmlText.substring(0, 200));
              setCadreHasActivePermission(false);
              updateMessage({
                type: 'warning',
                text: `Erreur de vérification permission: L'API retourne du HTML (Status: ${activePermResponse.status})`
              });
            } else {
              const errorBody = await activePermResponse.json().catch(() => ({}));
              console.error("🔴 Erreur vérification permission:", errorBody);
              setCadreHasActivePermission(false);
              updateMessage({
                type: 'warning',
                text: `Impossible de vérifier le statut de permission. (${errorBody.message || activePermResponse.status})`
              });
            }
          }
        } else {
          const activePermData = await activePermResponse.json();
          console.log(`✅ Permission data:`, activePermData);
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
      } catch (error) {
        console.error("🔴 Erreur réseau vérification permission:", error);
        setCadreHasActivePermission(false);
        updateMessage({
          type: 'warning',
          text: `Erreur réseau lors de la vérification : ${error.message}`
        });
      } finally {
        setCheckingActivePermission(false);
      }
    };

    checkCadrePermissionStatus();
  }, [selectedCadreId, token, updateMessage]);

  // Si l'utilisateur n'a pas les droits d'accès
  if (!canUpdateCadres) {
    return (
      <div className="container mt-4">
        <div className="alert alert-warning text-center">
          <h4><i className="bi bi-exclamation-triangle"></i> Accès Restreint</h4>
          <p className="mb-0">
            {user?.role === 'Admin'
              ? 'Les administrateurs ne peuvent pas effectuer de mises à jour. Veuillez vous connecter avec un compte Standard ou Consultant.'
              : 'Vous devez être connecté avec un compte Standard ou Consultant pour accéder à cette fonctionnalité.'
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4 mb-5">



      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-primary">
            <div className="card-header bg-primary text-white">
              <h1 className="h4 mb-0">
                <i className="bi bi-pencil-square me-2"></i>
                Mise à Jour Absence Cadre
                <span className="badge bg-light text-primary ms-2">
                  {user?.role === 'Consultant' ? 'Mode Service de semaine (Accès Global)' : 'Mode Standard (Entité Limitée)'}
                </span>
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-3 mb-md-0">
          <div className="card h-100">
            <div className="card-header bg-info text-white">
              <h5 className="mb-0">
                <i className="bi bi-person-fill-gear me-2"></i>
                Informations et Mise à Jour du Cadre
              </h5>
            </div>
            <div className="card-body">
              {loadingCadresList && (
                <div className="alert alert-info">
                  <div className="d-flex align-items-center">
                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                    Chargement de la liste des cadres...
                  </div>
                </div>
              )}

              {errorCadresList && (
                <div className="alert alert-danger">
                  <i className="bi bi-exclamation-triangle me-2"></i>
                  <strong>Erreur de chargement:</strong><br/>
                  {errorCadresList}
                  <hr/>
                  <small>
                    <strong>Solutions possibles:</strong><br/>
                    1. Vérifiez que votre serveur backend est démarré<br/>
                    2. Vérifiez l'URL de l'API dans vos variables d'environnement<br/>
                    3. Vérifiez que les routes API sont correctement définies<br/>
                    4. Consultez les logs de la console pour plus de détails
                  </small>
                </div>
              )}

              {loadingServerTime && (
                <div className="alert alert-info">
                  <div className="d-flex align-items-center">
                    <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                    Chargement de l'heure du serveur pour les calculs de date...
                  </div>
                </div>
              )}

              {serverTimeError && (
                <div className="alert alert-warning">
                  <i className="bi bi-clock me-2"></i>
                  {serverTimeError}
                </div>
              )}

              {!loadingCadresList && !errorCadresList && allCadresList.length > 0 && (
                <>
                  {/* Section Filtres Avancés */}
                  <div className="card mb-3 border-secondary">
                    <div className="card-header bg-light">
                      <h6 className="mb-0">
                        <i className="bi bi-funnel me-2"></i>
                        Filtres de Recherche
                        <button
                          className="btn btn-outline-secondary btn-sm float-end"
                          onClick={clearFilters}
                          title="Effacer tous les filtres"
                        >
                          <i className="bi bi-arrow-counterclockwise"></i> Effacer
                        </button>
                      </h6>
                    </div>
                    <div className="card-body">
                      {/* Barre de recherche */}
                      <div className="mb-3">
                        <label htmlFor="searchCadre" className="form-label">
                          <i className="bi bi-search me-1"></i>
                          Rechercher un Cadre :
                        </label>
                        <div className="input-group">
                          <span className="input-group-text">
                            <i className="bi bi-person-search"></i>
                          </span>
                          <input
                            type="text"
                            className="form-control"
                            id="searchCadre"
                            placeholder="Rechercher par matricule, nom ou prénom..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            disabled={loadingGroupUpdate || checkingActivePermission || loadingServerTime}
                          />
                          {searchTerm && (
                            <button
                              className="btn btn-outline-secondary"
                              type="button"
                              onClick={clearSearch}
                              title="Effacer la recherche"
                            >
                              <i className="bi bi-x"></i>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Filtres par entité */}
                      <div className="row">
                        <div className="col-md-4 mb-2">
                          <label htmlFor="filterEntite" className="form-label">
                            <i className="bi bi-building me-1"></i>
                            Entité :
                          </label>
                          <select
                            className="form-select form-select-sm"
                            id="filterEntite"
                            value={filterEntite}
                            onChange={(e) => {
                              setFilterEntite(e.target.value);
                              setFilterService('');
                              setFilterEscadron('');
                            }}
                            disabled={loadingGroupUpdate || checkingActivePermission}
                          >
                            <option value="">Toutes les entités</option>
                            <option value="Service">Service</option>
                            <option value="Escadron">Escadron</option>
                            <option value="None">Aucune</option>
                          </select>
                        </div>

                        {filterEntite === 'Service' && (
                          <div className="col-md-4 mb-2">
                            <label htmlFor="filterService" className="form-label">
                              <i className="bi bi-gear me-1"></i>
                              Service :
                            </label>
                            <select
                              className="form-select form-select-sm"
                              id="filterService"
                              value={filterService}
                              onChange={(e) => setFilterService(e.target.value)}
                              disabled={loadingGroupUpdate || checkingActivePermission}
                            >
                              <option value="">Tous les services</option>
                              {servicesList.map(service => (
                                <option key={service} value={service}>{service}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {filterEntite === 'Escadron' && (
                          <div className="col-md-4 mb-2">
                            <label htmlFor="filterEscadron" className="form-label">
                              <i className="bi bi-shield me-1"></i>
                              Escadron :
                            </label>
                            <select
                              className="form-select form-select-sm"
                              id="filterEscadron"
                              value={filterEscadron}
                              onChange={(e) => setFilterEscadron(e.target.value)}
                              disabled={loadingGroupUpdate || checkingActivePermission}
                            >
                              <option value="">Tous les escadrons</option>
                              {escadronsList.map(escadron => (
                                <option key={escadron} value={escadron}>{escadron}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Indicateur de résultats */}
                      <div className="text-muted small">
                        <i className="bi bi-info-circle me-1"></i>
                        {filteredCadresList.length} cadre(s) trouvé(s) sur {allCadresList.length} au total
                        {user?.role === 'Consultant' && (
                          <span className="badge bg-success ms-2">Accès Global</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menu déroulant des cadres */}
                  <div className="mb-3">
                    <label htmlFor="selectCadre" className="form-label">
                      <i className="bi bi-person-check me-1"></i>
                      Sélectionner un Cadre :
                    </label>
                    <select
                      className="form-select"
                      id="selectCadre"
                      value={selectedCadreId}
                      onChange={handleSelectCadre}
                      disabled={loadingGroupUpdate || checkingActivePermission || loadingServerTime}
                      required
                    >
                      <option value="">-- Sélectionner un cadre --</option>
                      {filteredCadresList.map(cadre => (
                        <option key={cadre.id} value={cadre.id}>
                          {cadre.nom} {cadre.prenom} ({cadre.matricule}) - {
                            cadre.entite === 'Service' ? cadre.service :
                            cadre.entite === 'Escadron' ? (cadre.EscadronResponsable?.nom || 'N/A') :
                            cadre.entite || 'N/A'
                          }
                        </option>
                      ))}
                    </select>
                  </div>

                  {checkingActivePermission && selectedCadreId && (
                    <div className="alert alert-info">
                      <div className="d-flex align-items-center">
                        <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        Vérification de la permission en cours...
                      </div>
                    </div>
                  )}

                  {selectedCadreData && (
                    <div className="card mb-3 border-success">
                      <div className="card-header bg-success text-white">
                        <h6 className="mb-0">
                          <i className="bi bi-person-badge me-2"></i>
                          Informations du Cadre Sélectionné
                        </h6>
                      </div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <p><strong><i className="bi bi-hash"></i> Matricule :</strong> {selectedCadreData.matricule}</p>
                            <p><strong><i className="bi bi-person"></i> Nom :</strong> {selectedCadreData.nom}</p>
                            <p><strong><i className="bi bi-person"></i> Prénom :</strong> {selectedCadreData.prenom}</p>
                          </div>
                          <div className="col-md-6">
                            <p><strong><i className="bi bi-award"></i> Grade :</strong> {selectedCadreData.grade}</p>
                            <p><strong><i className="bi bi-building"></i> Entité/Service :</strong> {selectedCadreData.entite === 'Service' ?
                              selectedCadreData.service :
                              (selectedCadreData.entite === 'Escadron' ?
                                selectedCadreData.EscadronResponsable?.nom || 'N/A' :
                                selectedCadreData.entite || 'N/A')}</p>
                            <p><strong><i className="bi bi-circle-fill me-1"></i> Statut Actuel :</strong>
                              <span className={`badge ms-1 ${
                                selectedCadreData.statut_absence === 'Présent' ? 'bg-success' :
                                selectedCadreData.statut_absence === 'Absent' ? 'bg-danger' :
                                selectedCadreData.statut_absence === 'Indisponible' ? 'bg-warning text-dark' :
                                'bg-secondary'
                              }`}>
                                {selectedCadreData.statut_absence || 'Non défini'}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedCadreData && (
                <>
                  <hr />
                  <div className="card border-warning">
                    <div className="card-header bg-warning">
                      <h5 className="mb-0">
                        <i className="bi bi-pencil-square me-2"></i>
                        Nouvelle mise à jour pour {selectedCadreData.nom} {selectedCadreData.prenom}
                      </h5>
                    </div>
                    <div className="card-body">
                      <div className="mb-3">
                        <label htmlFor="statutAbsence" className="form-label">
                          <i className="bi bi-toggle-on me-1"></i>
                          Nouveau Statut :
                        </label>
                        <select
                          className="form-select"
                          id="statutAbsence"
                          value={statutAbsence}
                          onChange={handleStatutChange}
                          required
                          disabled={loadingGroupUpdate || loadingServerTime}
                        >
                          <option value="">-- Sélectionner le statut --</option>
                          <option value="Présent">Présent</option>
                          <option value="Absent">Absent</option>
                          <option value="Indisponible">Indisponible</option>
                        </select>
                      </div>

                      {(statutAbsence === 'Indisponible' || statutAbsence === 'Absent') && (
                        <>
                          <div className="mb-3">
                            <label htmlFor="dateDebutAbsence" className="form-label">
                              <i className="bi bi-calendar-date me-1"></i>
                              Date de début d'absence :
                            </label>
                            <input
                              type="date"
                              className="form-control"
                              id="dateDebutAbsence"
                              value={dateDebutAbsence}
                              onChange={(e) => setDateDebutAbsence(e.target.value)}
                              required
                              disabled={loadingGroupUpdate}
                            />
                          </div>

                          <div className="mb-3">
                            <label htmlFor="motifAbsence" className="form-label">
                              <i className="bi bi-card-text me-1"></i>
                              Motif d'absence :
                            </label>
                            <select
                              className="form-select"
                              id="motifAbsence"
                              value={motifAbsence}
                              onChange={handleMotifChange}
                              required
                              disabled={loadingGroupUpdate}
                            >
                              <option value="">-- Sélectionner le motif --</option>
                              {statutAbsence === 'Indisponible' && INDISPONSIBLE_MOTIFS.map((motif) => (
                                <option key={motif} value={motif}>{motif}</option>
                              ))}
                              {statutAbsence === 'Absent' && ABSENT_MOTIFS.map((motif) => (
                                <option key={motif} value={motif}>{motif}</option>
                              ))}
                              <option value={AUTRE_MOTIF_VALUE}>Autre (personnalisé)</option>
                            </select>
                          </div>

                          {motifAbsence === AUTRE_MOTIF_VALUE && (
                            <div className="mb-3">
                              <label htmlFor="customMotif" className="form-label">
                                <i className="bi bi-pencil me-1"></i>
                                Motif personnalisé :
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                id="customMotif"
                                placeholder="Entrez le motif personnalisé"
                                value={customMotif}
                                onChange={(e) => setCustomMotif(e.target.value)}
                                required
                                disabled={loadingGroupUpdate}
                              />
                            </div>
                          )}

                          {motifAbsence !== AUTRE_MOTIF_VALUE && MOTIFS_REQUIRING_OU.includes(motifAbsence) && (
                            <div className="mb-3">
                              <label htmlFor="motifOuDetails" className="form-label">
                                <i className="bi bi-file-text me-1"></i>
                                Détails / Ordre d'Unité :
                              </label>
                              <input
                                type="text"
                                className="form-control"
                                id="motifOuDetails"
                                placeholder="Référence de l'ordre d'unité ou détails"
                                value={motifOuDetails}
                                onChange={(e) => setMotifOuDetails(e.target.value)}
                                required
                                disabled={loadingGroupUpdate}
                              />
                            </div>
                          )}

                          {/* Section Permission Simplifiée */}
                          {motifAbsence === 'perm' && (
                            <div className="card border-primary mt-3">
                              <div className="card-header bg-primary text-white">
                                <h6 className="mb-0">
                                  <i className="bi bi-calendar-week me-2"></i>
                                  Détails de la Permission (Simplifiée)
                                </h6>
                              </div>
                              <div className="card-body">
                                {cadreHasActivePermission && (
                                  <div className="alert alert-warning">
                                    <i className="bi bi-exclamation-triangle me-2"></i>
                                    <strong>Attention :</strong> Ce cadre a déjà une permission active.
                                  </div>
                                )}

                                <div className="row">
                                  <div className="col-md-6 mb-3">
                                    <label htmlFor="dateDepartPerm" className="form-label">
                                      <i className="bi bi-calendar-plus me-1"></i>
                                      Date de départ :
                                    </label>
                                    <input
                                      type="date"
                                      className="form-control"
                                      id="dateDepartPerm"
                                      value={dateDepartPerm}
                                      onChange={(e) => setDateDepartPerm(e.target.value)}
                                      required={motifAbsence === 'perm'}
                                      disabled={loadingGroupUpdate || cadreHasActivePermission}
                                    />
                                  </div>

                                  <div className="col-md-6 mb-3">
                                    <label htmlFor="dateArriveePerm" className="form-label">
                                      <i className="bi bi-calendar-minus me-1"></i>
                                      Date d'arrivée :
                                    </label>
                                    <input
                                      type="date"
                                      className="form-control"
                                      id="dateArriveePerm"
                                      value={dateArriveePerm}
                                      onChange={(e) => setDateArriveePerm(e.target.value)}
                                      required={motifAbsence === 'perm'}
                                      disabled={loadingGroupUpdate || cadreHasActivePermission}
                                    />
                                  </div>
                                </div>

                                <div className="mb-3">
                                  <label htmlFor="referenceMessageDepart" className="form-label">
                                    <i className="bi bi-file-earmark-text me-1"></i>
                                    Référence message de départ :
                                  </label>
                                  <input
                                    type="text"
                                    className="form-control"
                                    id="referenceMessageDepart"
                                    placeholder="Référence du message de départ"
                                    value={referenceMessageDepart}
                                    onChange={(e) => setReferenceMessageDepart(e.target.value)}
                                    disabled={loadingGroupUpdate || cadreHasActivePermission}
                                  />
                                </div>

                                {dateDepartPerm && dateArriveePerm && (
                                  <div className="alert alert-info">
                                    <i className="bi bi-calculator me-2"></i>
                                    <strong>Durée calculée :</strong> {totalJoursPermission} jour(s)
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* Messages de statut */}
                      {groupUpdateMessage && (
                        <div className={`alert alert-${groupUpdateMessage.type === 'success' ? 'success' :
                                       groupUpdateMessage.type === 'error' ? 'danger' :
                                       groupUpdateMessage.type === 'warning' ? 'warning' : 'info'} mt-3`}>
                          <i className={`bi ${groupUpdateMessage.type === 'success' ? 'bi-check-circle' :
                                        groupUpdateMessage.type === 'error' ? 'bi-x-circle' :
                                        groupUpdateMessage.type === 'warning' ? 'bi-exclamation-triangle' :
                                        'bi-info-circle'} me-2`}></i>
                          {groupUpdateMessage.text}
                        </div>
                      )}

                      {/* Bouton d'ajout à la liste */}
                      <div className="d-grid mt-3">
                        <button
                          type="button"
                          className="btn btn-primary btn-lg"
                          onClick={handleAddToTemporaryList}
                          disabled={!isFormValid || loadingGroupUpdate || checkingActivePermission || loadingServerTime}
                        >
                          <i className="bi bi-plus-circle me-2"></i>
                          Ajouter à la liste de validation
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header bg-success text-white">
              <h5 className="mb-0">
                <i className="bi bi-list-check me-2"></i>
                Mises à jour en attente de validation
              </h5>
            </div>
            <div className="card-body">
              {misesAJourTemporaires.length > 0 ? (
                <>
                  <div className="table-responsive">
                    <table className="table table-striped table-hover table-sm">
                      <thead className="table-dark">
                        <tr>
                          <th><i className="bi bi-hash"></i> Matricule</th>
                          <th><i className="bi bi-person"></i> Nom</th>
                          <th><i className="bi bi-toggle-on"></i> Statut</th>
                          <th><i className="bi bi-calendar"></i> Date Début</th>
                          <th><i className="bi bi-card-text"></i> Motif</th>
                          <th><i className="bi bi-calendar-week"></i> Jours Perm.</th>
                          <th><i className="bi bi-gear"></i> Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {misesAJourTemporaires.map((item) => (
                          <tr key={item.cadreId}>
                            <td><code>{item.matricule}</code></td>
                            <td><strong>{item.nom} {item.prenom}</strong></td>
                            <td>
                              <span className={`badge ${
                                item.statut_absence === 'Présent' ? 'bg-success' :
                                item.statut_absence === 'Absent' ? 'bg-danger' :
                                item.statut_absence === 'Indisponible' ? 'bg-warning text-dark' :
                                'bg-secondary'
                              }`}>
                                {item.statut_absence}
                              </span>
                            </td>
                            <td>{item.date_debut_absence || '-'}</td>
                            <td>
                              <small>
                                {item.motif_absence ? (
                                  item.motif_details ?
                                    `${item.motif_absence} (${item.motif_details})` :
                                    item.motif_absence
                                ) : '-'}
                              </small>
                            </td>
                            <td>
                              {item.motif_absence === 'perm' && item.permissionDetails
                                ? <span className="badge bg-info">{item.permissionDetails.totalJours}</span>
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

                  <div className="d-grid mt-3">
                    <button
                      type="button"
                      className="btn btn-success btn-lg"
                      onClick={handleGroupUpdate}
                      disabled={loadingGroupUpdate || misesAJourTemporaires.length === 0}
                    >
                      {loadingGroupUpdate ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                          <span>Validation en cours...</span>
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Valider les {misesAJourTemporaires.length} mise(s) à jour
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="alert alert-light text-center" role="alert">
                  <i className="bi bi-inbox me-2"></i>
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