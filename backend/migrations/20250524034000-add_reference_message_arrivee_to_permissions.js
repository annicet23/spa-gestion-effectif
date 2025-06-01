// xxxx-add_reference_message_arrivee_to_permissions.js
'use strict';
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Permissions', 'referenceMessageArrivee', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Permissions', 'referenceMessageArrivee');
  }
};