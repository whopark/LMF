const express = require('express');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');
const worklistRepo = require('../repositories/worklistRepo');

const router = express.Router();

// Use JWT-authenticated user name; x-user header no longer accepted for writes
function getUser(req) {
  return req.user?.name || 'unknown';
}

// GET /api/worklists — current user's worklist (viewer+). Engine via worklistRepo factory.
router.get('/', requireAuth('viewer'), async (req, res) => {
  try {
    const user = getUser(req);
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    const { item_numbers, updated_at } = await worklistRepo.get(user, year);
    res.json({ user, year, item_numbers, updated_at });
  } catch (err) {
    serverError(res, err, 'GET /worklists');
  }
});

// PUT /api/worklists — save worklist (editor+, own data only)
router.put('/', requireAuth('editor'), async (req, res) => {
  try {
    const user = getUser(req);
    const { item_numbers = [], year = new Date().getFullYear() } = req.body;

    if (!Array.isArray(item_numbers)) {
      return res.status(400).json({ message: 'item_numbers must be an array' });
    }

    const saved = await worklistRepo.set(user, parseInt(year), item_numbers);
    res.json({ user, year: saved.year, item_numbers: saved.item_numbers });
  } catch (err) {
    serverError(res, err, 'PUT /worklists');
  }
});

// DELETE /api/worklists — clear own worklist (editor+)
router.delete('/', requireAuth('editor'), async (req, res) => {
  try {
    const user = getUser(req);
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();
    await worklistRepo.clear(user, year);
    res.json({ user, year, item_numbers: [] });
  } catch (err) {
    serverError(res, err, 'DELETE /worklists');
  }
});

module.exports = router;
