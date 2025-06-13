// backend/routes/dbAdmin.js - CODE COMPLET CORRIGÉ
const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/authMiddleware');
const db = require('../models');
const { Op } = require('sequelize');

// Middleware - Seuls les admins peuvent accéder
router.use(authenticateJWT);
router.use((req, res, next) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({
      success: false,
      message: 'Accès réservé aux administrateurs'
    });
  }
  next();
});

// ✅ ROUTE TEST SIMPLE
router.get('/test-simple', async (req, res) => {
  try {
    console.log('🧪 Test simple appelé');

    res.json({
      success: true,
      message: 'Route DB Admin fonctionne !',
      models_available: Object.keys(db),
      timestamp: new Date().toISOString(),
      user: req.user.username
    });
  } catch (error) {
    console.error('Erreur test simple:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ LISTER TOUTES LES TABLES - VERSION MYSQL COMPLÈTE
router.get('/tables', async (req, res) => {
  try {
    console.log('🔍 Début listage des tables MySQL...');

    // Test de connexion MySQL
    try {
      await db.sequelize.authenticate();
      console.log('✅ Connexion MySQL OK');
    } catch (connError) {
      console.error('❌ Erreur connexion MySQL:', connError);
      return res.status(500).json({
        success: false,
        message: 'Erreur de connexion à la base de données',
        error: connError.message
      });
    }

    // Lister les modèles Sequelize disponibles
    const models = Object.keys(db).filter(key => {
      if (key === 'sequelize' || key === 'Sequelize') return false;
      const model = db[key];
      return model &&
             typeof model === 'object' &&
             model.tableName &&
             typeof model.findAll === 'function';
    });

    console.log('📋 Modèles Sequelize trouvés:', models);

    // Requête directe MySQL pour lister TOUTES les tables
    console.log('🗃️ Interrogation directe de database_development...');

    const [dbTables] = await db.sequelize.query(`
      SELECT
        table_name as tableName,
        table_rows as tableRows,
        table_comment as tableComment
      FROM information_schema.tables
      WHERE table_schema = 'database_development'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('🗃️ Tables dans database_development:', dbTables);

    // Si aucune table dans la DB
    if (dbTables.length === 0) {
      console.log('⚠️ Aucune table trouvée dans database_development');

      // Vérifier si la DB existe vraiment
      const [databases] = await db.sequelize.query(`SHOW DATABASES`);
      console.log('🗄️ Bases de données disponibles:', databases.map(d => d.Database));

      return res.json({
        success: true,
        data: [],
        debug: {
          message: 'Aucune table trouvée dans database_development',
          available_databases: databases.map(d => d.Database),
          models_found: models.length,
          connection_ok: true
        }
      });
    }

    // Traiter les tables trouvées
    const tablesInfo = await Promise.all(
      dbTables.map(async (table) => {
        try {
          const tableName = table.tableName;
          console.log(`📊 Traitement table: ${tableName}`);

          // Compter les lignes réellement
          const [countResult] = await db.sequelize.query(
            `SELECT COUNT(*) as count FROM \`${tableName}\``
          );
          const count = countResult[0].count;

          // Récupérer les colonnes
          const [columns] = await db.sequelize.query(`
            SELECT
              column_name as name,
              data_type as type,
              is_nullable as allowNull,
              column_key as keyType,
              COALESCE(extra, '') as extra
            FROM information_schema.columns
            WHERE table_schema = 'database_development'
            AND table_name = '${tableName}'
            ORDER BY ordinal_position
          `);

          // Trouver le modèle Sequelize correspondant (si il existe)
          const correspondingModel = models.find(modelName => {
            const model = db[modelName];
            return model.tableName === tableName;
          });

          return {
            name: correspondingModel || tableName,
            tableName: tableName,
            count: parseInt(count),
            attributes: columns.map(col => col.name),
            columns: columns,
            primaryKey: columns.find(col => col.keyType === 'PRI')?.name || 'id',
            hasSequelizeModel: !!correspondingModel,
            source: 'mysql_direct'
          };

        } catch (error) {
          console.error(`❌ Erreur avec table ${table.tableName}:`, error.message);
          return {
            name: table.tableName,
            tableName: table.tableName,
            count: 0,
            attributes: [],
            error: error.message,
            source: 'error'
          };
        }
      })
    );

    console.log(`✅ ${tablesInfo.length} tables traitées avec succès`);

    res.json({
      success: true,
      data: tablesInfo,
      debug: {
        database: 'database_development',
        total_tables: dbTables.length,
        sequelize_models: models.length,
        method: 'mysql_direct_query'
      }
    });

  } catch (error) {
    console.error('❌ Erreur listage tables MySQL:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du listage des tables MySQL',
      error: error.message,
      stack: error.stack
    });
  }
});

// ✅ RÉCUPÉRER LES DONNÉES D'UNE TABLE - VERSION CORRIGÉE
router.get('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { page = 1, limit = 50, search = '', orderBy, orderDir = 'ASC' } = req.query;

    console.log(`📊 Récupération données table: ${tableName}`);

    // Sécuriser le nom de la table
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Vérifier que la table existe
    const [tableExists] = await db.sequelize.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
    `);

    if (tableExists[0].count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Table non trouvée'
      });
    }

    const offset = (page - 1) * parseInt(limit);

    // Récupérer les colonnes avec protection NULL
    const [columns] = await db.sequelize.query(`
      SELECT
        column_name as name,
        data_type as type,
        is_nullable as allowNull,
        column_key as keyType,
        COALESCE(extra, '') as extra
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      ORDER BY ordinal_position
    `);

    // Construire la requête de recherche
    let whereClause = '';
    if (search && search.trim()) {
      const searchTerm = search.trim();
      const searchableColumns = columns.filter(col =>
        ['varchar', 'text', 'char', 'longtext', 'mediumtext', 'tinytext'].includes(col.type.toLowerCase())
      );

      if (searchableColumns.length > 0) {
        const searchConditions = searchableColumns.map(col =>
          `\`${col.name}\` LIKE '%${searchTerm}%'`
        ).join(' OR ');
        whereClause = `WHERE (${searchConditions})`;
      }
    }

    // Déterminer la colonne de tri
    let orderColumn = 'id';
    if (orderBy && columns.find(col => col.name === orderBy)) {
      orderColumn = orderBy;
    } else {
      const pkColumn = columns.find(col => col.keyType === 'PRI');
      if (pkColumn) {
        orderColumn = pkColumn.name;
      } else if (columns.length > 0) {
        orderColumn = columns[0].name;
      }
    }

    // Compter le total
    const [countResult] = await db.sequelize.query(`
      SELECT COUNT(*) as total FROM \`${sanitizedTableName}\` ${whereClause}
    `);
    const total = countResult[0].total;

    // Récupérer les données avec pagination
    const [rows] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\`
      ${whereClause}
      ORDER BY \`${orderColumn}\` ${orderDir.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}
      LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `);

    // ✅ FORMATER LES COLONNES AVEC VÉRIFICATIONS DE SÉCURITÉ
    const formattedColumns = columns.map(col => ({
      name: col.name || '',
      type: (col.type || '').toUpperCase(),
      allowNull: col.allowNull === 'YES',
      primaryKey: col.keyType === 'PRI',
      autoIncrement: col.extra && typeof col.extra === 'string' && col.extra.includes('auto_increment')
    }));

    console.log(`✅ Retour de ${rows.length} enregistrements sur ${total}`);

    res.json({
      success: true,
      data: {
        rows,
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        columns: formattedColumns,
        tableName: sanitizedTableName
      }
    });

  } catch (error) {
    console.error('❌ Erreur récupération table:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des données',
      error: error.message
    });
  }
});

// ✅ RÉCUPÉRER UN ENREGISTREMENT SPÉCIFIQUE
router.get('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Trouver la clé primaire
    const [pkResult] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      AND column_key = 'PRI'
      LIMIT 1
    `);

    const primaryKey = pkResult[0]?.column_name || 'id';

    const [rows] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` = ${id}
    `);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enregistrement non trouvé'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Erreur récupération enregistrement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'enregistrement',
      error: error.message
    });
  }
});

// ✅ METTRE À JOUR UN ENREGISTREMENT
router.put('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const updateData = req.body;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Supprimer les champs non modifiables
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    delete updateData.created_at;
    delete updateData.updated_at;

    // Trouver la clé primaire
    const [pkResult] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      AND column_key = 'PRI'
      LIMIT 1
    `);

    const primaryKey = pkResult[0]?.column_name || 'id';

    // Construire la requête UPDATE avec échappement
    const setClause = Object.keys(updateData).map(key => {
      const value = updateData[key];
      if (value === null || value === undefined) {
        return `\`${key}\` = NULL`;
      } else if (typeof value === 'string') {
        return `\`${key}\` = '${value.replace(/'/g, "''")}'`;
      } else {
        return `\`${key}\` = ${value}`;
      }
    }).join(', ');

    if (setClause) {
      await db.sequelize.query(`
        UPDATE \`${sanitizedTableName}\`
        SET ${setClause}
        WHERE \`${primaryKey}\` = ${id}
      `);
    }

    // Récupérer l'enregistrement mis à jour
    const [updatedRows] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` = ${id}
    `);

    res.json({
      success: true,
      message: 'Enregistrement mis à jour avec succès',
      data: updatedRows[0]
    });

  } catch (error) {
    console.error('Erreur mise à jour:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour',
      error: error.message
    });
  }
});

// ✅ SUPPRIMER UN ENREGISTREMENT
router.delete('/table/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Trouver la clé primaire
    const [pkResult] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      AND column_key = 'PRI'
      LIMIT 1
    `);

    const primaryKey = pkResult[0]?.column_name || 'id';

    // Récupérer l'enregistrement avant suppression
    const [recordRows] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` = ${id}
    `);

    if (recordRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enregistrement non trouvé'
      });
    }

    // Supprimer l'enregistrement
    await db.sequelize.query(`
      DELETE FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` = ${id}
    `);

    res.json({
      success: true,
      message: 'Enregistrement supprimé avec succès',
      deletedRecord: recordRows[0]
    });

  } catch (error) {
    console.error('Erreur suppression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression',
      error: error.message
    });
  }
});

// ✅ EXÉCUTER UNE REQUÊTE SQL PERSONNALISÉE (DANGEREUX - Admin seulement)
router.post('/query', async (req, res) => {
  try {
    const { query, type = 'SELECT' } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Requête SQL requise'
      });
    }

    // Sécurité basique - empêcher certaines opérations dangereuses
    const dangerousKeywords = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE'];
    const upperQuery = query.toUpperCase();

    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        return res.status(403).json({
          success: false,
          message: `Opération ${keyword} non autorisée pour des raisons de sécurité`
        });
      }
    }

    const [results] = await db.sequelize.query(query);

    res.json({
      success: true,
      data: results,
      query,
      rowCount: Array.isArray(results) ? results.length : 1
    });

  } catch (error) {
    console.error('Erreur requête SQL:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'exécution de la requête',
      error: error.message
    });
  }
});

// ✅ ROUTE DE TEST POUR UNE TABLE SPÉCIFIQUE
router.get('/test-table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    console.log(`🧪 Test table: ${sanitizedTableName}`);

    // Test simple : compter les lignes
    const [result] = await db.sequelize.query(`SELECT COUNT(*) as count FROM \`${sanitizedTableName}\``);

    res.json({
      success: true,
      tableName: sanitizedTableName,
      count: result[0].count,
      message: 'Test table OK'
    });

  } catch (error) {
    console.error('Erreur test table:', error);
    res.json({
      success: false,
      tableName: req.params.tableName,
      error: error.message
    });
  }
});
// ✅ NOUVELLES ROUTES POUR OPÉRATIONS EN LOT - Ajoutez à la fin du fichier

// ✅ SUPPRESSION MULTIPLE
router.delete('/table/:tableName/bulk', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { ids } = req.body;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste d\'IDs requise'
      });
    }

    // Trouver la clé primaire
    const [pkResult] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      AND column_key = 'PRI'
      LIMIT 1
    `);

    const primaryKey = pkResult[0]?.column_name || 'id';

    // Récupérer les enregistrements avant suppression
    const placeholders = ids.map(() => '?').join(',');
    const [recordsToDelete] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` IN (${placeholders})
    `, {
      replacements: ids
    });

    // Transaction pour supprimer tous les enregistrements
    await db.sequelize.transaction(async (t) => {
      await db.sequelize.query(`
        DELETE FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` IN (${placeholders})
      `, {
        replacements: ids,
        transaction: t
      });
    });

    res.json({
      success: true,
      message: `${recordsToDelete.length} enregistrements supprimés avec succès`,
      deletedRecords: recordsToDelete,
      deletedCount: recordsToDelete.length
    });

  } catch (error) {
    console.error('Erreur suppression multiple:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression multiple',
      error: error.message
    });
  }
});

// ✅ AJOUT D'ENREGISTREMENT
router.post('/table/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const newData = req.body;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Récupérer les colonnes pour validation
    const [columns] = await db.sequelize.query(`
      SELECT
        column_name as name,
        data_type as type,
        is_nullable as allowNull,
        column_key as keyType,
        COALESCE(extra, '') as extra
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      ORDER BY ordinal_position
    `);

    // Filtrer les champs pour exclure auto-increment et clés primaires
    const editableFields = {};
    const autoIncrementFields = [];

    columns.forEach(col => {
      if (col.extra && col.extra.includes('auto_increment')) {
        autoIncrementFields.push(col.name);
      } else if (newData[col.name] !== undefined) {
        editableFields[col.name] = newData[col.name];
      }
    });

    if (Object.keys(editableFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucun champ modifiable fourni'
      });
    }

    // Construire la requête INSERT
    const fieldNames = Object.keys(editableFields);
    const fieldValues = Object.values(editableFields);

    const placeholders = fieldNames.map(() => '?').join(', ');
    const fieldsString = fieldNames.map(name => `\`${name}\``).join(', ');

    const [result] = await db.sequelize.query(`
      INSERT INTO \`${sanitizedTableName}\` (${fieldsString}) VALUES (${placeholders})
    `, {
      replacements: fieldValues
    });

    // Récupérer l'enregistrement créé
    const insertId = result.insertId || result;
    const primaryKey = columns.find(col => col.keyType === 'PRI')?.name || 'id';

    const [newRecord] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` = ?
    `, {
      replacements: [insertId]
    });

    res.json({
      success: true,
      message: 'Enregistrement créé avec succès',
      data: newRecord[0],
      insertId: insertId
    });

  } catch (error) {
    console.error('Erreur création enregistrement:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création',
      error: error.message
    });
  }
});

// ✅ DUPLICATION D'ENREGISTREMENTS
router.post('/table/:tableName/duplicate', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { ids } = req.body;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste d\'IDs requise pour duplication'
      });
    }

    // Récupérer les colonnes
    const [columns] = await db.sequelize.query(`
      SELECT
        column_name as name,
        data_type as type,
        column_key as keyType,
        COALESCE(extra, '') as extra
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      ORDER BY ordinal_position
    `);

    const primaryKey = columns.find(col => col.keyType === 'PRI')?.name || 'id';
    const editableColumns = columns.filter(col =>
      !(col.keyType === 'PRI' || (col.extra && col.extra.includes('auto_increment')))
    );

    // Récupérer les enregistrements à dupliquer
    const placeholders = ids.map(() => '?').join(',');
    const [recordsToDuplicate] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` IN (${placeholders})
    `, {
      replacements: ids
    });

    const duplicatedRecords = [];

    // Transaction pour dupliquer tous les enregistrements
    await db.sequelize.transaction(async (t) => {
      for (const record of recordsToDuplicate) {
        const fieldsToInsert = {};
        editableColumns.forEach(col => {
          if (record[col.name] !== undefined) {
            fieldsToInsert[col.name] = record[col.name];
          }
        });

        const fieldNames = Object.keys(fieldsToInsert);
        const fieldValues = Object.values(fieldsToInsert);

        if (fieldNames.length > 0) {
          const placeholders = fieldNames.map(() => '?').join(', ');
          const fieldsString = fieldNames.map(name => `\`${name}\``).join(', ');

          const [result] = await db.sequelize.query(`
            INSERT INTO \`${sanitizedTableName}\` (${fieldsString}) VALUES (${placeholders})
          `, {
            replacements: fieldValues,
            transaction: t
          });

          duplicatedRecords.push({ originalId: record[primaryKey], newId: result.insertId || result });
        }
      }
    });

    res.json({
      success: true,
      message: `${duplicatedRecords.length} enregistrements dupliqués avec succès`,
      duplicatedRecords,
      duplicatedCount: duplicatedRecords.length
    });

  } catch (error) {
    console.error('Erreur duplication:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la duplication',
      error: error.message
    });
  }
});

// ✅ ÉDITION EN LOT
router.put('/table/:tableName/bulk', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { ids, updateData } = req.body;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Liste d\'IDs requise'
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Données de mise à jour requises'
      });
    }

    // Trouver la clé primaire
    const [pkResult] = await db.sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      AND column_key = 'PRI'
      LIMIT 1
    `);

    const primaryKey = pkResult[0]?.column_name || 'id';

    // Supprimer les champs non modifiables
    const cleanUpdateData = { ...updateData };
    delete cleanUpdateData.id;
    delete cleanUpdateData.createdAt;
    delete cleanUpdateData.updatedAt;
    delete cleanUpdateData.created_at;
    delete cleanUpdateData.updated_at;

    // Construire la requête UPDATE
    const setClause = Object.keys(cleanUpdateData).map(key => {
      const value = cleanUpdateData[key];
      if (value === null || value === undefined) {
        return `\`${key}\` = NULL`;
      } else if (typeof value === 'string') {
        return `\`${key}\` = '${value.replace(/'/g, "''")}'`;
      } else {
        return `\`${key}\` = ${value}`;
      }
    }).join(', ');

    const idsPlaceholders = ids.map(() => '?').join(',');

    // Transaction pour mettre à jour tous les enregistrements
    await db.sequelize.transaction(async (t) => {
      await db.sequelize.query(`
        UPDATE \`${sanitizedTableName}\`
        SET ${setClause}
        WHERE \`${primaryKey}\` IN (${idsPlaceholders})
      `, {
        replacements: ids,
        transaction: t
      });
    });

    // Récupérer les enregistrements mis à jour
    const [updatedRecords] = await db.sequelize.query(`
      SELECT * FROM \`${sanitizedTableName}\` WHERE \`${primaryKey}\` IN (${idsPlaceholders})
    `, {
      replacements: ids
    });

    res.json({
      success: true,
      message: `${updatedRecords.length} enregistrements mis à jour avec succès`,
      updatedRecords,
      updatedCount: updatedRecords.length
    });

  } catch (error) {
    console.error('Erreur mise à jour en lot:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour en lot',
      error: error.message
    });
  }
});

// ✅ IMPORT CSV
router.post('/table/:tableName/import', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { csvData, options = {} } = req.body;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    if (!csvData) {
      return res.status(400).json({
        success: false,
        message: 'Données CSV requises'
      });
    }

    // Parser le CSV (simple)
    const lines = csvData.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'CSV doit contenir au moins un en-tête et une ligne de données'
      });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataRows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || null;
        return obj;
      }, {});
    });

    // Récupérer les colonnes de la table
    const [columns] = await db.sequelize.query(`
      SELECT
        column_name as name,
        data_type as type,
        column_key as keyType,
        COALESCE(extra, '') as extra
      FROM information_schema.columns
      WHERE table_schema = 'database_development'
      AND table_name = '${sanitizedTableName}'
      ORDER BY ordinal_position
    `);

    const editableColumns = columns.filter(col =>
      !(col.keyType === 'PRI' || (col.extra && col.extra.includes('auto_increment')))
    ).map(col => col.name);

    let insertedCount = 0;
    const errors = [];

    // Transaction pour insérer tous les enregistrements
    await db.sequelize.transaction(async (t) => {
      for (let i = 0; i < dataRows.length; i++) {
        try {
          const row = dataRows[i];
          const fieldsToInsert = {};

          editableColumns.forEach(col => {
            if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
              fieldsToInsert[col] = row[col];
            }
          });

          if (Object.keys(fieldsToInsert).length > 0) {
            const fieldNames = Object.keys(fieldsToInsert);
            const fieldValues = Object.values(fieldsToInsert);

            const placeholders = fieldNames.map(() => '?').join(', ');
            const fieldsString = fieldNames.map(name => `\`${name}\``).join(', ');

            await db.sequelize.query(`
              INSERT INTO \`${sanitizedTableName}\` (${fieldsString}) VALUES (${placeholders})
            `, {
              replacements: fieldValues,
              transaction: t
            });

            insertedCount++;
          }
        } catch (error) {
          errors.push({
            line: i + 2,
            error: error.message,
            data: dataRows[i]
          });
        }
      }
    });

    res.json({
      success: true,
      message: `Import terminé: ${insertedCount} enregistrements ajoutés`,
      insertedCount,
      totalLines: dataRows.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Erreur import CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'import CSV',
      error: error.message
    });
  }
});

// ✅ EXPORT COMPLET DE TABLE
router.get('/table/:tableName/export', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { format = 'csv' } = req.query;
    const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');

    // Récupérer toutes les données
    const [rows] = await db.sequelize.query(`SELECT * FROM \`${sanitizedTableName}\``);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucune donnée à exporter'
      });
    }

    if (format === 'csv') {
      const headers = Object.keys(rows[0]);
      const csvHeaders = headers.join(',');
      const csvRows = rows.map(row =>
        headers.map(header => {
          const value = row[header];
          return value !== null ? `"${String(value).replace(/"/g, '""')}"` : '';
        }).join(',')
      );

      const csvContent = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}_export.csv"`);
      res.send(csvContent);
    } else {
      res.json({
        success: true,
        data: rows,
        tableName: sanitizedTableName,
        exportedCount: rows.length
      });
    }

  } catch (error) {
    console.error('Erreur export:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'export',
      error: error.message
    });
  }
});

module.exports = router;