// models/absence.js
'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Absence = sequelize.define('Absence', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    cadre_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'cadres', key: 'id' } },
    eleve_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'eleves', key: 'id' } },
    type: { type: DataTypes.ENUM('Maladie', 'Permission', 'Mission', 'Non justifiée', 'Autre'), allowNull: false },
    start_date: { type: DataTypes.DATE, allowNull: false },
    end_date: { type: DataTypes.DATE, allowNull: true },
    justification: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.ENUM('Soumise', 'Validée', 'Refusée'), allowNull: false, defaultValue: 'Soumise' },
    // submitted_by_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }}, // Si ajouté
    // validated_by_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' }}, // Si ajouté
  }, {
    sequelize, modelName: 'Absence', tableName: 'absences', timestamps: true, underscored: true,
    validate: {
      checkOnlyOnePersonId() {
        if ((this.cadre_id === null && this.eleve_id === null) || (this.cadre_id !== null && this.eleve_id !== null)) {
          throw new Error('Une absence doit être liée soit à un cadre, soit à un élève, mais pas aux deux.');
        }
      }
    }
  });

  // --- DÉFINITION DES RELATIONS POUR ABSENCE ---
  Absence.associate = (models) => {
    // Une Absence appartient à un Cadre
    Absence.belongsTo(models.Cadre, {
      foreignKey: 'cadre_id' // La clé étrangère dans la table Absence
    });
    // Une Absence appartient à un Eleve
    Absence.belongsTo(models.Eleve, {
      foreignKey: 'eleve_id' // L'autre clé étrangère dans la table Absence
    });
    
  };
  // --- FIN DÉFINITION DES RELATIONS POUR ABSENCE ---

  return Absence;
};