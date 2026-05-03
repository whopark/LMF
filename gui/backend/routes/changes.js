const express = require('express');
const ChecklistItem = require('../models/ChecklistItem');

const router = express.Router();

// Get year-over-year changes
router.get('/:year', async (req, res) => {
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
