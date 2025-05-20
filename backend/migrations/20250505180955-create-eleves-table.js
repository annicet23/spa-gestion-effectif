// migrations/YYYYMMDDHHMMSS-create-eleves-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Logique pour créer la table 'eleves'
    await queryInterface.createTable('eleves', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      matricule: {
        type: Sequelize.STRING, // Ou Sequelize.INTEGER
        allowNull: true // Correspond au modèle mis à jour
      },
      incorporation: {
        type: Sequelize.STRING, // Ou Sequelize.INTEGER
        allowNull: false, // Correspond au modèle mis à jour
        unique: true // Correspond au modèle mis à jour
      },
      nom: {
        type: Sequelize.STRING,
        allowNull: false
      },
      prenom: {
        type: Sequelize.STRING,
        allowNull: false
      },
      escadron: {
        type: Sequelize.STRING,
        allowNull: false
      },
      peloton: {
        type: Sequelize.STRING,
        allowNull: false
      },
      statut: {
        type: Sequelize.ENUM('Présent', 'Absent', 'Indisponible'),
        allowNull: false,
        defaultValue: 'Présent'
      },
      motif: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
      // Ajoutez d'autres colonnes ici si nécessaire
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Logique pour supprimer la table 'eleves' (pour annuler)
    await queryInterface.dropTable('eleves');
  }
};