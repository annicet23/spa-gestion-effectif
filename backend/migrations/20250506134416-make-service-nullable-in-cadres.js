'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Logique pour appliquer la migration (rendre la colonne 'service' nullable)
    await queryInterface.changeColumn('cadres', 'service', {
      type: Sequelize.STRING, // Utilisez le même type que la colonne actuelle (VARCHAR(255) selon votre DESCRIBE)
      allowNull: true, // Change la contrainte de NOT NULL à NULL
    });
     // TODO: Si vous avez d'autres colonnes que vous voulez rendre nullable (comme 'cours' si il était NOT NULL par erreur),
     // vous pouvez ajouter d'autres appels à changeColumn ici.
     // Exemple pour 'responsible_escadron_id' (votre champ 'cours'):
     // await queryInterface.changeColumn('cadres', 'responsible_escadron_id', {
     //   type: Sequelize.INTEGER, // ou UUID
     //   allowNull: true,
     // });
  },

  async down (queryInterface, Sequelize) {
    // Logique pour annuler la migration (rendre la colonne 'service' à nouveau NOT NULL)
    // Note : Si la colonne contient des valeurs NULL, cette opération échouera.
    await queryInterface.changeColumn('cadres', 'service', {
      type: Sequelize.STRING, // Utilisez le même type
      allowNull: false, // Change la contrainte de NULL à NOT NULL
      // TODO: Si la colonne avait une valeur par défaut, ajoutez defaultValue ici
      // defaultValue: 'ValeurParDefaut',
    });
     // TODO: Annuler le changement pour 'responsible_escadron_id' si vous l'avez rendu nullable dans up
     // await queryInterface.changeColumn('cadres', 'responsible_escadron_id', {
     //   type: Sequelize.INTEGER, // ou UUID
     //   allowNull: false, // ou true si elle était déjà nullable
     // });
  }
};
