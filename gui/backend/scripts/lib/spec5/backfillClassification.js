// §5 — backfill classification from the clean-year map.
// Design Ref: §3.3 — fill only when empty; no guess when unmatched. Plan SC: SC-2.
function isEmptyCls(c) {
  return c === null || c === undefined || c === '';
}

// Returns { classification } when the doc is unclassified and the map has a
// non-empty value for its common_key; otherwise null (추측 금지 — '' 유지).
function backfillClassification(doc, classMap) {
  if (!doc || !isEmptyCls(doc.classification)) return null;
  const key = doc.common_key;
  if (!key || !classMap || !classMap.has(key)) return null;
  const cls = classMap.get(key);
  if (!cls) return null;
  return { classification: cls };
}

module.exports = { backfillClassification };
