const express = require('express');
const mongoose = require('mongoose');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');
const { applyItemEdit } = require('../services/revisionTxn');
const itemRepo = require('../repositories/itemRepo');

const router = express.Router();

// Maps request body field names to Item model fields
const PATCH_FIELD_MAP = {
  'about_item.question': 'question',
  'about_item.description': 'description',
  'about_item.field_specific_description': 'field_specific_description',
  'about_item.score': 'score',
  'about_item.item_type': 'classification',
  'status': 'revision.status',
};

// Transform a flat Item-shape doc to the API response contract.
// Both mongo (lean) and pg (de-normalized) repos return this shape.
function toResponse(item) {
  return {
    _id: item._id,
    area: item.area_code,
    sub_category: item.sub_category,
    about_item: {
      item_number: item.item_number || '',
      question: item.question || '',
      description: item.description || '',
      field_specific_description: item.field_specific_description || '',
      blocks: item.blocks || [],
      score: item.score,
      item_type: item.classification || '',
    },
    na_available: item.na_available || false,
    last_modified: item.last_modified || null,
    metadata: {
      year: item.year,
      source: item.area_name || '',
    },
    revision: item.revision,
    common_key: item.common_key,
  };
}

// GET /api/items — paginated list with filtering & search (read: engine via itemRepo)
router.get('/', async (req, res) => {
  try {
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const safePage = Math.max(parseInt(req.query.page) || 1, 1);
    const { items, total } = await itemRepo.listItems(req.query, {
      skip: (safePage - 1) * safeLimit,
      limit: safeLimit,
    });
    res.json({
      items: items.map(toResponse),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit),
    });
  } catch (err) {
    serverError(res, err, 'items');
  }
});

// GET /api/items/categories — unique area list (compatibility endpoint)
router.get('/categories', async (req, res) => {
  try {
    res.json(await itemRepo.getCategories(req.query.year));
  } catch (err) {
    serverError(res, err, 'items');
  }
});

// GET /api/items/:code — item history sorted by year desc
router.get('/:code', async (req, res) => {
  try {
    const items = await itemRepo.getByNumber(req.params.code);
    if (items.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(items.map(toResponse));
  } catch (err) {
    serverError(res, err, 'items');
  }
});

// PATCH /api/items/:id — update item fields (editor role required).
// WRITE path stays on Mongo (applyItemEdit) until Phase 4b. Plan SC-1: item update +
// revision + audit commit atomically (G1).
router.patch('/:id', requireAuth('editor'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid document ID format' });
    }

    const updates = {};
    let hasValid = false;
    for (const [reqField, modelField] of Object.entries(PATCH_FIELD_MAP)) {
      if (req.body[reqField] !== undefined) {
        updates[modelField] = req.body[reqField];
        hasValid = true;
      }
    }

    if (!hasValid) {
      return res.status(400).json({
        message: 'No valid fields to update',
        allowed_fields: Object.keys(PATCH_FIELD_MAP),
      });
    }

    // req.user.name is set by requireAuth (JWT name OR x-user header for API key auth)
    const { updated } = await applyItemEdit({
      id,
      updates,
      editTypes: Array.isArray(req.body.edit_types) ? req.body.edit_types : [],
      rawReason: req.body.reason,
      user: req.user?.name || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
    });

    res.json(toResponse(updated));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err, 'items');
  }
});

module.exports = router;
