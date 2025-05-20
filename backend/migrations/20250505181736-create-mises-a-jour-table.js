// migrations/YYYYMMDDHHMMSS-create-mises-a-jour-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Logique pour créer la table 'mises_a_jour'
    await queryInterface.createTable('mises_a_jour', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      submitted_by_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      update_date: {
        type: Sequelize.DATEONLY, // Utiliser DATEONLY si seule la date compte
        allowNull: false
         // Pas de contrainte unique composite ici, gérée par l'application
      },
      status: {
        type: Sequelize.ENUM('En attente', 'Validée', 'Rejetée'), // Adaptez si besoin
        allowNull: false,
        defaultValue: 'En attente'
      },
       validated_by_id: {
         type: Sequelize.INTEGER,
         allowNull: true,
         references: {
           model: 'users',
           key: 'id'
         },
         onUpdate: 'CASCADE',
         onDelete: 'SET NULL'
       },
      validation_date: {
         type: Sequelize.DATE,
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
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Logique pour supprimer la table 'mises_a_jour' (pour annuler)
    await queryInterface.dropTable('mises_a_jour');
  }
};