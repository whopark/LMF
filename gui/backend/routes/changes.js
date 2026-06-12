const express = require('express');
const Item = require('../models/Item');

const router = express.Router();

// GET /api/changes/:year — year-over-year diff
router.get('/:year', async (req, res) => {
  try {
    const targetYear = parseInt(req.params.year);
    const { area } = req.query;
    const prevYear = targetYear - 1;

    const baseQuery = area ? { area_code: area } : {};

    const [targetItems, prevItems] = await Promise.all([
      Item.find({ year: targetYear, ...baseQuery }).lean(),
      Item.find({ year: prevYear, ...baseQuery }).lean(),
    ]);

    const prevMap = new Map(prevItems.map(i => [i.item_number, i]));
    const changes = [];

    for (const current of targetItems) {
      if (!current.item_number) continue;
      const prev = prevMap.get(current.item_number);

      if (!prev) {
        changes.push(buildChange('NEW', current, null, targetYear, prevYear));
        continue;
      }

      const diff = detectChanges(current, prev);
      if (diff) changes.push(buildChange('MODIFIED', current, prev, targetYear, prevYear, diff));
    }

    const currentCodes = new Set(targetItems.map(i => i.item_number).filter(Boolean));
    for (const prev of prevItems) {
      if (prev.item_number && !currentCodes.has(prev.item_number)) {
        changes.push(buildChange('DELETED', null, prev, targetYear, prevYear));
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
      changes,
    });
  } catch (err) {
    console.error('Changes API error:', err);
    res.status(500).json({ error: err.message });
  }
});

function itemSnapshot(item, year) {
  return {
    year,
    question: item.question || '',
    description: item.description || '',
    item_type: item.classification || '',
    score: item.score,
  };
}

function buildChange(type, current, prev, targetYear, prevYear, summary) {
  const ref = current || prev;
  return {
    item_number: ref.item_number,
    area: ref.area_code,
    sub_category: ref.sub_category,
    change_type: type,
    summary: summary || (type === 'NEW' ? '신규 문항 추가' : '문항 삭제됨'),
    current: current ? itemSnapshot(current, targetYear) : null,
    previous: prev ? itemSnapshot(prev, prevYear) : null,
  };
}

function detectChanges(current, prev) {
  const parts = [];
  if ((current.question || '') !== (prev.question || '')) parts.push('질문 변경');
  if ((current.description || '') !== (prev.description || '')) parts.push('설명 변경');
  if ((current.classification || '') !== (prev.classification || '')) {
    parts.push(`유형 변경 (${prev.classification || '없음'} → ${current.classification || '없음'})`);
  }
  if (current.score !== prev.score) {
    parts.push(`배점 변경 (${prev.score || 0} → ${current.score || 0})`);
  }
  return parts.length ? parts.join(', ') : null;
}

module.exports = router;
