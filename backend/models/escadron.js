// models/escadron.js
'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Escadron = sequelize.define('Escadron', {
    // L'ID sera automatiquement créé par Sequelize comme clé primaire par défaut
    // id: {
    //   type: DataTypes.INTEGER,
    //   primaryKey: true,
    //   autoIncrement: true,
    //   allowNull: false,
    // },
    nom: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Assurez-vous que le nom de l'escadron est unique si nécessaire
    },
    numero: {
      type: DataTypes.INTEGER, // Ou STRING si vos numéros peuvent être non numériques
      allowNull: false,
      unique: true, // Le numéro de l'escadron devrait être unique
    },
    description: {
      type: DataTypes.TEXT, // Ou STRING pour un texte plus court
      allowNull: true, // La description est optionnelle
    },
    // Ajoutez d'autres champs si votre table escadrons en a (ex: chef_escadron_id si c'est une FK vers Cadre)

  }, {
    sequelize, // L'instance de connexion à la base de données
    modelName: 'Escadron', // Le nom du modèle
    tableName: 'escadrons', // Le nom de la table dans la base de données
    timestamps: true, // Ajoute createdAt et updatedAt automatiquement
    underscored: true, // Utilise snake_case pour les noms de colonnes (created_at au lieu de createdAt)
  });

  // --- DÉFINITION DES RELATIONS POUR ESCADRON ---
  Escadron.associate = (models) => {
    // Un Escadron peut avoir plusieurs Élèves
    // Assurez-vous que cette relation correspond à la clé étrangère dans votre modèle Eleve (Eleve.escadron_id)
    Escadron.hasMany(models.Eleve, { foreignKey: 'escadron_id', as: 'Eleves' });

    // Un Escadron peut avoir un Cadre Responsable (si vous avez modélisé cela)
    // Si un Cadre est responsable d'UN SEUL escadron (via Cadre.responsible_escadron_id)
    // Escadron.hasOne(models.Cadre, { foreignKey: 'responsible_escadron_id', as: 'ResponsableCadre' });

    // Si un Cadre peut être responsable de PLUSIEURS escadrons (via table de liaison)
    // Escadron.belongsToMany(models.Cadre, { through: 'CadreEscadronResponsibility', as: 'ResponsableCadres', foreignKey: 'escadronId' });

  };
  // --- FIN DÉFINITION DES RELATIONS POUR ESCADRON ---

  return Escadron;
};
