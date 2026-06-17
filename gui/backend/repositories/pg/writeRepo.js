// SPEC-DB-001 Phase 4b · writeRepo knex impl. Atomic via knex.transaction.
// applyItemEdit (4b-1): single-area edit → per-area override columns (shared item_content
// untouched). applyCommonEdit (4b-2): common propagation → shared item_content 1 row +
// override clear (AC-2), per-area score, locked siblings pinned. before/after snapshots use
// EFFECTIVE values (COALESCE override, content) to match mongo semantics.
const { knex } = require('../../config/db')
const { base, cols, toLean, decodeId } = require('./itemQuery')
const { buildReasonFields } = require('../../utils/reason')
const { hasRole } = require('../../middleware/roles')
const { isValidTransition, getStatusUpdates, VALID_TRANSITIONS } = require('../../utils/revisionState')
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

function pkWhere(ref) {
  return { area_code: ref.area_code, item_number: ref.item_number, year: ref.year }
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
    const cnt = await trx('checklist_item').where({ ...pkWhere(ref), locked: false }).update(set)
    if (cnt === 0) throw httpError('Item is locked (final status). Unlock required.', 403)

    const updated = toLean((await whereRef(base(trx).select(cols(trx)), ref))[0])
    const scoreChanged = updates.score !== undefined && updates.score !== existing.score
    await insertRevision(trx, existing, pickSnapshot(existing), pickSnapshot(updated), editTypes, rawReason, user, scoreChanged)
    await insertAudit(trx, 'patch_item', user, existing.item_number, { role, score_changed: scoreChanged, ip })
    return { updated, scoreChanged }
  })
}

// G1 + G7: bulk propagation. `updates` is pre-filtered to COMMON_SHARED_FIELDS by the facade.
async function applyCommonEdit({ key, areaCodes, year, updates, editTypes = [], rawReason, user }) {
  const k = knex()
  const hasAreaScope = Array.isArray(areaCodes) && areaCodes.length > 0
  const qChange = updates.question !== undefined
  const dChange = updates.description !== undefined
  const sChange = updates.score !== undefined

  return k.transaction(async (trx) => {
    let tq = base(trx).select(cols(trx)).where('ci.common_key', key)
    if (year !== undefined && year !== null) tq = tq.where('ci.year', Number(year))
    if (hasAreaScope) tq = tq.whereIn('ci.area_code', areaCodes)
    const targets = (await tq.orderBy('ci.area_code', 'asc')).map(toLean)
    if (targets.length === 0) throw httpError('No items found for this common_key', 404)

    const result = { updated: [], skipped_locked: [] }
    const live = []
    for (const t of targets) {
      if (t.revision.locked) result.skipped_locked.push(t.item_number)
      else live.push(t)
    }
    if (live.length === 0) return result

    // AC-2: full-scope question/description propagate via the shared item_content 1 row.
    if ((qChange || dChange) && !hasAreaScope) {
      // Pin locked siblings (override = current effective value) so the shared update skips them.
      for (const t of targets) {
        if (!t.revision.locked) continue
        const pin = {}
        if (qChange) pin.question_override = t.question
        if (dChange) pin.description_override = t.description
        await trx('checklist_item').where(pkWhere(t)).update(pin)
      }
      const contentSet = {}
      if (qChange) contentSet.question = updates.question
      if (dChange) contentSet.description = updates.description
      for (const y of [...new Set(live.map(t => t.year))]) {
        await trx('item_content').where({ common_key: key, year: y }).update(contentSet)
      }
    }

    for (const t of live) {
      const set = { last_modified_user: user, last_modified_at: new Date() }
      if (sChange) set.score = updates.score
      // full scope: clear override → follow shared content; subset: set override on this area.
      if (qChange) set.question_override = hasAreaScope ? updates.question : null
      if (dChange) set.description_override = hasAreaScope ? updates.description : null
      if ((t.revision.status || 'none') === 'none') set.rev_status = 'draft'
      await trx('checklist_item').where(pkWhere(t)).update(set)

      const before = pickSnapshot(t)
      const after = { ...before }
      if (qChange) after.question = updates.question
      if (dChange) after.description = updates.description
      if (sChange) after.score = updates.score
      await insertRevision(trx, t, before, after, editTypes, rawReason, user,
        sChange && updates.score !== before.score)
      result.updated.push(t.item_number)
    }
    return result
  })
}

// edit_type_code (single FK) left null to avoid FK churn; edit_types jsonb is source of truth (005).
async function insertRevision(trx, item, before, after, editTypes, rawReason, user, scoreChanged) {
  const rf = buildReasonFields(rawReason)
  await trx('item_revision').insert({
    item_number: item.item_number, area_code: item.area_code, common_key: item.common_key,
    year: item.year, revised_by: user, edit_types: JSON.stringify(editTypes),
    status_at_save: item.revision.status || 'none',
    before_json: JSON.stringify(before), after_json: JSON.stringify(after),
    raw_reason: rf.raw_reason, content_hash: rf.reason_hash, score_changed: scoreChanged,
  })
}

async function insertAudit(trx, event, actor, target, detail) {
  await trx('audit_log').insert({
    event, actor, target, detail: JSON.stringify({ item_number: target, ...detail }),
  })
}

// G4: admin unlock — clear lock, return to 'review', audit the reason.
async function unlockItem({ id, rawReason, user, role }) {
  const ref = decodeId(id)
  if (!ref) throw httpError('Invalid item ID', 400)
  const k = knex()
  return k.transaction(async (trx) => {
    const rows = await whereRef(base(trx).select(cols(trx)), ref)
    if (!rows.length) throw httpError('Item not found', 404)
    const existing = toLean(rows[0])
    if (!existing.revision.locked) throw httpError('Item is not locked', 400)

    await trx('checklist_item').where(pkWhere(ref)).update({ locked: false, rev_status: 'review' })
    await insertAudit(trx, 'unlock', user, existing.item_number, { role, reason: String(rawReason ?? '') })
    return toLean((await whereRef(base(trx).select(cols(trx)), ref))[0])
  })
}

// G5: workflow status transition with an atomic status+lock guard (TOCTOU-safe).
async function transitionItem({ id, to, role }) {
  const ref = decodeId(id)
  if (!ref) throw httpError('Invalid item ID', 400)
  const k = knex()
  return k.transaction(async (trx) => {
    const rows = await whereRef(base(trx).select(cols(trx)), ref)
    if (!rows.length) throw httpError('Item not found', 404)
    const cur = toLean(rows[0])
    const from = cur.revision.status || 'none'
    if (cur.revision.locked) throw httpError('Item is locked (final). Only admin unlock allowed.', 403)
    if (to === 'final' && !hasRole(role, 'approver')) throw httpError('Transition to final requires approver role or above', 403)
    if (!isValidTransition(from, to)) {
      throw httpError(`Invalid transition: ${from} → ${to}`, 400, { valid_transitions: VALID_TRANSITIONS[from] || [] })
    }
    // Translate the mongo-keyed getStatusUpdates() to PG columns.
    const mongoSet = getStatusUpdates(to)
    const set = { rev_status: mongoSet['revision.status'] }
    if ('revision.locked' in mongoSet) set.locked = mongoSet['revision.locked']
    if ('revision.revised' in mongoSet) set.revised = mongoSet['revision.revised']

    const cnt = await trx('checklist_item')
      .where({ ...pkWhere(ref), rev_status: from, locked: false }).update(set)
    if (cnt === 0) throw httpError('Item state changed concurrently — please retry', 409)
    return toLean((await whereRef(base(trx).select(cols(trx)), ref))[0])
  })
}

module.exports = { applyItemEdit, applyCommonEdit, unlockItem, transitionItem }
