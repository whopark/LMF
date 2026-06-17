// SPEC-DB-001 Phase 4b · writeRepo Mongoose impl (applyItemEdit; moved from revisionTxn.js).
// item update + revision + audit commit atomically via a replica-set session (G1).
const mongoose = require('mongoose')
const Item = require('../../models/Item')
const Revision = require('../../models/Revision')
const AuditLog = require('../../models/AuditLog')
const { withTransaction } = require('../../utils/withTransaction')
const { buildReasonFields } = require('../../utils/reason')
const { pickSnapshot, httpError } = require('../../services/revisionRules')

async function applyItemEdit({ id, updates, editTypes = [], rawReason, user, role, ip }) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw httpError('Invalid document ID format', 400)
  return withTransaction(async (session) => {
    const existing = await Item.findById(id).session(session).lean()
    if (!existing) throw httpError('Item not found', 404)

    const setUpdates = { ...updates, last_modified: { user, at: new Date() } }
    if ((existing.revision?.status || 'none') === 'none') setUpdates['revision.status'] = 'draft'

    // Atomic lock guard (G5): locked items return null instead of updating.
    const updated = await Item.findOneAndUpdate(
      { _id: id, 'revision.locked': { $ne: true } },
      { $set: setUpdates },
      { new: true, runValidators: true, session },
    ).lean()
    if (!updated) throw httpError('Item is locked (final status). Unlock required.', 403)

    const scoreChanged = updates.score !== undefined && updates.score !== existing.score

    await Revision.create([{
      item_number: existing.item_number, area_code: existing.area_code,
      common_key: existing.common_key, year: existing.year, user,
      edit_types: editTypes, ...buildReasonFields(rawReason),
      before: pickSnapshot(existing), after: pickSnapshot(updated),
      status_at_save: existing.revision?.status || 'none', score_changed: scoreChanged,
    }], { session })

    await AuditLog.create([{
      user, role, action: 'patch_item', resource_type: 'item', resource_id: String(id),
      details: { item_number: existing.item_number, score_changed: scoreChanged }, ip,
    }], { session })

    return { updated, scoreChanged }
  })
}

module.exports = { applyItemEdit }
