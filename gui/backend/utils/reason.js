// Design Ref: §4 — verbatim reason storage (G2). raw_reason is the source of truth;
// reason mirrors it for backward-compat (export/frontend); reason_hash (SHA-256) detects tampering.
const crypto = require('crypto');

// SHA-256 hex digest of the given text (null/undefined treated as empty string).
function hashReason(text) {
  return crypto.createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

// Build the verbatim reason fields for a Revision.
// Plan SC-2: no trim, no summarization — store byte-for-byte as entered.
function buildReasonFields(rawInput) {
  const raw = rawInput === null || rawInput === undefined ? '' : String(rawInput);
  return { raw_reason: raw, reason: raw, reason_hash: hashReason(raw) };
}

// Verify a revision's raw_reason still matches its stored hash.
function verifyReason(revision) {
  if (!revision) return false;
  return hashReason(revision.raw_reason ?? '') === revision.reason_hash;
}

module.exports = { hashReason, buildReasonFields, verifyReason };
