import React, { useEffect, useState, useMemo, useRef } from 'react';
// Importer le hook useAuth pour accéder aux infos utilisateur et au token
import { useAuth } from '../context/AuthContext';
// Utilisation des classes Bootstrap pour le style
import 'bootstrap/dist/css/bootstrap.min.css';

// Importer le composant pour afficher la liste des personnes (sera utilisé uniquement dans la vue normale)
import PersonList from '../components/PersonList';

// Importations pour la génération de PDF
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import moment from 'moment-timezone';

// Définir une structure de données par défaut pour les statistiques (uniquement pour Cadre)
const defaultStats = {
    total: 0,
    absent: 0,
    present: 0,
    indisponible: 0,
    surLeRang: 0,
};

// Structure pour stocker les données des listes (uniquement pour Cadre)
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
        // Utiliser 'motif_absence' d'après la structure de données fournie par l'utilisateur
        // Utilise un fallback sur 'Motif inconnu' si la propriété est absente ou nulle
        const motif = person.motif_absence || 'Motif inconnu';

        motifCounts[motif] = (motifCounts[motif] || 0) + 1;
    });
    return motifCounts;
};
const getDisplayDateLabel = (realTime, timezone) => {
    // Utilise moment.tz si un fuseau horaire est spécifié, sinon l'heure locale
    const momentDate = timezone ? moment.tz(realTime, timezone) : moment(realTime);
    // La logique est la même que dans votre getHistoricalDate backend :
    // Si l'heure actuelle est 16h ou plus, la date label est la date du jour suivant.

    const historicalMoment = momentDate.hour() >= 16 ?
                             momentDate.clone().add(1, 'day') : // Utilisez clone() pour ne pas modifier momentDate
                             momentDate.clone();
    // Retourne la date formatée pour l'affichage
    return historicalMoment.format('DD/MM/YYYY'); // Format comme jj/mm/aaaa pour l'affichage
};


function HomePage() {
    // Accéder au token et aux infos utilisateur via le contexte
    const { user, token } = useAuth();

    // --- États pour les données réelles (uniquement pour Cadre) ---
    const [cadreStats, setCadreStats] = useState(defaultStats);
    // personListData stockera les données pour les différentes listes (uniquement pour Cadre)
    const [personListData, setPersonListData] = useState(defaultPersonListData);

    // displayListInfo: { category: 'cadre', types: ['absent'] | ['indisponible'] | ['absent', 'indisponible'] } ou null
    // ** Cet état contrôle l'affichage des listes DANS LA PAGE NORMALE **
    const [displayListInfo, setDisplayListInfo] = useState(null);

    const [isLoadingStats, setIsLoadingStats] = useState(true); // État de chargement des stats
    // isLoadingList est maintenant un objet pour suivre le chargement par type (uniquement pour cadre)
    const [isLoadingList, setIsLoadingList] = useState({ cadre: { absent: false, indisponible: false } });
    // errorList est aussi un objet (uniquement pour cadre)
    const [errorList, setErrorList] = useState({ cadre: { absent: null, indisponible: null } });
    const [errorStats, setErrorStats] = useState(null); // État d'erreur pour les stats
    // --- Fin États ---
const [displayDateLabel, setDisplayDateLabel] = useState('');
    // Ref pour la zone d'impression (utilisée par html2canvas)
    const printAreaRef = useRef(null);
    // État pour stocker la date d'impression
    const [printDate, setPrintDate] = useState('');
    // État pour indiquer si la génération du PDF est en cours
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // ** Nouvel état pour contrôler la catégorie à imprimer **
    // Sera 'cadre' lorsque le bouton Imprimer est cliqué, null sinon
    const [printCategory, setPrintCategory] = useState(null);


    // --- Récupération des statistiques globales au chargement de la page ---
    useEffect(() => {
        const fetchStats = async () => {
            setIsLoadingStats(true);
            setErrorStats(null); // Réinitialiser l'erreur au début du fetch
            try {
                // MODIFICATION ICI : Changez l'URL de l'appel API
                const response = await fetch('/api/dashboard/summary', { // <-- NOUVELLE URL - MODIFIÉ
                    method: 'GET',
                    headers: {
                        // Assurez-vous d'inclure le token d'authentification si nécessaire
                        'Content-Type': 'application/json',
                        ...(token && { 'Authorization': `Bearer ${token}` }),
                    },
                });

                if (!response.ok) {
                    const errorData = await response.json()
                        .catch(() => ({ message: `Erreur HTTP: ${response.status}` })); // Si le corps n'est pas JSON, utilise le statut
                    throw new Error(errorData.message || `Erreur HTTP: ${response.status}`); // Lance une erreur avec le message du backend ou le statut
                }

                const data = await response.json();
                console.log("Données reçues de l'API /api/dashboard/summary :", data); // Log pour vérifier les données reçues - LOG MIS À JOUR

                // --- Extraction des données avec les clés correctes (uniquement cadres) ---
                // Utilise directement les champs 'present' et 'surLeRang' du backend - ADAPTÉ
                const cadreTotal = data.cadres?.total ?? 0;
                const cadreAbsent = data.cadres?.absent ?? 0;
                const cadreIndisponible = data.cadres?.indisponible ?? 0;
                const cadrePresent = data.cadres?.present ?? (cadreTotal - cadreAbsent - cadreIndisponible); // Utilise le backend si disponible, sinon calcule
                const cadreSurLeRang = data.cadres?.surLeRang ?? cadrePresent; // Utilise le backend si disponible, sinon calcule

                setCadreStats({
                    total: cadreTotal,
                    absent: cadreAbsent,
                    indisponible: cadreIndisponible,
                    present: cadrePresent,
                    surLeRang: cadreSurLeRang // Utilise le champ calculé ou reçu
                });

            } catch (error) {
                console.error("Erreur lors de la récupération des statistiques:", error);
                setErrorStats(`Impossible de charger les statistiques. Détails: ${error.message || error}.`);
                setCadreStats(defaultStats);
            } finally {
                setIsLoadingStats(false);
            }
        };

        fetchStats();
// --- CALCUL ET MISE À JOUR DE LA DATE D'AFFICHAGE DÉCALÉE --- // AJOUTEZ CECI
        const now = new Date();
        // Appelez la helper function avec l'heure actuelle
        // Passez null pour utiliser l'heure locale, ou APP_TIMEZONE si défini
        const calculatedDisplayDate = getDisplayDateLabel(now, null); // ou APP_TIMEZONE
        setDisplayDateLabel(calculatedDisplayDate);
        // -------------------------------------------------------- //
        // Définir la date actuelle pour l'impression lors du montage du composant
        const today = new Date();
        setPrintDate(today.toLocaleDateString('fr-FR')); // Format date comme jj/mm/aaaa

    }, [token]); // Dépendance au token pour relancer le fetch si le token change


    // --- Récupération des listes de personnes (Absents, Indisponibles) (uniquement pour Cadre) ---
    const fetchSpecificList = async (type, category) => {
        // On ne gère que la catégorie 'cadre' dans ce composant pour l'instant
        if (category !== 'cadre') {
            console.warn(`WorkspaceSpecificList appelé avec une catégorie non gérée: ${category}`);
            return [];
        }

        // Assurer que 'type' est soit 'absent' soit 'indisponible'
        if (type !== 'absent' && type !== 'indisponible') {
             console.error(`WorkspaceSpecificList appelé avec un type non valide pour cadre: ${type}`);
             return [];
        }


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
            // Assurez-vous que la valeur envoyée au backend correspond aux valeurs de l'ENUM (ex: 'Absent', 'Indisponible')
            // Le backend attend 'Absent' ou 'Indisponible' pour le paramètre 'statut'
            const backendStatusValue = type === 'absent' ? 'Absent' : 'Indisponible';
            queryParams.append('statut', backendStatusValue);

            // L'URL pour les listes détaillées de cadres est /api/cadres
            const url = '/api/cadres';

            const fullUrl = `${url}?${queryParams.toString()}`;
            console.log("Fetching list from URL:", fullUrl);

            const response = await fetch(fullUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': `Bearer ${token}` }),
                },
            });

            if (!response.ok) {
                 const errorData = await response.json().catch(() => ({ message: `Erreur HTTP: ${response.status}` }));
                 // Si l'erreur est 403 Forbidden (accès non autorisé, ex: Standard voit liste service uniquement), on peut afficher un message specifique
                 if (response.status === 403) {
                     throw new Error("Vous n'avez pas les permissions pour voir cette liste détaillée.");
                 }
                 throw new Error(errorData.message || `Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Données de liste reçues pour cadre ${type}:`, data);
 console.log(`Données BRUTES reçues de l'API pour cadre ${type}:`, data);
            // Mettre à jour l'état avec les données reçues pour le type et la catégorie corrects
            setPersonListData(prevState => ({
                ...prevState, // Conserver les données des autres catégories si elles existent
                cadre: {
                    ...prevState.cadre, // Conserver les données des autres types de cadres si elles existent
                    [type]: data // Mettre à jour les données pour le type spécifique ('absent' ou 'indisponible')
                }
            }));

            return data; // Retourner les données pour une utilisation potentielle (ex: par le PDF)

        } catch (error) {
            console.error(`Erreur lors de la récupération de la liste cadre ${type}:`, error);
             // Mettre à jour l'état d'erreur pour le type et la catégorie corrects
            setErrorList(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: `Impossible de charger la liste. Détails: ${error.message || error}.`
                }
            }));
             // S'assurer que la liste est vide en cas d'erreur
            setPersonListData(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: []
                }
            }));
            return []; // Retourner un tableau vide en cas d'erreur
        } finally {
            // Désactiver l'état de chargement pour le type et la catégorie corrects
            setIsLoadingList(prevState => ({
                ...prevState,
                cadre: {
                    ...prevState.cadre,
                    [type]: false
                }
            }));
        }
    };


    // --- Gestionnaire de clic pour les cartes ET le bouton "Voir la liste" (contrôle l'affichage normal) ---
    const handleCardClick = (type) => {
        let requestedTypes = [];
        // Déterminer quels types de listes de cadres sont demandés
        if (type === 'absent') {
            requestedTypes = ['absent'];
        } else if (type === 'indisponible') {
            requestedTypes = ['indisponible'];
        } else if (type === 'absent_indisponible') {
             // Si le bouton "Voir la liste (Absents, Indisponibles)" est cliqué
            requestedTypes = ['absent', 'indisponible'];
        } else {
            // Clic sur une autre carte (Total, Présent, Sur le rang)
            setDisplayListInfo(null);
            return;
        }

        // La catégorie est toujours 'cadre' pour l'affichage normal des listes détaillées
        const newDisplayInfo = { category: 'cadre', types: requestedTypes };

        // Vérifier si l'on a cliqué à nouveau sur la même catégorie et le(s) même(s) type(s)
        // pour basculer l'affichage (cacher la liste si déjà affichée)
        const isSameDisplay = displayListInfo &&
                                displayListInfo.category === newDisplayInfo.category &&
                                displayListInfo.types.length === newDisplayInfo.types.length &&
                                displayListInfo.types.every(t => newDisplayInfo.types.includes(t));

        if (isSameDisplay) {
            // Si on reclique sur la même carte/le même bouton, on cache les listes
            setDisplayListInfo(null);
            // setPersonListData(defaultPersonListData); // Optionnel: effacer les données des listes
        } else {
            // Sinon, on définit les informations pour afficher la(les) nouvelle(s) liste(s)
            setDisplayListInfo(newDisplayInfo);

            // Si l'utilisateur n'est pas authentifié (pas de token), afficher une erreur et ne pas fetcher
            if (!token) {
                 // Afficher des messages d'erreur pour chaque type de liste demandé
                 const newErrorState = { cadre: { absent: null, indisponible: null } };
                 if(requestedTypes.includes('absent')) newErrorState.cadre.absent = "Authentification requise pour voir cette liste.";
                 if(requestedTypes.includes('indisponible')) newErrorState.cadre.indisponible = "Authentification requise pour voir cette liste.";
                 setErrorList(newErrorState);
                 // S'assurer que les données pour cette catégorie sont vides si non authentifié
                 setPersonListData(defaultPersonListData); // S'assurer que les listes sont vides
            } else {
                 // Si authentifié, on va chercher les données des listes demandées
                 // Optionnel: effacer les données précédentes si on change de liste affichée
                 // setPersonListData(defaultPersonListData);

                 // Réinitialiser les erreurs spécifiques pour les types demandés avant de fetcher
                 setErrorList(prevState => {
                     const nextState = { ...prevState, cadre: { ...prevState.cadre } };
                     if(requestedTypes.includes('absent')) nextState.cadre.absent = null;
                     if(requestedTypes.includes('indisponible')) nextState.cadre.indisponible = null;
                     return nextState;
                 });


                 // Lancer les fetches pour chaque type de liste demandé
                 requestedTypes.forEach(typeToFetch => {
                     fetchSpecificList(typeToFetch, 'cadre'); // On ne gère que les cadres ici
                 });
            }
        }
    };


    // Utiliser useMemo pour déterminer le titre de la section des listes affichées (vue normale)
    const mainListSectionTitle = useMemo(() => {
        // Vérifier si displayListInfo existe, si la catégorie est 'cadre' et si au moins un type est demandé
        if (!displayListInfo || displayListInfo.category !== 'cadre' || displayListInfo.types.length === 0) return null;

        const category = 'Cadre'; // La catégorie est fixe ici

        // Construire le titre en fonction des types demandés
        if (displayListInfo.types.length === 1) {
            const type = displayListInfo.types[0]; // 'absent' ou 'indisponible'
             // Capitaliser le premier caractère pour le titre
            const capitalizedType = type.charAt(0).toUpperCase() + type.slice(1);
            return `Liste des ${capitalizedType}s (${category}s)`;
        } else if (displayListInfo.types.length === 2 && displayListInfo.types.includes('absent') && displayListInfo.types.includes('indisponible')) {
            // Cas spécifique pour les deux listes combinées
            return `Détails ${category}s (Absents et Indisponibles)`;
        }
         // Cas par défaut ou inattendu
        return `Liste des ${category}s`;

    }, [displayListInfo]); // Recalculer si displayListInfo change


    // Vérifier si une liste est en cours de chargement pour un type donné (pour l'affichage normal)
    const isSpecificListLoading = (type) => {
        // Vérifier si isLoadingList.cadre existe avant d'y accéder
        return isLoadingList.cadre?.[type] ?? false;
    };

    // Vérifier si une erreur est présente pour une liste spécifique (pour l'affichage normal)
    const getSpecificListError = (type) => {
        // Vérifier si errorList.cadre existe avant d'y accéder
        return errorList.cadre?.[type] ?? null;
    };

    // Vérifier si le bouton "Voir la liste (Absents, Indisponibles)" est en cours de chargement (pour l'affichage normal)
    const isCombinedListLoading = () => {
        // Le bouton charge si la liste 'absent' OU 'indisponible' est en cours de chargement
        return isSpecificListLoading('absent') || isSpecificListLoading('indisponible');
    };


    // Function to trigger PDF generation using jspdf and html2canvas (only for cadre)
    const handleGeneratePdf = async () => {
        setIsGeneratingPdf(true);
        setErrorStats(null); // Clear any previous stats errors

        // Définir les types de listes de cadres nécessaires pour le PDF (Absents et Indisponibles)
        const typesToFetch = ['absent', 'indisponible'];
        const fetchPromises = typesToFetch.map(type => {
            // Vérifier si les données pour ce type de cadre sont déjà chargées ET non vides.
            // Si c'est le cas, on n'a pas besoin de les fetcher à nouveau.
            // Sinon, on lance le fetch.
            const dataAlreadyLoaded = personListData.cadre[type]?.length > 0 && !isLoadingList.cadre[type];
            const errorFetching = errorList.cadre[type]; // Vérifier si une erreur s'est produite lors d'un fetch précédent

             // Si données déjà chargées ou erreur, on résout la promesse immédiatement
             // Si données non chargées ET pas en cours de chargement ET pas d'erreur précédente, on fetch
            if (dataAlreadyLoaded || errorFetching || isSpecificListLoading(type)) {
                 // Si erreur, on rejette pour que Promise.all échoue
                 if(errorFetching) return Promise.reject(new Error(`Impossible de récupérer la liste des ${type}s pour le PDF.`));
                 // Si déjà chargé ou en cours, on résout avec les données actuelles
                 return Promise.resolve(personListData.cadre[type] || []);
            } else {
                // Lancer le fetch de la liste spécifique pour les cadres
                return fetchSpecificList(type, 'cadre');
            }
        });

        try {
            // Attendre que toutes les données nécessaires pour le PDF soient récupérées (ou résolues si déjà chargées)
             // Promise.all attend que toutes les promesses soient résolues. Si une rejette, Promise.all rejette immédiatement.
            await Promise.all(fetchPromises);

            // ** Définir l'état printCategory pour indiquer que la zone d'impression doit être rendue pour les cadres **
            // Cela va rendre la div cachée avec le contenu formaté pour le PDF.
            setPrintCategory('cadre');

            // Attendre un court instant pour permettre au DOM (y compris la zone d'impression cachée) de se mettre à jour
            // avant que html2canvas tente de la capturer. Un délai est crucial ici.
            await new Promise(resolve => setTimeout(resolve, 150)); // Augmenté légèrement pour plus de sécurité

            // Récupérer l'élément DOM de la zone d'impression en utilisant la ref
            const input = printAreaRef.current;

            if (!input) {
                // Si la ref est null, la zone d'impression n'a pas été rendue correctement
                throw new Error("Zone d'impression introuvable dans le DOM.");
            }

            // Utiliser html2canvas pour capturer le contenu de la zone d'impression en tant qu'image (canvas)
            const canvas = await html2canvas(input, {
                scale: 3, // Augmenter l'échelle pour une meilleure résolution de l'image
                logging: false, // Désactiver le logging de html2canvas pour nettoyer la console
                useCORS: true // Important si vos images (logos, etc.) proviennent d'une autre origine
            });

            // Convertir le canvas en image PNG encodée en base64
            const imgData = canvas.toDataURL('image/png');

            // Initialiser jsPDF avec l orientation portrait ('p'), unites millimetres ('mm'), format A4
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // Largeur d'une page A4 en mm
            const pageHeight = 297; // Hauteur d'une page A4 en mm
            // Calculer la hauteur de l'image capturée par rapport à la largeur de la page
            const imgHeight = canvas.height * imgWidth / canvas.width;
            let heightLeft = imgHeight; // Hauteur restante de l'image à ajouter au PDF
            let position = 0; // Position verticale actuelle sur la page PDF

            // Ajouter la première page de l'image au PDF
            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight; // Réduire la hauteur restante de l'image de la hauteur d'une page

            // Gérer le cas où le contenu dépasse une page (ajouter de nouvelles pages)
            while (heightLeft >= 0) {
                // Calculer la position pour la nouvelle page (négative pour afficher la partie suivante de l'image)
                position = heightLeft - imgHeight;
                pdf.addPage(); // Ajouter une nouvelle page
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight); // Ajouter la partie suivante de l'image
                heightLeft -= pageHeight; // Réduire la hauteur restante
            }

            // Sauvegarder le fichier PDF avec un nom incluant la date d'impression
            pdf.save(`rapport_spa_cadres_${printDate}.pdf`);

        } catch (error) {
            console.error("Erreur lors de la génération du PDF:", error);
            // Afficher un message d'erreur à l'utilisateur sur l'UI
            setErrorStats(`Impossible de générer le PDF. Détails: ${error.message || error}.`);
        } finally {
            // Désactiver l'état de génération PDF une fois le processus terminé (succès ou erreur)
            setIsGeneratingPdf(false);

            setTimeout(() => {
                setPrintCategory(null);
            }, 150); // Petit délai ajusté
        }
    };




    const cadreAbsentMotifCounts = useMemo(() => {
        console.log("Calculating cadre absent motif counts...");
        return groupAndCountMotifs(personListData.cadre.absent);
    }, [personListData.cadre.absent]); // Dépend de la liste des absents cadre

    const cadreIndisponibleMotifCounts = useMemo(() => {
        console.log("Calculating cadre indisponible motif counts...");
        return groupAndCountMotifs(personListData.cadre.indisponible);
    }, [personListData.cadre.indisponible]); // Dépend de la liste des indisponibles cadre


    // Afficher le tableau de bord avec les statistiques
    return (
        <div className="container mt-4">
            {/* Contenu normal de la page - Visible par l'utilisateur */}
            {/* Cette div contient tout ce qui n'est PAS la zone d'impression cachée */}
            <div>
                {/* Afficher l'état de chargement ou l'erreur pour les statistiques */}
                {isLoadingStats && <div className="alert alert-info">Chargement des statistiques...</div>}
                {errorStats && <div className="alert alert-danger">{errorStats}</div>}
                {/* Afficher le message de génération PDF */}
                {isGeneratingPdf && <div className="alert alert-info">Génération du PDF... Veuillez patienter.</div>}

                {/* Section Cadres */}
                {/* Afficher seulement si les stats sont chargées (ou non chargées avec erreur) */}
                {!isLoadingStats && (
                    <>
                        <h2 className="mb-3">SPA du  {displayDateLabel}  </h2> {/* Titre visible normal */}
                        <div className="row row-cols-1 row-cols-sm-2 row-cols-md-5 g-4 mb-3">
                            {/* Cartes Cadres */}
                            {/* Carte Total (Non cliquable) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card">
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-primary" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z"/>
                                        </svg>
                                        <h5 className="card-title">Total (R)</h5>
                                        <p className="card-text fs-3">{cadreStats.total ?? 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Carte Absent (Cliquable pour afficher la liste détaillée) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card clickable-card" onClick={() => handleCardClick('absent')}>
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

                            {/* Carte Présent (Non cliquable) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card">
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-success" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                                        </svg>
                                        <h5 className="card-title">Présent (P)</h5>
                                        <p className="card-text fs-3">{cadreStats.present ?? 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Carte Indisponible (Cliquable pour afficher la liste détaillée) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card clickable-card" onClick={() => handleCardClick('indisponible')}>
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

                            {/* Carte Sur le rang (Non cliquable) */}
                            <div className="col">
                                <div className="card text-center h-100 dashboard-card">
                                    <div className="card-body d-flex flex-column justify-content-center align-items-center">
                                        <svg className="bi mb-2 text-info" width="30" height="30" fill="currentColor" viewBox="0 0 16 16">
                                            <path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2zM9.5 3.5v-2L14 8.5V14h-1V8.5a1.5 1.5 0 0 0-1.5-1.5H9.5z"/>
                                            <path d="M8 11h-1v-.5a1.5 1.5 0 0 1 1.5-1.5h1a1.5 1.5 0 0 1 1.5 1.5V11h-1v-.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5V11z"/>
                                        </svg>
                                        <h5 className="card-title">Sur le rang (S)</h5>
                                        <p className="card-text fs-3">{cadreStats.surLeRang ?? 0}</p>
                                    </div>
                                </div>
                            </div>

                        </div> {/* Fin de la rangée Cadres */}

                        {/* Boutons pour Cadres */}
                        <div className="row mb-5">
                            <div className="col text-center">
                                {/* Bouton "Voir la liste" */}
                                <button
                                    className="btn btn-outline-primary me-2"
                                    onClick={() => handleCardClick('absent_indisponible')}
                                    // Désactiver si l'une des listes est en cours de chargement ou si le PDF est en génération
                                    disabled={isCombinedListLoading() || isGeneratingPdf}
                                >
                                    {isCombinedListLoading() && displayListInfo?.category === 'cadre' && displayListInfo?.types.includes('absent') && displayListInfo?.types.includes('indisponible') ?
                                        'Chargement...' :
                                        `Voir la liste (Absents: ${cadreStats.absent ?? 0}, Indisponibles: ${cadreStats.indisponible ?? 0})`
                                    }
                                </button>
                                {/* Bouton "Imprimer" pour Cadres */}
                                <button
                                    className="btn btn-secondary"
                                    onClick={handleGeneratePdf} // Appel de la fonction de génération de PDF
                                     // Désactiver si les stats ou les listes sont en chargement, ou si le PDF est déjà en génération
                                    disabled={isLoadingStats || isCombinedListLoading() || isGeneratingPdf}
                                >
                                    {isGeneratingPdf ? 'Génération PDF...' : 'Imprimer'}
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* Section Élèves - Supprimée dans le backend, donc pas affichée ici */}
                {/* Si vous réintroduisez les élèves, ajoutez une section similaire ici */}

                {/* Affichage conditionnel des listes des personnes (Tableaux de détail) - Uniquement pour Cadre (Vue normale) */}
                {/* Cette section s'affiche uniquement si displayListInfo est défini pour 'cadre' et demande l'affichage de types */}
                {displayListInfo && displayListInfo.category === 'cadre' && displayListInfo.types.length > 0 && (
                    <div className="row mt-4"> {/* mt-4 pour l'espacement avec les sections de stats */}
                        <div className="col">
                             {/* Titre principal pour la section des listes (vue normale) */}
                            <h3 className="mb-3">{mainListSectionTitle}</h3>

                            {/* Affichage de la liste des Absents si demandée (vue normale) */}
                            {displayListInfo.types.includes('absent') && (
                                <>
                                    {/* Afficher l'état de chargement ou l'erreur pour la liste Absent (pour cadre) */}
                                    {isSpecificListLoading('absent') && <div className="alert alert-info">Chargement des Absents...</div>}
                                    {getSpecificListError('absent') && <div className="alert alert-danger">{getSpecificListError('absent')}</div>}

                                    {/* Afficher la liste des Absents si non en chargement et sans erreur, et si des données sont présentes (pour cadre) */}
                                    {!isSpecificListLoading('absent') && !getSpecificListError('absent') && personListData.cadre?.absent.length > 0 && (
                                        <PersonList listTitle={`Liste des Absents (Cadres)`} data={personListData.cadre.absent} category="cadre" />
                                    )}
                                    {/* Message si aucune donnée n'est trouvée pour les Absents (pour cadre) */}
                                    {!isSpecificListLoading('absent') && !getSpecificListError('absent') && personListData.cadre?.absent.length === 0 && (
                                        <div className="alert alert-info">Aucun Absent trouvé pour cette catégorie.</div>
                                    )}
                                     {/* Ajouter un espace entre les deux tableaux si les deux sont affichés */}
                                    {displayListInfo.types.includes('indisponible') && <hr className="my-4"/>}
                                </>
                            )}

                             {/* Affichage de la liste des Indisponibles si demandée (vue normale) */}
                             {displayListInfo.types.includes('indisponible') && (
                                <>
                                     {/* Afficher l'état de chargement ou l'erreur pour la liste Indisponible (pour cadre) */}
                                    {isSpecificListLoading('indisponible') && <div className="alert alert-info">Chargement des Indisponibles...</div>}
                                    {getSpecificListError('indisponible') && <div className="alert alert-danger">{getSpecificListError('indisponible')}</div>}

                                     {/* Afficher la liste des Indisponibles si non en chargement et sans erreur, et si des données sont présentes (pour cadre) */}
                                    {!isSpecificListLoading('indisponible') && !getSpecificListError('indisponible') && personListData.cadre?.indisponible.length > 0 && (
                                         <PersonList listTitle={`Liste des Indisponibles (Cadres)`} data={personListData.cadre.indisponible} category="cadre" />
                                    )}
                                     {/* Message si aucune donnée n'est trouvée pour les Indisponibles (pour cadre) */}
                                    {!isSpecificListLoading('indisponible') && !getSpecificListError('indisponible') && personListData.cadre?.indisponible.length === 0 && (
                                        <div className="alert alert-info">Aucun Indisponible trouvé pour cette catégorie.</div>
                                    )}
                                </>
                            )}

                             {/* Message si displayListInfo est défini mais qu'aucune liste n'est incluse (cas inattendu) */}
                            {displayListInfo.category === 'cadre' && displayListInfo.types.length === 0 && (
                                 <div className="alert alert-warning">Aucune liste spécifiée à afficher.</div>
                            )}


                        </div>
                    </div>
                )}
            </div> {/* Fin de la div du contenu normal */}


            {/* Zone d'impression - Cachée visuellement mais présente dans le DOM pour html2canvas */}
            {/* Les styles en ligne sont ajustés pour correspondre à l'image fournie */}
            <div className="printable-area" ref={printAreaRef} style={{
                position: 'absolute',
                left: '-9999px', // Cacher hors de l'écran
                top: '-9999px',
                zIndex: '-1', // S'assurer qu'il est en dessous de tout
                backgroundColor: '#fff', // Assurez-vous d'avoir un fond blanc
                padding: '15mm', // Marge autour du contenu
                width: '210mm', // Largeur A4
                boxSizing: 'border-box', // Inclure le padding dans la largeur
                fontFamily: 'Arial, sans-serif', // Utiliser Arial ou une autre police simple
                fontSize: '10pt', // Taille de police de base
                color: '#000', // Couleur du texte
                lineHeight: '1.5' // Espacement des lignes
            }}>
                {/* Ce contenu sera capturé par html2canvas */}
                {/* Rendu conditionnel basé sur le nouvel état printCategory */}
                {printCategory === 'cadre' && (
                    <>
                        {/* En-tête du rapport - LABEL RÉTABLI */}
                        <div style={{ textAlign: 'left', marginBottom: '15mm', fontWeight: 'bold', fontSize: '11pt' }}>
                            SPA PERSONNEL EGNA DU <span style={{ textDecoration: 'underline', marginLeft: '10px' }}>{printDate}</span> {/* LABEL RÉTABLI */}
                        </div>

                        {/* Tableau Récapitulatif - Structure ajustée pour les cellules fusionnées */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10mm', border: '1px solid #000' }}>
                            <thead>
                                <tr>
                                    {/* Cellule EFFECTIF fusionnée sur 2 lignes */}
                                    <th rowSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '20%', fontWeight: 'bold' }}>EFFECTIF</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>R</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>A</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>P</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>I</th>
                                    <th style={{ border: '1px solid #000', padding: '5px', textAlign: 'center', width: '16%', fontWeight: 'bold' }}>S</th>
                                </tr>
                                {/* Deuxième ligne pour les valeurs statistiques des Cadres */}
                                <tr>
                                    {/* Les cellules sont vides car la cellule EFFECTIF s'étend sur cette ligne */}
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.total ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.absent ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.present ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.indisponible ?? 0}</td>
                                    <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{cadreStats.surLeRang ?? 0}</td>
                                </tr>
                            </thead>
                        </table>

                        {/* Tableaux Détaillés pour les Motifs (Absents et Indisponibles) */}
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
                                        {/* Rendre les lignes basées sur les décomptes de motifs calculés */}
                                        {Object.entries(cadreAbsentMotifCounts).map(([motif, count]) => (
                                            <tr key={motif}>
                                                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>{motif}</td>
                                                <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{count}</td>
                                            </tr>
                                        ))}
                                         {/* Message si aucun motif n'est trouvé */}
                                         {Object.keys(cadreAbsentMotifCounts).length === 0 && (
                                             <tr>
                                                 <td colSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>Aucun absent avec motif sp\u00E9cifi\u00E9.</td>
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
                                         {/* Rendre les lignes basées sur les décomptes de motifs calculés */}
                                         {Object.entries(cadreIndisponibleMotifCounts).map(([motif, count]) => (
                                             <tr key={motif}>
                                                 <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'left' }}>{motif}</td>
                                                 <td style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>{count}</td>
                                             </tr>
                                         ))}
                                          {/* Message si aucun motif n'est trouvé */}
                                          {Object.keys(cadreIndisponibleMotifCounts).length === 0 && (
                                              <tr>
                                                  <td colSpan="2" style={{ border: '1px solid #000', padding: '5px', textAlign: 'center' }}>Aucun indisponible avec motif sp\u00E9cifi\u00E9.</td>
                                              </tr>
                                          )}
                                     </tbody>
                                 </table>
                             </div>
                         </div>

                         {/* Le Grade de Semaine */}
                         <div style={{ marginTop: '20mm', textAlign: 'right', fontWeight: 'bold' }}>
                             LE GRADE DE SEMAINE
                         </div>
                     </>
                 )}
             </div>

         </div> // Fin du container principal
     );
 }

 export default HomePage;