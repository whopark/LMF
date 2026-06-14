// Design Ref: §3 D-6 — backup naming: checklist_items_backup_YYYYMMDD, restore by copy not rename
const mongoose = require('mongoose');

const SOURCE_COLLECTION = 'checklist_items';
const BACKUP_PREFIX = 'checklist_items_backup_';

function _todayTag() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

async function _db() {
  return mongoose.connection.db;
}

/**
 * Copy current checklist_items to a backup collection.
 * If a backup for today already exists, appends -2, -3, etc.
 * Returns the backup collection name.
 */
async function createBackup() {
  const db = await _db();
  const baseName = BACKUP_PREFIX + _todayTag();

  // Find next available name
  const existing = await db.listCollections({ name: new RegExp(`^${baseName}`) }).toArray();
  let backupName = baseName;
  if (existing.length > 0) {
    backupName = `${baseName}-${existing.length + 1}`;
  }

  const count = await db.collection(SOURCE_COLLECTION).countDocuments();
  if (count === 0) {
    console.log('[backup] Source collection is empty — creating empty backup');
  }

  // Use aggregation $out to copy documents in one server-side operation
  await db.collection(SOURCE_COLLECTION).aggregate([
    { $out: backupName },
  ]).toArray();

  const backupCount = await db.collection(backupName).countDocuments();
  console.log(`[backup] Created ${backupName} (${backupCount} docs)`);
  return backupName;
}

/**
 * List all backup collections sorted newest-first.
 */
async function listBackups() {
  const db = await _db();
  const cols = await db.listCollections({ name: new RegExp(`^${BACKUP_PREFIX}`) }).toArray();
  return cols.map(c => c.name).sort().reverse();
}

/**
 * Restore a backup into checklist_items (replaces current data).
 * The backup collection is preserved.
 */
async function restoreBackup(backupName) {
  const db = await _db();
  const cols = await db.listCollections({ name: backupName }).toArray();
  if (cols.length === 0) {
    throw new Error(`Backup not found: ${backupName}`);
  }

  const backupCount = await db.collection(backupName).countDocuments();
  console.log(`[backup] Restoring ${backupName} (${backupCount} docs) → ${SOURCE_COLLECTION}`);

  // Replace source with backup via aggregate $out
  await db.collection(backupName).aggregate([
    { $out: SOURCE_COLLECTION },
  ]).toArray();

  const restoredCount = await db.collection(SOURCE_COLLECTION).countDocuments();
  console.log(`[backup] Restored: ${SOURCE_COLLECTION} now has ${restoredCount} docs`);
  return restoredCount;
}

module.exports = { createBackup, listBackups, restoreBackup };
