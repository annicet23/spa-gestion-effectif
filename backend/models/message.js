// models/Message.js (ou le chemin vers votre définition de modèle Message)

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Message = sequelize.define('Message', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        sender_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Users', // Nom de votre table utilisateurs (assurez-vous que c'est le bon nom de table)
                key: 'id',
            },
        },
        receiver_id: { // Pour les messages privés
            type: DataTypes.INTEGER,
            allowNull: true, // Peut être null pour les messages de diffusion ou de groupe
            references: {
                model: 'Users',
                key: 'id',
            },
        },
        group_id: { // Pour les messages de groupe
            type: DataTypes.INTEGER,
            allowNull: true, // Peut être null pour les messages privés ou de diffusion
            references: {
                model: 'Groups', // Nom de votre table groupes (assurez-vous que c'est le bon nom de table)
                key: 'id',
            },
        },
        message_text: {
            type: DataTypes.TEXT,
            allowNull: true, // Peut être null si le message est uniquement un fichier
        },
        file_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        original_file_name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        file_mime_type: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        file_size_bytes: {
            type: DataTypes.BIGINT, // Utilisez BIGINT pour les tailles de fichiers potentiellement grandes
            allowNull: true,
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW, // Définit la valeur par défaut à l'heure actuelle lors de la création
        },
        // NOUVELLE COLONNE POUR LE STATUT LU/NON LU
        read_at: {
            type: DataTypes.DATE,
            allowNull: true, // Est null si le message n'a pas encore été lu par le destinataire concerné
        }
    }, {
        timestamps: false, // Indique à Sequelize de ne PAS ajouter automatiquement les colonnes 'createdAt' et 'updatedAt'
        tableName: 'messages', // Spécifie le nom exact de la table dans votre base de données
    });

    // Définition des associations pour que Sequelize puisse faire les jointures
    Message.associate = (models) => {
        // Un message est envoyé par un utilisateur (expéditeur)
        Message.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });
        // Un message peut être destiné à un utilisateur spécifique (destinataire privé)
        Message.belongsTo(models.User, { foreignKey: 'receiver_id', as: 'receiver' });
        // Un message peut appartenir à un groupe
        Message.belongsTo(models.Group, { foreignKey: 'group_id', as: 'group' });
    };

    return Message;
};