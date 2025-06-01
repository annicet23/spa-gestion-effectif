// models/permission.js
'use strict';
const {
    Model,
    DataTypes
} = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class Permission extends Model {
        static associate(models) {
            Permission.belongsTo(models.Cadre, {
                foreignKey: 'cadre_id',
                onDelete: 'CASCADE',
                onUpdate: 'CASCADE' // Ajouté pour la clarté, déjà dans init.references
            });
        }
    }
    Permission.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        cadre_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Cadres',
                key: 'id'
            },
            onUpdate: 'CASCADE', // Important pour la cohérence des clés étrangères
            onDelete: 'CASCADE'  // Important pour la cohérence des clés étrangères
        },
        droitAnneePerm: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        dateDepartPerm: {
            type: DataTypes.DATE,
            allowNull: false
        },
        dateArriveePerm: {
            type: DataTypes.DATE,
            allowNull: false
        },
        joursPrisPerm: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        referenceMessageDepart: {
            type: DataTypes.STRING,
            allowNull: true
        },
        // --- NOUVEAU CHAMP AJOUTÉ ICI ---
        referenceMessageArrivee: {
            type: DataTypes.STRING,
            allowNull: true // Peut être null tant que le cadre n'est pas revenu
        },
        // --- FIN NOUVEAU CHAMP ---
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false
        }
    }, {
        sequelize,
        modelName: 'Permission',
        tableName: 'Permissions', // Nom de la table dans la base de données
        timestamps: true, // Pour gérer createdAt et updatedAt
    });
    return Permission;
};