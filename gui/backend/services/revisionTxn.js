// Design Ref: §5.3 — transactional orchestration for revision writes (G1).
// Phase 4b: applyItemEdit (4b-1) + applyCommonEdit (4b-2) delegate to the engine write repo
// (mongo|pg). unlockItem stays on Mongo until Phase 4b-3. Engine-agnostic gating + pure rules
// (snapshot/shared-fields/httpError) live in revisionRules.js.
const Item = require('../models/Item');
const AuditLog = require('../models/AuditLog');
const { withTransaction } = require('../utils/withTransaction');
const { assertEditTypesAllowed } = require('../constants/sensitiveEditTypes');
const { httpError, COMMON_SHARED_FIELDS } = require('./revisionRules');
const writeRepo = require('../repositories/writeRepo');

// G1: single-item edit. G6 sensitive-type gating is engine-agnostic → runs before delegation.
async function applyItemEdit(args) {
  assertEditTypesAllowed(args.editTypes || [], args.role);
  return writeRepo.applyItemEdit(args);
}

// G1 + G7: bulk propagation across a common_key. Gating + shared-field filtering are
// engine-agnostic; the engine write repo performs the atomic propagation.
async function applyCommonEdit(args) {
  assertEditTypesAllowed(args.editTypes || [], args.role); // G6
  const safeUpdates = {};
  for (const f of COMMON_SHARED_FIELDS) {
    if (args.updates[f] !== undefined) safeUpdates[f] = args.updates[f];
  }
  if (Object.keys(safeUpdates).length === 0) throw httpError('No valid fields to update', 400);
  return writeRepo.applyCommonEdit({ ...args, updates: safeUpdates });
}

// G4: admin unlock — clears the lock, returns the item to 'review', records the reason.
// Still Mongo (Phase 4b-3).
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
