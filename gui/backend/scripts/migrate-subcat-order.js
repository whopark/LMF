#!/usr/bin/env node
/**
 * 중분류 10코드 분류 통합 마이그레이션 (Option C) — 각 문항의 sub_category를
 * MMM(문항번호 중간 3자리) 백자리 기반 10코드 라벨로 통합하고 order=코드 정수로 세팅.
 * 매핑은 scripts/lib/subcatOrder.js의 categoryFor(item_number)에서 결정(멱등).
 *
 * Usage (DRY-RUN 기본 — 쓰기 없음):
 *   node scripts/migrate-subcat-order.js            # dry-run
 *   node scripts/migrate-subcat-order.js --apply    # backup + write
 *   node scripts/migrate-subcat-order.js --apply --skip-backup
 *
 * Rollback: node scripts/rollback-items.js --from <backup>
 */
// Design Ref: §4 (Option C) — orchestrator. Plan SC: SC-1(분류당 order 1개), SC-3(안전).
const fs = require('fs');
const path = require('path');
const { connect, disconnect } = require('./lib/db-connect');
const { createBackup } = require('./lib/backup');
const { categoryFor } = require('./lib/subcatOrder');
const Item = require('../models/Item');

const BATCH = 500;
const REPORTS_DIR = path.join(__dirname, '../reports');

// Core migration over an already-connected DB (테스트가 직접 구동).
async function runMigration({ apply = false } = {}) {
  const all = await Item.find({}, { item_number: 1, sub_category: 1, sub_category_order: 1 }).lean();

  const ops = [];
  const stat = { scanned: all.length, changed: 0 };
  const dist = {};
  const samples = [];
  for (const d of all) {
    const { label, order } = categoryFor(d.item_number);
    dist[label] = (dist[label] || 0) + 1;
    if (d.sub_category === label && d.sub_category_order === order) continue;
    stat.changed++;
    if (samples.length < 10) samples.push(`${d.item_number} "${d.sub_category}" → "${label}"(${order})`);
    ops.push({ updateOne: { filter: { _id: d._id }, update: { $set: { sub_category: label, sub_category_order: order } } } });
  }

  let written = 0;
  if (apply) {
    for (let i = 0; i < ops.length; i += BATCH) {
      const res = await Item.collection.bulkWrite(ops.slice(i, i + BATCH), { ordered: false });
      written += res.modifiedCount;
    }
  }
  const post = apply ? await verifyMetrics(all.length) : null;
  return { stat, samples, written, post, dist };
}

async function verifyMetrics(total0) {
  // SC-1: 코드 분류당 distinct order=1; 분류 수 ≤ 11(10코드+제공서비스).
  const cats = await Item.aggregate([
    { $match: { sub_category: { $nin: [null, ''] } } },
    { $group: { _id: '$sub_category', ords: { $addToSet: '$sub_category_order' } } },
  ]);
  const inconsistent = cats.filter(c => c.ords.length > 1);
  const total1 = await Item.countDocuments({});
  return { categories: cats.length, inconsistentNames: inconsistent.length, totalOk: total1 === total0 };
}

function writeReport(args, stat, samples, post) {
  try {
    if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
    const tag = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const lines = [
      `# 중분류 순서 migration — ${args.apply ? 'APPLY' : 'DRY-RUN'}`,
      '',
      `scanned=${stat.scanned} changed=${stat.changed}`,
    ];
    if (post) lines.push('', `categories=${post.categories} inconsistentNames=${post.inconsistentNames} totalUnchanged=${post.totalOk}`);
    lines.push('', '## samples', ...samples.map(s => `- ${s}`));
    const file = path.join(REPORTS_DIR, `subcat-order-${tag}.md`);
    fs.writeFileSync(file, lines.join('\n'));
    console.log(`[subcat-order] report → ${path.relative(process.cwd(), file)}`);
  } catch (e) {
    console.warn('[subcat-order] report write failed:', e.message);
  }
}

function parseArgs() {
  const a = { apply: false, skipBackup: false };
  for (const v of process.argv.slice(2)) {
    if (v === '--apply') a.apply = true;
    else if (v === '--dry-run') a.apply = false;
    else if (v === '--skip-backup') a.skipBackup = true;
  }
  return a;
}

async function main() {
  const args = parseArgs();
  const uri = await connect();
  console.log(`[subcat-order] Connected: ${uri}  mode=${args.apply ? 'APPLY' : 'DRY-RUN'}`);
  const backupName = (args.apply && !args.skipBackup) ? await createBackup() : null;
  const r = await runMigration(args);
  console.log(`[subcat-order] scanned=${r.stat.scanned} changed=${r.stat.changed}`);
  if (args.apply) {
    console.log(`[subcat-order] bulkWrite modified=${r.written}`);
    console.log(`[subcat-order] POST categories=${r.post.categories} inconsistentNames=${r.post.inconsistentNames} totalUnchanged=${r.post.totalOk}`);
    if (backupName) console.log(`[subcat-order] rollback: node scripts/rollback-items.js --from ${backupName}`);
  } else {
    console.log('[subcat-order] DRY-RUN — no writes. Re-run with --apply to commit.');
  }
  writeReport(args, r.stat, r.samples, r.post);
  await disconnect();
}

if (require.main === module) {
  main().catch(err => { console.error('[subcat-order] Fatal:', err.message); process.exit(1); });
}

module.exports = { main, runMigration, verifyMetrics };
