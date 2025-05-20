// models/user.js
'use strict';

const { DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    matricule: { type: DataTypes.STRING, allowNull: false, unique: true }, // Le matricule est toujours l'ID de l'utilisateur dans ce cas (si l'utilisateur est un Cadre)
    username: { type: DataTypes.STRING, allowNull: false, unique: true },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('Admin', 'Standard'), allowNull: false, defaultValue: 'Standard' },
    status: { type: DataTypes.ENUM('Active', 'Inactive'), allowNull: false, defaultValue: 'Active' },
    nom: { type: DataTypes.STRING, allowNull: false },
    prenom: { type: DataTypes.STRING, allowNull: false },
    grade: { type: DataTypes.STRING, allowNull: true },
    service: { type: DataTypes.STRING, allowNull: true },
    // --- NOUVEAU CHAMP cadre_id ICI ---
    cadre_id: {
      type: DataTypes.INTEGER,
      allowNull: true, // Peut être nul si l'utilisateur est un Admin non lié à un cadre spécifique
      references: { // Clé étrangère vers la table 'cadres'
        model: 'cadres',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL' // Si le cadre est supprimé, le lien dans l'utilisateur devient NULL
      // Vous pourriez ajouter unique: true ici si un cadre ne peut avoir qu'un seul compte utilisateur,
      // ce qui est probablement le cas.
    },
    // --- FIN NOUVEAU CHAMP ---
  }, {
    sequelize, modelName: 'User', tableName: 'users', timestamps: true, underscored: true,
    hooks: {
      beforeSave: async (user, options) => {
        if (user.changed('password') || user.isNewRecord) {
          const salt = await bcrypt.genSalt(SALT_ROUNDS);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  // --- DÉFINITION DES RELATIONS POUR USER (MISE À JOUR) ---
  User.associate = (models) => {
    // Un User peut soumettre plusieurs MisesAJour
    User.hasMany(models.MiseAJour, { as: 'SubmittedUpdates', foreignKey: 'submitted_by_id' });
    // Un User peut valider plusieurs MisesAJour
    User.hasMany(models.MiseAJour, { as: 'ValidatedUpdates', foreignKey: 'validated_by_id' });

    // --- NOUVELLE RELATION VERS CADRE ---
    // Un User peut appartenir à un Cadre (relation 1:1 ou 1:0/1)
    User.belongsTo(models.Cadre, {
      foreignKey: 'cadre_id', // La clé étrangère dans la table User
      as: 'Cadre' // Alias pour accéder au Cadre depuis l'objet User
    });
    // --- FIN NOUVELLE RELATION ---
  };
  // --- FIN DÉFINITION DES RELATIONS POUR USER ---

  User.prototype.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
  };

  return User;
};