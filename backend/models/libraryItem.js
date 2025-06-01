// backend/models/libraryItem.js
module.exports = (sequelize, DataTypes) => {
    const LibraryItem = sequelize.define('LibraryItem', {
        id: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        tags: {
            type: DataTypes.JSON
        },
        fileUrl: {
            type: DataTypes.STRING
        },
        externalUrl: {
            type: DataTypes.STRING
        },
        videoUrl: {
            type: DataTypes.STRING
        },
        imageUrl: {
            type: DataTypes.STRING
        },
        // ✅ NOUVELLES COLONNES AJOUTÉES
        downloads: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        views: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        rating: {
            type: DataTypes.DECIMAL(2, 1),
            allowNull: false,
            defaultValue: 0.0
        },
        createdAt: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false
        }
    }, {
        tableName: 'library_items',
        timestamps: true,    // ✅ Garder timestamps activé
        updatedAt: false     // ✅ Mais désactiver updatedAt seulement
    });

    return LibraryItem;
};