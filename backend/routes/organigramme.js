// routes/organigramme.js
const express = require('express');
const router = express.Router();
const { Cadre, Escadron } = require('../models');
const { Op } = require('sequelize');

// ✅ Middleware d'authentification optionnelle pour les tests
const optionalAuth = (req, res, next) => {
  console.log('Middleware optionalAuth appelé');
  // Pour les tests, on utilise un utilisateur par défaut
  req.user = { id: 1, matricule: 'admin' };
  next();
};

// ✅ GET - Récupérer l'organigramme complet
router.get('/', optionalAuth, async (req, res) => {
  try {
    console.log('Route GET /api/organigramme appelée');

    // Vérifier la connexion à la base de données
    if (!req.app.locals.db) {
      console.error('Pas de connexion à la base de données');
      return res.status(500).json({
        success: false,
        message: 'Erreur de connexion à la base de données'
      });
    }

    // Vérifier si la table organigramme_nodes existe
    let nodes = [];
    try {
      nodes = await req.app.locals.db.query(`
        SELECT
          org.id,
          org.name,
          org.parent_id,
          org.type,
          org.numero,
          org.escadron_numero,
          org.cadre_id,
          org.fonction,
          org.position_order,
          org.description,
          org.is_active,
          -- Données du cadre si présent
          c.grade,
          c.nom,
          c.prenom,
          c.matricule,
          c.fonction as fonction_administrative,
          c.photo_url,
          c.email,
          c.numero_telephone,
          c.statut_absence,
          -- Données de l'escadron responsable
          e.nom as escadron_nom
        FROM organigramme_nodes org
        LEFT JOIN cadres c ON org.cadre_id = c.id
        LEFT JOIN escadrons e ON c.responsible_escadron_id = e.id
        WHERE org.is_active = TRUE
        ORDER BY org.parent_id ASC, org.position_order ASC, org.numero ASC
      `, { type: req.app.locals.db.QueryTypes.SELECT });
    } catch (tableError) {
      console.error('Erreur table organigramme_nodes:', tableError.message);

      // Si la table n'existe pas, créer une structure temporaire
      return res.json({
        success: true,
        data: {
          id: 'temp-1',
          name: 'École de la Gendarmerie Nationale Ambositra',
          attributes: {
            id: 'temp-1',
            type: 'Ecole',
            numero: null,
            escadronNumero: null,
            description: 'Structure temporaire - Table organigramme_nodes à créer'
          },
          children: []
        },
        message: 'Structure temporaire - Table organigramme_nodes non trouvée'
      });
    }

    console.log(`Trouvé ${nodes.length} nœuds dans l'organigramme`);

    // Si aucune donnée, créer une structure de base
    if (nodes.length === 0) {
      console.log('Aucun nœud trouvé, création du nœud racine');

      try {
        // Créer le nœud racine de l'école
        await req.app.locals.db.query(`
          INSERT INTO organigramme_nodes
          (name, parent_id, type, position_order, is_active, created_by)
          VALUES ('École de la Gendarmerie Nationale Ambositra', NULL, 'Ecole', 1, TRUE, ?)
        `, {
          replacements: [req.user?.id || 1],
          type: req.app.locals.db.QueryTypes.INSERT
        });

        // Retourner la structure de base
        return res.json({
          success: true,
          data: {
            id: 1,
            name: 'École de la Gendarmerie Nationale Ambositra',
            attributes: {
              id: 1,
              type: 'Ecole',
              numero: null,
              escadronNumero: null,
              description: null
            },
            children: []
          },
          message: 'Nœud racine créé avec succès'
        });
      } catch (insertError) {
        console.error('Erreur création nœud racine:', insertError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de la création du nœud racine'
        });
      }
    }

    // Construire la structure hiérarchique
    const buildTree = (nodes, parentId = null) => {
      return nodes
        .filter(node => node.parent_id === parentId)
        .map(node => {
          const nodeData = {
            id: node.id,
            name: node.name,
            attributes: {
              id: node.id,
              type: node.type,
              numero: node.numero,
              escadronNumero: node.escadron_numero,
              description: node.description
            },
            children: buildTree(nodes, node.id)
          };

          // Si c'est un nœud personne avec un cadre associé
          if (node.cadre_id && node.type === 'Personne') {
            nodeData.name = `${node.grade || ''} ${node.prenom || ''} ${node.nom || ''}`.trim();
            nodeData.attributes = {
              ...nodeData.attributes,
              grade: node.grade,
              nom: node.nom,
              prenom: node.prenom,
              matricule: node.matricule,
              poste: node.fonction || node.fonction_administrative,
              imageUrl: node.photo_url,
              email: node.email,
              telephone: node.numero_telephone,
              statut: node.statut_absence,
              escadronNom: node.escadron_nom,
              cadreId: node.cadre_id,
              fonctionAdmin: node.fonction_administrative,
              fonctionOrg: node.fonction
            };
          }

          return nodeData;
        });
    };

    const tree = buildTree(nodes);

    res.json({
      success: true,
      data: tree[0] || null, // Retourner la racine
      message: `Organigramme chargé avec ${nodes.length} nœuds`
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'organigramme:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération de l\'organigramme',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
});

// ✅ GET - Rechercher des cadres disponibles
router.get('/cadres/available', optionalAuth, async (req, res) => {
  try {
    const { search = '', service, escadronNumero, limit = 20 } = req.query;

    console.log('Recherche cadres:', { search, service, escadronNumero });

    // Vérifier la connexion à la base de données
    if (!req.app.locals.db) {
      return res.status(500).json({
        success: false,
        message: 'Erreur de connexion à la base de données'
      });
    }

    // Exclure les cadres déjà dans l'organigramme
    let excludeIds = [];
    try {
      const cadresInOrg = await req.app.locals.db.query(
        'SELECT cadre_id FROM organigramme_nodes WHERE cadre_id IS NOT NULL AND is_active = TRUE',
        { type: req.app.locals.db.QueryTypes.SELECT }
      );
      excludeIds = cadresInOrg.map(row => row.cadre_id);
      console.log('IDs cadres exclus:', excludeIds);
    } catch (err) {
      console.log('Table organigramme_nodes introuvable ou vide:', err.message);
    }

    // Construire les conditions de recherche
    let whereConditions = {};

    if (excludeIds.length > 0) {
      whereConditions.id = {
        [Op.notIn]: excludeIds
      };
    }

    // Filtrage par recherche textuelle
    if (search && search.length >= 2) {
      whereConditions[Op.or] = [
        { nom: { [Op.like]: `%${search}%` } },
        { prenom: { [Op.like]: `%${search}%` } },
        { grade: { [Op.like]: `%${search}%` } },
        { matricule: { [Op.like]: `%${search}%` } }
      ];
    }

    // Filtrage par service
    if (service) {
      whereConditions.service = service;
    }

    // Filtrage par escadron
    if (escadronNumero) {
      try {
        const escadrons = await Escadron.findAll({
          where: {
            [Op.or]: [
              { numero: escadronNumero },
              { nom: { [Op.like]: `%${escadronNumero}%` } }
            ]
          }
        });

        if (escadrons.length > 0) {
          whereConditions.responsible_escadron_id = {
            [Op.in]: escadrons.map(e => e.id)
          };
        } else {
          return res.json({
            success: true,
            data: [],
            total: 0,
            message: `Aucun escadron trouvé pour le numéro ${escadronNumero}`
          });
        }
      } catch (escError) {
        console.error('Erreur recherche escadron:', escError);
      }
    }

    console.log('Conditions de recherche:', whereConditions);

    // Rechercher les cadres
    const cadres = await Cadre.findAll({
      where: whereConditions,
      include: [{
        model: Escadron,
        as: 'EscadronResponsable',
        attributes: ['id', 'nom', 'numero'],
        required: false
      }],
      limit: parseInt(limit),
      order: [['grade', 'ASC'], ['nom', 'ASC'], ['prenom', 'ASC']]
    });

    const cadresFormatted = cadres.map(cadre => ({
      id: cadre.id,
      nom: cadre.nom,
      prenom: cadre.prenom,
      grade: cadre.grade,
      matricule: cadre.matricule,
      fonction: cadre.fonction,
      nomComplet: `${cadre.grade || ''} ${cadre.prenom || ''} ${cadre.nom || ''}`.trim(),
      escadron: cadre.EscadronResponsable ?
        `${cadre.EscadronResponsable.nom} (${cadre.EscadronResponsable.numero || 'N/A'})` :
        'Aucun escadron',
      photo_url: cadre.photo_url,
      statut_absence: cadre.statut_absence,
      service: cadre.service,
      email: cadre.email
    }));

    console.log(`Trouvé ${cadresFormatted.length} cadres disponibles`);

    res.json({
      success: true,
      data: cadresFormatted,
      total: cadresFormatted.length,
      filters: {
        service: service || null,
        escadronNumero: escadronNumero || null,
        search: search || null
      }
    });

  } catch (error) {
    console.error('Erreur lors de la recherche des cadres:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la recherche des cadres',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
});

// ✅ POST - Ajouter un cadre à l'organigramme
router.post('/node/cadre', optionalAuth, async (req, res) => {
  try {
    const { cadreId, parentId, fonction } = req.body;

    console.log('Ajout cadre à l\'organigramme:', { cadreId, parentId, fonction });

    // Validation des données
    if (!cadreId || !fonction) {
      return res.status(400).json({
        success: false,
        message: 'ID du cadre et fonction sont requis'
      });
    }

    // Vérifier que le cadre existe
    const cadre = await Cadre.findByPk(cadreId, {
      include: [{
        model: Escadron,
        as: 'EscadronResponsable',
        required: false
      }]
    });

    if (!cadre) {
      return res.status(404).json({
        success: false,
        message: 'Cadre non trouvé'
      });
    }

    // Vérifier que le cadre n'est pas déjà dans l'organigramme
    try {
      const alreadyExists = await req.app.locals.db.query(
        'SELECT id FROM organigramme_nodes WHERE cadre_id = ? AND is_active = TRUE',
        { replacements: [cadreId], type: req.app.locals.db.QueryTypes.SELECT }
      );

      if (alreadyExists.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ce cadre est déjà présent dans l\'organigramme'
        });
      }
    } catch (checkError) {
      console.log('Erreur vérification existence cadre:', checkError.message);
    }

    // Vérifier que le parent existe (si spécifié)
    if (parentId) {
      try {
        const parentExists = await req.app.locals.db.query(
          'SELECT id, type FROM organigramme_nodes WHERE id = ? AND is_active = TRUE',
          { replacements: [parentId], type: req.app.locals.db.QueryTypes.SELECT }
        );

        if (parentExists.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Le nœud parent spécifié n\'existe pas'
          });
        }
      } catch (parentError) {
        console.log('Erreur vérification parent:', parentError.message);
      }
    }

    // Construire le nom complet du cadre
    const nomComplet = `${cadre.grade || ''} ${cadre.prenom || ''} ${cadre.nom || ''}`.trim();

    // Obtenir l'ordre de position
    let positionOrder = 1;
    try {
      const positionResult = await req.app.locals.db.query(
        'SELECT COALESCE(MAX(position_order), 0) + 1 as next_order FROM organigramme_nodes WHERE parent_id = ?',
        { replacements: [parentId], type: req.app.locals.db.QueryTypes.SELECT }
      );
      positionOrder = positionResult[0].next_order;
    } catch (posError) {
      console.log('Erreur calcul position:', posError.message);
    }

    // Insérer le nœud personne avec fonction spécifique
    const result = await req.app.locals.db.query(`
      INSERT INTO organigramme_nodes
      (name, parent_id, type, cadre_id, fonction, position_order, created_by)
      VALUES (?, ?, 'Personne', ?, ?, ?, ?)
    `, {
      replacements: [nomComplet, parentId, cadreId, fonction, positionOrder, req.user.id],
      type: req.app.locals.db.QueryTypes.INSERT
    });

    console.log('Cadre ajouté avec l\'ID:', result[0]);

    res.status(201).json({
      success: true,
      message: 'Cadre ajouté à l\'organigramme avec succès',
      data: {
        id: result[0],
        name: nomComplet,
        cadreId: cadreId,
        fonction: fonction,
        matricule: cadre.matricule
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout du cadre:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de l\'ajout du cadre',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur interne'
    });
  }
});

// ✅ DELETE - Retirer un cadre de l'organigramme
router.delete('/node/:id', optionalAuth, async (req, res) => {
  try {
    const nodeId = req.params.id;

    console.log('Suppression du nœud:', nodeId);

    // Vérifier que le nœud existe
    const nodeExists = await req.app.locals.db.query(
      'SELECT * FROM organigramme_nodes WHERE id = ? AND is_active = TRUE',
      { replacements: [nodeId], type: req.app.locals.db.QueryTypes.SELECT }
    );

    if (nodeExists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Nœud non trouvé'
      });
    }

    const nodeData = nodeExists[0];

    // Empêcher la suppression de la racine
    if (!nodeData.parent_id) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer le nœud racine'
      });
    }

    // Vérifier s'il y a des enfants
    const hasChildren = await req.app.locals.db.query(
      'SELECT COUNT(*) as count FROM organigramme_nodes WHERE parent_id = ? AND is_active = TRUE',
      { replacements: [nodeId], type: req.app.locals.db.QueryTypes.SELECT }
    );

    if (hasChildren[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer un nœud qui a des enfants. Déplacez d\'abord les enfants.'
      });
    }

    // Soft delete du nœud
    await req.app.locals.db.query(`
      UPDATE organigramme_nodes
      SET is_active = FALSE, updated_at = NOW(), updated_by = ?
      WHERE id = ?
    `, { replacements: [req.user.id, nodeId] });

    console.log('Nœud supprimé avec succès');

    res.json({
      success: true,
      message: 'Nœud supprimé avec succès de l\'organigramme'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du nœud:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la suppression du nœud'
    });
  }
});

module.exports = router;