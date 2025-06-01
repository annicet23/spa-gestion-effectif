'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Cadres', 'numero_telephone');
  },

  down: async (queryInterface, Sequelize) => {
    // Pour le rollback, recréez la colonne (attention, les données seront perdues)
    await queryInterface.addColumn('Cadres', 'numero_telephone', {
      type: Sequelize.STRING,
      allowNull: true
    });
  }
};