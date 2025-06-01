'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Renommer la colonne responsibility_scope en entite
    await queryInterface.renameColumn('Cadres', 'responsibility_scope', 'entite');

    // S'assurer que le type et les contraintes sont corrects après le renommage
    // (Cela suppose que le type et les valeurs par défaut sont déjà corrects suite à d'autres migrations ou ont été définis au moment de la création de la table)
    // Si vous voulez être explicite et sûr:
    await queryInterface.changeColumn('Cadres', 'entite', {
      type: Sequelize.ENUM('Service', 'Escadron', 'None'),
      allowNull: false,
      defaultValue: 'None' // S'assurer que la valeur par défaut est bien 'None'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revenir en arrière: renommer entite en responsibility_scope
    await queryInterface.renameColumn('Cadres', 'entite', 'responsibility_scope');

    // Si nécessaire, revenir aux contraintes d'origine
    await queryInterface.changeColumn('Cadres', 'responsibility_scope', {
      type: Sequelize.ENUM('Service', 'Escadron', 'None'),
      allowNull: true, // Ou ce qu'elle était avant la migration
      defaultValue: null
    });
  }
};