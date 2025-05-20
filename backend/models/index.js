'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
// Assurez-vous que le chemin vers votre fichier config.json est correct
const config = require(__dirname + '/../config/config.json')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  // L'objet config peut contenir des options comme 'logging'
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    // Lit tous les fichiers .js dans ce dossier, sauf index.js et les fichiers de test
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    // --- LOG TEMPORAIRE POUR DEBUG ---
    // Cette ligne affichera le nom du fichier juste avant de tenter de le charger
    console.log(`Tentative de chargement du fichier modele : ${file}`);
    // ---------------------------------

    // Charge le modele en appelant la fonction exportee par le fichier
    // Cette fonction doit avoir la signature `(sequelize, DataTypes) => Model`
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

// Appelle la methode 'associate' sur chaque modele charge
// C'est ici que les relations (belongsTo, hasMany, etc.) sont configurees
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Exporte l'instance Sequelize et l'objet Sequelize lui-meme
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Exporte l'objet 'db' contenant tous les modeles charges et les instances sequelize
module.exports = db;
