const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// Get filter options (years, categories, sections)
router.get('/', async (req, res) => {
  try {
    const years = await ChecklistItem.distinct('year');
    const categories = await ChecklistItem.distinct('category');

    // Get unique section titles using aggregation
    const sections = await ChecklistItem.aggregate([
      { $unwind: '$structured_sections' },
      { $group: { _id: '$structured_sections.title' } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      years: years.sort((a, b) => b - a),
      areas: categories.sort(),
      subCategories: sections.map(s => s._id).filter(Boolean)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get unique item codes for a specific category
router.get('/item-numbers', async (req, res) => {
  try {
    const { area } = req.query;
    const match = area ? { category: area } : {};

    const itemCodes = await ChecklistItem.aggregate([
      { $match: match },
      { $unwind: '$structured_sections' },
      { $unwind: '$structured_sections.items' },
      { $group: { _id: '$structured_sections.items.item_code' } },
      { $sort: { _id: 1 } }
    ]);

    res.json(itemCodes.map(i => i._id).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
