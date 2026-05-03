const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// Get filter options (years, areas, subCategories)
router.get('/', async (req, res) => {
  try {
    const years = await ChecklistItem.distinct('metadata.year');
    const areas = await ChecklistItem.distinct('area');
    const subCategories = await ChecklistItem.distinct('sub_category');

    res.json({
      years: years.sort((a, b) => b - a),
      areas: areas.sort(),
      subCategories: subCategories.sort()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get unique item numbers for a specific Area
router.get('/item-numbers', async (req, res) => {
  try {
    const { area } = req.query;
    const query = area ? { area } : {};
    const itemNumbers = await ChecklistItem.distinct('about_item.item_number', query);
    res.json(itemNumbers.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
