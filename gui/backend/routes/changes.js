const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// Helper function to flatten items using aggregation pipeline
async function getFlattenedItems(year, area) {
  const match = { year: parseInt(year) };
  if (area) match.category = area;

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
        item_code: '$structured_sections.items.item_code',
        requirement: '$structured_sections.items.requirement',
        raw_line: '$structured_sections.items.raw_line',
        max_score: '$structured_sections.items.max_score',
        item_type: '$structured_sections.items.type'
      }
    }
  ];

  return await ChecklistItem.aggregate(pipeline);
}

// Get year-over-year changes
router.get('/:year', async (req, res) => {
  try {
    const targetYear = parseInt(req.params.year);
    const { area } = req.query;
    const prevYear = targetYear - 1;

    // Get flattened items for both years using aggregation
    const [targetItems, prevItems] = await Promise.all([
      getFlattenedItems(targetYear, area),
      getFlattenedItems(prevYear, area)
    ]);

    // Build map of previous year items by item_code
    const prevMap = new Map();
    prevItems.forEach(item => {
      if (item.item_code) {
        prevMap.set(item.item_code, item);
      }
    });

    const changes = [];

    // Find NEW and MODIFIED items
    for (const current of targetItems) {
      if (!current.item_code) continue;

      const prev = prevMap.get(current.item_code);

      if (!prev) {
        changes.push(buildNewItemChange(current, targetYear));
        continue;
      }

      const changeInfo = detectChanges(current, prev, targetYear, prevYear);
      if (changeInfo) {
        changes.push(changeInfo);
      }
    }

    // Find DELETED items
    const currentCodes = new Set(targetItems.filter(i => i.item_code).map(i => i.item_code));
    for (const prev of prevItems) {
      if (prev.item_code && !currentCodes.has(prev.item_code)) {
        changes.push(buildDeletedItemChange(prev, prevYear));
      }
    }

    // Sort by item_code
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
    console.error('Changes API error:', err);
    res.status(500).json({ error: err.message });
  }
});

function buildNewItemChange(current, targetYear) {
  return {
    item_number: current.item_code,
    area: current.category,
    sub_category: current.section_title,
    change_type: 'NEW',
    summary: '신규 문항 추가',
    current: {
      year: targetYear,
      question: current.requirement || '',
      description: current.raw_line || '',
      item_type: current.item_type || '',
      score: current.max_score
    },
    previous: null
  };
}

function buildDeletedItemChange(prev, prevYear) {
  return {
    item_number: prev.item_code,
    area: prev.category,
    sub_category: prev.section_title,
    change_type: 'DELETED',
    summary: '문항 삭제됨',
    current: null,
    previous: {
      year: prevYear,
      question: prev.requirement || '',
      description: prev.raw_line || '',
      item_type: prev.item_type || '',
      score: prev.max_score
    }
  };
}

function detectChanges(current, prev, targetYear, prevYear) {
  const questionChanged = (current.requirement || '') !== (prev.requirement || '');
  const descChanged = (current.raw_line || '') !== (prev.raw_line || '');
  const typeChanged = (current.item_type || '') !== (prev.item_type || '');
  const scoreChanged = current.max_score !== prev.max_score;

  if (!questionChanged && !descChanged && !typeChanged && !scoreChanged) {
    return null;
  }

  const changeParts = [];
  if (questionChanged) changeParts.push('질문 변경');
  if (descChanged) changeParts.push('설명 변경');
  if (typeChanged) changeParts.push(`유형 변경 (${prev.item_type || '없음'} → ${current.item_type || '없음'})`);
  if (scoreChanged) changeParts.push(`배점 변경 (${prev.max_score || 0} → ${current.max_score || 0})`);

  return {
    item_number: current.item_code,
    area: current.category,
    sub_category: current.section_title,
    change_type: 'MODIFIED',
    summary: changeParts.join(', '),
    current: {
      year: targetYear,
      question: current.requirement || '',
      description: current.raw_line || '',
      item_type: current.item_type || '',
      score: current.max_score
    },
    previous: {
      year: prevYear,
      question: prev.requirement || '',
      description: prev.raw_line || '',
      item_type: prev.item_type || '',
      score: prev.max_score
    }
  };
}

module.exports = router;
