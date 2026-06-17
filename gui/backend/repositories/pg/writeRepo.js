// SPEC-DB-001 Phase 4b · writeRepo knex impl (applyItemEdit). Atomic via knex.transaction.
// Single-item edit writes question/description to the PER-AREA override columns (never the
// shared item_content row) so editing one area does not mutate sibling areas. before/after
// snapshots use the EFFECTIVE values (COALESCE override, content) to match mongo semantics.
const { knex } = require('../../config/db')
const { base, cols, toLean, decodeId } = require('./itemQuery')
const { buildReasonFields } = require('../../utils/reason')
const { pickSnapshot, httpError } = require('../../services/revisionRules')

// mongo-style update keys -> PG checklist_item columns (question/description -> overrides).
const COLUMN_MAP = {
  question: 'question_override',
  description: 'description_override',
  field_specific_description: 'field_specific_description',
  score: 'score',
  classification: 'classification',
}

function whereRef(q, ref) {
  return q.where('ci.area_code', ref.area_code).where('ci.item_number', ref.item_number).where('ci.year', ref.year)
}

async function applyItemEdit({ id, updates, editTypes = [], rawReason, user, role, ip }) {
  const ref = decodeId(id)
  if (!ref) throw httpError('Invalid document ID format', 400)
  const k = knex()
  return k.transaction(async (trx) => {
    const erows = await whereRef(base(trx).select(cols(trx)), ref)
    if (!erows.length) throw httpError('Item not found', 404)
    const existing = toLean(erows[0])
    if (existing.revision.locked) throw httpError('Item is locked (final status). Unlock required.', 403)

    const set = { last_modified_user: user, last_modified_at: new Date() }
    for (const [key, col] of Object.entries(COLUMN_MAP)) {
      if (updates[key] !== undefined) set[col] = updates[key]
    }
    if (updates['revision.status'] !== undefined) set.rev_status = updates['revision.status']
    if ((existing.revision.status || 'none') === 'none' && set.rev_status === undefined) set.rev_status = 'draft'

    // Lock-guarded update (closes TOCTOU like mongo's findOneAndUpdate filter).
    const cnt = await trx('checklist_item')
      .where({ area_code: ref.area_code, item_number: ref.item_number, year: ref.year, locked: false })
      .update(set)
    if (cnt === 0) throw httpError('Item is locked (final status). Unlock required.', 403)

    const urows = await whereRef(base(trx).select(cols(trx)), ref)
    const updated = toLean(urows[0])
    const scoreChanged = updates.score !== undefined && updates.score !== existing.score
    const before = pickSnapshot(existing)
    const after = pickSnapshot(updated)
    const rf = buildReasonFields(rawReason)

    // edit_type_code (single FK) left null to avoid FK churn; edit_types jsonb is the source
    // of truth (005). content_hash = reason_hash; status_at_save preserved (005).
    await trx('item_revision').insert({
      item_number: existing.item_number, area_code: existing.area_code,
      common_key: existing.common_key, year: existing.year, revised_by: user,
      edit_types: JSON.stringify(editTypes), status_at_save: existing.revision.status || 'none',
      before_json: JSON.stringify(before), after_json: JSON.stringify(after),
      raw_reason: rf.raw_reason, content_hash: rf.reason_hash, score_changed: scoreChanged,
    })

    await trx('audit_log').insert({
      event: 'patch_item', actor: user, target: existing.item_number,
      detail: JSON.stringify({ role, item_number: existing.item_number, score_changed: scoreChanged, ip }),
    })

    return { updated, scoreChanged }
  })
}

module.exports = { applyItemEdit }
