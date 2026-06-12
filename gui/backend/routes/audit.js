const { serverError } = require('../utils/httpError');
const express = require('express');
const AuditLog = require('../models/AuditLog');
const { requireAuth } = require('../middleware/roles');

const router = express.Router();

// GET /api/audit — search audit logs (admin only)
router.get('/', requireAuth('admin'), async (req, res) => {
  try {
    const { user, action, resource_type, page = 1, limit = 100 } = req.query;

    const query = {};
    if (user) query.user = new RegExp(String(user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    if (action) query.action = action;
    if (resource_type) query.resource_type = resource_type;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ at: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean();

    res.json({ logs, total, page: safePage, totalPages: Math.ceil(total / safeLimit) });
  } catch (err) {
    serverError(res, err, 'audit.js');
  }
});

module.exports = router;
