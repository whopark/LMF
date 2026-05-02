const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  area: String,
  sub_category: String,
  about_item: {
    item_number: String,
    item_type: String,
    item_type_en: String,
    score: Number,
    score_note: String,
    has_na: Boolean,
    question: String,
    description: String,
    section: String,
  },
  metadata: {
    page: Number,
    source: String,
    year: Number,
    created_at: Date,
  }
});

const ChecklistItem = mongoose.model('ChecklistItem', checklistItemSchema, 'checklist_items');

module.exports = ChecklistItem;
