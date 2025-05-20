'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MiseAJour = sequelize.define('MiseAJour', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    submitted_by_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    update_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('En attente', 'Validée', 'Rejetée'),
      defaultValue: 'En attente'
    },
    submission_count: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    validated_by_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    validation_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cadre_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'cadres',
        key: 'id'
      }
    }
  }, {
    tableName: 'mises_a_jour',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  });

  MiseAJour.associate = (models) => {
    MiseAJour.belongsTo(models.User, {
      as: 'SubmittedBy',
      foreignKey: 'submitted_by_id'
    });
    MiseAJour.belongsTo(models.User, {
      as: 'ValidatedBy',
      foreignKey: 'validated_by_id'
    });
    MiseAJour.belongsTo(models.Cadre, {
      as: 'Cadre',
      foreignKey: 'cadre_id'
    });
  };

  return MiseAJour;
};