import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom'; // ✅ AJOUT pour redirection
import 'bootstrap/dist/css/bootstrap.min.css';
import { Alert, Spinner, Card, Button } from 'react-bootstrap'; // ✅ AJOUT composants Bootstrap
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2'; // ✅ AJOUT pour notifications
import {
    FaUser,
    FaUserPlus,
    FaInfoCircle,
    FaUserShield,
    FaUserTie,
    FaExclamationTriangle
} from 'react-icons/fa'; // ✅ AJOUT icônes

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // ✅ AJOUT variable d'environnement

function CreateCadrePage() {
    const { token, user } = useAuth(); // ✅ AJOUT user pour vérification rôle

    // ✅ AJOUT : Vérification des permissions
    const userRole = user?.role || 'Standard';
    const isAdmin = userRole === 'Admin';
    const isStandard = userRole === 'Standard';
    const isConsultant = userRole === 'Consultant';

    // ✅ NOUVEAU : Redirection si pas autorisé
    if (isConsultant) {
        return <Navigate to="/cadres" replace />;
    }

    const [services, setServices] = useState([]);
    const [coursOptions, setCoursOptions] = useState([]);
    const [loading, setLoading] = useState(false); // ✅ AJOUT état de chargement
    const [servicesLoading, setServicesLoading] = useState(true); // ✅ AJOUT chargement services

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

    // ✅ AMÉLIORATION : Récupération des services depuis l'API
    useEffect(() => {
        const fetchServices = async () => {
            if (!token) return;

            setServicesLoading(true);
            try {
                const response = await fetch(`${API_BASE_URL}api/cadres/services`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const servicesData = await response.json();
                    const formattedServices = servicesData.map(service => ({
                        id: service,
                        nom: service
                    }));
                    setServices(formattedServices);
                } else {
                    // ✅ Fallback vers les services simulés
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
                }
            } catch (error) {
                console.error('Erreur récupération services:', error);
                // Utiliser les services simulés en cas d'erreur
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
            } finally {
                setServicesLoading(false);
            }
        };

        const fetchCours = async () => {
            if (!token) return;

            try {
                const response = await fetch(`${API_BASE_URL}api/escadrons`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const escadronsData = await response.json();
                    setCoursOptions(escadronsData);
                } else {
                    // Fallback vers les cours simulés
                    const simulatedCours = Array.from({ length: 10 }, (_, i) => ({
                        id: i + 1,
                        numero: i + 1,
                        nom: `Escadron ${i + 1}`
                    }));
                    setCoursOptions(simulatedCours);
                }
            } catch (error) {
                console.error('Erreur récupération escadrons:', error);
                const simulatedCours = Array.from({ length: 10 }, (_, i) => ({
                    id: i + 1,
                    numero: i + 1,
                    nom: `Escadron ${i + 1}`
                }));
                setCoursOptions(simulatedCours);
            }
        };

        fetchServices();
        fetchCours();
    }, [token]);

    // ✅ AMÉLIORATION : Restrictions pour utilisateurs Standard
    useEffect(() => {
        if (isStandard && user) {
            // ✅ Pré-remplir selon l'entité de l'utilisateur
            if (user.service) {
                setFormData(prev => ({
                    ...prev,
                    entite: 'Service',
                    service: user.service
                }));
            } else if (user.escadron_id) {
                setFormData(prev => ({
                    ...prev,
                    entite: 'Escadron',
                    cours: user.escadron_id.toString()
                }));
            }
        }
    }, [isStandard, user]);

    // ✅ AMÉLIORATION : Fonction pour obtenir le badge de rôle
    const getRoleBadge = () => {
        if (isAdmin) {
            return <span className="badge bg-success ms-2"><FaUserShield className="me-1" />Administrateur</span>;
        }
        if (isStandard) {
            return <span className="badge bg-warning ms-2"><FaUserTie className="me-1" />Utilisateur Standard</span>;
        }
        return null;
    };

    const handleInputChange = (e) => {
        const { name, value, type, files, checked } = e.target;

        if (name === 'photo') {
            // ✅ AMÉLIORATION : Validation du fichier
            const file = files[0];
            if (file) {
                const maxSize = 5 * 1024 * 1024; // 5MB
                const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

                if (file.size > maxSize) {
                    setMessage('Le fichier photo ne doit pas dépasser 5MB.');
                    setIsSuccess(false);
                    return;
                }

                if (!allowedTypes.includes(file.type)) {
                    setMessage('Seules les images (JPEG, PNG, GIF) sont autorisées.');
                    setIsSuccess(false);
                    return;
                }
            }
            setFormData({ ...formData, [name]: file });
        } else if (name === 'isWhatsappPrincipal') {
            if (checked) {
                const updatedAutresTelephones = autresTelephones.map(tel => ({ ...tel, isWhatsapp: false }));
                setAutresTelephones(updatedAutresTelephones);
            }
            setFormData({ ...formData, [name]: checked });
        } else {
            const newValue = type === 'number' ? parseInt(value, 10) : value;

            if (name === 'entite') {
                // ✅ AMÉLIORATION : Restrictions pour Standard
                if (isStandard) {
                    // Standard ne peut pas changer d'entité
                    return;
                }

                setFormData(prevFormData => ({
                    ...prevFormData,
                    [name]: newValue,
                    service: newValue !== 'Service' ? '' : prevFormData.service,
                    cours: newValue !== 'Escadron' ? '' : prevFormData.cours,
                }));
            } else if ((name === 'service' || name === 'cours') && isStandard) {
                // ✅ Standard ne peut pas changer son service/escadron
                return;
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
        setLoading(true); // ✅ AJOUT état de chargement

        if (!token) {
            setMessage("Erreur: Utilisateur non authentifié.");
            setIsSuccess(false);
            setLoading(false);
            return;
        }

        // ✅ AMÉLIORATION : Validation renforcée
        const requiredFields = [
            'grade', 'nom', 'prenom', 'matricule', 'entite', 'sexe',
            'date_naissance', 'lieu_naissance', 'cfeg', 'date_sejour_egna',
            'situation_familiale', 'numero_telephone', 'email', 'date_nomination'
        ];

        const missingFields = requiredFields.filter(field => !formData[field]);

        if (missingFields.length > 0) {
            setMessage(`Champs obligatoires manquants: ${missingFields.join(', ')}`);
            setIsSuccess(false);
            setLoading(false);
            return;
        }

        // ✅ AMÉLIORATION : Validation email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setMessage("Veuillez saisir une adresse email valide.");
            setIsSuccess(false);
            setLoading(false);
            return;
        }

        // ✅ AMÉLIORATION : Validation matricule (format et longueur)
        if (formData.matricule.length !== 5) {
            setMessage("Le matricule doit contenir exactement 5 caractères.");
            setIsSuccess(false);
            setLoading(false);
            return;
        }

        if (isNaN(formData.nombre_enfants) || formData.nombre_enfants < 0) {
            setMessage("Le nombre d'enfants doit être un nombre positif.");
            setIsSuccess(false);
            setLoading(false);
            return;
        }

        if (formData.entite === 'Service') {
            if (!formData.service) {
                setMessage("Veuillez sélectionner un service si l'entité est 'Service'.");
                setIsSuccess(false);
                setLoading(false);
                return;
            }
        } else if (formData.entite === 'Escadron') {
            if (!formData.cours) {
                setMessage("Veuillez sélectionner un Escadron si l'entité est 'Escadron'.");
                setIsSuccess(false);
                setLoading(false);
                return;
            }
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
            setLoading(false);
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

        try {
            const response = await fetch(`${API_BASE_URL}api/cadres`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: data,
            });

            const result = await response.json();

            if (response.ok) {
                // ✅ AMÉLIORATION : Notification de succès avec SweetAlert
                await Swal.fire({
                    title: 'Succès !',
                    text: result.message || 'Cadre créé avec succès !',
                    icon: 'success',
                    timer: 3000,
                    showConfirmButton: false
                });

                setMessage(result.message || 'Cadre créé avec succès !');
                setIsSuccess(true);

                // ✅ Reset du formulaire
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
        } finally {
            setLoading(false);
        }
    };

    // ✅ AMÉLIORATION : Fonction de reset du formulaire
    const handleReset = () => {
        setFormData({
            grade: '', nom: '', prenom: '', matricule: '', service: '',
            numero_telephone: '', isWhatsappPrincipal: false, fonction: '',
            entite: 'Service', cours: '', sexe: '', date_naissance: null,
            lieu_naissance: '', cfeg: '', date_sejour_egna: null,
            situation_familiale: '', nombre_enfants: 0, email: '',
            photo: null, date_nomination: null,
        });
        setAutresTelephones([]);
        setMessage('');
    };

    // ✅ AMÉLIORATION : Affichage de chargement si services en cours de chargement
    if (servicesLoading) {
        return (
            <div className="container mt-4">
                <div className="text-center">
                    <Spinner animation="border" role="status" className="me-2" />
                    <span>Chargement des données...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mt-4">
            {/* ✅ AMÉLIORATION : En-tête avec informations sur les permissions */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="mb-2">
                        <FaUserPlus className="me-2" />
                        Ajouter un nouveau Cadre
                        {getRoleBadge()}
                    </h1>
                    {isStandard && (
                        <Alert variant="info" className="mb-3">
                            <FaInfoCircle className="me-2" />
                            <strong>Mode Standard :</strong> Vous ne pouvez créer des cadres que dans votre entité
                            ({user?.service ? `Service: ${user.service}` : `Escadron: ${user?.escadron_name || user?.escadron_id}`})
                        </Alert>
                    )}
                </div>
            </div>

            <Card className="shadow-lg rounded-3">
                <Card.Body className="p-4">
                    <form onSubmit={handleSubmit}>
                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="grade" className="form-label">Grade <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="grade"
                                    name="grade"
                                    value={formData.grade}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Ex: COL, LCL, CNE..."
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="matricule" className="form-label">Matricule <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="matricule"
                                    name="matricule"
                                    value={formData.matricule}
                                    onChange={handleInputChange}
                                    required
                                    maxLength="5"
                                    placeholder="5 caractères"
                                />
                                <small className="text-muted">Exactement 5 caractères</small>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="nom" className="form-label">Nom <span className="text-danger">*</span></label>
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
                                <label htmlFor="prenom" className="form-label">Prénom <span className="text-danger">*</span></label>
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
                                <label htmlFor="entite" className="form-label">Entité <span className="text-danger">*</span></label>
                                <select
                                    className="form-select rounded-pill"
                                    id="entite"
                                    name="entite"
                                    value={formData.entite}
                                    onChange={handleInputChange}
                                    required
                                    disabled={isStandard} // ✅ Désactivé pour Standard
                                >
                                    <option value="Service">Service</option>
                                    <option value="Escadron">COURS</option>
                                </select>
                                {isStandard && (
                                    <small className="text-muted">Fixé selon votre entité</small>
                                )}
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="service" className="form-label">
                                    Service {formData.entite === 'Service' && <span className="text-danger">*</span>}
                                </label>
                                <select
                                    className="form-select rounded-pill"
                                    id="service"
                                    name="service"
                                    value={formData.service}
                                    onChange={handleInputChange}
                                    disabled={formData.entite !== 'Service' || (isStandard && user?.service)}
                                    required={formData.entite === 'Service'}
                                >
                                    <option value="">-- Sélectionner un service --</option>
                                    {services.map(service => (
                                        <option key={service.id} value={service.nom}>
                                            {service.nom}
                                        </option>
                                    ))}
                                </select>
                                {isStandard && user?.service && (
                                    <small className="text-muted">Fixé à votre service</small>
                                )}
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
                                    placeholder="Ex: Chef de service, Instructeur..."
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="cours" className="form-label">
                                    Escadron {formData.entite === 'Escadron' && <span className="text-danger">*</span>}
                                </label>
                                <select
                                    className="form-select rounded-pill"
                                    id="cours"
                                    name="cours"
                                    value={formData.cours}
                                    onChange={handleInputChange}
                                    disabled={formData.entite !== 'Escadron' || (isStandard && user?.escadron_id)}
                                    required={formData.entite === 'Escadron'}
                                >
                                    <option value="">-- Sélectionner un Escadron --</option>
                                    {coursOptions.map(cours => (
                                        <option key={cours.id} value={cours.id}>
                                            {cours.numero ? `${cours.numero} - ${cours.nom}` : cours.nom}
                                        </option>
                                    ))}
                                </select>
                                {isStandard && user?.escadron_id && (
                                    <small className="text-muted">Fixé à votre escadron</small>
                                )}
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="sexe" className="form-label">Sexe <span className="text-danger">*</span></label>
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
                            <div className="col-md-6 mb-3">
                                <label htmlFor="numero_telephone" className="form-label">Numéro de Téléphone Principal <span className="text-danger">*</span></label>
                                <div className="input-group rounded-pill overflow-hidden border border-gray-300">
                                    <input
                                        type="tel"
                                        className="form-control border-0 focus:shadow-none"
                                        id="numero_telephone"
                                        name="numero_telephone"
                                        value={formData.numero_telephone}
                                        onChange={handleInputChange}
                                        required
                                        placeholder="Ex: +223 XX XX XX XX"
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

                        {/* Téléphones supplémentaires */}
                        {autresTelephones.map((tel, index) => (
                            <div className="row" key={index}>
                                <div className="col-md-6 offset-md-6 mb-3 d-flex align-items-end">
                                    <div className="input-group flex-grow-1 me-2 rounded-pill overflow-hidden border border-gray-300">
                                        <input
                                            type="tel"
                                            className="form-control border-0 focus:shadow-none"
                                            value={tel.numero}
                                            onChange={(e) => handleOtherTelephoneChange(index, 'numero', e.target.value)}
                                            placeholder={`Autre Numéro ${index + 1}`}
                                        />
                                        <div className="input-group-text bg-white border-0">
                                            <input
                                                className="form-check-input mt-0"
                                                type="checkbox"
                                                checked={tel.isWhatsapp}
                                                onChange={(e) => handleOtherTelephoneChange(index, 'isWhatsapp', e.target.checked)}
                                                aria-label="WhatsApp"
                                            />
                                            <label className="form-check-label ms-2">WhatsApp</label>
                                        </div>
                                    </div>
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        className="rounded-pill"
                                        onClick={() => handleRemoveTelephone(index)}
                                        title="Supprimer ce numéro"
                                    >
                                        &times;
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <div className="row">
                            <div className="col-md-6 offset-md-6 mb-3 d-flex justify-content-end">
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    className="rounded-pill"
                                    onClick={handleAddTelephone}
                                >
                                    + Ajouter un autre numéro
                                </Button>
                            </div>
                        </div>

                        <hr className="my-4" />
                        <h4 className="mb-3 text-center">
                            <FaInfoCircle className="me-2" />
                            Informations Personnelles Supplémentaires
                        </h4>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="date_naissance" className="form-label">Date de Naissance <span className="text-danger">*</span></label>
                                <DatePicker
                                    selected={formData.date_naissance}
                                    onChange={(date) => handleDateChange(date, 'date_naissance')}
                                    dateFormat="yyyy-MM-dd"
                                    className="form-control rounded-pill"
                                    required
                                    placeholderText="Sélectionner une date"
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                    maxDate={new Date()} // ✅ Pas de date future
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="lieu_naissance" className="form-label">Lieu de Naissance <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="lieu_naissance"
                                    name="lieu_naissance"
                                    value={formData.lieu_naissance}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Ex: Ihosy"
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="cfeg" className="form-label">CFEG <span className="text-danger">*</span></label>
                                <input
                                    type="text"
                                    className="form-control rounded-pill"
                                    id="cfeg"
                                    name="cfeg"
                                    value={formData.cfeg}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Certificat de Fin d'Études Générales"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="date_sejour_egna" className="form-label">Date de Séjour à EGNA <span className="text-danger">*</span></label>
                                <DatePicker
                                    selected={formData.date_sejour_egna}
                                    onChange={(date) => handleDateChange(date, 'date_sejour_egna')}
                                    dateFormat="yyyy-MM-dd"
                                    className="form-control rounded-pill"
                                    required
                                    placeholderText="Sélectionner une date"
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                    maxDate={new Date()} // ✅ Pas de date future
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="situation_familiale" className="form-label">Situation Familiale <span className="text-danger">*</span></label>
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
                                    <option value="Veuf">Veuf/Veuve</option>
                                </select>
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="nombre_enfants" className="form-label">Nombre d'enfants <span className="text-danger">*</span></label>
                                <input
                                    type="number"
                                    className="form-control rounded-pill"
                                    id="nombre_enfants"
                                    name="nombre_enfants"
                                    value={formData.nombre_enfants}
                                    onChange={handleInputChange}
                                    min="0"
                                    max="20"
                                    required
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-6 mb-3">
                                <label htmlFor="email" className="form-label">Email <span className="text-danger">*</span></label>
                                <input
                                    type="email"
                                    className="form-control rounded-pill"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="exemple@email.com"
                                />
                            </div>
                            <div className="col-md-6 mb-3">
                                <label htmlFor="date_nomination" className="form-label">Date de Nomination <span className="text-danger">*</span></label>
                                <DatePicker
                                    selected={formData.date_nomination}
                                    onChange={(date) => handleDateChange(date, 'date_nomination')}
                                    dateFormat="yyyy-MM-dd"
                                    className="form-control rounded-pill"
                                    required
                                    placeholderText="Sélectionner une date"
                                    showYearDropdown
                                    showMonthDropdown
                                    dropdownMode="select"
                                    maxDate={new Date()} // ✅ Pas de date future
                                />
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-12 mb-3">
                                <label htmlFor="photo" className="form-label">Photo (optionnel)</label>
                                <input
                                    type="file"
                                    className="form-control rounded-pill"
                                    id="photo"
                                    name="photo"
                                    onChange={handleInputChange}
                                    accept="image/*"
                                />
                                <small className="text-muted">
                                    Formats acceptés: JPEG, PNG, GIF - Taille max: 5MB
                                </small>
                            </div>
                        </div>

                        {/* ✅ AMÉLIORATION : Boutons d'action améliorés */}
                        <div className="text-center mt-4">
                            <div className="d-flex gap-3 justify-content-center">
                                <Button
                                    type="button"
                                    variant="outline-secondary"
                                    size="lg"
                                    className="rounded-pill px-4"
                                    onClick={handleReset}
                                    disabled={loading}
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="rounded-pill px-5 shadow-lg"
                                    style={{
                                        background: 'linear-gradient(to right, #ff8c00, #ff4500)',
                                        border: 'none'
                                    }}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Spinner size="sm" className="me-2" />
                                            Création en cours...
                                        </>
                                    ) : (
                                        <>
                                            <FaUserPlus className="me-2" />
                                            Créer Cadre
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>

                    {message && (
                        <Alert
                            variant={isSuccess ? 'success' : 'danger'}
                            className="mt-4 text-center"
                            dismissible
                            onClose={() => setMessage('')}
                        >
                            {message}
                        </Alert>
                    )}
                </Card.Body>
            </Card>
        </div>
    );
}

export default CreateCadrePage;