const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { EditTypeCode, DEFAULT_CODES } = require('../models/EditTypeCode');
const { requireApiKey } = require('../middleware/auth');
const { isValidTransition, getStatusUpdates, VALID_TRANSITIONS } = require('../utils/revisionState');

const router = express.Router();

// GET /api/revisions/edit-type-codes — must be BEFORE /:id routes
router.get('/edit-type-codes', async (req, res) => {
  try {
    let codes = await EditTypeCode.find({ active: true }).sort({ order: 1 }).lean();
    if (codes.length === 0) {
      await EditTypeCode.insertMany(DEFAULT_CODES, { ordered: false }).catch(() => {});
      codes = DEFAULT_CODES.filter(c => c);
    }
    res.json(codes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/revisions — search revision history
router.get('/', async (req, res) => {
  try {
    const { item_number, area_code, year, user, score_changed, page = 1, limit = 50 } = req.query;

    const query = {};
    if (item_number) query.item_number = item_number;
    if (area_code) query.area_code = area_code;
    if (year) query.year = parseInt(year);
    if (user) query.user = new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (score_changed === 'true') query.score_changed = true;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const total = await Revision.countDocuments(query);
    const revisions = await Revision.find(query)
      .sort({ at: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

    res.json({ revisions, total, page: safePage, totalPages: Math.ceil(total / safeLimit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/revisions/transition/:itemId — workflow state transition
router.post('/transition/:itemId', requireApiKey, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { to } = req.body;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid item ID' });
    }
    if (!to) {
      return res.status(400).json({ message: 'Missing required field: to (target status)' });
    }

    const item = await Item.findById(itemId).lean();
    if (!item) return res.status(404).json({ message: 'Item not found' });

    const currentStatus = item.revision?.status || 'none';

    if (item.revision?.locked) {
      return res.status(403).json({
        message: 'Item is locked (final). Only admin unlock allowed.',
      });
    }

    if (!isValidTransition(currentStatus, to)) {
      return res.status(400).json({
        message: `Invalid transition: ${currentStatus} → ${to}`,
        valid_transitions: VALID_TRANSITIONS[currentStatus] || [],
      });
    }

    const updated = await Item.findByIdAndUpdate(
      itemId,
      { $set: getStatusUpdates(to) },
      { new: true }
    ).lean();

    res.json({
      item_number: updated.item_number,
      year: updated.year,
      area_code: updated.area_code,
      revision: updated.revision,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
