// Exemple simplifié, adaptez à votre structure réelle
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Group = sequelize.define('Group', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        // Ajoutez d'autres champs si nécessaire, ex: creator_id
    }, {
        timestamps: true, // Sequelize gérera createdAt et updatedAt
        tableName: 'groups', // Nom de votre table de groupes
    });

    Group.associate = (models) => {
        // Relation Many-to-Many avec User via la table UserGroup
        Group.belongsToMany(models.User, {
            through: 'UserGroup', // Nom de la table de liaison
            as: 'members',       // Alias pour accéder aux utilisateurs depuis un groupe
            foreignKey: 'groupId',
            otherKey: 'userId'
        });
        // Si vous avez un créateur de groupe
        // Group.belongsTo(models.User, { foreignKey: 'creator_id', as: 'creator' });
    };

    return Group;
};