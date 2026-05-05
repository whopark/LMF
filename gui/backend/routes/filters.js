const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// Get filter options (years, categories, sections)
router.get('/', async (req, res) => {
  try {
    const years = await ChecklistItem.distinct('year');

    // Get unique categories with their display names from title field
    // Title format: "{code}.{name}_{year}" e.g., "01.검사실운영_2026"
    const categoriesWithNames = await ChecklistItem.aggregate([
      { $group: { _id: '$category', title: { $first: '$title' } } },
      { $sort: { _id: 1 } }
    ]);

    // Extract display name from title (remove code prefix and year suffix)
    const areas = categoriesWithNames.map(cat => {
      const title = cat.title || '';
      // Parse "01.검사실운영_2026" -> "검사실운영"
      const match = title.match(/^\d+\.(.+?)_\d+$/);
      const name = match ? match[1] : cat._id;
      return { code: cat._id, name };
    });

    // Get unique section titles using aggregation
    const sections = await ChecklistItem.aggregate([
      { $unwind: '$structured_sections' },
      { $group: { _id: '$structured_sections.title' } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      years: years.sort((a, b) => b - a),
      areas,
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
