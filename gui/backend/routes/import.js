const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// API Key middleware
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

// POST /api/import/bulk - Bulk import documents
router.post('/bulk', requireApiKey, async (req, res) => {
  try {
    const { documents, clearExisting } = req.body;

    if (!documents || !Array.isArray(documents)) {
      return res.status(400).json({ message: 'documents array required' });
    }

    // Clear existing data if requested
    if (clearExisting) {
      const deleteResult = await ChecklistItem.deleteMany({});
      console.log(`[Import] Cleared ${deleteResult.deletedCount} existing documents`);
    }

    // Insert documents in batches to avoid timeout
    const batchSize = 10;
    let inserted = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const result = await ChecklistItem.insertMany(batch, { ordered: false });
      inserted += result.length;
    }

    // Verify
    const count = await ChecklistItem.countDocuments();
    const years = await ChecklistItem.distinct('year');
    const categories = await ChecklistItem.distinct('category');

    res.json({
      success: true,
      message: 'Import completed',
      stats: {
        documentsReceived: documents.length,
        documentsInserted: inserted,
        totalInDB: count,
        years: years.sort((a, b) => a - b),
        categories: categories.sort(),
      }
    });

  } catch (err) {
    console.error('[Import] Error:', err);
    res.status(500).json({ message: 'Import failed', error: err.message });
  }
});

// GET /api/import/status - Check current database status
router.get('/status', async (req, res) => {
  try {
    const count = await ChecklistItem.countDocuments();
    const years = await ChecklistItem.distinct('year');
    const categories = await ChecklistItem.distinct('category');

    // Count items per year
    const yearCounts = await ChecklistItem.aggregate([
      { $group: { _id: '$year', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalDocuments: count,
      years: years.sort((a, b) => a - b),
      categories: categories.sort(),
      documentsPerYear: yearCounts.map(y => ({ year: y._id, count: y.count }))
    });

  } catch (err) {
    res.status(500).json({ message: 'Status check failed', error: err.message });
  }
});

module.exports = router;
