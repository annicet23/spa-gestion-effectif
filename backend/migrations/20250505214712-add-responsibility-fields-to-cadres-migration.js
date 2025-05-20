// Le nom de ce fichier sera quelque chose comme 'YYYYMMDDHHMMSS-add-responsibility-fields-to-cadres-migration.js'

'use strict';

module.exports = {
  // La fonction 'up' est exécutée lorsque vous appliquez la migration
  up: async (queryInterface, Sequelize) => {
    // Ajouter la colonne 'fonction'
    // Utilisez queryInterface.addColumn avec le nom de la table ('cadres')
    // et la définition de la colonne (nom, type, options)
    await queryInterface.addColumn('cadres', 'fonction', {
      type: Sequelize.STRING, // Type de données Chaîne de caractères
      allowNull: true, // La colonne peut contenir des valeurs NULL
    });

    // Ajouter la colonne 'responsibility_scope' (type ENUM)
    await queryInterface.addColumn('cadres', 'responsibility_scope', {
       type: Sequelize.ENUM('Service', 'Escadron', 'None'), // Les valeurs permises pour cette colonne
       allowNull: false, // La colonne ne peut pas être nulle
       defaultValue: 'None', // Valeur par défaut si non spécifié lors d'une insertion
    });

    // Ajouter la colonne 'responsible_escadron_id' (type Integer)
    await queryInterface.addColumn('cadres', 'responsible_escadron_id', {
      type: Sequelize.INTEGER, // Type de données Nombre entier
      allowNull: true, // Peut être nul si la responsabilité n'est pas d'Escadron

       // --- Si vous avez une table des escadrons et un modèle Escadron ---
       // Décommentez la section 'references' ci-dessous pour ajouter une contrainte de clé étrangère
       // Cela garantit que la valeur dans responsible_escadron_id existe dans la table 'escadrons'
      // references: {
      //   model: 'escadrons', // Nom EXACT de la table des escadrons dans votre base de données (souvent le nom au pluriel du modèle)
      //   key: 'id', // La colonne dans la table des escadrons à laquelle cette FK fait référence
      // },
      // onDelete: 'SET NULL', // Qu'arrive-t-il si l'escadron référencé est supprimé ? (Ex: met responsible_escadron_id à NULL)
      // --- Fin de la section 'references' ---
    });

     // TODO: Si un Cadre peut être responsable de PLUSIEURS escadrons, vous auriez besoin d'une table de liaison et d'une migration pour la créer ici.
     // queryInterface.createTable('CadreEscadronResponsibility', { /* ... */ });

  },

  // La fonction 'down' est exécutée lorsque vous annulez (rollback) la migration
  down: async (queryInterface, Sequelize) => {
    // Supprimer les colonnes ajoutées dans la fonction 'up'
    // C'est l'inverse de l'opération 'up'
    await queryInterface.removeColumn('cadres', 'fonction');
    await queryInterface.removeColumn('cadres', 'responsibility_scope');
    await queryInterface.removeColumn('cadres', 'responsible_escadron_id');

    // TODO: Si vous avez créé une table de liaison, supprimez-la ici
    // queryInterface.dropTable('CadreEscadronResponsibility');
  }
};