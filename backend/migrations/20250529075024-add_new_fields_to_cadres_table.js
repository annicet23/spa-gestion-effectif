'use strict';

module.exports = {
  async up (queryInterface, Sequelize) {
    // Ajouter le champ telephones_contacts
    await queryInterface.addColumn('cadres', 'telephones_contacts', {
      type: Sequelize.JSON, // IMPORTANT: Utilisez Sequelize.JSON ou Sequelize.TEXT selon votre version de MySQL
      allowNull: true,
      defaultValue: '[]', // Note: Le defaultValue doit être une chaîne JSON pour la migration
    });

    // Ajouter les champs personnels supplémentaires
    await queryInterface.addColumn('cadres', 'date_naissance', {
      type: Sequelize.DATEONLY, // Assurez-vous que c'est DATEONLY pour les dates sans heure
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
      type: Sequelize.DATEONLY, // Assurez-vous que c'est DATEONLY
      allowNull: true,
    });
    await queryInterface.addColumn('cadres', 'situation_familiale', {
      type: Sequelize.ENUM('Célibataire', 'Marié', 'Divorcé', 'Veuf'), // Mettez à jour l'ENUM si vous avez ajouté 'Veuf'
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
      unique: true, // Ajoutez unique si vous voulez cette contrainte en DB
    });

  },

  async down (queryInterface, Sequelize) {
    // Supprimer les colonnes en cas de rollback
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