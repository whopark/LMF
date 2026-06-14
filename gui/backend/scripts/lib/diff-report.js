// Diff report generator: flat JSON vs current MongoDB checklist_items collection
// Plan SC: SC-3 — diff report with zero-vanishing-items gate

/**
 * Build a diff between flat items (from ETL JSON) and DB items (from MongoDB).
 * Key: (item_number, year) — unique per item per year.
 *
 * Returns:
 *   { added, removed, changed, summary, markdownReport }
 */
function buildDiff(flatItems, dbItems) {
  const flatMap = new Map();
  for (const item of flatItems) {
    flatMap.set(`${item.item_number}|${item.year}`, item);
  }

  const dbMap = new Map();
  for (const item of dbItems) {
    dbMap.set(`${item.item_number}|${item.year}`, item);
  }

  const added = [];    // in flat, not in db (new items)
  const removed = [];  // in db, not in flat (would be lost on import)
  const changed = [];  // in both, but fields differ

  for (const [key, flat] of flatMap) {
    if (!dbMap.has(key)) {
      added.push({ item_number: flat.item_number, year: flat.year, area_code: flat.area_code });
    } else {
      const db = dbMap.get(key);
      const diffs = _fieldDiffs(flat, db);
      if (diffs.length > 0) {
        changed.push({ item_number: flat.item_number, year: flat.year, area_code: flat.area_code, diffs });
      }
    }
  }

  for (const [key, db] of dbMap) {
    if (!flatMap.has(key)) {
      removed.push({ item_number: db.item_number, year: db.year, area_code: db.area_code });
    }
  }

  const summary = {
    flatTotal: flatItems.length,
    dbTotal: dbItems.length,
    added: added.length,
    removed: removed.length,
    changed: changed.length,
  };

  return { added, removed, changed, summary, markdownReport: renderDiffMarkdown({ added, removed, changed, summary }) };
}

const TEXT_FIELDS = ['question', 'description', 'classification', 'na_available', 'score'];

function _fieldDiffs(flat, db) {
  const diffs = [];
  for (const field of TEXT_FIELDS) {
    const fv = flat[field] ?? null;
    const dv = db[field] ?? null;
    const fStr = String(fv ?? '');
    const dStr = String(dv ?? '');
    if (fStr !== dStr) {
      diffs.push({ field, from: dStr.slice(0, 80), to: fStr.slice(0, 80) });
    }
  }
  return diffs;
}

function renderDiffMarkdown({ added, removed, changed, summary }) {
  const lines = [];
  lines.push('# ETL Diff Report');
  lines.push('');
  lines.push('## 요약');
  lines.push('');
  lines.push(`| 항목 | 건수 |`);
  lines.push(`|------|------|`);
  lines.push(`| flat.json 총 | ${summary.flatTotal.toLocaleString()} |`);
  lines.push(`| DB 현재 총 | ${summary.dbTotal.toLocaleString()} |`);
  lines.push(`| 신규 (flat에만 있음) | ${summary.added} |`);
  lines.push(`| **삭제됨 (DB에만 있음, import 후 소멸)** | **${summary.removed}** |`);
  lines.push(`| 내용 변경 | ${summary.changed} |`);

  if (summary.removed === 0) {
    lines.push('');
    lines.push('✅ **사라지는 문항 없음 — import 진행 가능**');
  } else {
    lines.push('');
    lines.push(`⚠️ **사라지는 문항 ${summary.removed}건 — import 전 검토 필요**`);
  }

  if (removed.length > 0) {
    lines.push('');
    lines.push('## 사라지는 문항 (전체 목록)');
    lines.push('');
    lines.push('| item_number | year | area_code |');
    lines.push('|-------------|------|-----------|');
    for (const r of removed) {
      lines.push(`| ${r.item_number} | ${r.year} | ${r.area_code} |`);
    }
  }

  if (changed.length > 0) {
    const sample = changed.slice(0, 20);
    lines.push('');
    lines.push(`## 내용 변경 샘플 (${Math.min(20, changed.length)}/${changed.length}건)`);
    for (const c of sample) {
      lines.push('');
      lines.push(`**${c.item_number}** (year=${c.year})`);
      for (const d of c.diffs) {
        lines.push(`- \`${d.field}\`: \`${d.from}\` → \`${d.to}\``);
      }
    }
  }

  return lines.join('\n');
}

module.exports = { buildDiff };
