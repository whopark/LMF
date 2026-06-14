// Design Ref: §4 — backfill Revision.reason → raw_reason + reason_hash (G2).
// Additive only (never modifies `reason`). Idempotent: skips docs that already have
// raw_reason. Usage: `node scripts/migrate-reason.js [--dry-run]`.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connect, disconnect } = require('./lib/db-connect');
const { hashReason } = require('../utils/reason');

const COLLECTION = 'item_revisions';

// Copy item_revisions to a dated backup collection via server-side $out.
async function backup() {
  const db = mongoose.connection.db;
  const tag = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const name = `${COLLECTION}_backup_${tag}`;
  await db.collection(COLLECTION).aggregate([{ $out: name }]).toArray();
  console.log(`[migrate-reason] backup → ${name}`);
  return name;
}

async function migrate({ dryRun } = {}) {
  await connect();
  const col = mongoose.connection.db.collection(COLLECTION);

  const filter = { $or: [{ raw_reason: { $exists: false } }, { raw_reason: null }] };
  const total = await col.countDocuments(filter);
  console.log(`[migrate-reason] ${total} revision(s) need migration (dryRun=${!!dryRun})`);

  if (dryRun || total === 0) {
    await disconnect();
    return total;
  }

  await backup();

  let migrated = 0;
  for await (const doc of col.find(filter)) {
    const raw = doc.reason === null || doc.reason === undefined ? '' : String(doc.reason);
    await col.updateOne(
      { _id: doc._id },
      { $set: { raw_reason: raw, reason_hash: hashReason(raw) } },
    );
    migrated += 1;
  }

  console.log(`[migrate-reason] migrated ${migrated} revision(s)`);
  await disconnect();
  return migrated;
}

if (require.main === module) {
  migrate({ dryRun: process.argv.includes('--dry-run') })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[migrate-reason] failed:', err);
      process.exit(1);
    });
}

module.exports = { migrate };
