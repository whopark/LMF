const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

const ALLOWED_UPDATE_FIELDS = new Set([
  'about_item.question',
  'about_item.description',
  'about_item.score',
  'about_item.item_type',
]);

// Get items with filtering & search
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, area, sub_category, year, search } = req.query;

    const query = {};
    if (area) query['area'] = area;
    if (sub_category) query['sub_category'] = sub_category;
    if (year) query['metadata.year'] = parseInt(year);

    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escaped, 'i');
      query['$or'] = [
        { 'about_item.item_number': searchRegex },
        { 'about_item.question': searchRegex },
        { 'about_item.description': searchRegex }
      ];
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const safePage = Math.max(parseInt(page) || 1, 1);

    const items = await ChecklistItem.find(query)
      .sort({ 'metadata.year': -1, 'about_item.item_number': 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

    const total = await ChecklistItem.countDocuments(query);

    res.json({
      items,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get item by number (all versions over time)
router.get('/:number', async (req, res) => {
  try {
    const { number } = req.params;
    const history = await ChecklistItem.find({ 'about_item.item_number': number })
      .sort({ 'metadata.year': -1 });

    if (history.length === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update item by ID
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const updates = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    if ('about_item.score' in updates) {
      const n = Number(updates['about_item.score']);
      if (!Number.isFinite(n)) {
        return res.status(400).json({ message: "Invalid score" });
      }
      updates['about_item.score'] = n;
    }

    const updatedItem = await ChecklistItem.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.json(updatedItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
