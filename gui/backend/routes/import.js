const express = require('express');
const Item = require('../models/Item');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');

const router = express.Router();

// POST /api/import/bulk — bulk import flat Item documents (admin only)
router.post('/bulk', requireAuth('admin'), async (req, res) => {
  try {
    const { documents, clearExisting } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ message: 'documents array required' });
    }

    if (clearExisting) {
      const del = await Item.deleteMany({});
      console.log(`[Import] Cleared ${del.deletedCount} existing items`);
    }

    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const result = await Item.insertMany(batch, { ordered: false });
      inserted += result.length;
    }

    const count = await Item.countDocuments();
    const years = await Item.distinct('year');
    const categories = await Item.distinct('area_code');

    res.json({
      success: true,
      message: 'Import completed',
      stats: {
        documentsReceived: documents.length,
        documentsInserted: inserted,
        totalInDB: count,
        years: years.sort((a, b) => a - b),
        categories: categories.sort(),
      },
    });
  } catch (err) {
    serverError(res, err, 'POST /import/bulk');
  }
});

// GET /api/import/status — current database stats (viewer+)
router.get('/status', requireAuth('viewer'), async (req, res) => {
  try {
    const count = await Item.countDocuments();
    const years = await Item.distinct('year');
    const categories = await Item.distinct('area_code');

    const yearCounts = await Item.aggregate([
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      totalDocuments: count,
      years: years.sort((a, b) => a - b),
      categories: categories.sort(),
      documentsPerYear: yearCounts.map(y => ({ year: y._id, count: y.count })),
    });
  } catch (err) {
    serverError(res, err, 'GET /import/status');
  }
});

module.exports = router;
