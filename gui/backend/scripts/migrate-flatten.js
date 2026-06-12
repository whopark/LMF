/**
 * One-time migration: nested ChecklistItem collection → flat checklist_items collection.
 * Run: node gui/backend/scripts/migrate-flatten.js
 *
 * Safe to re-run: detects existing flat items and skips if already migrated.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ChecklistItem = require('../models/ChecklistItem');
const Item = require('../models/Item');

const BATCH_SIZE = 200;

async function migrate() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/lab_accreditation';
  await mongoose.connect(uri);
  console.log('[migrate] Connected to MongoDB');

  const existingFlat = await Item.countDocuments();
  if (existingFlat > 0) {
    console.log(`[migrate] checklist_items already has ${existingFlat} documents. Skipping.`);
    await mongoose.disconnect();
    return;
  }

  const cursor = ChecklistItem.find().cursor();
  let total = 0;
  let batch = [];

  for await (const doc of cursor) {
    const { year, category, title } = doc;

    // Extract area_name from title format "01.검사실운영_2026" → "검사실운영"
    const titleMatch = (title || '').match(/^\d+\.(.+?)_\d+$/);
    const area_name = titleMatch ? titleMatch[1] : (title || '');

    const sections = doc.structured_sections || [];
    let sub_category_order = 0;

    for (const section of sections) {
      sub_category_order += 1;
      const items = section.items || [];

      items.forEach((item, idx) => {
        if (!item.item_code) return;

        const flat = {
          item_number: item.item_code,
          area_code: category || '',
          year: year || 0,
          area_name,
          sub_category: section.title || '',
          sub_category_order,
          item_order: idx + 1,
          question: item.requirement || '',
          description: item.raw_line || '',
          score: item.max_score,
          classification: normalizeClassification(item.type),
          na_available: false,
          source: { filename: title || '' },
        };
        batch.push(flat);
      });

      if (batch.length >= BATCH_SIZE) {
        await Item.insertMany(batch, { ordered: false });
        total += batch.length;
        console.log(`[migrate] Inserted ${total} items so far...`);
        batch = [];
      }
    }
  }

  if (batch.length > 0) {
    await Item.insertMany(batch, { ordered: false });
    total += batch.length;
  }

  console.log(`[migrate] Done. Total flat items inserted: ${total}`);
  await mongoose.disconnect();
}

function normalizeClassification(type) {
  if (!type) return '';
  const t = type.toLowerCase();
  if (t === '핵심' || t === 'c') return 'C';
  if (t === '필요' || t === 'r' || t === '필수') return 'R';
  if (t === '기본' || t === 'b' || t === '권장') return 'B';
  return '';
}

if (require.main === module) {
  migrate().catch(err => {
    console.error('[migrate] Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { migrate };
