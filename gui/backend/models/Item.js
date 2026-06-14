const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['none', 'draft', 'review', 'final'],
    default: 'none',
  },
  locked: { type: Boolean, default: false },
  revised: { type: Boolean, default: false },
}, { _id: false });

const lastModifiedSchema = new mongoose.Schema({
  user: String,
  at: Date,
}, { _id: false });

const sourceSchema = new mongoose.Schema({
  filename: String,
  page: Number,
}, { _id: false });

// 1 document = 1 item × year × area (flat, no nesting)
const itemSchema = new mongoose.Schema({
  item_number: { type: String, required: true },
  area_code: { type: String, required: true },
  // Derived from item_number (last 7 chars e.g. "010.090"), stored for index queries
  common_key: { type: String, index: true },
  year: { type: Number, required: true },
  area_name: String,
  sub_category: String,
  sub_category_order: { type: Number, default: 0 },
  item_order: { type: Number, default: 0 },
  question: String,
  description: String,
  // G2 Fix: field-specific explanation that applies to only one area of a 공통문항.
  // Shared description lives in `description`; this field stores per-area overrides.
  field_specific_description: String,
  // G3 Fix: structured representation of description for table/bullet rendering.
  // Each block: { type: 'text'|'bullet'|'table', content: string|string[]|string[][] }
  blocks: { type: [mongoose.Schema.Types.Mixed], default: undefined },
  score: mongoose.Schema.Types.Mixed,
  // C=핵심, R=필요, B=기본
  classification: { type: String, enum: ['C', 'R', 'B', ''], default: '' },
  na_available: { type: Boolean, default: false },
  revision: { type: revisionSchema, default: () => ({}) },
  last_modified: lastModifiedSchema,
  source: sourceSchema,
});

// Compute common_key from standard item_number format "NN.NNN.NNN" → "NNN.NNN".
// Non-standard formats (e.g. non-numeric segments) leave common_key unchanged.
itemSchema.pre('save', function (next) {
  const m = (this.item_number || '').match(/^\d{2}\.(\d{3}\.\d{3})$/);
  if (m) this.common_key = m[1];
  next();
});

itemSchema.index({ year: 1, area_code: 1, sub_category_order: 1, item_order: 1 });
itemSchema.index({ item_number: 1, year: 1 });
itemSchema.index({ common_key: 1, year: 1 });
itemSchema.index({ question: 'text', description: 'text' });

const Item = mongoose.models.Item ||
  mongoose.model('Item', itemSchema, 'checklist_items');

module.exports = Item;
