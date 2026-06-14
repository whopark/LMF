#!/usr/bin/env node
/**
 * Diff ETL flat output against current MongoDB checklist_items collection.
 * Run BEFORE import-items.js to verify no items will be unintentionally lost.
 *
 * Usage:
 *   node scripts/diff-items.js --input ../../pdf/checklist_items_flat.json [--output diff.md]
 *
 * Exit: 0 = no removed items (safe to import), 1 = removed items found (review first)
 */
// Plan SC: SC-3 — diff report with zero-vanishing-items gate
const path = require('path');
const fs = require('fs');
const { connect, disconnect } = require('./lib/db-connect');
const { buildDiff } = require('./lib/diff-report');
const Item = require('../models/Item');

async function main() {
  const args = parseArgs();

  const flatPath = path.resolve(args.input);
  if (!fs.existsSync(flatPath)) {
    console.error(`ERROR: flat JSON not found: ${flatPath}`);
    process.exit(2);
  }

  const flatItems = JSON.parse(fs.readFileSync(flatPath, 'utf-8'));
  console.log(`[diff] Loaded ${flatItems.length.toLocaleString()} flat items from ${args.input}`);

  const uri = await connect();
  console.log(`[diff] Connected: ${uri}`);

  const dbItems = await Item.find({}, {
    item_number: 1, year: 1, area_code: 1,
    question: 1, description: 1, classification: 1,
    na_available: 1, score: 1, _id: 0,
  }).lean();
  console.log(`[diff] DB current: ${dbItems.length.toLocaleString()} items`);

  const { added, removed, changed, summary, markdownReport } = buildDiff(flatItems, dbItems);
  await disconnect();

  console.log('\n--- Diff Summary ---');
  console.log(`  flat total : ${summary.flatTotal.toLocaleString()}`);
  console.log(`  DB total   : ${summary.dbTotal.toLocaleString()}`);
  console.log(`  new        : +${summary.added}`);
  console.log(`  removed    : -${summary.removed}`);
  console.log(`  changed    :  ${summary.changed}`);

  if (args.output) {
    const outPath = path.resolve(args.output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, markdownReport, 'utf-8');
    console.log(`\n[diff] Report saved: ${outPath}`);
  }

  if (summary.removed > 0) {
    console.log(`\nWARNING: ${summary.removed} item(s) will be lost on import.`);
    console.log('Review the diff report, then re-run import-items.js if acceptable.');
    process.exit(1);
  }

  console.log('\nOK: No items will be removed. Safe to run import-items.js.');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {
    input: path.join(__dirname, '../../pdf/checklist_items_flat.json'),
    output: null,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) args.input = argv[++i];
    else if (argv[i] === '--output' && argv[i + 1]) args.output = argv[++i];
  }
  return args;
}

if (require.main === module) {
  main().catch(err => {
    console.error('[diff] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
