// src/pages/CreateCadrePage.jsx
import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext'; // Pour accéder au token si l'API nécessite authentification

function CreateCadrePage() {
   const { token } = useAuth(); // Récupérer le token
   // TODO: Dans une vraie application, vous devriez charger les listes des services depuis votre API backend
   const [services, setServices] = useState([]); // Pour stocker les options de service
   // TODO: Vous devrez aussi charger la liste des "Cours" (Escadrons) si l'entité est "COURS"
   const [coursOptions, setCoursOptions] = useState([]); // Pour stocker les options de Cours/Escadrons

  const [formData, setFormData] = useState({
    grade: '',
    nom: '',
    prenom: '',
    matricule: '',
    service: '', // Ce sera la valeur sélectionnée du menu déroulant Service (dépend de l'entité)
    numero_telephone: '',
    fonction: '',
    entite: 'Service', // Renommé de responsibility_scope à entite, valeur par défaut 'Service'
    cours: '', // Renommé de responsible_escadron_id à cours
    sexe: '', // Champ Sexe
  });
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

   // Charger les options pour les menus déroulants au chargement du composant
   useEffect(() => {
       // TODO: Remplacer par un appel API réel pour charger les services
       // Exemple simulé :
       const fetchServices = async () => {
           // const response = await fetch('http://localhost:3000/api/services', { headers: { 'Authorization': `Bearer ${token}` } });
           // if (response.ok) {
           //     const data = await response.json();
           //     setServices(data); // Assurez-vous que data est un tableau d'objets { id, nom }
           // } else {
           //      console.error("Erreur lors du chargement des services");
           // }
           // Options simulées
           const simulatedServices = [
               { id: 1, nom: 'Administration' },
               { id: 2, nom: 'Logistique' },
               { id: 3, nom: 'Formation' },
               { id: 4, nom: 'Santé' },
               // TODO: Ajouter d'autres services
           ];
           setServices(simulatedServices);
       };

        // TODO: Remplacer par un appel API réel pour charger les Cours (Escadrons)
        const fetchCours = async () => {
           // const response = await fetch('http://localhost:3000/api/escadrons', { headers: { 'Authorization': `Bearer ${token}` } });
           // if (response.ok) {
           //     const data = await response.json();
           //     setCoursOptions(data); // Assurez-vous que data est un tableau d'objets { id, nom, numero }
           // } else {
           //      console.error("Erreur lors du chargement des Cours/Escadrons");
           // }
           // Options simulées (1 à 10)
           const simulatedCours = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, numero: i + 1, nom: `Escadron ${i + 1}` }));
           setCoursOptions(simulatedCours);
        };


       fetchServices();
       fetchCours(); // Charger aussi les options de Cours

       // TODO: La logique d'ajout/suppression d'options pour les menus déroulants (Services, Cours)
       // devrait être gérée dans une page d'administration dédiée, pas ici dans le formulaire de création.
       // Les formulaires devraient simplement charger les options disponibles depuis l'API.

   }, [token]); // Déclenche l'effet lorsque le token change (connexion/déconnexion)


  // Gère les changements dans les champs du formulaire
  const handleInputChange = (e) => {
    const { name, value } = e.target;

    // Logique spécifique si le champ "entite" change
    if (name === 'entite') {
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: value,
            // Si l'entité change et n'est plus 'Service', réinitialiser le champ 'service'
            service: value !== 'Service' ? '' : prevFormData.service,
            // Si l'entité change et n'est plus 'Escadron' (la valeur réelle pour COURS), réinitialiser le champ 'cours'
            cours: value !== 'Escadron' ? '' : prevFormData.cours, // <-- Utiliser 'Escadron' ici
        }));
    } else {
        // Pour tous les autres champs, mettre à jour normalement
        setFormData({ ...formData, [name]: value });
    }
  };

  // Gère la soumission du formulaire
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(''); // Réinitialiser les messages

    if (!token) {
         setMessage("Erreur: Utilisateur non authentifié.");
         setIsSuccess(false);
         return;
    }

     // --- Validation Côté Frontend ---
     console.log('Valeur de formData.entite avant validation :', formData.entite); // Gardons le log pour l'instant

     // Vérifier les champs toujours requis (basé sur ce qui DOIT être dans la DB et le modèle Sequelize)
    if (!formData.grade || !formData.nom || !formData.prenom || !formData.matricule || !formData.entite || !formData.sexe) { // Assurez-vous que 'sexe' est requis si c'est le cas dans votre modèle/DB
        setMessage("Veuillez remplir tous les champs requis (Grade, Nom, Prénom, Matricule, Entité, Sexe).");
        setIsSuccess(false);
        return;
    }

    // Vérifier les champs requis conditionnellement basés sur l'entité
    if (formData.entite === 'Service') {
        if (!formData.service) {
            setMessage("Veuillez sélectionner un service si l'entité est 'Service'.");
            setIsSuccess(false);
            return;
        }
    } else if (formData.entite === 'Escadron') { // <-- Utiliser 'Escadron' ici pour la validation
        if (!formData.cours) {
             // Assurez-vous que 'cours' est bien l'ID de l'escadron
             // Vous pourriez vouloir vérifier ici si l'ID de l'escadron existe réellement dans votre table Escadrons
             // const escadronExiste = await Escadron.findByPk(cours);
             // if (!escadronExiste) { return res.status(400).json({ message: "L'escadron sélectionné n'existe pas." }); }
            setMessage("Veuillez sélectionner un Escadron si l'entité est 'COURS'."); // Message peut rester "COURS"
            setIsSuccess(false);
            return;
        }
    } else {
        // Ce bloc NE DEVRAIT PAS ÊTRE ATTEINT si les options du select sont correctes.
        // Le message "Valeur d'entité invalide" ne vient pas d'ici.
        setMessage('Erreur interne : Valeur d\'entité inattendue.');
        setIsSuccess(false);
        return;
    }

    // TODO: Validation supplémentaire côté frontend si nécessaire (format téléphone, etc.)
    // --- Fin Validation Côté Frontend ---

    // --- Préparation des données pour le Backend ---
    const dataToSend = { ...formData }; // Créer une copie pour ne pas modifier l'état directement

    if (dataToSend.entite === 'Escadron') {
        // Si l'entité est 'Escadron', le champ 'service' doit être null pour le backend
        dataToSend.service = null;
        // Convertir l'ID de l'escadron en nombre entier si ce n'est pas déjà fait
        // Assurez-vous que dataToSend.cours n'est pas une chaîne vide avant de convertir
        if (dataToSend.cours !== '') {
            dataToSend.cours = parseInt(dataToSend.cours, 10);
            // Vérifier si la conversion a réussi (pas NaN)
            if (isNaN(dataToSend.cours)) {
                 setMessage("Erreur: L'ID de l'Escadron sélectionné est invalide.");
                 setIsSuccess(false);
                 return; // Arrêter la soumission si l'ID est invalide
            }
        } else {
             // Si cours est vide malgré la validation, c'est une erreur logique, mais gérée par la validation ci-dessus
             // On peut le laisser comme chaîne vide si le backend gère ça, ou le mettre à null/undefined
             // Pour l'instant, la validation frontend devrait empêcher d'arriver ici avec cours vide si entite est Escadron
        }
    } else if (dataToSend.entite === 'Service') {
        // Si l'entité est 'Service', le champ 'cours' (responsible_escadron_id) doit être null pour le backend
        dataToSend.cours = null;
         // Le champ 'service' est déjà une chaîne (nom du service), ce qui devrait être correct.
    }
     // TODO: Si vous avez une option 'None' pour l'entité, ajoutez une logique ici pour mettre service et cours à null

    console.log('Données envoyées au backend :', dataToSend); // Utile pour le debug
    // --- Fin Préparation des données ---


    try {
      // TODO: Remplacer l'URL par votre endpoint backend pour créer un cadre
      // Assurez-vous que votre endpoint backend (/api/cadres) accepte ces champs (y compris 'sexe')
      const response = await fetch('http://localhost:3000/api/cadres', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Inclure le token JWT
        },
        // Envoyer les données préparées
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message || 'Cadre créé avec succès !');
        setIsSuccess(true);
        // Réinitialiser le formulaire après succès
        setFormData({
             grade: '',
             nom: '',
             prenom: '',
             matricule: '',
             service: '', // Réinitialiser le service
             numero_telephone: '',
             fonction: '',
             entite: 'Service', // Réinitialiser à la valeur par défaut
             cours: '', // Réinitialiser le cours
             sexe: '', // Réinitialiser le sexe
        });
      } else {
        // Afficher le message d'erreur du backend si disponible
        setMessage(result.message || `Échec de la création du cadre. Statut : ${response.status}`);
        setIsSuccess(false);
      }
    } catch (error) {
      console.error('Erreur lors de la soumission du formulaire :', error);
      setMessage('Une erreur est survenue lors de la création du cadre.');
      setIsSuccess(false);
    }
  };

  return (
    <div className="container mt-4">
      <h1 className="mb-4">Ajouter un nouveau Cadre</h1>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>

            {/* Utilisation de la grille Bootstrap pour aligner les champs */}
            <div className="row">
              {/* Champ Grade (prend la moitié de la largeur sur les écrans moyens et plus grands) */}
              <div className="col-md-6 mb-3">
                <label htmlFor="grade" className="form-label">Grade</label>
                <input
                  type="text" // TODO: Idéalement, un menu déroulant si les grades sont fixes
                  className="form-control"
                  id="grade"
                  name="grade"
                  value={formData.grade}
                  onChange={handleInputChange}
                  required // Rendu obligatoire
                />
              </div>
              {/* Champ Matricule (prend 1/3 de la largeur sur les écrans moyens et plus grands) */}
               <div className="col-md-6 mb-3"> {/* Taille réduite */}
                <label htmlFor="matricule" className="form-label">Matricule</label>
                <input
                  type="text"
                  className="form-control"
                  id="matricule"
                  name="matricule"
                  value={formData.matricule}
                  onChange={handleInputChange}
                  required // Rendu obligatoire
                  maxLength="5" // Limiter la saisie à 5 chiffres si c'est un nombre
                />
              </div>
            </div> {/* Fin de la première ligne */}

            <div className="row">
              {/* Champ Nom (prend la moitié de la largeur sur les écrans moyens et plus grands) */}
              <div className="col-md-6 mb-3">
                <label htmlFor="nom" className="form-label">Nom</label>
                <input
                  type="text"
                  className="form-control"
                  id="nom"
                  name="nom"
                  value={formData.nom}
                  onChange={handleInputChange}
                  required // Rendu obligatoire
                />
              </div>
              {/* Champ Prénom (prend la moitié de la largeur sur les écrans moyens et plus grands) */}
              <div className="col-md-6 mb-3">
                <label htmlFor="prenom" className="form-label">Prénom</label>
                <input
                  type="text"
                  className="form-control"
                  id="prenom"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleInputChange}
                  required // Rendu obligatoire
                />
              </div>
            </div> {/* Fin de la deuxième ligne */}

             <div className="row">
                {/* Champ Entité (Menu déroulant, prend la moitié de la largeur) */}
               <div className="col-md-6 mb-3"> {/* Taille ajustée */}
                 <label htmlFor="entite" className="form-label">Entité</label> {/* Label renommé */}
                 <select
                   className="form-select"
                   id="entite"
                   name="entite"
                   value={formData.entite}
                   onChange={handleInputChange}
                   required // Rendu obligatoire
                 >
                   {/* Options avec labels et VALEURS corrigées */}
                   <option value="Service">Service</option>
                   <option value="Escadron">COURS</option> {/* <-- value est 'Escadron', label est 'COURS' */}
                   {/* TODO: Si vous voulez l'option 'None', ajoutez-la ici : <option value="None">Aucun</option> */}
                 </select>
               </div>
               {/* Champ Service (Menu déroulant, prend la moitié de la largeur) - Dépend de l'entité */}
               <div className="col-md-6 mb-3"> {/* Taille ajustée */}
                 <label htmlFor="service" className="form-label">Service</label>
                 <select
                   className="form-select" // Classe Bootstrap pour les sélecteurs
                   id="service"
                   name="service"
                   value={formData.service}
                   onChange={handleInputChange}
                   disabled={formData.entite !== 'Service'} // Désactiver si l'entité n'est PAS 'Service'
                   required={formData.entite === 'Service'} // Rendre obligatoire UNIQUEMENT si l'entité est 'Service'
                 >
                   <option value="">-- Sélectionner un service --</option> {/* Option par défaut */}
                   {/* Mapper les options de service chargées */}
                   {services.map(service => (
                     <option key={service.id} value={service.nom}> {/* Utiliser le nom du service comme valeur */}
                       {service.nom}
                     </option>
                   ))}
                 </select>
                 {/* TODO: La logique d'ajout/suppression de services devrait être dans une page d'administration séparée */}
               </div>
             </div> {/* Fin de la troisième ligne */}

             <div className="row">
               {/* Champ Fonction (prend la moitié de la largeur) */}
               <div className="col-md-6 mb-3"> {/* Taille ajustée */}
                 <label htmlFor="fonction" className="form-label">Fonction</label>
                 <input
                   type="text"
                   className="form-control"
                   id="fonction"
                   name="fonction"
                   value={formData.fonction}
                   onChange={handleInputChange}
                   required // Rendu obligatoire
                 />
               </div>
                {/* Champ COURS (Menu déroulant, prend la moitié de la largeur) - Visible si entité est 'Escadron' */}
               <div className="col-md-6 mb-3"> {/* Taille ajustée */}
                 <label htmlFor="cours" className="form-label">Escadron</label> {/* Label "COURS" remplacé par "Escadron" */}
                 {/* Remplacer par un sélecteur d'escadron existant si entité est 'Escadron' */}
                 <select // Changé en <select>
                   className="form-select"
                   id="cours"
                   name="cours"
                   value={formData.cours}
                   onChange={handleInputChange}
                   disabled={formData.entite !== 'Escadron'} // Désactiver si entité n'est pas Escadron
                   required={formData.entite === 'Escadron'} // Rendre obligatoire UNIQUEMENT si entité est Escadron
                 >
                    <option value="">-- Sélectionner un Escadron --</option> {/* Option par défaut, label mis à jour */}
                    {/* Mapper les options de Cours/Escadrons chargées */}
                   {coursOptions.map(cours => (
                     <option key={cours.id} value={cours.id}> {/* Utiliser l'ID comme valeur */}
                       {cours.numero} - {cours.nom} {/* Afficher numéro et nom */}
                     </option>
                   ))}
                 </select>
                 {/* TODO: La logique d'ajout/suppression de Cours (Escadrons) devrait être dans une page d'administration séparée */}
               </div>
             </div> {/* Fin de la quatrième ligne */}

              <div className="row">
                {/* Champ Sexe (Menu déroulant, prend la moitié de la largeur) */}
               <div className="col-md-6 mb-3"> {/* Taille ajustée */}
                 <label htmlFor="sexe" className="form-label">Sexe</label> {/* <-- NOUVEAU LABEL */}
                 <select
                   className="form-select"
                   id="sexe"
                   name="sexe"
                   value={formData.sexe}
                   onChange={handleInputChange}
                   required // Rendu obligatoire
                 >
                   <option value="">-- Sélectionner le sexe --</option> {/* Option par défaut */}
                   <option value="Masculin">Masculin</option> {/* <-- Utiliser les valeurs exactes de l'ENUM de la DB */}
                   <option value="Féminin">Féminin</option> {/* <-- Utiliser les valeurs exactes de l'ENUM de la DB */}
                   {/* TODO: Adapter si votre ENUM Sexe a d'autres valeurs */}
                 </select>
               </div>
                 {/* Champ Numéro de Téléphone (prend la moitié de la largeur sur les écrans moyens et plus grands) */}
               <div className="col-md-6 mb-3"> {/* Taille ajustée */}
                 <label htmlFor="numero_telephone" className="form-label">Numéro de Téléphone</label>
                 <input
                   type="text" // Ou 'tel' si vous voulez utiliser le type tel
                   className="form-control"
                   id="numero_telephone"
                   name="numero_telephone"
                   value={formData.numero_telephone}
                   onChange={handleInputChange}
                   required // Rendu obligatoire
                 />
               </div>
             </div> {/* Fin de la cinquième ligne */}


            {/* TODO: Ajouter d'autres champs ici en utilisant des rows et cols si nécessaire */}


            {/* Bouton de soumission (centré) */}
             <div className="mb-3 text-center"> {/* Utilisation de text-center pour centrer le contenu */}
                <button type="submit" className="btn btn-primary">Créer Cadre</button>
             </div>


          </form>

          {/* Affichage du message de succès ou d'erreur */}
          {message && (
            <div className={`alert mt-3 ${isSuccess ? 'alert-success' : 'alert-danger'}`} role="alert">
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateCadrePage;
