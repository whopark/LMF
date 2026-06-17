// SPEC-DB-001 Phase 4b · writeRepo Mongoose impl. item update + revision + audit commit
// atomically via a replica-set session (G1). applyItemEdit (4b-1), applyCommonEdit (4b-2).
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

// G1 + G7: bulk propagation across a common_key. `updates` is pre-filtered to the shared
// fields by the facade; every unlocked item update + revision commits atomically.
async function applyCommonEdit({ key, areaCodes, year, updates, editTypes = [], rawReason, user }) {
  const reasonFields = buildReasonFields(rawReason)
  return withTransaction(async (session) => {
    const query = { common_key: key }
    if (Array.isArray(areaCodes) && areaCodes.length > 0) query.area_code = { $in: areaCodes }
    // G-1: scope propagation to the edited year so past years are never overwritten.
    if (year !== undefined && year !== null) query.year = Number(year)

    const targets = await Item.find(query).session(session).lean()
    if (targets.length === 0) throw httpError('No items found for this common_key', 404)

    const result = { updated: [], skipped_locked: [] }
    for (const item of targets) {
      if (item.revision?.locked) { result.skipped_locked.push(item.item_number); continue }

      const before = pickSnapshot(item)
      const itemUpdates = {
        ...updates, last_modified: { user, at: new Date() },
        ...(item.revision?.status === 'none' ? { 'revision.status': 'draft' } : {}),
      }
      await Item.findByIdAndUpdate(item._id, { $set: itemUpdates }, { session })

      await Revision.create([{
        item_number: item.item_number, area_code: item.area_code, common_key: key,
        year: item.year, user, edit_types: editTypes, ...reasonFields,
        before, after: { ...before, ...updates },
        status_at_save: item.revision?.status || 'none',
        score_changed: updates.score !== undefined && updates.score !== before.score,
      }], { session })

      result.updated.push(item.item_number)
    }
    return result
  })
}

module.exports = { applyItemEdit, applyCommonEdit }
