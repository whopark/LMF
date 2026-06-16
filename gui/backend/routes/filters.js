const { serverError } = require('../utils/httpError');
const express = require('express');
const Item = require('../models/Item');
const { areaCodeClause } = require('../utils/areaFilter');

const router = express.Router();

// GET /api/filters — return distinct years, areas, and sub_categories
router.get('/', async (req, res) => {
  try {
    const years = await Item.distinct('year');

    // Group by area_code, then collapse by area_name so a 분야 spanning multiple
    // codes (임상미생물 30~36, 수혈의학 40/43/46) appears once; code = joined group.
    const areaDocs = await Item.aggregate([
      { $group: { _id: '$area_code', name: { $first: '$area_name' } } },
      { $sort: { _id: 1 } },
    ]);
    const byName = new Map(); // name -> [codes] (insertion order = lowest code first)
    for (const a of areaDocs) {
      const name = a.name || a._id;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(a._id);
    }
    const areas = [...byName.entries()].map(([name, codes]) => ({ code: codes.join(','), name }));

    // 중분류 드롭다운: 가나다(.sort) 아닌 sub_category_order(10코드=심사점검표 순서) 정렬.
    // Design Ref: §5 — 분류당 order는 단일(통합 후); min은 방어적, 동률은 _id(라벨) tie-break.
    const subCatDocs = await Item.aggregate([
      { $match: { sub_category: { $nin: [null, ''] } } },
      { $group: { _id: '$sub_category', ord: { $min: '$sub_category_order' } } },
      { $sort: { ord: 1, _id: 1 } },
    ]);
    const subCategories = subCatDocs.map(d => d._id);

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
    const clause = areaCodeClause(area);
    const query = clause !== undefined ? { area_code: clause } : {};

    const numbers = await Item.distinct('item_number', query);
    res.json(numbers.filter(Boolean).sort());
  } catch (err) {
    serverError(res, err, 'filters.js');
  }
});

module.exports = router;
