const { serverError } = require('../utils/httpError');
const express = require('express');
const Revision = require('../models/Revision');
const { EditTypeCode, DEFAULT_CODES } = require('../models/EditTypeCode');
const { requireAuth } = require('../middleware/roles');
const { unlockItem, transitionItem } = require('../services/revisionTxn');

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

// GET /api/revisions — search revision history (read stays on Mongo; revisions-list read
// cutover is out of Phase 4b scope).
router.get('/', async (req, res) => {
  try {
    const { item_number, area_code, year, user, score_changed, edit_types, page = 1, limit = 50 } = req.query;

    const query = {};
    if (item_number) query.item_number = item_number;
    if (area_code) query.area_code = area_code;
    if (year) query.year = parseInt(year);
    if (user) query.user = new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (score_changed === 'true') query.score_changed = true;
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

// POST /api/revisions/transition/:itemId — workflow state transition (editor+).
// Write path: engine via transitionItem (mongo|pg). id format + atomic guard handled in repo.
router.post('/transition/:itemId', requireAuth('editor'), async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'Missing required field: to (target status)' });

    const updated = await transitionItem({ id: req.params.itemId, to, role: req.user?.role });
    res.json({
      item_number: updated.item_number,
      year: updated.year,
      area_code: updated.area_code,
      revision: updated.revision,
    });
  } catch (err) {
    if (err.status) {
      const body = { message: err.message };
      if (err.valid_transitions) body.valid_transitions = err.valid_transitions;
      return res.status(err.status).json(body);
    }
    serverError(res, err, 'revisions.js');
  }
});

// POST /api/revisions/unlock/:itemId — admin-only unlock of a final item (G4).
// Body: { reason } (required). Write path: engine via unlockItem (mongo|pg).
router.post('/unlock/:itemId', requireAuth('admin'), async (req, res) => {
  try {
    const updated = await unlockItem({
      id: req.params.itemId,
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
