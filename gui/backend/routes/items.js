const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();

// Maps request body field names to Item model fields
const PATCH_FIELD_MAP = {
  'about_item.question': 'question',
  'about_item.description': 'description',
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
      score: item.score,
      item_type: item.classification || '',
    },
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
    const { page = 1, limit = 50, area, sub_category, year, search, search_field, classification, revised_only } = req.query;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const query = {};
    if (area) query.area_code = area;
    if (year) query.year = parseInt(year);
    if (sub_category) query.sub_category = sub_category;
    if (classification) query.classification = classification;
    if (revised_only === 'true') query['revision.revised'] = true;

    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      // search_field restricts which field to search; default searches all three
      if (search_field === 'item_number') {
        query.item_number = regex;
      } else if (search_field === 'question') {
        query.question = regex;
      } else if (search_field === 'description') {
        query.description = regex;
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/items/:id — update item fields (requires API key)
// Optional body fields: edit_types (array), reason (string), x-user header
router.patch('/:id', requireApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid document ID format' });
    }

    const existing = await Item.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ message: 'Item not found' });
    }
    if (existing.revision && existing.revision.locked) {
      return res.status(403).json({ message: 'Item is locked (final status). Unlock required.' });
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

    // Auto-transition none → draft on first edit
    if ((existing.revision?.status || 'none') === 'none') {
      updates['revision.status'] = 'draft';
    }

    const rawUser = req.headers['x-user'] || '';
    const user = rawUser ? decodeURIComponent(rawUser) : 'unknown';
    updates['last_modified'] = { user, at: new Date() };

    const updated = await Item.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    // Record revision log (non-blocking — failure does not roll back the PATCH)
    const scoreChanged = updates.score !== undefined && updates.score !== existing.score;
    const before = {
      question: existing.question, description: existing.description,
      score: existing.score, classification: existing.classification, na_available: existing.na_available,
    };
    const after = {
      question: updated.question, description: updated.description,
      score: updated.score, classification: updated.classification, na_available: updated.na_available,
    };
    Revision.create({
      item_number: existing.item_number,
      area_code: existing.area_code,
      common_key: existing.common_key,
      year: existing.year,
      user,
      edit_types: Array.isArray(req.body.edit_types) ? req.body.edit_types : [],
      reason: req.body.reason || '',
      before,
      after,
      status_at_save: existing.revision?.status || 'none',
      score_changed: scoreChanged,
    }).catch(err => console.error('[PATCH] Failed to create revision log:', err.message));

    res.json(toResponse(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
