const { serverError } = require('../utils/httpError');
const express = require('express');
const Item = require('../models/Item');
const { requireApiKey } = require('../middleware/auth');
const { requireAuth } = require('../middleware/roles');
const { applyCommonEdit, COMMON_SHARED_FIELDS } = require('../services/revisionTxn');

const router = express.Router();

function toCommonResponse(item) {
  return {
    _id: item._id,
    item_number: item.item_number,
    area_code: item.area_code,
    area_name: item.area_name,
    year: item.year,
    question: item.question,
    description: item.description,
    score: item.score,
    classification: item.classification,
    na_available: item.na_available,
    field_specific_description: item.field_specific_description, // G-2: read-only 분야특이 표시
    revision: item.revision,
    common_key: item.common_key,
  };
}

// GET /api/common/:key — items sharing this common_key, scoped to ONE year (G-1).
// ?year=<n> selects a specific year; default = latest year present (one row per area).
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const query = { common_key: key };
    if (req.query.year) {
      query.year = parseInt(req.query.year, 10);
    } else {
      const latest = await Item.findOne({ common_key: key }).sort({ year: -1 }).select('year').lean();
      if (!latest) return res.status(404).json({ message: 'No items found for this common_key' });
      query.year = latest.year;
    }

    const items = await Item.find(query).sort({ area_code: 1 }).lean();
    if (items.length === 0) {
      return res.status(404).json({ message: 'No items found for this common_key' });
    }
    res.json({ common_key: key, year: query.year, items: items.map(toCommonResponse) });
  } catch (err) {
    serverError(res, err, 'common.js');
  }
});

// PATCH /api/common/:key — bulk update shared fields across all matching areas (G1/G7).
// Body: { question?, description?, score?, area_codes?, edit_types?, reason? }
// All item updates + revisions commit atomically; field_specific_description is never propagated.
router.patch('/:key', requireAuth('editor'), async (req, res) => {
  try {
    const { key } = req.params;
    const { area_codes, edit_types = [], reason = '', year, ...rest } = req.body;

    const result = await applyCommonEdit({
      key,
      areaCodes: area_codes,
      year, // G-1: scope propagation to a single year
      updates: rest,
      editTypes: edit_types,
      rawReason: reason,
      user: req.user?.name || 'unknown',
      role: req.user?.role || 'unknown',
    });

    res.json({ common_key: key, ...result });
  } catch (err) {
    if (err.status === 400) {
      return res.status(400).json({ message: err.message, allowed_fields: COMMON_SHARED_FIELDS });
    }
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err, 'common.js');
  }
});

module.exports = router;
