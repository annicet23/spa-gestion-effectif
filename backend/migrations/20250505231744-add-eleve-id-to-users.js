    // Le nom de ce fichier sera quelque chose comme 'YYYYMMDDHHMMSS-add-eleve-id-to-users.js'

    'use strict';

    module.exports = {
      up: async (queryInterface, Sequelize) => {
        // Ajouter la colonne 'eleve_id' à la table 'users'
        await queryInterface.addColumn('users', 'eleve_id', {
          type: Sequelize.INTEGER, // Le type doit correspondre à l'ID de la table 'eleves'
          allowNull: true, // Permettre que ce champ soit NULL (un utilisateur n'est pas forcément un élève)

          // --- Si vous avez une table des élèves et un modèle Eleve ---
          // Décommentez la section 'references' ci-dessous pour ajouter une contrainte de clé étrangère
          // Cela garantit que la valeur dans eleve_id existe dans la table 'eleves'
          // references: {
          //   model: 'eleves', // Nom EXACT de la table des élèves dans votre base de données
          //   key: 'id', // La colonne dans la table des élèves à laquelle cette FK fait référence
          // },
          // onDelete: 'SET NULL', // Qu'arrive-t-il si l'élève référencé est supprimé ? (Ex: met eleve_id à NULL)
          // onUpdate: 'CASCADE' // Met à jour eleve_id si l'ID de l'élève change (rare)
          // --- Fin de la section 'references' ---
        });

        // Si vous avez déjà une colonne cadre_id dans la table users, assurez-vous qu'elle est correcte
        // Si vous n'avez pas encore ajouté cadre_id, vous pourriez l'ajouter ici aussi dans la même migration
        // const tableDefinition = await queryInterface.describeTable('users');
        // if (!tableDefinition.cadre_id) {
        //     await queryInterface.addColumn('users', 'cadre_id', {
        //         type: Sequelize.INTEGER,
        //         allowNull: true,
        //         references: { model: 'cadres', key: 'id' },
        //         onDelete: 'SET NULL',
        //         onUpdate: 'CASCADE'
        //     });
        // }

      },

      down: async (queryInterface, Sequelize) => {
        // Supprimer la colonne 'eleve_id' si on annule la migration
        await queryInterface.removeColumn('users', 'eleve_id');

        // Si vous avez ajouté cadre_id dans cette migration, supprimez-la ici aussi
        // const tableDefinition = await queryInterface.describeTable('users');
        // if (tableDefinition.cadre_id) {
        //     await queryInterface.removeColumn('users', 'cadre_id');
        // }
      }
    };
    