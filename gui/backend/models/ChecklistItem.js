const mongoose = require('mongoose');

// Item schema (nested inside sections)
const itemSchema = new mongoose.Schema({
  item_code: String,
  requirement: String,
  evidence_required: String,
  max_score: mongoose.Schema.Types.Mixed,
  type: String,
  raw_line: String,
}, { _id: false });

// Section schema (nested inside document)
const sectionSchema = new mongoose.Schema({
  title: String,
  items: [itemSchema],
}, { _id: false });

// Main document schema (PDF/category level)
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

const ChecklistItem = mongoose.models.ChecklistItem ||
  mongoose.model('ChecklistItem', checklistDocSchema, 'lab_checklists_2026_v8');

module.exports = ChecklistItem;
