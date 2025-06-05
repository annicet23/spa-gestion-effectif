'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Ajouter la colonne actual_updater_id
    await queryInterface.addColumn('mises_a_jour', 'actual_updater_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Ajouter la colonne actual_updater_grade
    await queryInterface.addColumn('mises_a_jour', 'actual_updater_grade', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // Ajouter la colonne is_updated_by_responsible
    await queryInterface.addColumn('mises_a_jour', 'is_updated_by_responsible', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    // Ajouter la colonne commentaire (si elle n'existe pas déjà)
    try {
      await queryInterface.addColumn('mises_a_jour', 'commentaire', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    } catch (error) {
      // La colonne existe peut-être déjà, on continue
      console.log('Colonne commentaire existe déjà ou erreur:', error.message);
    }

    // Ajouter l'index pour la clé étrangère
    await queryInterface.addIndex('mises_a_jour', ['actual_updater_id'], {
      name: 'idx_mises_a_jour_actual_updater_id'
    });

    console.log('Migration UP terminée avec succès');
  },

  async down(queryInterface, Sequelize) {
    // Supprimer l'index
    try {
      await queryInterface.removeIndex('mises_a_jour', 'idx_mises_a_jour_actual_updater_id');
    } catch (error) {
      console.log('Index déjà supprimé ou n\'existe pas:', error.message);
    }

    // Supprimer les colonnes
    await queryInterface.removeColumn('mises_a_jour', 'actual_updater_id');
    await queryInterface.removeColumn('mises_a_jour', 'actual_updater_grade');
    await queryInterface.removeColumn('mises_a_jour', 'is_updated_by_responsible');

    // Optionnel : supprimer commentaire seulement si vous êtes sûr qu'elle a été ajoutée par cette migration
    // await queryInterface.removeColumn('mises_a_jour', 'commentaire');

    console.log('Migration DOWN terminée avec succès');
  }
};