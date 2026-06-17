// Design Ref: §5.3 — transactional orchestration for revision writes (G1).
// Phase 4b: applyItemEdit is delegated to the engine write repo (mongo|pg). applyCommonEdit
// and unlockItem stay on Mongo until Phase 4b-2/3. Engine-agnostic gating + pure rules
// (snapshot/shared-fields/httpError) live in revisionRules.js.
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const AuditLog = require('../models/AuditLog');
const { withTransaction } = require('../utils/withTransaction');
const { buildReasonFields } = require('../utils/reason');
const { assertEditTypesAllowed } = require('../constants/sensitiveEditTypes');
const { pickSnapshot, httpError, COMMON_SHARED_FIELDS } = require('./revisionRules');
const writeRepo = require('../repositories/writeRepo');

// G1: single-item edit — engine write repo handles the atomic item + revision + audit write.
// G6 sensitive-type gating is engine-agnostic, so it runs here before delegation.
async function applyItemEdit(args) {
  assertEditTypesAllowed(args.editTypes || [], args.role);
  return writeRepo.applyItemEdit(args);
}

// G1 + G7: bulk propagation across a common_key (still Mongo; Phase 4b-2).
async function applyCommonEdit({ key, areaCodes, year, updates, editTypes = [], rawReason, user, role }) {
  assertEditTypesAllowed(editTypes, role); // G6
  const safeUpdates = {};
  for (const f of COMMON_SHARED_FIELDS) {
    if (updates[f] !== undefined) safeUpdates[f] = updates[f];
  }
  if (Object.keys(safeUpdates).length === 0) throw httpError('No valid fields to update', 400);

  const reasonFields = buildReasonFields(rawReason);

  return withTransaction(async (session) => {
    const query = { common_key: key };
    if (Array.isArray(areaCodes) && areaCodes.length > 0) query.area_code = { $in: areaCodes };
    // G-1: scope propagation to the edited year so past years are never overwritten.
    if (year !== undefined && year !== null) query.year = Number(year);

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

// G4: admin unlock (still Mongo; Phase 4b-3).
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
