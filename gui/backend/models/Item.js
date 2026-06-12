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
  score: mongoose.Schema.Types.Mixed,
  // C=핵심, R=필요, B=기본
  classification: { type: String, enum: ['C', 'R', 'B', ''], default: '' },
  na_available: { type: Boolean, default: false },
  revision: { type: revisionSchema, default: () => ({}) },
  last_modified: lastModifiedSchema,
  source: sourceSchema,
});

// Compute common_key from item_number (format "NN.NNN.NNN" → last 7 chars "NNN.NNN")
itemSchema.pre('save', function (next) {
  if (this.item_number && this.item_number.length >= 7) {
    this.common_key = this.item_number.slice(-7);
  }
  next();
});

itemSchema.index({ year: 1, area_code: 1, sub_category_order: 1, item_order: 1 });
itemSchema.index({ item_number: 1, year: 1 });
itemSchema.index({ common_key: 1, year: 1 });
itemSchema.index({ question: 'text', description: 'text' });

const Item = mongoose.models.Item ||
  mongoose.model('Item', itemSchema, 'checklist_items');

module.exports = Item;
