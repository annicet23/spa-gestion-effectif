// middleware/validation.js
const Joi = require('joi');

const organigrammeNodeSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  parentId: Joi.number().integer().positive().allow(null).optional(),
  type: Joi.string().valid('Ecole', 'Escadron', 'Peloton', 'Service').required(),
  numero: Joi.string().max(10).allow('').optional(),
  escadronNumero: Joi.string().max(10).allow('').optional(),
  description: Joi.string().max(500).allow('').optional()
});

const cadreToOrgSchema = Joi.object({
  cadreId: Joi.number().integer().positive().required(),
  parentId: Joi.number().integer().positive().allow(null).optional(),
  positionOrder: Joi.number().integer().min(0).optional()
});

const validateOrganigramme = (req, res, next) => {
  const { error } = organigrammeNodeSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }))
    });
  }

  next();
};

const validateCadreToOrg = (req, res, next) => {
  const { error } = cadreToOrgSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: error.details.map(detail => ({
        field: detail.path[0],
        message: detail.message
      }))
    });
  }

  next();
};

module.exports = {
  validateOrganigramme,
  validateCadreToOrg
};