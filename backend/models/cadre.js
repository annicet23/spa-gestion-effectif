'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Cadre extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      // Association avec l'Escadron responsable
      Cadre.belongsTo(models.Escadron, {
        as: 'EscadronResponsable', // Alias pour l'association
        foreignKey: 'responsible_escadron_id', // Clé étrangère dans la table cadres
        targetKey: 'id', // Clé primaire dans la table escadrons
      });
      // Association avec le modèle Permission pour les permissions (si ce n'est pas déjà fait dans models/index.js)
      Cadre.hasMany(models.Permission, {
          foreignKey: 'cadre_id',
          as: 'Permissions'
      });
    }
  }

  Cadre.init({
    // Champ Grade
    grade: {
      type: DataTypes.STRING,
      allowNull: false, // Ce champ reste obligatoire
    },
    // Champ Nom
    nom: {
      type: DataTypes.STRING,
      allowNull: false, // Ce champ reste obligatoire
    },
    // Champ Prénom
    prenom: {
      type: DataTypes.STRING,
      allowNull: false, // Ce champ reste obligatoire
    },
    droit_annuel_perm: {
        type: DataTypes.INTEGER,
        allowNull: true // Correspond à la définition NULL dans la DB
    },
    // Champ Matricule
    matricule: {
      type: DataTypes.STRING,
      allowNull: true, // MODIFIÉ : Permet les valeurs NULL
      unique: true,    // Conserve la contrainte UNIQUE (gère les NULLs selon la version de MySQL)
    },
    // Champ Entité (Scope de responsabilité)
    entite: { // Mappé à responsibility_scope en DB
      type: DataTypes.ENUM('Service', 'Escadron', 'None'),
      allowNull: false, // Ce champ reste obligatoire
      field: 'responsibility_scope', // Nom de la colonne en base de données
      defaultValue: 'None', // Valeur par défaut
    },
    // Champ Service (applicable si entité est 'Service')
    service: {
      type: DataTypes.STRING,
      allowNull: true, // Peut être NULL si l'entité n'est pas 'Service'
    },
    // Champ Cours (Escadron responsable, applicable si entité est 'Escadron')
    cours: { // Mappé à responsible_escadron_id en DB
      type: DataTypes.INTEGER, // L'ID de l'escadron est un entier
      allowNull: true, // Peut être NULL si l'entité n'est pas 'Escadron'
      field: 'responsible_escadron_id', // Nom de la colonne en base de données
    },
    // Champ Sexe
    sexe: {
      type: DataTypes.ENUM('Masculin', 'Féminin', 'Autre'), // Correspond à l'ENUM en DB
      allowNull: false, // Ce champ reste obligatoire
    },
    // Champ Numéro de Téléphone principal (conservé pour compatibilité ou usage spécifique)
    numero_telephone: {
      type: DataTypes.STRING,
      allowNull: true, // Peut être NULL
    },
    // Champ Fonction
    fonction: {
      type: DataTypes.STRING,
      allowNull: true, // Peut être NULL
    },

    // Ajout des champs liés au statut d'absence (déjà présents)
    statut_absence: {
      type: DataTypes.ENUM('Présent', 'Indisponible', 'Absent'),
      allowNull: false,
      defaultValue: 'Présent',
    },
    date_debut_absence: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    motif_absence: {
      type: DataTypes.STRING, // Ou DataTypes.TEXT si le motif peut être long
      allowNull: true,
    },
    timestamp_derniere_maj_statut: { // Nom de la colonne dans la DB
      type: DataTypes.DATE, // Ou DataTypes.DATEONLY si vous ne voulez que la date
      allowNull: true,
    },

    // --- NOUVEAUX CHAMPS À AJOUTER ---

    // Date de naissance
    date_naissance: {
      type: DataTypes.DATEONLY, // Pour stocker uniquement la date (AAAA-MM-JJ)
      allowNull: true, // Selon vos besoins, peut être false si c'est obligatoire
    },
    // Date de séjour EGNA
    date_sejour_egna: {
      type: DataTypes.DATEONLY, // Pour stocker uniquement la date (AAAA-MM-JJ)
      allowNull: true,
    },
    // Statut matrimonial
    statut_matrimonial: {
      type: DataTypes.ENUM('Célibataire', 'Marié', 'Divorcé'),
      allowNull: true, // Selon vos besoins
    },
    // Nombre d'enfants
    nombre_enfants: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0, // Par défaut à 0 si non spécifié
    },
    // Email
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true, // L'email est souvent unique
      validate: {
        isEmail: true, // Validation pour le format email
      }
    },
    // Photo URL
    photo_url: {
      type: DataTypes.STRING, // Type pour stocker le chemin ou l'URL du fichier
      allowNull: true, // Permet les valeurs NULL (la photo est facultative)
    },
    // Téléphones (pour gérer l'array de numéros et leurs types WhatsApp)
    // Option 1: JSONB pour PostgreSQL, TEXT pour MySQL/SQLite
    // C'est l'option la plus flexible pour un tableau d'objets.
    telephones: {
      type: DataTypes.TEXT, // Pour MySQL/SQLite, stockera le JSON stringifié
      // type: DataTypes.JSONB, // Pour PostgreSQL, plus performant pour les JSON
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('telephones');
        return rawValue ? JSON.parse(rawValue) : [];
      },
      set(value) {
        this.setDataValue('telephones', JSON.stringify(value));
      }
    },
    // Date de Nomination (déjà présente dans la v2 du modèle que tu as envoyé, mais je la remets pour clarté)
    date_nomination: {
        type: DataTypes.DATEONLY, // Pour stocker uniquement la date
        allowNull: true, // Peut être true si c'est facultatif, ou false si toujours requis
    },


  }, {
    sequelize, // Instance de Sequelize
    modelName: 'Cadre', // Nom du modèle
    tableName: 'cadres', // Nom de la table en base de données
    timestamps: true, // Active created_at et updated_at
    underscored: true, // Utilise snake_case pour les noms de colonnes auto-générées (comme created_at -> created_at)
  });

  return Cadre;
};