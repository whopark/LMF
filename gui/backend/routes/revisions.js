const { serverError } = require('../utils/httpError');
const express = require('express');
const mongoose = require('mongoose');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { EditTypeCode, DEFAULT_CODES } = require('../models/EditTypeCode');
const { requireApiKey } = require('../middleware/auth');
const { requireAuth, hasRole } = require('../middleware/roles');
const { isValidTransition, getStatusUpdates, VALID_TRANSITIONS } = require('../utils/revisionState');
const { unlockItem } = require('../services/revisionTxn');

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
    serverError(res, err, 'revisions.js');
  }
});

// GET /api/revisions — search revision history
router.get('/', async (req, res) => {
  try {
    const { item_number, area_code, year, user, score_changed, edit_types, page = 1, limit = 50 } = req.query;

    const query = {};
    if (item_number) query.item_number = item_number;
    if (area_code) query.area_code = area_code;
    if (year) query.year = parseInt(year);
    if (user) query.user = new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (score_changed === 'true') query.score_changed = true;
    // G4 Fix: filter by edit_types (comma-separated or array)
    if (edit_types) {
      const types = Array.isArray(edit_types) ? edit_types : String(edit_types).split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) query.edit_types = { $in: types };
    }

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
    serverError(res, err, 'revisions.js');
  }
});

// POST /api/revisions/transition/:itemId — workflow state transition (editor+)
router.post('/transition/:itemId', requireAuth('editor'), async (req, res) => {
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

    // review→final requires approver role
    if (to === 'final' && !hasRole(req.user?.role, 'approver')) {
      return res.status(403).json({
        message: 'Transition to final requires approver role or above',
      });
    }

    if (!isValidTransition(currentStatus, to)) {
      return res.status(400).json({
        message: `Invalid transition: ${currentStatus} → ${to}`,
        valid_transitions: VALID_TRANSITIONS[currentStatus] || [],
      });
    }

    // G5: atomic guard on status + lock — closes the TOCTOU window between the
    // checks above and the write. A concurrent change makes this return null.
    const updated = await Item.findOneAndUpdate(
      { _id: itemId, 'revision.status': currentStatus, 'revision.locked': { $ne: true } },
      { $set: getStatusUpdates(to) },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(409).json({ message: 'Item state changed concurrently — please retry' });
    }

    res.json({
      item_number: updated.item_number,
      year: updated.year,
      area_code: updated.area_code,
      revision: updated.revision,
    });
  } catch (err) {
    serverError(res, err, 'revisions.js');
  }
});

// POST /api/revisions/unlock/:itemId — admin-only unlock of a final item (G4).
// Body: { reason } (required). Records an audit log entry. Plan SC-4.
router.post('/unlock/:itemId', requireAuth('admin'), async (req, res) => {
  try {
    const { itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    const updated = await unlockItem({
      id: itemId,
      rawReason: req.body.reason,
      user: req.user?.name || 'unknown',
      role: req.user?.role || 'unknown',
      ip: req.ip,
    });

    res.json({
      item_number: updated.item_number,
      year: updated.year,
      area_code: updated.area_code,
      revision: updated.revision,
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ message: err.message });
    serverError(res, err, 'revisions.js');
  }
});

module.exports = router;
