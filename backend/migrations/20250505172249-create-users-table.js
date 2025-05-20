// migrations/YYYYMMDDHHMMSS-create-users-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // La logique pour créer la table
    await queryInterface.createTable('users', { // Le nom de la table doit correspondre à celui dans modelName.tableName
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
      username: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      password: {
        type: Sequelize.STRING,
        allowNull: false
      },
      role: {
        type: Sequelize.ENUM('Admin', 'Standard'),
        allowNull: false,
        defaultValue: 'Standard'
      },
       status: {
        type: Sequelize.ENUM('Active', 'Inactive'),
        allowNull: false,
        defaultValue: 'Active'
      },
      nom: {
         type: Sequelize.STRING,
         allowNull: false
      },
      prenom: {
         type: Sequelize.STRING,
         allowNull: false
      },
      grade: {
         type: Sequelize.STRING,
         allowNull: true // Correspondant au modèle
      },
      service: {
         type: Sequelize.STRING,
         allowNull: true // Correspondant au modèle
      },
      created_at: { // Colonnes gérées par timestamps: true et underscored: true
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: { // Colonnes gérées par timestamps: true et underscored: true
        type: Sequelize.DATE,
        allowNull: false
      }
      // Ajoutez d'autres colonnes ici si nécessaire
    });
  },

  down: async (queryInterface, Sequelize) => {
    // La logique pour supprimer la table (pour annuler la migration)
    await queryInterface.dropTable('users');
  }
};