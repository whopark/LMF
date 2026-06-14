#!/usr/bin/env node
/**
 * Restore checklist_items from a named backup collection.
 *
 * Usage:
 *   node scripts/rollback-items.js --from checklist_items_backup_20260613
 *   node scripts/rollback-items.js --list   (show available backups)
 */
// Design Ref: §3 D-6 — restore by copy (backup preserved), not rename
const { connect, disconnect } = require('./lib/db-connect');
const { listBackups, restoreBackup } = require('./lib/backup');

async function main() {
  const args = parseArgs();

  const uri = await connect();
  console.log(`[rollback] Connected: ${uri}`);

  if (args.list) {
    const backups = await listBackups();
    if (backups.length === 0) {
      console.log('[rollback] No backups found.');
    } else {
      console.log('[rollback] Available backups (newest first):');
      for (const name of backups) console.log(`  ${name}`);
    }
    await disconnect();
    return;
  }

  if (!args.from) {
    console.error('ERROR: --from <backup-name> required. Use --list to see available backups.');
    process.exit(2);
  }

  const count = await restoreBackup(args.from);
  await disconnect();
  console.log(`\n[rollback] Complete. checklist_items now has ${count.toLocaleString()} documents.`);
  console.log('Next: npm run test:run');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = { from: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from' && argv[i + 1]) args.from = argv[++i];
    else if (argv[i] === '--list') args.list = true;
  }
  return args;
}

if (require.main === module) {
  main().catch(err => {
    console.error('[rollback] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { main };
