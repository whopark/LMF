const express = require('express');
const mongoose = require('mongoose');
const ChecklistItem = require('../models/ChecklistItem');
const { requireApiKey } = require('../middleware/auth');

const router = express.Router();

// Whitelist of fields allowed for PATCH updates
const ALLOWED_PATCH_FIELDS = ['about_item.score', 'status', 'tags', 'notes'];

// Get items with filtering & search (flattened from nested structure)
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, area, sub_category, year, search } = req.query;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);
    const safePage = Math.max(parseInt(page) || 1, 1);

    // Build match stage
    const match = {};
    if (area) match.category = area;
    if (year) match.year = parseInt(year);

    // Aggregation pipeline to flatten nested items
    const pipeline = [
      { $match: match },
      { $unwind: '$structured_sections' },
      { $unwind: '$structured_sections.items' },
      {
        $project: {
          _id: 1,
          year: 1,
          category: 1,
          title: 1,
          section_title: '$structured_sections.title',
          item: '$structured_sections.items'
        }
      }
    ];

    // Filter by section title (sub_category)
    if (sub_category) {
      pipeline.push({ $match: { section_title: sub_category } });
    }

    // Search filter
    if (search) {
      const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      pipeline.push({
        $match: {
          $or: [
            { 'item.item_code': { $regex: escaped, $options: 'i' } },
            { 'item.requirement': { $regex: escaped, $options: 'i' } },
            { 'item.raw_line': { $regex: escaped, $options: 'i' } }
          ]
        }
      });
    }

    // Count total before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await ChecklistItem.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Add pagination
    pipeline.push({ $skip: (safePage - 1) * safeLimit });
    pipeline.push({ $limit: safeLimit });

    const items = await ChecklistItem.aggregate(pipeline);

    // Transform to match expected frontend format
    const transformedItems = items.map(doc => ({
      _id: doc._id,
      area: doc.category,
      sub_category: doc.section_title,
      about_item: {
        item_number: doc.item.item_code || '',
        question: doc.item.requirement || '',
        description: doc.item.raw_line || '',
        score: doc.item.max_score,
        item_type: doc.item.type || '',
      },
      metadata: {
        year: doc.year,
        source: doc.title,
      }
    }));

    res.json({
      items: transformedItems,
      total,
      page: safePage,
      totalPages: Math.ceil(total / safeLimit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get documents (categories) list
router.get('/categories', async (req, res) => {
  try {
    const { year } = req.query;
    const match = year ? { year: parseInt(year) } : {};

    const docs = await ChecklistItem.find(match)
      .select('year category title total_items')
      .sort({ category: 1 });

    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get item by item_code
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;

    const pipeline = [
      { $unwind: '$structured_sections' },
      { $unwind: '$structured_sections.items' },
      { $match: { 'structured_sections.items.item_code': code } },
      {
        $project: {
          year: 1,
          category: 1,
          title: 1,
          section_title: '$structured_sections.title',
          item: '$structured_sections.items'
        }
      },
      { $sort: { year: -1 } }
    ];

    const results = await ChecklistItem.aggregate(pipeline);

    if (results.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const history = results.map(doc => ({
      _id: doc._id,
      area: doc.category,
      sub_category: doc.section_title,
      about_item: {
        item_number: doc.item.item_code || '',
        question: doc.item.requirement || '',
        description: doc.item.raw_line || '',
        score: doc.item.max_score,
        item_type: doc.item.type || '',
      },
      metadata: {
        year: doc.year,
        source: doc.title,
      }
    }));

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH item by document ObjectId (requires API key authentication)
router.patch('/:id', requireApiKey, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid document ID format' });
    }

    // Filter body to only allowed fields
    const updates = {};
    let hasValidFields = false;

    for (const field of ALLOWED_PATCH_FIELDS) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
        hasValidFields = true;
      }
    }

    if (!hasValidFields) {
      return res.status(400).json({
        message: 'No valid fields to update',
        allowed_fields: ALLOWED_PATCH_FIELDS
      });
    }

    // Build MongoDB update object using $set
    const updateDoc = { $set: updates };

    const doc = await ChecklistItem.findByIdAndUpdate(
      id,
      updateDoc,
      { new: true, runValidators: true }
    );

    if (!doc) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Return response in format matching GET endpoint
    res.json({
      _id: doc._id,
      area: doc.category,
      about_item: doc['about_item'] || { score: updates['about_item.score'] },
      metadata: {
        year: doc.year,
        source: doc.title
      },
      status: doc.status,
      tags: doc.tags,
      notes: doc.notes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
