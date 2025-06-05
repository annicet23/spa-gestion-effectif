import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import Swal from 'sweetalert2';

import PersonList from '../components/PersonList';

// Importations pour la génération de PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment-timezone';

// Importation pour l'exportation Excel
import * as XLSX from 'xlsx';

// Définir une structure de données par défaut pour les statistiques
const defaultStats = {
    total: 0,
    absent: 0,
    present: 0,
    indisponible: 0,
    surLeRang: 0,
};

// Structure pour stocker les données des listes
const defaultPersonListData = {
    cadre: {
        absent: [],
        indisponible: []
    }
};

// Helper function to group and count motifs
const groupAndCountMotifs = (peopleList) => {
    if (!peopleList || peopleList.length === 0) {
        return {};
    }
    const motifCounts = {};
    peopleList.forEach(person => {
        const motif = person.motif_absence || 'Motif inconnu';
        motifCounts[motif] = (motifCounts[motif] || 0) + 1;
    });
    return motifCounts;
};

// Helper function pour obtenir la date historique
const getHistoricalDate = (realTime, timezone = 'Indian/Antananarivo') => {
    const momentDate = moment.tz(realTime, timezone);
    return momentDate.hour() >= 16 ?
           momentDate.clone().add(1, 'day') :
           momentDate.clone();
};

function HomePage() {
    const { user, token, login } = useAuth();

    // --- États existants ---
    const [cadreStats, setCadreStats] = useState(defaultStats);
    const [personListData, setPersonListData] = useState(defaultPersonListData);
    const [displayListInfo, setDisplayListInfo] = useState(null);
    const [isLoadingStats, setIsLoadingStats] = useState(true);
    const [isLoadingList, setIsLoadingList] = useState({ cadre: { absent: false, indisponible: false } });
    const [errorList, setErrorList] = useState({ cadre: { absent: null, indisponible: null } });
    const [errorStats, setErrorStats] = useState(null);
    const [displayDateLabel, setDisplayDateLabel] = useState('');
    const [printDate, setPrintDate] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [printCategory, setPrintCategory] = useState(null);

    // --- États pour les filtres ---
    const [selectedService, setSelectedService] = useState('');
    const [selectedEscadron, setSelectedEscadron] = useState('');
    const [availableServices, setAvailableServices] = useState([]);
    const [availableEscadrons, setAvailableEscadrons] = useState([]);
    const [isLoadingFilters, setIsLoadingFilters] = useState(false);

    // --- État pour l'exportation Excel ---
    const [isExporting, setIsExporting] = useState(false);

    // ✅ NOUVEAUX ÉTATS POUR LA ROTATION
    const [isCheckingRotation, setIsCheckingRotation] = useState(false);
    const [rotationProcessed, setRotationProcessed] = useState(false);

    const printAreaRef = useRef(null);

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

    // ✅ FONCTION DE ROTATION DES CONSULTANTS
    const handleConsultantRotation = async () => {
        console.log('🔄 Démarrage du processus de rotation consultant depuis HomePage');

        try {
            // Étape 1: Demander le matricule du nouveau responsable
            const { value: newMatricule, dismiss: matriculeDismiss } = await Swal.fire({
                title: '🔄 Rotation hebdomadaire requise',
                text: 'Votre compte consultant doit être mis à jour. Veuillez saisir le matricule du nouveau responsable.',
                input: 'text',
                inputPlaceholder: 'Matricule du nouveau responsable',
                showCancelButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                confirmButtonText: 'Suivant',
                customClass: {
                    popup: 'animated-popup',
                    confirmButton: 'swal-confirm-btn'
                },
                inputValidator: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Le matricule du nouveau responsable est requis !';
                    }
                }
            });

            if (matriculeDismiss) return false;

            // Étape 2: Vérifier si le cadre existe
            const cadreResponse = await fetch(`${API_BASE_URL}api/cadres/matricule/${newMatricule.trim()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!cadreResponse.ok) {
                Swal.fire({
                    title: 'Erreur',
                    text: 'Matricule non trouvé. Veuillez vérifier le matricule du nouveau responsable.',
                    icon: 'error',
                    customClass: { popup: 'animated-popup' }
                });
                return await handleConsultantRotation(); // Retry
            }

            const newCadreData = await cadreResponse.json();

            // Étape 3: Formulaire complet de rotation
            const { value: rotationData, dismiss: rotationDismiss } = await Swal.fire({
                title: '🔐 Finalisation de la rotation',
                html: `
                    <div class="rotation-form">
                        <div class="mb-3">
                            <p><strong>Nouveau responsable:</strong> ${newCadreData.grade} ${newCadreData.nom} ${newCadreData.prenom}</p>
                            <p><strong>Entité:</strong> ${newCadreData.entite} ${newCadreData.service || newCadreData.cours || ''}</p>
                        </div>
                        <hr>
                        <div class="mb-3">
                            <label class="form-label">Mot de passe actuel (sécurité):</label>
                            <input id="current-password" type="password" class="swal2-input" placeholder="Votre mot de passe actuel">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Nouveau nom d'utilisateur:</label>
                            <input id="new-username" type="text" class="swal2-input" placeholder="Nouveau nom d'utilisateur">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Nouveau mot de passe:</label>
                            <input id="new-password" type="password" class="swal2-input" placeholder="Nouveau mot de passe">
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Confirmer le nouveau mot de passe:</label>
                            <input id="confirm-password" type="password" class="swal2-input" placeholder="Confirmer le mot de passe">
                        </div>
                    </div>
                `,
                showCancelButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                confirmButtonText: 'Effectuer la rotation',
                customClass: {
                    popup: 'animated-popup rotation-popup',
                    confirmButton: 'swal-confirm-btn'
                },
                preConfirm: () => {
                    const currentPassword = document.getElementById('current-password').value;
                    const newUsername = document.getElementById('new-username').value;
                    const newPassword = document.getElementById('new-password').value;
                    const confirmPassword = document.getElementById('confirm-password').value;

                    if (!currentPassword || !newUsername || !newPassword || !confirmPassword) {
                        Swal.showValidationMessage('Tous les champs sont requis.');
                        return false;
                    }

                    if (newPassword !== confirmPassword) {
                        Swal.showValidationMessage('Les mots de passe ne correspondent pas.');
                        return false;
                    }

                    if (newPassword.length < 6) {
                        Swal.showValidationMessage('Le mot de passe doit faire au moins 6 caractères.');
                        return false;
                    }

                    if (newUsername.length < 3) {
                        Swal.showValidationMessage('Le nom d\'utilisateur doit faire au moins 3 caractères.');
                        return false;
                    }

                    return {
                        currentPassword,
                        newUsername: newUsername.trim(),
                        newPassword,
                        newCadreId: newCadreData.id,
                        newMatricule: newMatricule.trim()
                    };
                }
            });

            if (rotationDismiss) return false;

            // Étape 4: Envoyer la demande de rotation au backend
            setIsCheckingRotation(true);
            const rotationResponse = await fetch(`${API_BASE_URL}api/auth/rotate-consultant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: rotationData.currentPassword,
                    newUsername: rotationData.newUsername,
                    newPassword: rotationData.newPassword,
                    newCadreId: rotationData.newCadreId,
                    newMatricule: rotationData.newMatricule
                })
            });

            const rotationResult = await rotationResponse.json();

            if (rotationResponse.ok) {
                await Swal.fire({
                    title: '✅ Rotation réussie !',
                    html: `
                        <div class="text-center">
                            <p><strong>Votre compte a été mis à jour avec succès.</strong></p>
                            <p>Nouveau responsable: ${newCadreData.grade} ${newCadreData.nom} ${newCadreData.prenom}</p>
                            <p>Nouveau nom d'utilisateur: ${rotationData.newUsername}</p>
                            <p>L'interface va se recharger avec vos nouvelles informations...</p>
                        </div>
                    `,
                    icon: 'success',
                    timer: 3000,
                    showConfirmButton: false,
                    customClass: { popup: 'animated-popup' }
                });

                // Mettre à jour le contexte d'authentification
                login(rotationResult.token, rotationResult.user);
                setRotationProcessed(true);
                return true;
            } else {
                throw new Error(rotationResult.message || 'Erreur lors de la rotation');
            }

        } catch (error) {
            console.error('Erreur rotation consultant:', error);
            await Swal.fire({
                title: 'Erreur de rotation',
                text: error.message || 'Une erreur est survenue lors de la rotation. Veuillez réessayer.',
                icon: 'error',
                customClass: { popup: 'animated-popup' }
            });

            return await handleConsultantRotation();
        } finally {
            setIsCheckingRotation(false);
        }
    };

    // ✅ FONCTION UTILITAIRE - Vérifier si c'est vendredi et rotation nécessaire
    const isFridayAndRotationNeeded = (userData) => {
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Dimanche, 5 = Vendredi

        // Pour les tests, décommentez la ligne suivante pour forcer la rotation
        // return userData.role === 'Consultant' && !rotationProcessed;

        return dayOfWeek === 5 &&
               userData.role === 'Consultant' &&
               userData.needsWeeklyRotation &&
               !rotationProcessed;
    };

    // ✅ VÉRIFICATION DE ROTATION AU CHARGEMENT DE LA PAGE
    useEffect(() => {
        const checkRotationNeed = async () => {
            if (!user || !token || rotationProcessed || isCheckingRotation) return;

            console.log('🔍 Vérification rotation au chargement HomePage:', {
                role: user.role,
                needsWeeklyRotation: user.needsWeeklyRotation,
                rotationProcessed
            });

            if (isFridayAndRotationNeeded(user)) {
                console.log('🔄 Rotation requise - Lancement du processus depuis HomePage');
                setIsCheckingRotation(true);

                setTimeout(async () => {
                    const rotationSuccess = await handleConsultantRotation();
                    if (!rotationSuccess) {
                        setIsCheckingRotation(false);
                    }
                }, 1000);
            }
        };

        checkRotationNeed();
    }, [user, token, rotationProcessed]);

    // --- Récupération des options de filtres ---
    useEffect(() => {
        const fetchFilterOptions = async () => {
            if (!token || isCheckingRotation) return;

            setIsLoadingFilters(true);
            try {
                console.log('🔄 Récupération des options de filtres...');

                // Récupérer les services disponibles
                const servicesResponse = await fetch(`${API_BASE_URL}api/cadres/services`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (servicesResponse.ok) {
                    const servicesData = await servicesResponse.json();
                    console.log('✅ Services récupérés:', servicesData);
                    setAvailableServices(servicesData);
                } else {
                    console.error('❌ Erreur lors de la récupération des services:', servicesResponse.status);
                }

                // Récupérer les escadrons disponibles
                const escadronsResponse = await fetch(`${API_BASE_URL}api/escadrons`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (escadronsResponse.ok) {
                    const escadronsData = await escadronsResponse.json();
                    console.log('✅ Escadrons récupérés:', escadronsData);
                    setAvailableEscadrons(escadronsData);
                } else {
                    console.error('❌ Erreur lors de la récupération des escadrons:', escadronsResponse.status);
                }

            } catch (error) {
                console.error("❌ Erreur lors de la récupération des options de filtres:", error);
            } finally {
                setIsLoadingFilters(false);
            }
        };

        fetchFilterOptions();
    }, [token, user, isCheckingRotation]);

    // --- Récupération des statistiques avec filtres ET CALCULS CORRIGÉS ---
    useEffect(() => {
        const fetchStats = async () => {
            if (!token || isCheckingRotation) return;

            setIsLoadingStats(true);
            setErrorStats(null);

            try {
                console.log('🔄 Récupération des statistiques...');
                console.log('📊 Filtres appliqués:', {
                    service: selectedService || 'TOUS',
                    escadron: selectedEscadron || 'TOUS'
                });

                const currentClientTime = new Date();
                const spaDateMoment = getHistoricalDate(currentClientTime, 'Indian/Antananarivo');
                const formattedSpaDate = spaDateMoment.format('YYYY-MM-DD');

                setDisplayDateLabel(spaDateMoment.format('DD/MM/YYYY'));
                setPrintDate(spaDateMoment.format('DD/MM/YYYY'));

                // Construire les paramètres de requête avec les filtres
                const queryParams = new URLSearchParams();
                queryParams.append('date', formattedSpaDate);

                if (selectedService && selectedService.trim() !== '') {
                    queryParams.append('service', selectedService);
                    console.log('🏢 Filtre service appliqué:', selectedService);
                }
                if (selectedEscadron && selectedEscadron.trim() !== '') {
                    queryParams.append('escadron', selectedEscadron);
                    console.log('🎯 Filtre escadron appliqué:', selectedEscadron);
                }

                const url = `${API_BASE_URL}api/mises-a-jour/cadres/summary?${queryParams.toString()}`;
                console.log('🔗 URL de requête:', url);

                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json()
                        .catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                    throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
                }

                const data = await response.json();
                console.log("✅ Réponse de l'API statistiques:", data);

                // ✅ CALCULS CORRIGÉS SELON VOS SPÉCIFICATIONS
                const cadreTotal = data.total_cadres ?? 0;              // R (Total)
                const cadreAbsent = data.absents_cadres ?? 0;           // A (Absent)
                const cadreIndisponible = data.indisponibles_cadres ?? 0; // I (Indisponible)

                // 🧮 NOUVEAUX CALCULS :
                const cadrePresentCalculated = cadreTotal - cadreAbsent;           // P = R - A
                const cadreSurLeRangCalculated = cadrePresentCalculated - cadreIndisponible; // S = P - I

                const newStats = {
                    total: cadreTotal,                    // R
                    absent: cadreAbsent,                  // A
                    present: cadrePresentCalculated,      // P = R - A ✅
                    indisponible: cadreIndisponible,      // I
                    surLeRang: cadreSurLeRangCalculated   // S = P - I ✅
                };

                console.log('🧮 Statistiques calculées avec nouvelles formules:');
                console.log(`   R (Total): ${newStats.total}`);
                console.log(`   A (Absent): ${newStats.absent}`);
                console.log(`   P (Présent): ${newStats.present} = ${newStats.total} - ${newStats.absent}`);
                console.log(`   I (Indisponible): ${newStats.indisponible}`);
                console.log(`   S (Sur le rang): ${newStats.surLeRang} = ${newStats.present} - ${newStats.indisponible}`);

                setCadreStats(newStats);

            } catch (error) {
                console.error("❌ Erreur lors de la récupération des statistiques:", error);
                setErrorStats(`Impossible de charger les statistiques. Détails: ${error.message || error}.`);
                setCadreStats(defaultStats);
            } finally {
                setIsLoadingStats(false);
            }
        };

        fetchStats();

    }, [token, selectedService, selectedEscadron, isCheckingRotation]);

    // --- Récupération des listes avec filtres ---
    const fetchSpecificList = async (type, category) => {
        if (category !== 'cadre') {
            console.warn(`Liste appelée avec une catégorie non gérée: ${category}`);
            return [];
        }

        if (type !== 'absent' && type !== 'indisponible') {
             console.error(`Liste appelée avec un type non valide: ${type}`);
             return [];
        }

        console.log(`🔄 Récupération de la liste des ${type}s...`);

        setIsLoadingList(prevState => ({
            ...prevState,
            cadre: {
                ...prevState.cadre,
                [type]: true
            }
        }));
        setErrorList(prevState => ({
            ...prevState,
            cadre: {
                ...prevState.cadre,
                [type]: null
            }
        }));

        try {
            const queryParams = new URLSearchParams();
            const backendStatusValue = type === 'absent' ? 'Absent' : 'Indisponible';
            queryParams.append('statut', backendStatusValue);

            const currentClientTime = new Date();
            const spaDateMoment = getHistoricalDate(currentClientTime, 'Indian/Antananarivo');
            const formattedSpaDate = spaDateMoment.format('YYYY-MM-DD');
            queryParams.append('date', formattedSpaDate);

            // Ajouter les filtres actifs
            if (selectedService && selectedService.trim() !== '') {
                queryParams.append('service', selectedService);
                console.log(`🏢 Filtre service appliqué à la liste ${type}:`, selectedService);
            }
            if (selectedEscadron && selectedEscadron.trim() !== '') {
                queryParams.append('escadron', selectedEscadron);
                console.log(`🎯 Filtre escadron appliqué à la liste ${type}:`, selectedEscadron);
            }

            // ✅ ROUTE ADAPTÉE POUR LES CONSULTANTS (accès global)
            const baseUrl = user?.role === 'Consultant' ?
                `${API_BASE_URL}api/cadres/all` :
                `${API_BASE_URL}api/cadres`;

            const url = `${baseUrl}?${queryParams.toString()}`;
            console.log(`🔗 URL pour liste ${type}:`, url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                 if (response.status === 403) {
                     throw new Error("Vous n'avez pas les permissions pour voir cette liste détaillée.");
                 }
                 throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ Liste ${type} récupérée:`, data.length, 'éléments');

            setPersonListData(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: data
                }
            }));

            return data;

        } catch (error) {
            console.error(`❌ Erreur lors de la récupération de la liste ${type}:`, error);
            setErrorList(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: `Impossible de charger la liste. Détails: ${error.message || error}.`
                }
            }));
            setPersonListData(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: []
                }
            }));
            return [];
        } finally {
            setIsLoadingList(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: false
                }
            }));
        }
    };

    // --- Gestionnaire de changement de filtre ---
    const handleServiceChange = (e) => {
        const newService = e.target.value;
        console.log('🏢 Changement de service:', newService);
        setSelectedService(newService);
        setDisplayListInfo(null);
        setPersonListData(defaultPersonListData);
    };

    const handleEscadronChange = (e) => {
        const newEscadron = e.target.value;
        console.log('🎯 Changement d\'escadron:', newEscadron);
        setSelectedEscadron(newEscadron);
        setDisplayListInfo(null);
        setPersonListData(defaultPersonListData);
    };

    // --- Fonctions d'exportation Excel ---
    const exportStatsToExcel = () => {
        setIsExporting(true);
        try {
            console.log('📊 Exportation des statistiques vers Excel...');

            const statsData = [
                ['Statistiques SPA du', displayDateLabel],
                [''],
                ['Catégorie', 'Total (R)', 'Absent (A)', 'Présent (P)', 'Indisponible (I)', 'Sur le rang (S)'],
                ['Cadres', cadreStats.total, cadreStats.absent, cadreStats.present, cadreStats.indisponible, cadreStats.surLeRang]
            ];

            if (selectedService || selectedEscadron) {
                statsData.splice(2, 0, ['Filtres appliqués:']);
                if (selectedService) {
                    statsData.splice(3, 0, ['Service:', selectedService]);
                }
                if (selectedEscadron) {
                    const escadronName = availableEscadrons.find(e => e.id.toString() === selectedEscadron)?.nom || `Escadron ${selectedEscadron}`;
                    statsData.splice(selectedService ? 4 : 3, 0, ['Escadron:', escadronName]);
                }
                statsData.splice(selectedService && selectedEscadron ? 5 : 4, 0, ['']);
            }

            const worksheet = XLSX.utils.aoa_to_sheet(statsData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Statistiques');

            let fileName = `statistiques_spa_${printDate.replace(/\//g, '-')}`;
            if (selectedService) fileName += `_${selectedService}`;
            if (selectedEscadron) fileName += `_escadron${selectedEscadron}`;
            fileName += '.xlsx';

            XLSX.writeFile(workbook, fileName);
            console.log('✅ Fichier Excel généré:', fileName);
        } catch (error) {
            console.error("❌ Erreur lors de l'exportation Excel:", error);
            setErrorStats(`Erreur lors de l'exportation Excel: ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    const exportListToExcel = async (type) => {
        setIsExporting(true);
        try {
            console.log(`📊 Exportation de la liste ${type} vers Excel...`);

            let data = personListData.cadre[type];
            if (!data || data.length === 0) {
                console.log(`⏳ Récupération des données pour ${type}...`);
                data = await fetchSpecificList(type, 'cadre');
            }

            if (!data || data.length === 0) {
                alert(`Aucune donnée à exporter pour les ${type}s.`);
                return;
            }

            const headers = ['Grade', 'Nom', 'Prénom', 'Matricule', 'Service', 'Escadron', 'Motif'];
            const excelData = [headers];

            data.forEach(person => {
                excelData.push([
                    person.grade || '',
                    person.nom || '',
                    person.prenom || '',
                    person.matricule || '',
                    person.service || '',
                    person.EscadronResponsable?.nom || person.cours || '',
                    person.motif_absence || ''
                ]);
            });

            const worksheet = XLSX.utils.aoa_to_sheet(excelData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, `${type}s`);

            let fileName = `liste_${type}s_${printDate.replace(/\//g, '-')}`;
            if (selectedService) fileName += `_${selectedService}`;
            if (selectedEscadron) fileName += `_escadron${selectedEscadron}`;
            fileName += '.xlsx';

            XLSX.writeFile(workbook, fileName);
            console.log('✅ Fichier Excel généré:', fileName);
        } catch (error) {
            console.error("❌ Erreur lors de l'exportation Excel:", error);
            setErrorStats(`Erreur lors de l'exportation Excel: ${error.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    // --- Gestionnaire de clic pour les cartes ---
    const handleCardClick = (type) => {
        console.log(`🖱️ Clic sur carte: ${type}`);

        let requestedTypes = [];
        if (type === 'absent') {
            requestedTypes = ['absent'];
        } else if (type === 'indisponible') {
            requestedTypes = ['indisponible'];
        } else if (type === 'absent_indisponible') {
            requestedTypes = ['absent', 'indisponible'];
        } else {
            setDisplayListInfo(null);
            return;
        }

        const newDisplayInfo = { category: 'cadre', types: requestedTypes };

        const isSameDisplay = displayListInfo &&
                               displayListInfo.category === newDisplayInfo.category &&
                               displayListInfo.types.length === newDisplayInfo.types.length &&
                               displayListInfo.types.every(t => newDisplayInfo.types.includes(t));

        if (isSameDisplay) {
            console.log('🔄 Masquage de la liste (même sélection)');
            setDisplayListInfo(null);
        } else {
            console.log('📋 Affichage de la liste:', requestedTypes);
            setDisplayListInfo(newDisplayInfo);

            if (!token) {
                 const newErrorState = { cadre: { absent: null, indisponible: null } };
                 if(requestedTypes.includes('absent')) newErrorState.cadre.absent = "Authentification requise pour voir cette liste.";
                 if(requestedTypes.includes('indisponible')) newErrorState.cadre.indisponible = "Authentification requise pour voir cette liste.";
                 setErrorList(newErrorState);
                 setPersonListData(defaultPersonListData);
            } else {
                 setErrorList(prevState => {
                     const nextState = { ...prevState, cadre: { ...prevState.cadre } };
                     if(requestedTypes.includes('absent')) nextState.cadre.absent = null;
                     if(requestedTypes.includes('indisponible')) nextState.cadre.indisponible = null;
                     return nextState;
                 });

                 requestedTypes.forEach(typeToFetch => {
                     fetchSpecificList(typeToFetch, 'cadre');
                 });
            }
        }
    };

    // --- Fonction de génération PDF ---
    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        setErrorStats(null);

        console.log('📄 Génération du PDF...');

        const typesToFetch = ['absent', 'indisponible'];
        const fetchPromises = typesToFetch.map(type => {
            const dataAlreadyLoaded = personListData.cadre[type]?.length > 0 && !isLoadingList.cadre[type];
            const errorFetching = errorList.cadre[type];

            if (dataAlreadyLoaded || errorFetching || isSpecificListLoading(type)) {
                 if(errorFetching) return Promise.reject(new Error(`Impossible de récupérer la liste des ${type}s pour le PDF.`));
                 return Promise.resolve(personListData.cadre[type] || []);
            } else {
                return fetchSpecificList(type, 'cadre');
            }
        });

        try {
            await Promise.all(fetchPromises);
            setPrintCategory('cadre');
            await new Promise(resolve => setTimeout(resolve, 150));

            const input = printAreaRef.current;
            if (!input) {
                throw new Error("Zone d'impression introuvable dans le DOM.");
            }

            const canvas = await html2canvas(input, {
                scale: 3,
                logging: false,
                useCORS: true
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const pageHeight = 297;
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            let pdfFileName = `rapport_spa_cadres_${printDate.replace(/\//g, '-')}`;
            if (selectedService) pdfFileName += `_${selectedService}`;
            if (selectedEscadron) pdfFileName += `_escadron${selectedEscadron}`;
            pdfFileName += '.pdf';

            pdf.save(pdfFileName);
            console.log('✅ PDF généré:', pdfFileName);

        } catch (error) {
            console.error("❌ Erreur lors de la génération du PDF:", error);
            setErrorStats(`Impossible de générer le PDF. Détails: ${error.message || error}.`);
        } finally {
            setIsGeneratingPdf(false);
            setTimeout(() => {
                setPrintCategory(null);
            }, 150);
        }
    };

    // --- Fonctions utilitaires ---
    const mainListSectionTitle = useMemo(() => {
        if (!displayListInfo || displayListInfo.category !== 'cadre' || displayListInfo.types.length === 0) return null;

        let title = '';

        if (displayListInfo.types.length === 1) {
            const type = displayListInfo.types[0];
            const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
            title = `${capitalizedType}s`;
        } else if (displayListInfo.types.length === 2 && displayListInfo.types.includes('absent') && displayListInfo.types.includes('indisponible')) {
            title = `Absents et Indisponibles`;
        } else {
            title = `Personnel`;
        }

        const filters = [];
        if (selectedService) filters.push(`Service: ${selectedService}`);
        if (selectedEscadron) {
            const escadronName = availableEscadrons.find(e => e.id.toString() === selectedEscadron)?.nom || `Escadron ${selectedEscadron}`;
            filters.push(escadronName);
        }

        if (filters.length > 0) {
            title += ` - ${filters.join(', ')}`;
        }

        return title;
    }, [displayListInfo, selectedService, selectedEscadron, availableEscadrons]);

    const isSpecificListLoading = (type) => {
        return isLoadingList.cadre?.[type] ?? false;
    };

    const getSpecificListError = (type) => {
        return errorList.cadre?.[type] ?? null;
    };

    const isCombinedListLoading = () => {
        return isSpecificListLoading('absent') || isSpecificListLoading('indisponible');
    };

    const cadreAbsentMotifCounts = useMemo(() => {
        return groupAndCountMotifs(personListData.cadre.absent);
    }, [personListData.cadre.absent]);

    const cadreIndisponibleMotifCounts = useMemo(() => {
        return groupAndCountMotifs(personListData.cadre.indisponible);
    }, [personListData.cadre.indisponible]);

    const handleResetFilters = () => {
        console.log('🔄 Réinitialisation des filtres');
        setSelectedService('');
        setSelectedEscadron('');
        setDisplayListInfo(null);
        setPersonListData(defaultPersonListData);
    };

    // ✅ BLOCAGE SI ROTATION EN COURS
    if (isCheckingRotation) {
        return (
            <div className="container-fluid d-flex justify-content-center align-items-center min-vh-100">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <h4>🔄 Rotation en cours...</h4>
                    <p className="text-muted">Veuillez patienter pendant la mise à jour de votre compte.</p>
                </div>
            </div>
        );
    }

    // Afficher le tableau de bord avec les statistiques
    return (
        <div className="container-fluid homepage-container">
            {/* Messages d'état */}
            {isLoadingStats && <div className="alert alert-info">Chargement des statistiques...</div>}
            {errorStats && <div className="alert alert-danger">{errorStats}</div>}
            {isGeneratingPdf && <div className="alert alert-info">Génération du PDF... Veuillez patienter.</div>}
            {isExporting && <div className="alert alert-info">Exportation Excel en cours... Veuillez patienter.</div>}

            {/* ✅ SECTION STATS - CONTENEUR FIXE ISOLÉ */}
            {!isLoadingStats && (
                <div className="homepage-stats-section">
                    <div className="spa-header">
                        <h2 className="mb-3">SPA du {displayDateLabel}</h2>
                        {/* ✅ INDICATEUR ROLE CONSULTANT */}
                        {user?.role === 'Consultant' && (
                            <div className="badge bg-success mb-3">
                                👥 Accès Service de semaine
                            </div>
                        )}
                    </div>

                    {/* Section des filtres */}
                    <div className="card mb-4 filters-card">
                        <div className="card-header">
                            <h5 className="mb-0">
                                <svg className="bi me-2" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                    <path d="M6 10.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zm-2-3a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11a.5.5 0 0 1-.5-.5z"/>
                                </svg>
                                Filtres
                            </h5>
                        </div>
                        <div className="card-body">
                            <div className="row g-3">
                                <div className="col-12 col-md-4">
                                    <label htmlFor="serviceFilter" className="form-label">Service</label>
                                    <select
                                        id="serviceFilter"
                                        className="form-select"
                                        value={selectedService}
                                        onChange={handleServiceChange}
                                        disabled={isLoadingFilters || isLoadingStats}
                                    >
                                        <option value="">Tous les services</option>
                                        {availableServices.map((service, index) => (
                                            <option key={index} value={service}>{service}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12 col-md-4">
                                    <label htmlFor="escadronFilter" className="form-label">Escadron</label>
                                    <select
                                        id="escadronFilter"
                                        className="form-select"
                                        value={selectedEscadron}
                                        onChange={handleEscadronChange}
                                        disabled={isLoadingFilters || isLoadingStats}
                                    >
                                        <option value="">Tous les escadrons</option>
                                        {availableEscadrons.map((escadron) => (
                                            <option key={escadron.id} value={escadron.id}>
                                                {escadron.nom}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12 col-md-4 d-flex align-items-end">
                                    <div className="d-flex flex-column flex-md-row gap-2 w-100">
                                        <button
                                            className="btn btn-outline-secondary flex-fill"
                                            onClick={handleResetFilters}
                                            disabled={isLoadingStats}
                                        >
                                            🔄 Réinitialiser
                                        </button>
                                        <button
                                            className="btn btn-success flex-fill"
                                            onClick={exportStatsToExcel}
                                            disabled={isLoadingStats || isExporting}
                                        >
                                            📊 Export Stats
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Affichage des filtres actifs */}
                            {(selectedService || selectedEscadron) && (
                                <div className="active-filters">
                                    <small className="text-muted">
                                        <strong>Filtres actifs:</strong>
                                        {selectedService && <span className="badge bg-primary ms-1">Service: {selectedService}</span>}
                                        {selectedEscadron && (
                                            <span className="badge bg-info ms-1">
                                                {availableEscadrons.find(e => e.id.toString() === selectedEscadron)?.nom || `Escadron ${selectedEscadron}`}
                                            </span>
                                        )}
                                    </small>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ✅ CARTES STATISTIQUES AVEC CALCULS CORRIGÉS */}
                    <div className="stats-container-fixed">
                        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-5 g-3 mb-4">
                            {/* Carte Total (R) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card stats-card">
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-primary" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
                                        </svg>
                                        <h5 className="card-title">Total (R)</h5>
                                        <p className="card-text fs-3">{cadreStats.total ?? 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Carte Absent (A) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card stats-card clickable-card"
                                     onClick={() => handleCardClick('absent')}
                                     style={{ cursor: 'pointer' }}>
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-danger" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                            <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
                                        </svg>
                                        <h5 className="card-title">Absent (A)</h5>
                                        <p className="card-text fs-3">{cadreStats.absent ?? 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Carte Présent (P = R - A) ✅ */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card stats-card">
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-success" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                        </svg>
                                        <h5 className="card-title">Présent (P)</h5>
                                        <p className="card-text fs-3">{cadreStats.present ?? 0}</p>
                                        <small className="text-muted">R - A = {cadreStats.total} - {cadreStats.absent}</small>
                                    </div>
                                </div>
                            </div>

                            {/* Carte Indisponible (I) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card stats-card clickable-card"
                                     onClick={() => handleCardClick('indisponible')}
                                     style={{ cursor: 'pointer' }}>
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-warning" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                                            <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 0 1.8 0l-.35 3.507a.552.552 0 0 0-1.1 0z"/>
                                        </svg>
                                        <h5 className="card-title">Indisponible (I)</h5>
                                        <p className="card-text fs-3">{cadreStats.indisponible ?? 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Carte Sur le rang (S = P - I) ✅ */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card stats-card">
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-info" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M12.17 9.53c2.307-2.592 3.278-4.684 3.641-6.218.21-.887.214-1.58.16-2.065a3.578 3.578 0 0 0-.108-.563 2.22 2.22 0 0 0-.078-.23V.453c0-.864-.933-1.453-1.617-.978L8 4.347 1.85-.525C1.167-.002.234.588.234 1.453v.232a2.22 2.22 0 0 0-.078.23 3.578 3.578 0 0 0-.108.563c-.054.485-.05 1.178.16 2.065.363 1.534 1.334 3.626 3.641 6.218l.33.371a2.001 2.001 0 0 0 2.98 0l.33-.371zM8 5.993c1.664-1.711 5.825 1.283 0 5.132-5.825-3.85-1.664-6.843 0-5.132z"/>
                                        </svg>
                                        <h5 className="card-title">Sur le rang (S)</h5>
                                        <p className="card-text fs-3">{cadreStats.surLeRang ?? 0}</p>
                                        <small className="text-muted">P - I = {cadreStats.present} - {cadreStats.indisponible}</small>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Boutons d'actions */}
                    <div className="actions-container">
                        <div className="row">
                            <div className="col">
                                <div className="d-flex flex-column flex-md-row justify-content-center gap-2">
                                    <button
                                        className="btn btn-outline-primary"
                                        onClick={() => handleCardClick('absent_indisponible')}
                                        disabled={isCombinedListLoading() || isGeneratingPdf}
                                    >
                                        {isCombinedListLoading() && displayListInfo?.category === 'cadre' && displayListInfo?.types.includes('absent') && displayListInfo?.types.includes('indisponible') ?
                                            'Chargement...' :
                                            `Voir la liste (A: ${cadreStats.absent ?? 0}, I: ${cadreStats.indisponible ?? 0})`
                                        }
                                    </button>

                                    <div className="export-buttons-container d-flex flex-column flex-md-row gap-2">
                                        <button
                                            className="btn btn-outline-success"
                                            onClick={() => exportListToExcel('absent')}
                                            disabled={isExporting || isLoadingStats}
                                        >
                                            📋 Export Absents
                                        </button>

                                        <button
                                            className="btn btn-outline-warning"
                                            onClick={() => exportListToExcel('indisponible')}
                                            disabled={isExporting || isLoadingStats}
                                        >
                                            📋 Export Indispo
                                        </button>

                                        <button
                                            className="btn btn-secondary"
                                            onClick={handleGeneratePdf}
                                            disabled={isLoadingStats || isCombinedListLoading() || isGeneratingPdf}
                                        >
                                            {isGeneratingPdf ? 'Génération PDF...' : '🖨️ Imprimer'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ SECTION TABLEAU - CONTENEUR SEPARÉ QUI PEUT GRANDIR */}
            {displayListInfo && displayListInfo.category === 'cadre' && displayListInfo.types.length > 0 && (
                <div className="homepage-table-section">
                    <div className="person-list-container">
                        <div className="row">
                            <div className="col">
                                <h3 className="text-wrap-mobile">{mainListSectionTitle}</h3>

                                {/* Affichage de la liste des Absents */}
                                {displayListInfo.types.includes('absent') && (
                                    <>
                                        {isSpecificListLoading('absent') && <div className="alert alert-info">Chargement des Absents...</div>}
                                        {getSpecificListError('absent') && <div className="alert alert-danger">{getSpecificListError('absent')}</div>}

                                        {!isSpecificListLoading('absent') && !getSpecificListError('absent') && personListData.cadre?.absent.length > 0 && (
                                            <PersonList data={personListData.cadre.absent} displayMode="table" />
                                        )}
                                        {!isSpecificListLoading('absent') && !getSpecificListError('absent') && personListData.cadre?.absent.length === 0 && (
                                            <div className="alert alert-info">Aucun Absent trouvé pour ces critères.</div>
                                        )}
                                        {displayListInfo.types.includes('indisponible') && <hr className="my-4"/>}
                                    </>
                                )}

                                {/* Affichage de la liste des Indisponibles */}
                                {displayListInfo.types.includes('indisponible') && (
                                    <>
                                        {isSpecificListLoading('indisponible') && <div className="alert alert-info">Chargement des Indisponibles...</div>}
                                        {getSpecificListError('indisponible') && <div className="alert alert-danger">{getSpecificListError('indisponible')}</div>}

                                        {!isSpecificListLoading('indisponible') && !getSpecificListError('indisponible') && personListData.cadre?.indisponible.length > 0 && (
                                             <PersonList data={personListData.cadre.indisponible} displayMode="table" />
                                        )}
                                        {!isSpecificListLoading('indisponible') && !getSpecificListError('indisponible') && personListData.cadre?.indisponible.length === 0 && (
                                             <div className="alert alert-info">Aucun Indisponible trouvé pour ces critères.</div>
                                        )}
                                    </>
                                )}

                                {displayListInfo.category === 'cadre' && displayListInfo.types.length === 0 && (
                                     <div className="alert alert-warning">Aucune liste spécifiée à afficher.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Zone d'impression - Cachée visuellement mais présente dans le DOM pour html2canvas */}
            <div className="printable-area" ref={printAreaRef} style={{
                position: 'absolute',
                left: '-9999px',
                top: '-9999px',
                zIndex: '-1',
                backgroundColor: '#fff',
                padding: '15mm',
                width: '210mm',
                boxSizing: 'border-box',
                fontFamily: 'Arial, sans-serif',
                fontSize: '10pt',
                color: '#000',
                lineHeight: '1.5'
            }}>
                {printCategory === 'cadre' && (
                    <>
                        {/* En-tête du rapport avec filtres */}
                        <div style={{ textAlign: 'left', marginBottom: '15mm', fontWeight: 'bold', fontSize: '11pt' }}>
                            SPA PERSONNEL EGNA DU <span style={{ textDecoration: 'underline', marginLeft: '10px' }}>{printDate}</span>
                            {(selectedService || selectedEscadron) && (
                                <div style={{ fontSize: '9pt', marginTop: '5mm', fontWeight: 'normal' }}>
                                    Filtres appliqués:
                                    {selectedService && ` Service: ${selectedService}`}
                                    {selectedEscadron && ` Escadron: ${availableEscadrons.find(e => e.id.toString() === selectedEscadron)?.nom || selectedEscadron}`}
                                </div>
                            )}
                        </div>

                        {/* Tableau Récapitulatif avec calculs corrigés */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm', border: '1px solid #000' }}>
                            <thead>
                                <tr>
                                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '20%', fontWeight: 'bold' }}>EFFECTIF</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>R</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>A</th>

                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>I</th>

                                </tr>
                                <tr>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.total ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.absent ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.present ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.indisponible ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.surLeRang ?? 0}</td>
                                </tr>
                            </thead>
                        </table>

                        {/* Tableaux Détaillés pour les Motifs */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15mm', marginTop: '10mm' }}>
                            {/* Tableau pour les Absents */}
                            <div style={{ flex: 1, minWidth: '45%' }}>
                                <h2 style={{ fontSize: '11pt', marginBottom: '5mm', textAlign: 'left', textDecoration: 'underline', fontWeight: 'bold' }}>MOTIFS DES ABSENTS</h2>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                                    <thead>
                                        <tr>
                                            <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>Motif</th>
                                            <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '20%', fontWeight: 'bold' }}>NOMBRE</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(cadreAbsentMotifCounts).map(([motif, count]) => (
                                            <tr key={motif}>
                                                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>{motif}</td>
                                                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{count}</td>
                                            </tr>
                                        ))}
                                         {Object.keys(cadreAbsentMotifCounts).length === 0 && (
                                             <tr>
                                                 <td colSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>Aucun absent avec motif spécifié.</td>
                                             </tr>
                                         )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Tableau pour les Indisponibles */}
                            <div style={{ flex: 1, minWidth: '45%' }}>
                                <h2 style={{ fontSize: '11pt', marginBottom: '5mm', textAlign: 'left', textDecoration: 'underline', fontWeight: 'bold' }}>MOTIFS DES INDISPONIBLES</h2>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
                                     <thead>
                                         <tr>
                                             <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'left', fontWeight: 'bold' }}>Motif</th>
                                             <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '20%', fontWeight: 'bold' }}>NOMBRE</th>
                                         </tr>
                                     </thead>
                                     <tbody>
                                         {Object.entries(cadreIndisponibleMotifCounts).map(([motif, count]) => (
                                             <tr key={motif}>
                                                 <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>{motif}</td>
                                                 <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{count}</td>
                                             </tr>
                                         ))}
                                          {Object.keys(cadreIndisponibleMotifCounts).length === 0 && (
                                              <tr>
                                                  <td colSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>Aucun indisponible avec motif spécifié.</td>
                                              </tr>
                                          )}
                                     </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default HomePage;