'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Étape 1: Mettre à jour toutes les valeurs NULL existantes avec la valeur par défaut
    await queryInterface.sequelize.query(
      `UPDATE Cadres SET droit_annuel_perm = 30 WHERE droit_annuel_perm IS NULL;`
    );

    // Étape 2: Modifier la colonne pour la rendre NOT NULL avec la valeur par défaut
    await queryInterface.changeColumn('Cadres', 'droit_annuel_perm', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 30
    });
  },

  down: async (queryInterface, Sequelize) => {
    // En cas de rollback, revenir à l'état où la colonne était NULLable
    await queryInterface.changeColumn('Cadres', 'droit_annuel_perm', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null
    });
  }
};