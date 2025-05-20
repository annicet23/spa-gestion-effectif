'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Logique pour appliquer la migration (ajouter la colonne 'sexe')
    await queryInterface.addColumn('cadres', 'sexe', {
      type: Sequelize.ENUM('Masculin', 'Féminin', 'Autre'), // Utilisez le même type que dans votre modèle
      allowNull: false, // Mettez false si le sexe est obligatoire, true sinon
      // Si vous voulez une valeur par défaut, ajoutez defaultValue: 'Masculin' (ou autre)
    });
  },

  async down (queryInterface, Sequelize) {
    // Logique pour annuler la migration (supprimer la colonne 'sexe')
    await queryInterface.removeColumn('cadres', 'sexe');
    // TODO: Si vous utilisez ENUM, vous pourriez avoir besoin de nettoyer les types ENUM si cette colonne était la seule à l'utiliser.
    // C'est une opération plus complexe et dépendante de la base de données.
  }
};
