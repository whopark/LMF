// §5 데이터 오염 정제 — 2020 병합추출 질문/설명 분리.
// Design Ref: §3.1 — pure, idempotent guard. Plan SC: SC-1.
const BULLET = /[∙•]/;

function isEmpty(s) {
  return s === null || s === undefined || String(s).trim() === '';
}

// Split a merged question into { question, description } at the first ∙/• bullet.
// Returns null (no change) when: description already present, no bullet in the
// question, or the split would leave the question empty (안전 — 원본 파괴 방지).
function splitMerged(doc) {
  if (!doc || !isEmpty(doc.description)) return null;
  const q = String(doc.question || '');
  const i = q.search(BULLET);
  if (i < 0) return null;
  const question = q.slice(0, i).trim();
  const description = q.slice(i).trim();
  if (!question) return null;
  return { question, description };
}

module.exports = { splitMerged };
