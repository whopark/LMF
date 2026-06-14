// §5 잔여 — 질문에 혼입된 답안/분류 마커(bleed) 정제. question만 수정.
// Design Ref: §2 — targeted guard + embed 제거 + '?' 절단. Plan SC: SC-B1.
const GUARD = /예\s*\(\s*(?:필수|필요|기본)\s*\)|\?\s*\(\s*(?:필수|필요|기본)\s*\)/;
const EMBED = /예\s*\(\s*(?:필수|필요|기본)\s*\)/g;

// Returns { question } when the question carries an answer-marker bleed, else null.
// Targeted: non-bleed questions (incl. 2020 merges) are left untouched.
function cleanBleed(question) {
  const orig = String(question ?? '');
  if (!GUARD.test(orig)) return null;
  let q = orig.replace(EMBED, ' ');     // 2025형: "예 (필수)" 임베드 제거
  const i = q.indexOf('?');             // 2021형: '?' 뒤 잔여물(마커·중복설명) 절단
  if (i >= 0) q = q.slice(0, i + 1);
  q = q.replace(/\s+/g, ' ').trim();
  return q && q !== orig ? { question: q } : null;
}

module.exports = { cleanBleed, BLEED_GUARD: GUARD };
