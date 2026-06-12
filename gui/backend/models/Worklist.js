const mongoose = require('mongoose');

// Per-user revision worklist — stores item_numbers selected for revision.
// Stage 1: keyed by user name (not auth token). Upserted on PUT.
const worklistSchema = new mongoose.Schema({
  user: { type: String, required: true },
  year: { type: Number, required: true },
  item_numbers: [String],
  updated_at: { type: Date, default: Date.now },
});

worklistSchema.index({ user: 1, year: 1 }, { unique: true });

const Worklist = mongoose.models.Worklist ||
  mongoose.model('Worklist', worklistSchema, 'revision_worklists');

module.exports = Worklist;
