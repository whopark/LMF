const express = require('express');
const Worklist = require('../models/Worklist');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');

const router = express.Router();

// Use JWT-authenticated user name; x-user header no longer accepted for writes
function getUser(req) {
  return req.user?.name || 'unknown';
}

// GET /api/worklists — current user's worklist (viewer+)
router.get('/', requireAuth('viewer'), async (req, res) => {
  try {
    const user = getUser(req);
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    const worklist = await Worklist.findOne({ user, year }).lean();
    res.json({
      user,
      year,
      item_numbers: worklist?.item_numbers || [],
      updated_at: worklist?.updated_at || null,
    });
  } catch (err) {
    serverError(res, err, 'GET /worklists');
  }
});

// PUT /api/worklists — save worklist (editor+, must be own data)
router.put('/', requireAuth('editor'), async (req, res) => {
  try {
    const user = getUser(req);
    const { item_numbers = [], year = new Date().getFullYear() } = req.body;

    if (!Array.isArray(item_numbers)) {
      return res.status(400).json({ message: 'item_numbers must be an array' });
    }

    const worklist = await Worklist.findOneAndUpdate(
      { user, year: parseInt(year) },
      { item_numbers, updated_at: new Date() },
      { upsert: true, new: true }
    ).lean();

    res.json({ user, year: worklist.year, item_numbers: worklist.item_numbers });
  } catch (err) {
    serverError(res, err, 'PUT /worklists');
  }
});

// DELETE /api/worklists — clear own worklist (editor+)
router.delete('/', requireAuth('editor'), async (req, res) => {
  try {
    const user = getUser(req);
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    await Worklist.findOneAndUpdate(
      { user, year },
      { item_numbers: [], updated_at: new Date() }
    );
    res.json({ user, year, item_numbers: [] });
  } catch (err) {
    serverError(res, err, 'DELETE /worklists');
  }
});

module.exports = router;
