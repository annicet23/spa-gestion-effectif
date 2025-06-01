'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('cadres', 'photo_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'telephones_contacts', {
      type: Sequelize.JSON, // OU Sequelize.TEXT si votre DB ne supporte pas JSON
      allowNull: true,
      defaultValue: '[]', // Note: Pour JSON/TEXT, la valeur par défaut doit être une chaîne JSON
    });
    // Ajoutez les autres champs personnels si vous ne les aviez pas déjà en DB
    await queryInterface.addColumn('cadres', 'date_naissance', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'lieu_naissance', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'cfeg', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'date_sejour_egna', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'situation_familiale', {
      type: Sequelize.ENUM('Célibataire', 'Marié', 'Divorcé', 'Veuf'), // Assurez-vous que l'ENUM correspond
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'nombre_enfants', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 0,
    });
    await queryInterface.addColumn('cadres', 'email', {
      type: Sequelize.STRING,
      allowNull: true,
      unique: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('cadres', 'photo_url');
    await queryInterface.removeColumn('cadres', 'telephones_contacts');
    await queryInterface.removeColumn('cadres', 'date_naissance');
    await queryInterface.removeColumn('cadres', 'lieu_naissance');
    await queryInterface.removeColumn('cadres', 'cfeg');
    await queryInterface.removeColumn('cadres', 'date_sejour_egna');
    await queryInterface.removeColumn('cadres', 'situation_familiale');
    await queryInterface.removeColumn('cadres', 'nombre_enfants');
    await queryInterface.removeColumn('cadres', 'email');
  }
};