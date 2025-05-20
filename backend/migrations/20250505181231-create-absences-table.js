// migrations/YYYYMMDDHHMMSS-create-absences-table.js
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Logique pour créer la table 'absences'
    await queryInterface.createTable('absences', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      cadre_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { // Définit la clé étrangère
          model: 'cadres', // Référence la table 'cadres'
          key: 'id'      // Référence la colonne 'id' dans la table 'cadres'
        },
        onUpdate: 'CASCADE', // Options pour l'intégrité référentielle
        onDelete: 'SET NULL' // Si un cadre est supprimé, les absences liées ont cadre_id mis à NULL
      },
      eleve_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { // Définit la clé étrangère
          model: 'eleves', // Référence la table 'eleves'
          key: 'id'      // Référence la colonne 'id' dans la table 'eleves'
        },
         onUpdate: 'CASCADE', // Options pour l'intégrité référentielle
        onDelete: 'SET NULL' // Si un élève est supprimé, les absences liées ont eleve_id mis à NULL
      },
      type: {
        type: Sequelize.ENUM('Maladie', 'Permission', 'Mission', 'Non justifiée', 'Autre'), // Adaptez si besoin
        allowNull: false
      },
      start_date: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true
      },
      justification: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('Soumise', 'Validée', 'Refusée'), // Adaptez si besoin
        allowNull: false,
        defaultValue: 'Soumise'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false
      }
       // Si vous avez ajouté submitted_by_id/validated_by_id au modèle:
       // submitted_by_id: {
       //   type: Sequelize.INTEGER,
       //   allowNull: true,
       //   references: { model: 'users', key: 'id' },
       //   onUpdate: 'CASCADE',
       //   onDelete: 'SET NULL'
       // },
       // validated_by_id: {
       //    type: Sequelize.INTEGER,
       //    allowNull: true,
       //    references: { model: 'users', key: 'id' },
       //    onUpdate: 'CASCADE',
       //    onDelete: 'SET NULL'
       // },
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Logique pour supprimer la table 'absences' (pour annuler)
    await queryInterface.dropTable('absences');
  }
};