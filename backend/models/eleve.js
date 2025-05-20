'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Eleve = sequelize.define('Eleve', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    matricule: { type: DataTypes.STRING, allowNull: true }, // Optionnel
    incorporation: { type: DataTypes.STRING, allowNull: false, unique: true }, // Obligatoire et unique
    nom: { type: DataTypes.STRING, allowNull: false }, // Obligatoire
    prenom: { type: DataTypes.STRING, allowNull: false }, // Obligatoire
    escadron_id: { type: DataTypes.INTEGER, allowNull: false }, // Obligatoire
    peloton: { type: DataTypes.STRING, allowNull: false }, // Obligatoire
    statut: {
      type: DataTypes.ENUM('Présent', 'Absent', 'Indisponible'),
      allowNull: false,
      defaultValue: 'Présent' // Valeur par défaut
    },
    motif: { type: DataTypes.TEXT, allowNull: true }, // Optionnel
    date_debut_absence: {
      type: DataTypes.DATEONLY, // Utilisez DATEONLY si vous stockez seulement la date (YYYY-MM-DD)
      // type: DataTypes.DATE, // Utilisez DATE si vous stockez date et heure
      allowNull: true // Doit être allowNull: true comme dans la commande SQL
    },
    // numero_telephone: { type: DataTypes.STRING, allowNull: true } // <-- SUPPRIMÉ
  }, {
    sequelize,
    modelName: 'Eleve',
    tableName: 'eleves',
    timestamps: true,
    underscored: true
  });

  // !!! DÉCOMMENTEZ CE BLOC POUR DÉFINIR L'ASSOCIATION !!!
  Eleve.associate = (models) => {
    Eleve.belongsTo(models.Escadron, { foreignKey: 'escadron_id', as: 'escadron' });
    // Si vous avez d'autres associations pour Eleve (par exemple, avec les Absences), ajoutez-les ici
    Eleve.hasMany(models.Absence, { foreignKey: 'eleve_id', as: 'absences' });
  };

  return Eleve;
};
