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
    // Champ Matricule
    matricule: {
      type: DataTypes.STRING,
      allowNull: true, // <--- MODIFIÉ : Permet les valeurs NULL
      unique: true,     // Conserve la contrainte UNIQUE (gère les NULLs selon la version de MySQL)
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
    // Champ Numéro de Téléphone
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
    },timestamp_derniere_maj_statut: { // Nom de la colonne dans la DB
      type: DataTypes.DATE, // Ou DataTypes.DATEONLY si vous ne voulez que la date
      allowNull: true,
    },

    // <--- NOUVEAU CHAMP POUR LA PHOTO --->
    photo_url: {
      type: DataTypes.STRING, // Type pour stocker le chemin ou l'URL du fichier
      allowNull: true, // <--- Permet les valeurs NULL (la photo est facultative)
      // Vous pouvez ajouter un 'field' ici si le nom de la colonne en DB est différent de 'photo_url'
      // field: 'nom_colonne_photo_en_db',
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
