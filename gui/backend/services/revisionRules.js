// SPEC-DB-001 Phase 4 · pure revision rules shared by mongo & pg write repos (no DB access).
// Extracted from revisionTxn.js so both engine write repos and the facade reuse them
// without a circular dependency.

// Fields captured in a Revision before/after snapshot.
const SNAPSHOT_FIELDS = ['question', 'description', 'score', 'classification', 'na_available']

// Fields propagated to common items (G7). field_specific_description is intentionally absent:
// it is a per-area override and must never be overwritten by propagation.
const COMMON_SHARED_FIELDS = ['question', 'description', 'score']

function pickSnapshot(doc) {
  const snap = {}
  for (const f of SNAPSHOT_FIELDS) snap[f] = doc[f]
  return snap
}

function httpError(message, status) {
  const e = new Error(message)
  e.status = status
  return e
}

module.exports = { SNAPSHOT_FIELDS, COMMON_SHARED_FIELDS, pickSnapshot, httpError }
