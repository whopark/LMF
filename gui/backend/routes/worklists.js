const express = require('express');
const Worklist = require('../models/Worklist');

const router = express.Router();

function getUser(req) {
  const raw = req.headers['x-user'] || '';
  return raw ? decodeURIComponent(raw) : 'unknown';
}

// GET /api/worklists — current user's worklist (from x-user header)
router.get('/', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/worklists — save (upsert) current user's worklist
router.put('/', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/worklists — clear current user's worklist
router.delete('/', async (req, res) => {
  try {
    const user = getUser(req);
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    await Worklist.findOneAndUpdate(
      { user, year },
      { item_numbers: [], updated_at: new Date() }
    );
    res.json({ user, year, item_numbers: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
