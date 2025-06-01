'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Étape 1: Gérer la colonne 'responsibility_scope' si elle existe et n'est plus utilisée
    // Si 'entite' est la colonne canonique, nous allons la renommer/supprimer 'responsibility_scope'
    // et nous assurer que 'entite' a un DEFAULT valide.
    // Vérifiez si 'responsibility_scope' existe
    const columns = await queryInterface.describeColumns('Cadres');

    if (columns.responsibility_scope) {
      console.log("Column 'responsibility_scope' found. Attempting to migrate/remove.");
      // Option A: Si 'entite' n'existe pas encore, renommer 'responsibility_scope' en 'entite'
      // et mettre à jour le type et la valeur par défaut.
      if (!columns.entite) {
        console.log("Renaming 'responsibility_scope' to 'entite' and updating type.");
        await queryInterface.renameColumn('Cadres', 'responsibility_scope', 'entite');
        await queryInterface.changeColumn('Cadres', 'entite', {
          type: Sequelize.ENUM('Service', 'Escadron', 'None'),
          allowNull: false,
          defaultValue: 'None' // Définir une valeur par défaut valide
        });
      } else {
        // Option B: Si 'entite' existe déjà, cela signifie que 'responsibility_scope' est un reliquat.
        // Copier les données si nécessaire (ici, on suppose que 'entite' est déjà peuplée correctement)
        // puis supprimer 'responsibility_scope'.
        console.log("Column 'entite' already exists. Removing redundant 'responsibility_scope'.");
        await queryInterface.removeColumn('Cadres', 'responsibility_scope');
      }
    }

    // Étape 2: Assurer que 'entite' a une valeur par défaut valide et n'est pas NULL
    if (columns.entite && columns.entite.defaultValue === null && !columns.entite.allowNull) {
        console.log("Setting default value for 'entite' and updating existing NULLs.");
        // Mettre à jour les lignes existantes où 'entite' est NULL (si possible)
        await queryInterface.sequelize.query(
            `UPDATE Cadres SET entite = 'None' WHERE entite IS NULL;`
        );
        // Modifier la colonne pour ajouter la valeur par défaut
        await queryInterface.changeColumn('Cadres', 'entite', {
            type: Sequelize.ENUM('Service', 'Escadron', 'None'),
            allowNull: false,
            defaultValue: 'None' // Définir une valeur par défaut valide
        });
    }


    // Étape 3: Gérer 'createdAt' et 'updatedAt'
    // D'après votre DESCRIBE, elles sont NOT NULL mais avec DEFAULT NULL, ce qui cause le problème.
    // Nous allons les modifier pour avoir un DEFAULT valide.

    // Mettre à jour les lignes existantes avec une valeur valide pour createdAt et updatedAt
    // C'est CRUCIAL avant de tenter de changer la colonne en NOT NULL avec un DEFAULT.
    console.log("Updating existing rows for 'createdAt' and 'updatedAt' to NOW().");
    await queryInterface.sequelize.query(
      `UPDATE Cadres SET createdAt = NOW() WHERE createdAt IS NULL OR createdAt = '0000-00-00 00:00:00';`
    );
    await queryInterface.sequelize.query(
      `UPDATE Cadres SET updatedAt = NOW() WHERE updatedAt IS NULL OR updatedAt = '0000-00-00 00:00:00';`
    );

    // Modifier les colonnes pour ajouter DEFAULT CURRENT_TIMESTAMP et ON UPDATE CURRENT_TIMESTAMP
    // pour updated_at.
    console.log("Changing 'createdAt' column to set default CURRENT_TIMESTAMP.");
    await queryInterface.changeColumn('Cadres', 'createdAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW, // Sequelize.NOW se traduit en CURRENT_TIMESTAMP pour MySQL
    });

    console.log("Changing 'updatedAt' column to set default CURRENT_TIMESTAMP and ON UPDATE CURRENT_TIMESTAMP.");
    await queryInterface.changeColumn('Cadres', 'updatedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW, // Sequelize.NOW se traduit en CURRENT_TIMESTAMP pour MySQL
      onUpdate: Sequelize.NOW, // Ceci ajoute ON UPDATE CURRENT_TIMESTAMP
    });

    // Étape 4: Gérer 'date_nomination' (si elle n'a pas été ajoutée correctement avant)
    if (!columns.date_nomination) {
      console.log("Column 'date_nomination' not found, adding it.");
      await queryInterface.addColumn('Cadres', 'date_nomination', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null // Il est préférable d'expliciter null pour les colonnes nullables
      });
    } else {
        console.log("Column 'date_nomination' already exists. Ensuring it's nullable.");
        await queryInterface.changeColumn('Cadres', 'date_nomination', {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null
        });
    }

    // Étape 5: Corriger le type de 'situation_familiale' si nécessaire (ajout de 'Veuf')
    if (columns.situation_familiale && columns.situation_familiale.type.includes("enum('Célibataire','Marié','Divorcé')")) {
        console.log("Updating 'situation_familiale' enum to include 'Veuf'.");
        await queryInterface.changeColumn('Cadres', 'situation_familiale', {
            type: Sequelize.ENUM('Célibataire', 'Marié', 'Divorcé', 'Veuf'),
            allowNull: true, // Garder la nullabilité existante
            defaultValue: null // Garder la valeur par défaut existante
        });
    }

  },

  down: async (queryInterface, Sequelize) => {
    // Logique pour annuler la migration
    const columns = await queryInterface.describeColumns('Cadres');

    if (columns.date_nomination) {
      await queryInterface.removeColumn('Cadres', 'date_nomination');
    }
    // Note: Revenir à l'état précédent pour createdAt et updatedAt est complexe
    // car on ne peut pas simplement supprimer les defaults et NOT NULL si des données existent.
    // Pour un down simple, on peut juste les rendre nullable.
    if (columns.createdAt) {
      await queryInterface.changeColumn('Cadres', 'createdAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
    if (columns.updatedAt) {
      await queryInterface.changeColumn('Cadres', 'updatedAt', {
        type: Sequelize.DATE,
        allowNull: true,
        defaultValue: null
      });
    }
    // Si 'responsibility_scope' a été renommé en 'entite' dans 'up', on peut le renommer ici
    // ou si 'responsibility_scope' a été supprimé, on peut le recréer.
    // Pour simplifier le down, on peut juste supprimer 'entite' si elle a été ajoutée par cette migration
    // et recréer 'responsibility_scope' si c'était l'intention originale.
    // Cette partie dépend beaucoup de votre historique de migrations.
    // Pour l'instant, je ne recrée pas 'responsibility_scope' dans le down.
    // Si 'entite' a été créé par cette migration et n'existait pas avant, vous pourriez le supprimer.
    // Mais si c'est un renommage/changement, le down est plus complexe.
  }
};
