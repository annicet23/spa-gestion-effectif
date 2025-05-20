'use strict';

// On importe DataTypes car on en a besoin pour définir le type de colonne dans la fonction down()
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Logique pour appliquer la migration : supprimer la colonne numero_telephone
     */
    await queryInterface.removeColumn(
      'eleves', // Nom de la table
      'numero_telephone' // Nom de la colonne à supprimer
    );
  },

  async down (queryInterface, Sequelize) {
    /**
     * Logique pour annuler la migration : rajouter la colonne numero_telephone
     * (Les options doivent correspondre à celles définies dans votre modèle initial)
     */
     await queryInterface.addColumn(
       'eleves', // Nom de la table
       'numero_telephone', // Nom de la colonne à rajouter
       {
         type: DataTypes.STRING, // Type de données comme défini dans le modèle
         allowNull: true,       // Correspond à allowNull dans le modèle
         // Vous pourriez ajouter d'autres options comme defaultValue, etc. si elles existaient
       }
     );
  }
};