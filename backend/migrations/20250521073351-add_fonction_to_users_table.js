'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'fonction', {
      type: Sequelize.STRING, // Ou Sequelize.TEXT si la fonction peut être longue
      allowNull: true, // Ou false si c'est obligatoire
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'fonction');
  }
};