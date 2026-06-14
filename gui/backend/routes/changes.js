const { serverError } = require('../utils/httpError');
const express = require('express');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { requireAuth } = require('../middleware/roles');
const { normalizeKo } = require('../utils/normalizeKo');

const router = express.Router();

// GET /api/changes/:year — year-over-year diff (G-Y1: viewer+ 인증)
router.get('/:year', requireAuth('viewer'), async (req, res) => {
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

    await attachVerbatimReasons(changes, targetYear); // G-Y4

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
    serverError(res, err, 'changes.js');
  }
});

// G-Y5: 6-field snapshot (분야특이 설명·해당없음 추가)
function itemSnapshot(item, year) {
  return {
    year,
    question: item.question || '',
    description: item.description || '',
    item_type: item.classification || '',
    score: item.score,
    field_specific_description: item.field_specific_description || '',
    na_available: item.na_available || false,
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

// G-Y5/G-Y6: 6-field diff with comparison-only Korean normalization for text fields.
function detectChanges(current, prev) {
  const parts = [];
  if (normalizeKo(current.question) !== normalizeKo(prev.question)) parts.push('질문 변경');
  if (normalizeKo(current.description) !== normalizeKo(prev.description)) parts.push('설명 변경');
  if (normalizeKo(current.field_specific_description) !== normalizeKo(prev.field_specific_description)) {
    parts.push('분야특이 설명 변경');
  }
  if ((current.classification || '') !== (prev.classification || '')) {
    parts.push(`유형 변경 (${prev.classification || '없음'} → ${current.classification || '없음'})`);
  }
  if (current.score !== prev.score) {
    parts.push(`배점 변경 (${prev.score || 0} → ${current.score || 0})`);
  }
  if ((current.na_available || false) !== (prev.na_available || false)) {
    parts.push(`해당없음 변경 (${prev.na_available ? '예' : '아니오'} → ${current.na_available ? '예' : '아니오'})`);
  }
  return parts.length ? parts.join(', ') : null;
}

// G-Y4: attach the latest target-year Revision.reason (verbatim) to each change.current.
// Single batch query (item_number $in) avoids N+1.
async function attachVerbatimReasons(changes, targetYear) {
  const codes = changes.filter(c => c.current).map(c => c.item_number);
  if (codes.length === 0) return;

  const revisions = await Revision.find({ year: targetYear, item_number: { $in: codes } })
    .sort({ at: -1 }).lean();

  const latest = new Map();
  for (const rev of revisions) {
    if (!latest.has(rev.item_number)) latest.set(rev.item_number, rev.reason || '');
  }
  for (const c of changes) {
    if (c.current && latest.has(c.item_number)) c.current.reason = latest.get(c.item_number);
  }
}

module.exports = router;
