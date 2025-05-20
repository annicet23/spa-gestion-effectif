// migrations/YYYYMMDDHHMMSS-create-cadres-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Logique pour créer la table 'cadres'
    await queryInterface.createTable('cadres', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      matricule: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      grade: {
        type: Sequelize.STRING,
        allowNull: false
      },
      nom: {
        type: Sequelize.STRING,
        allowNull: false
      },
      prenom: {
        type: Sequelize.STRING,
        allowNull: false
      },
      service: {
        type: Sequelize.STRING,
        allowNull: false
      },
      numero_telephone: {
        type: Sequelize.STRING,
        allowNull: true
      },
      // --- STATUT EST STRING DANS CETTE PREMIERE MIGRATION ---
      statut: {
        type: Sequelize.STRING, // Initialement un STRING
        allowNull: false,
        defaultValue: 'Actif' // Votre valeur par défaut initiale
      },
      // --- FIN STATUT STRING ---
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
    // Logique pour supprimer la table 'cadres' (pour annuler)
    await queryInterface.dropTable('cadres');
  }
};