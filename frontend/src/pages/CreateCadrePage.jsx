import React, { useState, useEffect } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../context/AuthContext';

function CreateCadrePage() {
    const { token } = useAuth();
    const [services, setServices] = useState([]);
    const [coursOptions, setCoursOptions] = useState([]);

    const [formData, setFormData] = useState({
        grade: '',
        nom: '',
        prenom: '',
        matricule: '',
        service: '',
        numero_telephone: '',
        isWhatsappPrincipal: false,
        fonction: '',
        entite: 'Service',
        cours: '',
        sexe: '',
        date_naissance: null,
        lieu_naissance: '',
        cfeg: '',
        date_sejour_egna: null,
        situation_familiale: '',
        nombre_enfants: 0,
        email: '',
        photo: null,
        date_nomination: null,
    });
    const [autresTelephones, setAutresTelephones] = useState([]);

    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const fetchServices = async () => {
            const simulatedServices = [
                { id: 1, nom: 'CAB' }, { id: 2, nom: 'DI' }, { id: 3, nom: 'SAF' },
                { id: 4, nom: 'ST' }, { id: 5, nom: 'SM' }, { id: 6, nom: 'COURS A' },
                { id: 7, nom: 'COURS B' }, { id: 8, nom: 'SED' }, { id: 9, nom: 'SRH' },
                { id: 10, nom: 'PEDA' }, { id: 11, nom: 'SSL' }, { id: 12, nom: 'MATR' },
                { id: 13, nom: 'TELECOM' }, { id: 14, nom: 'ARM' }, { id: 15, nom: 'PDS' },
                { id: 16, nom: 'INFR' }, { id: 17, nom: 'PIF' }, { id: 18, nom: 'INFO' },
                { id: 19, nom: 'SE' }
            ];
            setServices(simulatedServices);
        };

        const fetchCours = async () => {
            const simulatedCours = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, numero: i + 1, nom: `Escadron ${i + 1}` }));
            setCoursOptions(simulatedCours);
        };

        fetchServices();
        fetchCours();
    }, [token]);

    const handleInputChange = (e) => {
        const { name, value, type, files, checked } = e.target;

        if (name === 'photo') {
            setFormData({ ...formData, [name]: files[0] });
        } else if (name === 'isWhatsappPrincipal') {
            if (checked) {
                const updatedAutresTelephones = autresTelephones.map(tel => ({ ...tel, isWhatsapp: false }));
                setAutresTelephones(updatedAutresTelephones);
            }
            setFormData({ ...formData, [name]: checked });
        }
        else {
            const newValue = type === 'number' ? parseInt(value, 10) : value;

            if (name === 'entite') {
                setFormData(prevFormData => ({
                    ...prevFormData,
                    [name]: newValue,
                    service: newValue !== 'Service' ? '' : prevFormData.service,
                    cours: newValue !== 'Escadron' ? '' : prevFormData.cours,
                }));
            } else {
                setFormData({ ...formData, [name]: newValue });
            }
        }
    };

    const handleDateChange = (date, name) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            [name]: date
        }));
    };

    const handleOtherTelephoneChange = (index, field, value) => {
        const newAutresTelephones = [...autresTelephones];
        newAutresTelephones[index][field] = value;

        if (field === 'isWhatsapp' && value === true) {
            setFormData(prevFormData => ({ ...prevFormData, isWhatsappPrincipal: false }));
            newAutresTelephones.forEach((tel, i) => {
                if (i !== index) {
                    tel.isWhatsapp = false;
                }
            });
        }
        setAutresTelephones(newAutresTelephones);
    };

    const handleAddTelephone = () => {
        setAutresTelephones([...autresTelephones, { numero: '', isWhatsapp: false }]);
    };

    const handleRemoveTelephone = (index) => {
        const newAutresTelephones = autresTelephones.filter((_, i) => i !== index);
        setAutresTelephones(newAutresTelephones);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');

        if (!token) {
            setMessage("Erreur: Utilisateur non authentifié.");
            setIsSuccess(false);
            return;
        }

        console.log('Valeur de formData.entite avant validation :', formData.entite);

        if (!formData.grade || !formData.nom || !formData.prenom || !formData.matricule || !formData.entite || !formData.sexe ||
            !formData.date_naissance || !formData.lieu_naissance || !formData.cfeg || !formData.date_sejour_egna ||
            !formData.situation_familiale || !formData.numero_telephone || !formData.email || !formData.date_nomination) {
            setMessage("Veuillez remplir tous les champs obligatoires (Grade, Nom, Prénom, Matricule, Entité, Sexe, Date de Naissance, Lieu de Naissance, CFEG, Date de séjour à EGNA, Situation Familiale, Numéro de Téléphone principal, Email, Date de Nomination).");
            setIsSuccess(false);
            return;
        }

        if (isNaN(formData.nombre_enfants) || formData.nombre_enfants < 0) {
            setMessage("Le nombre d'enfants doit être un nombre positif.");
            setIsSuccess(false);
            return;
        }

        if (formData.entite === 'Service') {
            if (!formData.service) {
                setMessage("Veuillez sélectionner un service si l'entité est 'Service'.");
                setIsSuccess(false);
                return;
            }
        } else if (formData.entite === 'Escadron') {
            if (!formData.cours) {
                setMessage("Veuillez sélectionner un Escadron si l'entité est 'COURS'.");
                setIsSuccess(false);
                return;
            }
        } else {
            setMessage('Erreur interne : Valeur d\'entité inattendue.');
            setIsSuccess(false);
            return;
        }

        const allPhones = [
            { numero: formData.numero_telephone, isWhatsapp: formData.isWhatsappPrincipal }
        ];
        autresTelephones.forEach(tel => {
            if (tel.numero.trim() !== '') {
                allPhones.push(tel);
            }
        });
        const whatsappNumbersCount = allPhones.filter(p => p.isWhatsapp && p.numero.trim() !== '').length;

        if (whatsappNumbersCount > 1) {
            setMessage("Vous ne pouvez marquer qu'un seul numéro comme numéro WhatsApp.");
            setIsSuccess(false);
            return;
        }

        const data = new FormData();

        for (const key in formData) {
            if (key === 'photo') {
                if (formData[key]) {
                    data.append('photo', formData[key]);
                }
            } else if (key === 'isWhatsappPrincipal' || key === 'numero_telephone') {
                continue;
            } else if (['date_naissance', 'date_sejour_egna', 'date_nomination'].includes(key)) {
                if (formData[key]) {
                    data.append(key, formData[key].toISOString().substring(0, 10));
                } else {
                    data.append(key, '');
                }
            } else if (key === 'cours' && formData.entite === 'Escadron' && formData[key] !== '') {
                data.append('responsible_escadron_id', parseInt(formData[key], 10));
            } else if (key === 'service' && formData.entite === 'Service') {
                data.append('service', formData[key]);
            } else {
                data.append(key, formData[key]);
            }
        }

        data.append('telephones', JSON.stringify(allPhones));

        console.log('Données envoyées au backend (FormData) :');
        for (let pair of data.entries()) {
            console.log(pair[0] + ', ' + pair[1]);
        }

        try {
            const response = await fetch('http://localhost:3000/api/cadres', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: data,
            });

            const result = await response.json();

            if (response.ok) {
                setMessage(result.message || 'Cadre créé avec succès !');
                setIsSuccess(true);
                setFormData({
                    grade: '', nom: '', prenom: '', matricule: '', service: '',
                    numero_telephone: '', isWhatsappPrincipal: false, fonction: '',
                    entite: 'Service', cours: '', sexe: '', date_naissance: null,
                    lieu_naissance: '', cfeg: '', date_sejour_egna: null,
                    situation_familiale: '', nombre_enfants: 0, email: '',
                    photo: null, date_nomination: null,
                });
                setAutresTelephones([]);
            } else {
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
            <h1 className="mb-4 text-center">Ajouter un nouveau Cadre</h1>

            <div className="card shadow-lg rounded-3">
                <div className="card-body p-4">
                    <form onSubmit={handleSubmit}>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="grade" className="form-label">Grade</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="grade"
                                    name="grade"
                                    value={formData.grade}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="matricule" className="form-label">Matricule</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="matricule"
                                    name="matricule"
                                    value={formData.matricule}
                                    onChange={handleInputChange}
                                    required
                                    maxLength="5"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="nom" className="form-label">Nom</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="nom"
                                    name="nom"
                                    value={formData.nom}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="prenom" className="form-label">Prénom</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="prenom"
                                    name="prenom"
                                    value={formData.prenom}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="entite" className="form-label">Entité</label>
                                <select
                                    className="form-select rounded-pill"
                                    id="entite"
                                    name="entite"
                                    value={formData.entite}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="Service">Service</option>
                                    <option value="Escadron">COURS</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="service" className="form-label">Service</label>
                                <select
                                    className="form-select rounded-pill"
                                    id="service"
                                    name="service"
                                    value={formData.service}
                                    onChange={handleInputChange}
                                    disabled={formData.entite !== 'Service'}
                                    required={formData.entite === 'Service'}
                                >
                                    <option value="">-- Sélectionner un service --</option>
                                    {services.map(service => (
                                        <option key={service.id} value={service.nom}>
                                            {service.nom}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="fonction" className="form-label">Fonction</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="fonction"
                                    name="fonction"
                                    value={formData.fonction}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="cours" className="form-label">Escadron</label>
                                <select
                                    className="form-select rounded-pill"
                                    id="cours"
                                    name="cours"
                                    value={formData.cours}
                                    onChange={handleInputChange}
                                    disabled={formData.entite !== 'Escadron'}
                                    required={formData.entite === 'Escadron'}
                                >
                                    <option value="">-- Sélectionner un Escadron --</option>
                                    {coursOptions.map(cours => (
                                        <option key={cours.id} value={cours.id}>
                                            {cours.numero} - {cours.nom}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="sexe" className="form-label">Sexe</label>
                                <select
                                    className="form-select rounded-pill"
                                    id="sexe"
                                    name="sexe"
                                    value={formData.sexe}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">-- Sélectionner le sexe --</option>
                                    <option value="Masculin">Masculin</option>
                                    <option value="Féminin">Féminin</option>
                                </select>
                            </div>
                            {/* Numéro de Téléphone Principal avec case à cocher WhatsApp */}
                            <div className="col-md-6 mb-3">
                                <label htmlFor="numero_telephone" className="form-label">Numéro de Téléphone Principal</label>
                                <div className="input-group rounded-pill overflow-hidden border border-gray-300">
                                    <input
                                        type="text"
                                        className="form-control border-0 focus:shadow-none"
                                        id="numero_telephone"
                                        name="numero_telephone"
                                        value={formData.numero_telephone}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="input-group-text bg-white border-0">
                                        <input
                                            className="form-check-input mt-0"
                                            type="checkbox"
                                            id="isWhatsappPrincipal"
                                            name="isWhatsappPrincipal"
                                            checked={formData.isWhatsappPrincipal}
                                            onChange={handleInputChange}
                                            aria-label="WhatsApp"
                                        />
                                        <label className="form-check-label ms-2" htmlFor="isWhatsappPrincipal">WhatsApp</label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CHAMPS DE NUMÉROS DE TÉLÉPHONE SUPPLÉMENTAIRES */}
                        {autresTelephones.map((tel, index) => (
                            <div className="row" key={index}>
                                <div className="col-md-6 offset-md-6 mb-3 d-flex align-items-end">
                                    <div className="input-group flex-grow-1 me-2 rounded-pill overflow-hidden border border-gray-300">
                                        <input
                                            type="text"
                                            className="form-control border-0 focus:shadow-none"
                                            id={`autre_telephone_${index}`}
                                            name={`autre_telephone_${index}`}
                                            value={tel.numero}
                                            onChange={(e) => handleOtherTelephoneChange(index, 'numero', e.target.value)}
                                            placeholder={`Autre Numéro ${index + 1}`}
                                        />
                                        <div className="input-group-text bg-white border-0">
                                            <input
                                                className="form-check-input mt-0"
                                                type="checkbox"
                                                id={`isWhatsappOther_${index}`}
                                                name={`isWhatsappOther_${index}`}
                                                checked={tel.isWhatsapp}
                                                onChange={(e) => handleOtherTelephoneChange(index, 'isWhatsapp', e.target.checked)}
                                                aria-label="WhatsApp"
                                            />
                                            <label className="form-check-label ms-2" htmlFor={`isWhatsappOther_${index}`}>WhatsApp</label>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn btn-danger rounded-pill"
                                        onClick={() => handleRemoveTelephone(index)}
                                        title="Supprimer ce numéro"
                                    >
                                        &times;
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div className="row">
                            <div className="col-md-6 offset-md-6 mb-3 d-flex justify-content-end">
                                <button
                                    type="button"
                                    className="btn btn-outline-secondary rounded-pill"
                                    onClick={handleAddTelephone}
                                >
                                    Ajouter un autre numéro
                                </button>
                            </div>
                        </div>

                        ---

                        <h4 className="mb-3 text-center">Informations Personnelles Supplémentaires</h4>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="date_naissance" className="form-label">Date de Naissance</label>
                                <DatePicker
                                    selected={formData.date_naissance}
                                    onChange={(date) => handleDateChange(date, 'date_naissance')}
                                    dateFormat="yyyy-MM-dd"
                                    className="form-control rounded-pill"
                                    id="date_naissance"
                                    name="date_naissance"
                                    required
                                    placeholderText="Sélectionner une date"
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="lieu_naissance" className="form-label">Lieu de Naissance</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="lieu_naissance"
                                    name="lieu_naissance"
                                    value={formData.lieu_naissance}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="cfeg" className="form-label">CFEG</label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="cfeg"
                                    name="cfeg"
                                    value={formData.cfeg}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="date_sejour_egna" className="form-label">Date de Séjour à EGNA</label>
                                <DatePicker
                                    selected={formData.date_sejour_egna}
                                    onChange={(date) => handleDateChange(date, 'date_sejour_egna')}
                                    dateFormat="yyyy-MM-dd"
                                    className="form-control rounded-pill"
                                    id="date_sejour_egna"
                                    name="date_sejour_egna"
                                    required
                                    placeholderText="Sélectionner une date"
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="situation_familiale" className="form-label">Situation Familiale</label>
                                <select
                                    className="form-select rounded-pill"
                                    id="situation_familiale"
                                    name="situation_familiale"
                                    value={formData.situation_familiale}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">-- Sélectionner la situation --</option>
                                    <option value="Celibataire">Célibataire</option>
                                    <option value="Marié">Marié(e)</option>
                                    <option value="Divorcé">Divorcé(e)</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="nombre_enfants" className="form-label">Nombre d'enfants</label>
                                <input
                                    type="number"
                                    className="form-control rounded-pill"
                                    id="nombre_enfants"
                                    name="nombre_enfants"
                                    value={formData.nombre_enfants}
                                    onChange={handleInputChange}
                                    min="0"
                                    required
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="email" className="form-label">Email</label>
                                <input
                                    type="email"
                                    className="form-control rounded-pill"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="date_nomination" className="form-label">Date de Nomination</label>
                                <DatePicker
                                    selected={formData.date_nomination}
                                    onChange={(date) => handleDateChange(date, 'date_nomination')}
                                    dateFormat="yyyy-MM-dd"
                                    className="form-control rounded-pill"
                                    id="date_nomination"
                                    name="date_nomination"
                                    required
                                    placeholderText="Sélectionner une date"
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <label htmlFor="photo" className="form-label">Photo</label>
                                <input
                                    type="file"
                                    className="form-control rounded-pill"
                                    id="photo"
                                    name="photo"
                                    onChange={handleInputChange}
                                    accept="image/*"
                                />
                            </div>
                        </div>

                        <div className="text-center mt-4">
                            <button type="submit" className="btn btn-primary btn-lg rounded-pill px-5 shadow-lg" style={{ background: 'linear-gradient(to right, #ff8c00, #ff4500)', border: 'none' }}>
                                Créer Cadre
                            </button>
                        </div>

                    </form>

                    {message && (
                        <div className={`alert mt-4 text-center ${isSuccess ? 'alert-success' : 'alert-danger'}`} role="alert">
                            {message}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default CreateCadrePage;