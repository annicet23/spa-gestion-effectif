'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Logique pour appliquer la migration (ajouter, supprimer, modifier des colonnes)

    // 1. Ajouter la colonne 'sexe'
    await queryInterface.addColumn('cadres', 'sexe', {
      type: Sequelize.ENUM('Masculin', 'Féminin', 'Autre'), // Utilisez le même type que dans votre modèle
      allowNull: false, // Mettez false si le sexe est obligatoire, true sinon
      // Si vous voulez une valeur par défaut, ajoutez defaultValue: 'Masculin' (ou autre)
    });

    // 2. Supprimer les colonnes 'statut' et 'motif'
    // NOTE : Ces opérations supprimeront définitivement les données dans ces colonnes.
    await queryInterface.removeColumn('cadres', 'statut');
    await queryInterface.removeColumn('cadres', 'motif');

    // 3. Rendre la colonne 'service' nullable
    await queryInterface.changeColumn('cadres', 'service', {
      type: Sequelize.STRING, // Utilisez le même type que la colonne actuelle (VARCHAR(255) selon votre DESCRIBE)
      allowNull: true, // Change la contrainte de NOT NULL à NULL
    });

    // 4. Rendre la colonne 'responsible_escadron_id' (votre champ 'cours') nullable
    // Assurez-vous que le type correspond au type de la colonne dans votre DB (INT selon votre DESCRIBE)
     await queryInterface.changeColumn('cadres', 'responsible_escadron_id', {
       type: Sequelize.INTEGER, // Utilisez le même type que la colonne actuelle (INT selon votre DESCRIBE)
       allowNull: true, // Change la contrainte de NOT NULL à NULL (si elle était NOT NULL)
     });

     // TODO: Si vous avez renommé 'responsibility_scope' en 'entite' dans une migration précédente qui n'a pas marché,
     // et que la colonne s'appelle toujours 'responsibility_scope' dans la DB, vous n'avez pas besoin de la renommer ici
     // car on utilise déjà l'option 'field' dans le modèle. Si vous voulez vraiment la renommer, ce serait une autre opération ici.
     // Exemple (NE FAITES CECI QUE SI VOUS VOULEZ RENOMMER LA COLONNE DANS LA DB) :
     // await queryInterface.renameColumn('cadres', 'responsibility_scope', 'entite');


  },

  async down (queryInterface, Sequelize) {
    // Logique pour annuler la migration (inverser les changements)

    // 1. Supprimer la colonne 'sexe'
    await queryInterface.removeColumn('cadres', 'sexe');

    // 2. Ajouter de nouveau les colonnes 'statut' et 'motif'
    // Note : Vous devrez définir le type et les contraintes exactes de ces colonnes
    // telles qu'elles étaient avant la suppression (selon votre DESCRIBE).
    await queryInterface.addColumn('cadres', 'statut', {
      type: Sequelize.STRING, // Remplacez par le type correct (VARCHAR(255) selon votre DESCRIBE)
      allowNull: false, // Remplacez par la contrainte correcte (NO NULL selon votre DESCRIBE)
      defaultValue: 'Actif', // Remplacez par la valeur par défaut correcte si elle existait
    });
    await queryInterface.addColumn('cadres', 'motif', {
      type: Sequelize.TEXT, // Remplacez par le type correct (TEXT selon votre DESCRIBE)
      allowNull: true, // Remplacez par la contrainte correcte (YES NULL selon votre DESCRIBE)
    });

    // 3. Rendre la colonne 'service' à nouveau NOT NULL
    // Note : Cette opération échouera si la colonne contient des valeurs NULL.
    await queryInterface.changeColumn('cadres', 'service', {
      type: Sequelize.STRING, // Utilisez le même type
      allowNull: false, // Change la contrainte de NULL à NOT NULL
      // TODO: Si la colonne avait une valeur par défaut, ajoutez defaultValue ici
      // defaultValue: 'ValeurParDefaut',
    });

     // 4. Rendre la colonne 'responsible_escadron_id' à nouveau NOT NULL (si elle l'était)
     // Note : Cette opération échouera si la colonne contient des valeurs NULL.
     // await queryInterface.changeColumn('cadres', 'responsible_escadron_id', {
     //   type: Sequelize.INTEGER, // ou UUID
     //   allowNull: false, // ou true si elle était déjà nullable
     // });

     // TODO: Si vous avez renommé 'responsibility_scope' en 'entite' dans up, annulez le renommage ici
     // await queryInterface.renameColumn('cadres', 'entite', 'responsibility_scope');
  }
};
