const express = require('express');
const Item = require('../models/Item');

const router = express.Router();

// API Key middleware (local copy — import route predates shared middleware)
const requireApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const validKey = process.env.API_KEY;

  if (!validKey) {
    return res.status(500).json({ message: 'API_KEY not configured on server' });
  }
  if (!apiKey || apiKey !== validKey) {
    return res.status(401).json({ message: 'Invalid or missing API key' });
  }
  next();
};

// POST /api/import/bulk — bulk import flat Item documents
router.post('/bulk', requireApiKey, async (req, res) => {
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
    console.error('[Import] Error:', err);
    res.status(500).json({ message: 'Import failed', error: err.message });
  }
});

// GET /api/import/status — current database stats
router.get('/status', async (req, res) => {
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
    res.status(500).json({ message: 'Status check failed', error: err.message });
  }
});

module.exports = router;
