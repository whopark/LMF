const { serverError } = require('../utils/httpError');
const express = require('express');
const Item = require('../models/Item');

const router = express.Router();

// GET /api/filters — return distinct years, areas, and sub_categories
router.get('/', async (req, res) => {
  try {
    const years = await Item.distinct('year');

    const areaDocs = await Item.aggregate([
      { $group: { _id: '$area_code', name: { $first: '$area_name' } } },
      { $sort: { _id: 1 } },
    ]);
    const areas = areaDocs.map(a => ({ code: a._id, name: a.name || a._id }));

    const subCategoryValues = await Item.distinct('sub_category');
    const subCategories = subCategoryValues.filter(Boolean).sort();

    res.json({
      years: years.filter(Boolean).sort((a, b) => b - a),
      areas,
      subCategories,
    });
  } catch (err) {
    serverError(res, err, 'filters.js');
  }
});

// GET /api/filters/item-numbers — distinct item numbers, optionally by area
router.get('/item-numbers', async (req, res) => {
  try {
    const { area } = req.query;
    const query = area ? { area_code: area } : {};

    const numbers = await Item.distinct('item_number', query);
    res.json(numbers.filter(Boolean).sort());
  } catch (err) {
    serverError(res, err, 'filters.js');
  }
});

module.exports = router;
