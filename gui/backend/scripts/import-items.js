#!/usr/bin/env node
/**
 * Import ETL flat output into MongoDB checklist_items collection.
 * Automatically creates a dated backup before replacing.
 *
 * Usage:
 *   node scripts/import-items.js [--input ../../pdf/checklist_items_flat.json] [--skip-backup]
 *
 * Recommended flow:
 *   1. node scripts/diff-items.js   ← review diff first
 *   2. node scripts/import-items.js ← then import
 *   3. node scripts/rollback-items.js --from <backup> ← if needed
 */
// Design Ref: §3 D-1 — direct Mongoose, no server required
// Design Ref: §3 D-2 — insertMany bypasses pre-save; common_key from ETL output only
// Plan SC: SC-4
const path = require('path');
const fs = require('fs');
const { connect, disconnect } = require('./lib/db-connect');
const { createBackup } = require('./lib/backup');
const Item = require('../models/Item');

const BATCH_SIZE = 500;

async function main() {
  const args = parseArgs();

  const flatPath = path.resolve(args.input);
  if (!fs.existsSync(flatPath)) {
    console.error(`ERROR: flat JSON not found: ${flatPath}`);
    process.exit(2);
  }

  let flatItems;
  try {
    flatItems = JSON.parse(fs.readFileSync(flatPath, 'utf-8'));
  } catch (e) {
    console.error(`ERROR: failed to parse ${flatPath}: ${e.message}`);
    process.exit(2);
  }
  console.log(`[import] Loaded ${flatItems.length.toLocaleString()} items from ${args.input}`);

  // Design Ref: D-2 — validate common_key presence for standard item numbers
  const missingKey = flatItems.filter(
    item => /^\d{2}\.\d{3}\.\d{3}$/.test(item.item_number) && !item.common_key
  );
  if (missingKey.length > 0) {
    console.error(`ERROR: ${missingKey.length} standard items missing common_key. Run ETL again.`);
    process.exit(2);
  }

  const uri = await connect();
  console.log(`[import] Connected: ${uri}`);

  // Step 1: backup
  let backupName = null;
  if (!args.skipBackup) {
    backupName = await createBackup();
  } else {
    console.log('[import] --skip-backup: no backup created');
  }

  // Step 2: replace collection
  console.log('[import] Deleting existing items...');
  const { deletedCount } = await Item.deleteMany({});
  console.log(`[import] Deleted ${deletedCount} existing items`);

  // Step 3: batch insertMany (ordered=true so failures surface immediately)
  console.log(`[import] Inserting ${flatItems.length.toLocaleString()} items in batches of ${BATCH_SIZE}...`);
  let inserted = 0;
  try {
    for (let i = 0; i < flatItems.length; i += BATCH_SIZE) {
      const batch = flatItems.slice(i, i + BATCH_SIZE);
      await Item.collection.insertMany(batch, { ordered: true });
      inserted += batch.length;
      process.stdout.write(`\r[import] ${inserted.toLocaleString()} / ${flatItems.length.toLocaleString()}`);
    }
  } catch (err) {
    console.error(`\n[import] insertMany failed after ${inserted} items: ${err.message}`);
    if (backupName) {
      console.error(`[import] To restore: node scripts/rollback-items.js --from ${backupName}`);
    }
    await disconnect();
    process.exit(1);
  }
  console.log('');

  // Step 4: verify count
  const finalCount = await Item.countDocuments();
  if (finalCount !== flatItems.length) {
    console.error(`[import] Count mismatch: expected ${flatItems.length}, got ${finalCount}`);
    if (backupName) {
      console.error(`[import] To restore: node scripts/rollback-items.js --from ${backupName}`);
    }
    await disconnect();
    process.exit(1);
  }

  await disconnect();

  console.log(`\n[import] Done.`);
  console.log(`  Inserted : ${inserted.toLocaleString()}`);
  console.log(`  Verified : ${finalCount.toLocaleString()} documents`);
  if (backupName) console.log(`  Backup   : ${backupName}`);
  console.log('\nNext: npm run test:run');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = {
    input: path.join(__dirname, '../../pdf/checklist_items_flat.json'),
    skipBackup: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--input' && argv[i + 1]) args.input = argv[++i];
    else if (argv[i] === '--skip-backup') args.skipBackup = true;
  }
  return args;
}

if (require.main === module) {
  main().catch(err => {
    console.error('[import] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
