const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// Allowed fields for PATCH updates
const ALLOWED_UPDATE_FIELDS = new Set([
  'about_item.question',
  'about_item.description',
  'about_item.score',
  'about_item.item_type',
]);

// 1. Get filter options
router.get('/filters', async (req, res) => {
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

// 2. Get unique item numbers for a specific Area
router.get('/filters/item-numbers', async (req, res) => {
  try {
    const { area } = req.query;
    const query = area ? { area } : {};
    const itemNumbers = await ChecklistItem.distinct('about_item.item_number', query);
    res.json(itemNumbers.sort());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get items with filtering & search
router.get('/items', async (req, res) => {
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

// 4. Get item by number (all versions over time)
router.get('/items/:number', async (req, res) => {
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

// 5. Update item by ID
router.patch('/items/:id', async (req, res) => {
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

// 6. Get year-over-year changes
router.get('/changes/:year', async (req, res) => {
  try {
    const targetYear = parseInt(req.params.year);
    const { area } = req.query;
    const prevYear = targetYear - 1;

    const baseQuery = area ? { area } : {};

    const [targetItems, prevItems] = await Promise.all([
      ChecklistItem.find({ ...baseQuery, 'metadata.year': targetYear }),
      ChecklistItem.find({ ...baseQuery, 'metadata.year': prevYear })
    ]);

    const prevMap = new Map();
    prevItems.forEach(item => {
      prevMap.set(item.about_item.item_number, item);
    });

    const changes = [];

    for (const current of targetItems) {
      const itemNum = current.about_item.item_number;
      const prev = prevMap.get(itemNum);

      if (!prev) {
        changes.push(buildNewItemChange(current, targetYear));
        continue;
      }

      const changeInfo = detectChanges(current, prev, targetYear, prevYear);
      if (changeInfo) {
        changes.push(changeInfo);
      }
    }

    // Find deleted items
    const currentNums = new Set(targetItems.map(i => i.about_item.item_number));
    for (const prev of prevItems) {
      if (!currentNums.has(prev.about_item.item_number)) {
        changes.push(buildDeletedItemChange(prev, prevYear));
      }
    }

    changes.sort((a, b) => a.item_number.localeCompare(b.item_number));

    res.json({
      targetYear,
      previousYear: prevYear,
      totalChanges: changes.length,
      newItems: changes.filter(c => c.change_type === 'NEW').length,
      modifiedItems: changes.filter(c => c.change_type === 'MODIFIED').length,
      deletedItems: changes.filter(c => c.change_type === 'DELETED').length,
      changes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function buildNewItemChange(current, targetYear) {
  return {
    item_number: current.about_item.item_number,
    area: current.area,
    sub_category: current.sub_category,
    change_type: 'NEW',
    summary: '신규 문항 추가',
    current: {
      year: targetYear,
      question: current.about_item.question,
      description: current.about_item.description,
      item_type: current.about_item.item_type,
      score: current.about_item.score
    },
    previous: null
  };
}

function buildDeletedItemChange(prev, prevYear) {
  return {
    item_number: prev.about_item.item_number,
    area: prev.area,
    sub_category: prev.sub_category,
    change_type: 'DELETED',
    summary: '문항 삭제됨',
    current: null,
    previous: {
      year: prevYear,
      question: prev.about_item.question,
      description: prev.about_item.description,
      item_type: prev.about_item.item_type,
      score: prev.about_item.score
    }
  };
}

function detectChanges(current, prev, targetYear, prevYear) {
  const questionChanged = current.about_item.question !== prev.about_item.question;
  const descChanged = current.about_item.description !== prev.about_item.description;
  const typeChanged = current.about_item.item_type !== prev.about_item.item_type;
  const scoreChanged = current.about_item.score !== prev.about_item.score;

  if (!questionChanged && !descChanged && !typeChanged && !scoreChanged) {
    return null;
  }

  const changeParts = [];
  if (questionChanged) changeParts.push('질문 변경');
  if (descChanged) changeParts.push('설명 변경');
  if (typeChanged) changeParts.push(`유형 변경 (${prev.about_item.item_type || '없음'} → ${current.about_item.item_type || '없음'})`);
  if (scoreChanged) changeParts.push(`배점 변경 (${prev.about_item.score || 0} → ${current.about_item.score || 0})`);

  return {
    item_number: current.about_item.item_number,
    area: current.area,
    sub_category: current.sub_category,
    change_type: 'MODIFIED',
    summary: changeParts.join(', '),
    current: {
      year: targetYear,
      question: current.about_item.question,
      description: current.about_item.description,
      item_type: current.about_item.item_type,
      score: current.about_item.score
    },
    previous: {
      year: prevYear,
      question: prev.about_item.question,
      description: prev.about_item.description,
      item_type: prev.about_item.item_type,
      score: prev.about_item.score
    }
  };
}

module.exports = router;
