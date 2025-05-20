// models/historiquestatsjournalierescadres.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class HistoriqueStatsJournalieresCadres extends Model {
        static associate(models) {
            // Associations si nécessaire
        }
    }

    HistoriqueStatsJournalieresCadres.init({
        date_snapshot: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            unique: true // Important: une seule entrée de stats par date historique
        },
        total_cadres: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        absents_cadres: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        presents_cadres: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        indisponibles_cadres: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        sur_le_rang_cadres: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        sequelize,
        modelName: 'HistoriqueStatsJournalieresCadres',
        tableName: 'historique_stats_journalieres_cadres',
        timestamps: true,
        underscored: true,
    });

    return HistoriqueStatsJournalieresCadres;
};