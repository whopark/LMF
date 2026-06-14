#!/usr/bin/env node
/**
 * §5 data-integrity migration — split merged 2020 questions, backfill 2021
 * classification, populate blocks. Pure transforms live in scripts/lib/spec5/.
 *
 * Usage (DRY-RUN is the default — no writes):
 *   node scripts/migrate-spec5.js                 # dry-run, writes a report only
 *   node scripts/migrate-spec5.js --apply         # backup + write changes
 *   node scripts/migrate-spec5.js --year=2020     # limit to one year
 *   node scripts/migrate-spec5.js --limit=50      # cap number of changes
 *   node scripts/migrate-spec5.js --apply --skip-backup
 *
 * Rollback: node scripts/rollback-items.js --from <backup>
 */
// Design Ref: §4 — orchestrator: connect/backup/classMap/loop/write/report. Plan SC: SC-4, SC-5.
const fs = require('fs');
const path = require('path');
const { connect, disconnect } = require('./lib/db-connect');
const { createBackup } = require('./lib/backup');
const { applyPatches, buildClassMap } = require('./lib/spec5');
const Item = require('../models/Item');

const BATCH = 500;
const REPORTS_DIR = path.join(__dirname, '../reports');
const MERGED_Q = { $and: [{ $or: [{ description: '' }, { description: null }, { description: { $exists: false } }] }, { question: /[∙•]/ }] };
const UNCLASSIFIED_Q = { $or: [{ classification: '' }, { classification: null }, { classification: { $exists: false } }] };
// §5 잔여: 답안마커 bleed (cleanBleed GUARD와 동일 패턴) — SC-B1 증거.
const BLEED_Q = { question: { $regex: '예\\s*\\(\\s*(?:필수|필요|기본)\\s*\\)|\\?\\s*\\(\\s*(?:필수|필요|기본)\\s*\\)' } };

// Core migration over an already-connected DB. Pure of connect/backup/disconnect
// so tests can drive it against an in-memory replset.
async function runMigration({ apply = false, year = null, limit = 0 } = {}) {
  const all = await Item.find({}).lean();
  const classMap = buildClassMap(all);
  const targets = year ? all.filter(d => d.year === year) : all;

  // SC-2 report: backfill matching rate + unmatched (no clean-year common_key) samples.
  const isUnclassified = d => d.classification === '' || d.classification === null || d.classification === undefined;
  const unclassified = all.filter(isUnclassified);
  const unmatched = unclassified.filter(d => !d.common_key || !classMap.get(d.common_key));
  const backfill = {
    unclassified: unclassified.length,
    matched: unclassified.length - unmatched.length,
    unmatched: unmatched.length,
    matchRate: unclassified.length ? Math.round((1 - unmatched.length / unclassified.length) * 100) : 100,
    unmatchedSamples: unmatched.slice(0, 10).map(d => `${d.year} ${d.item_number}`),
  };

  const ops = [];
  const stat = { scanned: targets.length, split: 0, backfill: 0, blocks: 0, changed: 0 };
  const samples = [];
  for (const doc of targets) {
    if (limit && ops.length >= limit) break;
    const patch = applyPatches(doc, classMap);
    if (!patch) continue;
    stat.changed++;
    if (patch.question !== undefined) stat.split++;
    if (patch.classification !== undefined) stat.backfill++;
    if (patch.blocks !== undefined) stat.blocks++;
    if (samples.length < 8) samples.push(`${doc.year} ${doc.item_number}: ${Object.keys(patch).join(', ')}`);
    ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: patch } } });
  }

  let written = 0;
  if (apply) {
    for (let i = 0; i < ops.length; i += BATCH) {
      const res = await Item.collection.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
      written += res.modifiedCount;
    }
  }
  const post = apply ? await verifyMetrics(all.length) : null;
  return { classMapSize: classMap.size, stat, samples, written, post, opsCount: ops.length, backfill };
}

async function main() {
  const args = parseArgs();
  const uri = await connect();
  console.log(`[spec5] Connected: ${uri}  mode=${args.apply ? 'APPLY' : 'DRY-RUN'}`);

  const backupName = (args.apply && !args.skipBackup) ? await createBackup() : null;
  const r = await runMigration(args);
  console.log(`[spec5] classMap=${r.classMapSize}  scanned=${r.stat.scanned} changed=${r.stat.changed} (split=${r.stat.split} backfill=${r.stat.backfill} blocks=${r.stat.blocks})`);
  console.log(`[spec5] backfill: unclassified=${r.backfill.unclassified} matched=${r.backfill.matched} unmatched=${r.backfill.unmatched} (matchRate=${r.backfill.matchRate}%)`);

  if (args.apply) {
    console.log(`[spec5] bulkWrite modified=${r.written}`);
    console.log(`[spec5] POST mergedRemaining=${r.post.mergedRemaining} unclassifiedRemaining=${r.post.unclassifiedRemaining} bleedRemaining=${r.post.bleedRemaining} blocksCoverage=${r.post.blocksCoverage} totalUnchanged=${r.post.totalOk}`);
    if (backupName) console.log(`[spec5] rollback: node scripts/rollback-items.js --from ${backupName}`);
    writeReport(args, r.stat, r.samples, { backupName, written: r.written, ...r.post }, r.backfill);
  } else {
    writeReport(args, r.stat, r.samples, null, r.backfill);
    console.log('[spec5] DRY-RUN — no writes. Re-run with --apply to commit.');
  }
  await disconnect();
}

async function verifyMetrics(total0) {
  const withDesc = { description: { $nin: ['', null], $exists: true } };
  const [mergedRemaining, unclassifiedRemaining, bleedRemaining, descCount, descNoBlocks, total1] = await Promise.all([
    Item.countDocuments(MERGED_Q),
    Item.countDocuments(UNCLASSIFIED_Q),
    Item.countDocuments(BLEED_Q),
    Item.countDocuments(withDesc),
    Item.countDocuments({ ...withDesc, $or: [{ blocks: { $exists: false } }, { blocks: null }, { blocks: { $size: 0 } }] }),
    Item.countDocuments({}),
  ]);
  return {
    mergedRemaining,
    unclassifiedRemaining,
    bleedRemaining,
    blocksCoverage: descCount ? `${descCount - descNoBlocks}/${descCount}` : 'n/a',
    totalOk: total1 === total0,
  };
}

function writeReport(args, stat, samples, applied, backfill) {
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const tag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const lines = [
      `# §5 migration report — ${args.apply ? 'APPLY' : 'DRY-RUN'}`,
      '',
      `scanned=${stat.scanned} changed=${stat.changed} split=${stat.split} backfill=${stat.backfill} blocks=${stat.blocks}`,
    ];
    if (applied) {
      lines.push('', `backup=${applied.backupName} written=${applied.written}`,
        `mergedRemaining=${applied.mergedRemaining} unclassifiedRemaining=${applied.unclassifiedRemaining} blocksCoverage=${applied.blocksCoverage} totalUnchanged=${applied.totalOk}`);
    }
    if (backfill) {
      lines.push('', '## backfill (SC-2)',
        `unclassified=${backfill.unclassified} matched=${backfill.matched} unmatched=${backfill.unmatched} matchRate=${backfill.matchRate}%`);
      if (backfill.unmatchedSamples.length) {
        lines.push('', '미매칭 (클린연도 common_key 없음):', ...backfill.unmatchedSamples.map(s => `- ${s}`));
      }
    }
    lines.push('', '## samples', ...samples.map(s => `- ${s}`));
    const file = path.join(REPORTS_DIR, `spec5-${tag}.md`);
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`[spec5] report → ${path.relative(process.cwd(), file)}`);
  } catch (e) {
    console.warn('[spec5] report write failed:', e.message);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const a = { apply: false, year: null, limit: 0, skipBackup: false };
  for (const v of argv) {
    if (v === '--apply') a.apply = true;
    else if (v === '--dry-run') a.apply = false;
    else if (v === '--skip-backup') a.skipBackup = true;
    else if (v.startsWith('--year=')) a.year = parseInt(v.slice(7), 10);
    else if (v.startsWith('--limit=')) a.limit = parseInt(v.slice(8), 10);
  }
  return a;
}

if (require.main === module) {
  main().catch(err => {
    console.error('[spec5] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { main, runMigration, verifyMetrics };
