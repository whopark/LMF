#!/usr/bin/env node
/**
 * Transform checklist_items_final.json to structured_sections format
 * and upload to MongoDB Atlas.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Configuration
const JSON_FILE = path.join(__dirname, '../../pdf/checklist_items_final.json');
const OUTPUT_FILE = path.join(__dirname, '../../pdf/transformed_data.json');
const MONGO_URI = process.env.MONGO_URI;

// Define the schema directly (same as ChecklistItem model)
const itemSchema = new mongoose.Schema({
  item_code: String,
  requirement: String,
  evidence_required: String,
  max_score: mongoose.Schema.Types.Mixed,
  type: String,
  raw_line: String,
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  title: String,
  items: [itemSchema],
}, { _id: false });

const checklistDocSchema = new mongoose.Schema({
  year: Number,
  category: String,
  title: String,
  filename: String,
  page_count: Number,
  parsed_at: String,
  parser_version: String,
  structured_sections: [sectionSchema],
  total_items: Number,
  tags: [String],
  status: String,
  imported_at: String,
  imported_via: String,
});

const ChecklistDoc = mongoose.model('ChecklistDoc', checklistDocSchema, 'lab_checklists_2026_v8');

/**
 * Transform flat items to structured_sections format.
 */
function transformToStructured(items) {
  // Group by (year, area)
  const grouped = {};

  for (const item of items) {
    const year = item.metadata.year;
    const area = item.area;
    const section = item.about_item?.section || item.sub_category || 'Unknown';
    const key = `${year}|${area}`;

    if (!grouped[key]) {
      grouped[key] = {};
    }
    if (!grouped[key][section]) {
      grouped[key][section] = [];
    }
    grouped[key][section].push(item);
  }

  // Transform to documents
  const documents = [];

  for (const [key, sections] of Object.entries(grouped)) {
    const [yearStr, area] = key.split('|');
    const year = parseInt(yearStr, 10);

    // Extract category code (e.g., "01" from "01 검사실운영")
    const parts = area.split(' ', 2);
    const categoryCode = parts[0] || area;
    const categoryName = parts[1] || area;

    // Build structured_sections
    const structuredSections = [];
    let totalItems = 0;

    for (const [sectionTitle, sectionItems] of Object.entries(sections)) {
      const itemsList = sectionItems.map(si => {
        const about = si.about_item || {};
        return {
          item_code: about.item_number || '',
          requirement: about.question || '',
          raw_line: about.description || '',
          type: about.item_type || '필수',
          max_score: about.score || 0,
        };
      });

      totalItems += itemsList.length;

      structuredSections.push({
        title: sectionTitle,
        items: itemsList,
      });
    }

    // Sort sections by title
    structuredSections.sort((a, b) => a.title.localeCompare(b.title));

    const doc = {
      year,
      category: categoryCode,
      title: `${categoryCode}.${categoryName}_${year}`,
      filename: `${area}/${year}.pdf`,
      page_count: 0,
      parsed_at: new Date().toISOString(),
      parser_version: 'transform_v1_node',
      structured_sections: structuredSections,
      total_items: totalItems,
      tags: [categoryName],
      status: 'imported',
      imported_at: new Date().toISOString(),
      imported_via: 'transform-and-upload.js',
    };
    documents.push(doc);
  }

  // Sort by year and category
  documents.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.category.localeCompare(b.category);
  });

  return documents;
}

async function main() {
  console.log('='.repeat(60));
  console.log('PDF Data Transformation and Upload Script');
  console.log('='.repeat(60));

  // Load data
  console.log('\n[1/4] Loading data from checklist_items_final.json...');
  const rawData = fs.readFileSync(JSON_FILE, 'utf-8');
  const items = JSON.parse(rawData);
  console.log(`     Loaded ${items.length} items`);

  // Transform
  console.log('\n[2/4] Transforming to structured_sections format...');
  const documents = transformToStructured(items);
  console.log(`     Created ${documents.length} documents`);

  // Summary
  const years = [...new Set(documents.map(d => d.year))].sort();
  const categories = [...new Set(documents.map(d => d.category))].sort();
  const totalItems = documents.reduce((sum, d) => sum + d.total_items, 0);

  console.log('\n     Summary:');
  console.log(`       - Years: ${years.join(', ')}`);
  console.log(`       - Categories: ${categories.join(', ')}`);
  console.log(`       - Documents: ${documents.length}`);
  console.log(`       - Total items: ${totalItems}`);

  // Save JSON for verification
  console.log('\n[3/4] Saving transformed data to JSON...');
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(documents, null, 2), 'utf-8');
  console.log(`     Saved to ${OUTPUT_FILE}`);

  // Upload to MongoDB
  console.log('\n[4/4] Uploading to MongoDB...');

  if (!MONGO_URI) {
    console.log('     ERROR: MONGO_URI not set in .env');
    console.log('     Transformation complete. Data saved to transformed_data.json');
    return;
  }

  try {
    await mongoose.connect(MONGO_URI);
    console.log('     Connected to MongoDB');

    // Clear existing data
    const deleteResult = await ChecklistDoc.deleteMany({});
    console.log(`     Cleared ${deleteResult.deletedCount} existing documents`);

    // Insert new documents
    const insertResult = await ChecklistDoc.insertMany(documents);
    console.log(`     Inserted ${insertResult.length} documents`);

    // Verify
    const count = await ChecklistDoc.countDocuments();
    const dbYears = await ChecklistDoc.distinct('year');
    console.log('\n     Verification:');
    console.log(`       - Document count: ${count}`);
    console.log(`       - Years in DB: ${dbYears.sort().join(', ')}`);

    await mongoose.disconnect();
    console.log('\n' + '='.repeat(60));
    console.log('SUCCESS: Data uploaded to MongoDB');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('     MongoDB Error:', err.message);
    console.log('\n' + '='.repeat(60));
    console.log('FAILED: Could not upload to MongoDB');
    console.log('Transformed data saved to transformed_data.json');
    console.log('='.repeat(60));
  }
}

main().catch(console.error);
