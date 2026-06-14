// Design Ref: §4 (G-Y6) — comparison-only Korean normalization for year-over-year diff.
// Used ONLY to decide whether a field changed; display/stored text keeps the original
// (심사점검표 원문의 ∙·따옴표 보존). Plan SC-Y5: pure whitespace/bullet/newline diffs
// must not be flagged as MODIFIED.
function normalizeKo(text) {
  return String(text ?? '')
    .normalize('NFC')          // 한글 자모 합성 통일
    .replace(/[•∙ㆍ·]/g, '·')   // bullet 기호 통일
    .replace(/\s+/g, ' ')      // 공백/개행 축약
    .trim();
}

module.exports = { normalizeKo };
