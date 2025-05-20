// models/historiquepersonnesjournalierescadres.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class HistoriquePersonnesJournalieresCadres extends Model {
        static associate(models) {
            this.belongsTo(models.Cadre, { // Assurez-vous que le modèle Cadre est importé et associé dans models/index.js
                foreignKey: 'cadre_id',
                as: 'Cadre'
            });
        }
    }

    HistoriquePersonnesJournalieresCadres.init({
        date_snapshot: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        cadre_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'cadres',
                key: 'id'
            }
        },
        statut_snapshot: {
            type: DataTypes.ENUM('Présent', 'Indisponible', 'Absent', 'Sur Le Rang'), // Ajouté 'Sur Le Rang' si ce statut peut être capturé
            allowNull: false
        },
        motif_snapshot: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        sequelize,
        modelName: 'HistoriquePersonnesJournalieresCadres',
        tableName: 'historique_personnes_journalieres_cadres',
        timestamps: true,
        underscored: true,
        indexes: [
            {
                unique: true,
                fields: ['date_snapshot', 'cadre_id']
            }
        ]
    });

    return HistoriquePersonnesJournalieresCadres;
};