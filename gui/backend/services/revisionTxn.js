// Design Ref: §5.3 — transactional orchestration for revision writes (G1).
// Phase 4b: all write ops (applyItemEdit/applyCommonEdit/unlockItem/transitionItem) delegate
// to the engine write repo (mongo|pg). This facade keeps the engine-agnostic guards: sensitive
// edit-type gating (G6), shared-field filtering (G7), and the unlock reason requirement.
const { assertEditTypesAllowed } = require('../constants/sensitiveEditTypes');
const { httpError, COMMON_SHARED_FIELDS } = require('./revisionRules');
const writeRepo = require('../repositories/writeRepo');

// G1: single-item edit. G6 sensitive-type gating runs before delegation.
async function applyItemEdit(args) {
  assertEditTypesAllowed(args.editTypes || [], args.role);
  return writeRepo.applyItemEdit(args);
}

// G1 + G7: bulk propagation. Gating + shared-field filtering are engine-agnostic.
async function applyCommonEdit(args) {
  assertEditTypesAllowed(args.editTypes || [], args.role); // G6
  const safeUpdates = {};
  for (const f of COMMON_SHARED_FIELDS) {
    if (args.updates[f] !== undefined) safeUpdates[f] = args.updates[f];
  }
  if (Object.keys(safeUpdates).length === 0) throw httpError('No valid fields to update', 400);
  return writeRepo.applyCommonEdit({ ...args, updates: safeUpdates });
}

// G4: admin unlock — reason requirement is engine-agnostic.
async function unlockItem(args) {
  const reason = args.rawReason === null || args.rawReason === undefined ? '' : String(args.rawReason);
  if (reason.trim().length === 0) throw httpError('Unlock reason is required', 400);
  return writeRepo.unlockItem(args);
}

// G5: workflow status transition (validation + atomic guard live in the engine repo).
async function transitionItem(args) {
  return writeRepo.transitionItem(args);
}

module.exports = { applyItemEdit, applyCommonEdit, unlockItem, transitionItem, COMMON_SHARED_FIELDS };
