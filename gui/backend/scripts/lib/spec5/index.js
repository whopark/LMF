// §5 — compose transforms into a single minimal doc patch.
// Design Ref: §3.5 — split → backfill → buildBlocks(new desc). Idempotent.
const { splitMerged } = require('./splitMerged');
const { buildClassMap, CLEAN_YEARS } = require('./classMap');
const { backfillClassification } = require('./backfillClassification');
const { buildBlocks } = require('./buildBlocks');
const { cleanBleed } = require('./cleanBleed');

function blocksEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Returns a patch with only the changed fields, or null when nothing changes.
// Idempotent: re-running on an already-patched doc yields null.
function applyPatches(doc, classMap) {
  const patch = {};

  const split = splitMerged(doc);
  let question = doc.question;
  if (split) {
    patch.question = split.question;
    patch.description = split.description;
    question = split.question;
  }
  const newDescription = split ? split.description : doc.description;

  // §5 잔여: 답안마커 bleed 정제 (split 후 question에 적용; question만 변경).
  const bleed = cleanBleed(question);
  if (bleed) patch.question = bleed.question;

  const cls = backfillClassification(doc, classMap);
  if (cls) patch.classification = cls.classification;

  const blocks = buildBlocks(newDescription);
  if (blocks && !blocksEqual(blocks, doc.blocks)) patch.blocks = blocks;

  return Object.keys(patch).length ? patch : null;
}

module.exports = {
  applyPatches,
  splitMerged,
  buildClassMap,
  backfillClassification,
  buildBlocks,
  cleanBleed,
  CLEAN_YEARS,
};
