const { serverError } = require('../utils/httpError');
const express = require('express');
const { requireAuth } = require('../middleware/roles');
const auditRepo = require('../repositories/auditRepo');

const router = express.Router();

// GET /api/audit — search audit logs (admin only). Read via auditRepo factory (mongo|pg).
router.get('/', requireAuth('admin'), async (req, res) => {
  try {
    const safeLimit = Math.min(Math.max(parseInt(req.query.limit) || 100, 1), 500);
    const safePage = Math.max(parseInt(req.query.page) || 1, 1);
    const { logs, total } = await auditRepo.list(req.query, {
      skip: (safePage - 1) * safeLimit,
      limit: safeLimit,
    });
    res.json({ logs, total, page: safePage, totalPages: Math.ceil(total / safeLimit) });
  } catch (err) {
    serverError(res, err, 'audit.js');
  }
});

module.exports = router;
