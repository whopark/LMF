// Design Ref: §5.3 — transactional orchestration for revision writes (G1).
// All item mutations + revision logs + audit logs commit atomically so a failed
// revision write rolls back the item change (no history gaps). Plan SC-1.
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const AuditLog = require('../models/AuditLog');
const { withTransaction } = require('../utils/withTransaction');
const { buildReasonFields } = require('../utils/reason');
const { assertEditTypesAllowed } = require('../constants/sensitiveEditTypes');

// Fields captured in a Revision before/after snapshot.
const SNAPSHOT_FIELDS = ['question', 'description', 'score', 'classification', 'na_available'];

// Design Ref: §8 (G7) — fields propagated to common items. field_specific_description is
// intentionally absent: it is a per-area override and must never be overwritten by propagation.
const COMMON_SHARED_FIELDS = ['question', 'description', 'score'];

function pickSnapshot(doc) {
  const snap = {};
  for (const f of SNAPSHOT_FIELDS) snap[f] = doc[f];
  return snap;
}

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// G1: single-item edit — item update + revision + audit committed atomically.
async function applyItemEdit({ id, updates, editTypes = [], rawReason, user, role, ip }) {
  assertEditTypesAllowed(editTypes, role); // G6: sensitive types require approver+
  return withTransaction(async (session) => {
    const existing = await Item.findById(id).session(session).lean();
    if (!existing) throw httpError('Item not found', 404);

    const setUpdates = { ...updates, last_modified: { user, at: new Date() } };
    if ((existing.revision?.status || 'none') === 'none') setUpdates['revision.status'] = 'draft';

    // Atomic lock guard (G5): locked items return null instead of updating.
    const updated = await Item.findOneAndUpdate(
      { _id: id, 'revision.locked': { $ne: true } },
      { $set: setUpdates },
      { new: true, runValidators: true, session },
    ).lean();
    if (!updated) throw httpError('Item is locked (final status). Unlock required.', 403);

    const scoreChanged = updates.score !== undefined && updates.score !== existing.score;

    await Revision.create([{
      item_number: existing.item_number, area_code: existing.area_code,
      common_key: existing.common_key, year: existing.year, user,
      edit_types: editTypes, ...buildReasonFields(rawReason),
      before: pickSnapshot(existing), after: pickSnapshot(updated),
      status_at_save: existing.revision?.status || 'none', score_changed: scoreChanged,
    }], { session });

    await AuditLog.create([{
      user, role, action: 'patch_item', resource_type: 'item', resource_id: String(id),
      details: { item_number: existing.item_number, score_changed: scoreChanged }, ip,
    }], { session });

    return { updated, scoreChanged };
  });
}

// G1 + G7: bulk propagation across a common_key — every item update + revision commits atomically.
async function applyCommonEdit({ key, areaCodes, updates, editTypes = [], rawReason, user, role }) {
  assertEditTypesAllowed(editTypes, role); // G6: sensitive types require approver+
  const safeUpdates = {};
  for (const f of COMMON_SHARED_FIELDS) {
    if (updates[f] !== undefined) safeUpdates[f] = updates[f];
  }
  if (Object.keys(safeUpdates).length === 0) throw httpError('No valid fields to update', 400);

  const reasonFields = buildReasonFields(rawReason);

  return withTransaction(async (session) => {
    const query = { common_key: key };
    if (Array.isArray(areaCodes) && areaCodes.length > 0) query.area_code = { $in: areaCodes };

    const targets = await Item.find(query).session(session).lean();
    if (targets.length === 0) throw httpError('No items found for this common_key', 404);

    const result = { updated: [], skipped_locked: [] };
    for (const item of targets) {
      if (item.revision?.locked) { result.skipped_locked.push(item.item_number); continue; }

      const before = pickSnapshot(item);
      const itemUpdates = {
        ...safeUpdates, last_modified: { user, at: new Date() },
        ...(item.revision?.status === 'none' ? { 'revision.status': 'draft' } : {}),
      };
      await Item.findByIdAndUpdate(item._id, { $set: itemUpdates }, { session });

      await Revision.create([{
        item_number: item.item_number, area_code: item.area_code, common_key: key,
        year: item.year, user, edit_types: editTypes, ...reasonFields,
        before, after: { ...before, ...safeUpdates },
        status_at_save: item.revision?.status || 'none',
        score_changed: safeUpdates.score !== undefined && safeUpdates.score !== before.score,
      }], { session });

      result.updated.push(item.item_number);
    }
    return result;
  });
}

// G4: admin unlock — clears the lock, returns the item to 'review' so it can be re-finalized,
// and records the required reason in the audit log. Unlimited per Plan decision.
async function unlockItem({ id, rawReason, user, role, ip }) {
  const reason = rawReason === null || rawReason === undefined ? '' : String(rawReason);
  if (reason.trim().length === 0) throw httpError('Unlock reason is required', 400);

  return withTransaction(async (session) => {
    const existing = await Item.findById(id).session(session).lean();
    if (!existing) throw httpError('Item not found', 404);
    if (!existing.revision?.locked) throw httpError('Item is not locked', 400);

    const updated = await Item.findByIdAndUpdate(
      id,
      { $set: { 'revision.locked': false, 'revision.status': 'review' } },
      { new: true, session },
    ).lean();

    await AuditLog.create([{
      user, role, action: 'unlock', resource_type: 'item', resource_id: String(id),
      details: { item_number: existing.item_number, reason }, ip,
    }], { session });

    return updated;
  });
}

module.exports = { applyItemEdit, applyCommonEdit, unlockItem, COMMON_SHARED_FIELDS };
