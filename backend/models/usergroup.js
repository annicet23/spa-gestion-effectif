const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserGroup = sequelize.define('UserGroup', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.INTEGER,
            references: {
                model: 'Users',
                key: 'id',
            }
        },
        groupId: {
            type: DataTypes.INTEGER,
            references: {
                model: 'Groups',
                key: 'id',
            }
        }
    }, {
        timestamps: false, // Pas de timestamps pour la table de liaison
        tableName: 'user_groups'
    });

    return UserGroup;
};