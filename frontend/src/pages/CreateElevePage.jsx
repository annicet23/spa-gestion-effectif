import React, { useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import { useAuth } from '../context/AuthContext';

// NOTE: Assurez-vous que votre backend tourne sur le port 3000 ou ajustez l'URL du fetch en conséquence.
// Assurez-vous que votre backend est capable de recevoir un TABLEAU d'élèves en POST.

const BATCH_SIZE = 50; // Taille de lot conceptuelle. L'envoi manuel est toujours possible.

function CreateElevePage() {
    const { token } = useAuth();

    const [formData, setFormData] = useState({
        nom: '',
        prenom: '',
        matricule: '',
        incorporation: '',
        escadron_id: '',
        peloton: '',
        sexe: '',
        statut: 'Présent'
    });

    const [tempElevesList, setTempElevesList] = useState([]);
    const [isSendingBatch, setIsSendingBatch] = useState(false); // State pour gérer l'état d'envoi

    const [notification, setNotification] = useState({ message: null, type: null });

    const showLocalNotification = (message, type) => {
        setNotification({ message, type });
        setTimeout(() => {
            setNotification({ message: null, type: null });
        }, 5000);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const sendBatchToBackend = async (batchToSend) => {
        console.log(`Tentative d'envoi groupé de ${batchToSend.length} élève(s) au backend...`);
        setIsSendingBatch(true); // Désactiver le bouton et afficher un indicateur

        try {
            const response = await fetch('http://localhost:3000/api/eleves', { // <-- URL à vérifier
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(batchToSend),
            });

            let responseBody = null;
            let rawTextBody = null;

            try {
                rawTextBody = await response.text();
                console.log('Réponse backend (texte brut):', rawTextBody);
                try {
                    responseBody = JSON.parse(rawTextBody);
                    console.log('Réponse backend (JSON parsé):', responseBody);
                } catch (parseError) {
                    console.warn('Échec du parsage JSON de la réponse groupée.', parseError);
                    responseBody = rawTextBody; // Fallback to raw text if JSON parsing fails
                }
            } catch (readError) {
                console.error('Erreur irrécupérable lecture corps réponse backend groupée.', readError);
                responseBody = "Could not read batch response body.";
                rawTextBody = "Could not read batch response body.";
            }


            if (response.ok) {
                showLocalNotification(`Lot de ${batchToSend.length} élève(s) créé(s) avec succès !`, 'success');
                setTempElevesList([]); // Vider la liste temporaire après succès
            } else {
                let errorMessage = `Erreur lors de l'insertion groupée (Statut ${response.status}: ${response.statusText})`;
                if (responseBody && typeof responseBody === 'object' && responseBody.message) {
                    errorMessage += `: ${responseBody.message}`;
                } else if (typeof responseBody === 'string' && responseBody.length > 0) {
                     const limitedRawText = responseBody.length > 150 ? responseBody.substring(0, 150) + '...' : responseBody;
                     errorMessage += `: ${limitedRawText}`;
                 } else {
                    errorMessage += `. Aucun détail d'erreur supplémentaire n'a pu être lu.`;
                }
                console.error('Erreur insertion groupée détaillée:', {
                    status: response.status, statusText: response.statusText, body: responseBody
                });
                showLocalNotification(errorMessage, 'danger');
                // Optionally, don't clear the list on error so the user can retry or inspect
            }

        } catch (error) {
            console.error('Erreur réseau lors de l\'envoi groupé:', error);
            const errorMessage = `Erreur réseau ou serveur lors de l'envoi groupé: ${error.message}`;
            showLocalNotification(errorMessage, 'danger');
             // Optionally, don't clear the list on error
        } finally {
             setIsSendingBatch(false); // Réactiver le bouton
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!token) {
             showLocalNotification("Authentification requise ! Veuillez vous connecter.", 'danger');
            return;
        }
         if (!formData.nom || !formData.prenom || !formData.incorporation || !formData.escadron_id || !formData.peloton || !formData.sexe) {
              showLocalNotification("Veuillez remplir tous les champs obligatoires.", 'danger');
             return;
         }

        const formattedEleve = {
            ...formData,
            nom: formData.nom.toUpperCase(),
            prenom: formData.prenom.charAt(0).toUpperCase() + formData.prenom.slice(1).toLowerCase(),
            escadron_id: parseInt(formData.escadron_id, 10),
        };
        console.log('Nouvel élève formaté pour ajout temporaire:', formattedEleve);

        const updatedList = [...tempElevesList, formattedEleve];
        setTempElevesList(updatedList);

        setFormData({
             nom: '', prenom: '', matricule: '', incorporation: '',
             escadron_id: '', peloton: '', sexe: '', statut: 'Présent'
        });

        console.log(`Élève ajouté temporairement. Total: ${updatedList.length}`);
        showLocalNotification(`Élève "${formattedEleve.prenom} ${formattedEleve.nom}" ajouté à la liste d'attente (${updatedList.length}).`, 'success');
    };

     const handleSendBatch = async () => {
         if (tempElevesList.length === 0) {
             showLocalNotification("Aucun élève dans la liste à envoyer.", 'info');
             return;
         }
         // Ensure we don't send if already in progress
         if (isSendingBatch) {
             return;
         }
          await sendBatchToBackend(tempElevesList);
     };

     // NOUVELLE FONCTION pour supprimer un élève de la liste temporaire
     const handleRemoveEleve = (indexToRemove) => {
         // Crée une nouvelle liste en filtrant l'élément à l'index spécifié
         const updatedList = tempElevesList.filter((_, index) => index !== indexToRemove);
         setTempElevesList(updatedList);
         console.log(`Élève à l'index ${indexToRemove} retiré de la liste temporaire.`);
         showLocalNotification(`Élève retiré de la liste. Il reste ${updatedList.length} en attente.`, 'info');
     };


    // --- Rendu du composant (JSX) ---
    return (
        <div className="container mt-4">

            {/* --- Affichage de la notification --- */}
            {notification.message && (
                <div
                    className={`alert alert-${notification.type} alert-dismissible fade show`}
                    role="alert"
                    style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1050, minWidth: '300px' }}
                >
                    {notification.message}
                    <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close" onClick={() => setNotification({ message: null, type: null })}></button>
                </div>
            )}

            <h1>Ajouter un Élève (Collecte en lot)</h1>

            <div className="row">

                {/* Colonne pour le formulaire */}
                <div className="col-md-5 border shadow-sm p-3">
                     <form onSubmit={handleSubmit}>
                         {/* ... autres champs du formulaire (identiques) ... */}
                          <div className="row">
                              <div className="col-md-12 mb-3">
                                  <label htmlFor="nom" className="form-label">Nom:</label>
                                  <input type="text" className="form-control" id="nom" name="nom" value={formData.nom} onChange={handleInputChange} required />
                              </div>
                              <div className="col-md-12 mb-3">
                                   <label htmlFor="prenom" className="form-label">Prénom:</label>
                                   <input type="text" className="form-control" id="prenom" name="prenom" value={formData.prenom} onChange={handleInputChange} required />
                              </div>
                          </div>

                           <div className="row">
                                <div className="col-md-12 mb-3">
                                    <label htmlFor="incorporation" className="form-label">Incorporation:</label>
                                    <input type="text" className="form-control" id="incorporation" name="incorporation" value={formData.incorporation} onChange={handleInputChange} required />
                                </div>
                                <div className="col-md-12 mb-3">
                                    <label htmlFor="escadron_id" className="form-label">Escadron:</label>
                                    <select className="form-select" id="escadron_id" name="escadron_id" value={formData.escadron_id} onChange={handleInputChange} required>
                                         <option value="">-- Sélectionner un escadron --</option>
                                         {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (<option key={num} value={num}>{num}{num === 1 ? 'er' : 'ème'} Escadron</option>))}
                                    </select>
                                </div>
                           </div>

                           <div className="row">
                              <div className="col-md-12 mb-3">
                                   <label htmlFor="peloton" className="form-label">Peloton:</label>
                                   <select className="form-select" id="peloton" name="peloton" value={formData.peloton} onChange={handleInputChange} required>
                                       <option value="">-- Sélectionner un peloton --</option>
                                       {['1', '2', '3'].map(num => (<option key={num} value={num}>{num}</option>))}
                                   </select>
                              </div>
                               <div className="col-md-12 mb-3">
                                    <label htmlFor="sexe" className="form-label">Sexe:</label>
                                    <select className="form-select" id="sexe" name="sexe" value={formData.sexe} onChange={handleInputChange} required>
                                         <option value="">-- Sélectionner le sexe --</option>
                                         <option value="Masculin">Masculin</option>
                                         <option value="Féminin">Féminin</option>
                                    </select>
                                </div>
                           </div>

                           <div className="row">
                                <div className="col-md-12 mb-3">
                                     <label htmlFor="matricule" className="form-label">Matricule (optionnel):</label>
                                     <input type="text" className="form-control" id="matricule" name="matricule" value={formData.matricule} onChange={handleInputChange} />
                                 </div>
                           </div>

                          {/* Rangée pour les boutons Ajouter et Envoyer */}
                          <div className="row mt-3 align-items-center">
                              {/* Colonne pour le bouton Ajouter */}
                              <div className="col-md-6 mb-2 mb-md-0">
                                   <button type="submit" className="btn btn-primary w-100">
                                       Ajouter à la liste ({tempElevesList.length})
                                   </button>
                              </div>
                              {/* Colonne pour le bouton Envoyer */}
                              <div className="col-md-6">
                                   {tempElevesList.length > 0 ? (
                                       <button
                                           type="button"
                                           className="btn btn-success w-100"
                                           onClick={handleSendBatch}
                                           disabled={isSendingBatch}
                                       >
                                           {isSendingBatch ? (
                                               <>
                                                   <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                   Envoi...
                                               </>
                                           ) : (
                                                `Envoyer (${tempElevesList.length})`
                                           )}
                                       </button>
                                   ) : (
                                       <div className="text-muted text-center">Liste vide</div>
                                   )}
                              </div>
                          </div> {/* Fin de la rangée des boutons */}

                      </form>
                 </div> {/* Fin de la colonne du formulaire */}

                {/* Colonne pour le titre du tableau et le tableau */}
                <div className="col-md-7">
                    <h2>Liste des élèves en attente ({tempElevesList.length})</h2>
                    {tempElevesList.length > 0 ? (
                        <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                             <table className="table table-striped table-bordered mb-0">
                                <thead>
                                    <tr>
                                         <th>#</th><th>Nom</th><th>Prénom</th><th>Matricule</th>
                                         <th>Incorporation</th><th>Escadron</th><th>Peloton</th><th>Sexe</th><th>Statut</th>
                                          {/* NOUVEAU: En-tête pour les actions */}
                                         <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tempElevesList.map((eleve, index) => (
                                         <tr key={index}> {/* L'index est utilisé comme clé, ce qui est acceptable car la liste n'est qu'ajoutée/supprimée par index/vidée */}
                                             <td>{index + 1}</td>
                                             <td>{eleve.nom}</td>
                                             <td>{eleve.prenom}</td>
                                             <td>{eleve.matricule || '-'}</td>
                                             <td>{eleve.incorporation}</td>
                                             <td>{eleve.escadron_id}</td>
                                             <td>{eleve.peloton}</td>
                                             <td>{eleve.sexe}</td>
                                             <td>{eleve.statut}</td>
                                             {/* NOUVEAU: Cellule pour le bouton supprimer */}
                                             <td>
                                                 <button
                                                     type="button" // Type button pour ne pas déclencher la soumission du formulaire parent
                                                     className="btn btn-danger btn-sm" // Style Bootstrap danger (rouge) et sm (petite taille)
                                                     onClick={() => handleRemoveEleve(index)} // Appel la fonction de suppression avec l'index
                                                 >
                                                     Supprimer
                                                 </button>
                                             </td>
                                         </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p>Aucun élève en attente d'insertion groupée.</p>
                    )}

                </div> {/* Fin de la colonne du tableau */}

            </div> {/* Fin de la ligne Bootstrap principale */}

         </div>
     );
}

export default CreateElevePage;