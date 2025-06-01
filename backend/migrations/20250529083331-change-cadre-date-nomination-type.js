'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('Cadres', 'date_nomination', {
      type: Sequelize.DATEONLY, // Change to DATEONLY for 'date' type in MySQL
      allowNull: true // Conserver allowNull comme défini dans votre modèle
    });
  },

  down: async (queryInterface, Sequelize) => {
    // En cas de rollback, revenir au type datetime si nécessaire
    await queryInterface.changeColumn('Cadres', 'date_nomination', {
      type: Sequelize.DATE, // Revenir au type DATE (qui correspond à datetime en MySQL)
      allowNull: true
    });
  }
};