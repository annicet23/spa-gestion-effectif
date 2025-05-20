// migrations/YYYYMMDDHHMMSS-add-cadre-id-to-users-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Logique pour ajouter la colonne cadre_id à la table users
    await queryInterface.addColumn('users', 'cadre_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Permettre que ce soit nul si l'utilisateur n'est pas un cadre lié
      references: {
        model: 'cadres', // Référence la table 'cadres'
        key: 'id'      // Référence la colonne 'id' dans la table 'cadres'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

     // Optionnel: Si vous voulez aussi que la relation soit unique du côté cadre (un cadre n'a qu'UN SEUL compte utilisateur)
     // await queryInterface.addConstraint('users', {
     //   fields: ['cadre_id'],
     //   type: 'unique',
     //   name: 'unique_cadre_user' // Nommez la contrainte
     // });
  },

  down: async (queryInterface, Sequelize) => {
    // Logique pour supprimer la colonne cadre_id de la table users
    // Optionnel: Supprimer la contrainte unique d'abord si vous l'avez ajoutée
    // await queryInterface.removeConstraint('users', 'unique_cadre_user');
    await queryInterface.removeColumn('users', 'cadre_id');
  }
};