'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Logique pour appliquer la migration (supprimer les colonnes 'statut' et 'motif')
    await queryInterface.removeColumn('cadres', 'statut');
    await queryInterface.removeColumn('cadres', 'motif');
    // TODO: Si la colonne 'statut' utilisait un type ENUM qui n'est plus utilisé ailleurs,
    // vous pourriez avoir besoin de nettoyer ce type ENUM.
  },

  async down (queryInterface, Sequelize) {
    // Logique pour annuler la migration (ajouter de nouveau les colonnes 'statut' et 'motif')
    // Note : Vous devrez définir le type et les contraintes exactes de ces colonnes
    // telles qu'elles étaient avant la suppression.
    await queryInterface.addColumn('cadres', 'statut', {
      type: Sequelize.STRING, // Remplacez par le type correct (VARCHAR(255) selon votre DESCRIBE)
      allowNull: false, // Remplacez par la contrainte correcte (NO NULL selon votre DESCRIBE)
      defaultValue: 'Actif', // Remplacez par la valeur par défaut correcte si elle existait
    });
    await queryInterface.addColumn('cadres', 'motif', {
      type: Sequelize.TEXT, // Remplacez par le type correct (TEXT selon votre DESCRIBE)
      allowNull: true, // Remplacez par la contrainte correcte (YES NULL selon votre DESCRIBE)
    });
  }
};
