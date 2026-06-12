const express = require('express');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();

// Fields allowed for bulk update across all areas sharing a common_key.
// na_available is intentionally excluded — it can legitimately differ per area.
const BULK_ALLOWED = ['question', 'description', 'score'];

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
    revision: item.revision,
    common_key: item.common_key,
  };
}

// GET /api/common/:key — all items sharing this common_key
router.get('/:key', async (req, res) => {
  try {
    const items = await Item.find({ common_key: req.params.key })
      .sort({ area_code: 1, year: -1 })
      .lean();

    if (items.length === 0) {
      return res.status(404).json({ message: 'No items found for this common_key' });
    }
    res.json({ common_key: req.params.key, items: items.map(toCommonResponse) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/common/:key — bulk update shared fields across all matching areas
// Body: { question?, description?, score?, area_codes?, edit_types?, reason? }
router.patch('/:key', requireApiKey, async (req, res) => {
  try {
    const { key } = req.params;
    const { area_codes, edit_types = [], reason = '', ...rest } = req.body;

    const updates = {};
    for (const f of BULK_ALLOWED) {
      if (rest[f] !== undefined) updates[f] = rest[f];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No valid fields to update',
        allowed_fields: BULK_ALLOWED,
      });
    }

    const query = { common_key: key };
    if (Array.isArray(area_codes) && area_codes.length > 0) {
      query.area_code = { $in: area_codes };
    }

    const targets = await Item.find(query).lean();
    if (targets.length === 0) {
      return res.status(404).json({ message: 'No items found for this common_key' });
    }

    const rawUser = req.headers['x-user'] || '';
    const user = rawUser ? decodeURIComponent(rawUser) : 'unknown';
    const result = { updated: [], skipped_locked: [] };

    for (const item of targets) {
      if (item.revision?.locked) {
        result.skipped_locked.push(item.item_number);
        continue;
      }

      const before = {
        question: item.question, description: item.description,
        score: item.score, classification: item.classification, na_available: item.na_available,
      };
      const after = { ...before, ...updates };
      const scoreChanged = before.score !== after.score;

      const itemUpdates = {
        ...updates,
        last_modified: { user, at: new Date() },
        ...(item.revision?.status === 'none' ? { 'revision.status': 'draft' } : {}),
      };

      await Item.findByIdAndUpdate(item._id, { $set: itemUpdates });

      await Revision.create({
        item_number: item.item_number,
        area_code: item.area_code,
        common_key: key,
        year: item.year,
        user,
        edit_types,
        reason,
        before,
        after,
        status_at_save: item.revision?.status || 'none',
        score_changed: scoreChanged,
      });

      result.updated.push(item.item_number);
    }

    res.json({ common_key: key, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
