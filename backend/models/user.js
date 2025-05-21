// models/user.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs'); // Assurez-vous d'avoir bcryptjs
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS || '10', 10); // Définissez vos salt rounds

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        matricule: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        role: {
            type: DataTypes.ENUM('Admin', 'Standard', 'Consultant'),
            allowNull: false,
            defaultValue: 'Standard',
        },
        status: {
            type: DataTypes.ENUM('Active', 'Inactive'),
            allowNull: false,
            defaultValue: 'Active',
        },
        nom: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        prenom: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        grade: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        service: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        cadre_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        eleve_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        password_needs_reset: {
            type: DataTypes.BOOLEAN, // Utilisez BOOLEAN pour tinyint(1)
            allowNull: false,
            defaultValue: false, // <-- Changez ceci à false si vous le voulez
        },
        last_password_change: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW, // Sequelize gère cela lors de la création
        },
        fonction: { // Si vous maintenez cette colonne dans le modèle User
            type: DataTypes.STRING,
            allowNull: true,
        }
    }, {
        tableName: 'users',
        timestamps: true,
        underscored: true,
        hooks: {
            // Hook beforeSave pour hasher le mot de passe et gérer les flags de réinitialisation
            beforeSave: async (user, options) => {
                // Seulement si le champ 'password' a été explicitement modifié
                if (user.changed('password')) {
                    if (user.password) { // S'assurer que le mot de passe n'est pas vide
                        const salt = await bcrypt.genSalt(SALT_ROUNDS);
                        user.password = await bcrypt.hash(user.password, salt);
                        user.last_password_change = new Date(); // Mettre à jour la date du dernier changement
                        user.password_needs_reset = false; // Le mot de passe a été changé, donc plus besoin de réinitialisation forcée
                    }
                }
                // Optionnel: Pour les nouvelles entrées si password_needs_reset n'est pas géré ailleurs
                if (user.isNewRecord && user.password_needs_reset === undefined) {
                    user.password_needs_reset = true; // Si c'est un nouveau consultant, forcez le reset
                }
            }
        }
    });

    // Association (si elle existe)
    User.associate = (models) => {
        User.belongsTo(models.Cadre, { foreignKey: 'cadre_id', as: 'cadre' });
    };

    // Méthode d'instance pour valider le mot de passe
    User.prototype.validPassword = async function (password) {
        return bcrypt.compare(password, this.password);
    };

    return User;
};