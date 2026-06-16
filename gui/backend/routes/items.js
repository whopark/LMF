const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { requireApiKey } = require('../middleware/auth');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');
const { applyItemEdit } = require('../services/revisionTxn');
const { areaCodeClause } = require('../utils/areaFilter');

const router = express.Router();

// Safely parse year query param — returns undefined for invalid/injected values
function safeYear(value) {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

// Maps request body field names to Item model fields
const PATCH_FIELD_MAP = {
  'about_item.question': 'question',
  'about_item.description': 'description',
  'about_item.field_specific_description': 'field_specific_description',
  'about_item.score': 'score',
  'about_item.item_type': 'classification',
  'status': 'revision.status',
};

// Transform a flat Item document to the API response contract
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

// GET /api/items — paginated list with filtering & search
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 50, area, sub_category, year,
      search, search_field, classification, revised_only,
      score_min, score_max, score_null,
      modified_after, modified_before,
    } = req.query;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const query = {};
    const areaClause = areaCodeClause(area);
    if (areaClause !== undefined) query.area_code = areaClause;
    const parsedYear = safeYear(year);
    if (parsedYear !== undefined) query.year = parsedYear;
    if (sub_category) query.sub_category = sub_category;
    if (classification) query.classification = classification;
    if (revised_only === 'true') query['revision.revised'] = true;
    // G5 Fix: score range filter — score_null=true returns null/C-type items (핵심/필수)
    if (score_null === 'true') {
      query.$or = [{ score: null }, { score: { $exists: false } }, { classification: 'C' }];
    } else {
      const sMin = score_min !== undefined ? parseInt(score_min) : undefined;
      const sMax = score_max !== undefined ? parseInt(score_max) : undefined;
      if (!Number.isNaN(sMin) && sMin !== undefined) query.score = { ...(query.score || {}), $gte: sMin };
      if (!Number.isNaN(sMax) && sMax !== undefined) query.score = { ...(query.score || {}), $lte: sMax };
    }

    // Date range filter on last_modified.at
    if (modified_after || modified_before) {
      const dateFilter = {};
      if (modified_after) {
        const d = new Date(String(modified_after));
        if (!isNaN(d.getTime())) dateFilter.$gte = d;
      }
      if (modified_before) {
        const d = new Date(String(modified_before));
        if (!isNaN(d.getTime())) {
          // inclusive: extend to end of that day
          d.setHours(23, 59, 59, 999);
          dateFilter.$lte = d;
        }
      }
      if (Object.keys(dateFilter).length > 0) query['last_modified.at'] = dateFilter;
    }

    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (search_field === 'item_number') {
        query.item_number = regex;
      } else if (search_field === 'question') {
        query.question = regex;
      } else if (search_field === 'description') {
        query.description = regex;
      } else if (search_field === 'modifier') {
        // Search by last modifier username stored on the item
        query['last_modified.user'] = regex;
      } else if (search_field === 'edit_type') {
        // Search items that have a revision with a matching edit_type code
        const matchingRevisions = await Revision.distinct('item_number', { edit_types: regex });
        query.item_number = { $in: matchingRevisions };
      } else {
        query.$or = [
          { item_number: regex },
          { question: regex },
          { description: regex },
        ];
      }
    }

    const total = await Item.countDocuments(query);
    const items = await Item.find(query)
      .sort({ sub_category_order: 1, item_order: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

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
    const { year } = req.query;
    const query = year ? { year: parseInt(year) } : {};

    const areas = await Item.aggregate([
      { $match: query },
      { $group: { _id: '$area_code', area_name: { $first: '$area_name' }, year: { $first: '$year' } } },
      { $sort: { _id: 1 } },
    ]);

    res.json(areas.map(a => ({
      category: a._id,
      title: `${a._id}.${a.area_name || ''}_${a.year || ''}`,
    })));
  } catch (err) {
    serverError(res, err, 'items');
  }
});

// GET /api/items/:code — item history sorted by year desc
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const items = await Item.find({ item_number: code })
      .sort({ year: -1 })
      .lean();

    if (items.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json(items.map(toResponse));
  } catch (err) {
    serverError(res, err, 'items');
  }
});

// PATCH /api/items/:id — update item fields (editor role required)
// Optional body fields: edit_types (array), reason (string), x-user header
// Plan SC-1: item update + revision + audit commit atomically via applyItemEdit (G1).
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
