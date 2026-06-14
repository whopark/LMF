const mongoose = require('mongoose');

// Snapshot of mutable item fields captured before/after a PATCH operation.
const snapshotSchema = new mongoose.Schema({
  question: String,
  description: String,
  score: mongoose.Schema.Types.Mixed,
  classification: String,
  na_available: Boolean,
}, { _id: false });

const revisionSchema = new mongoose.Schema({
  item_number: { type: String, required: true },
  area_code: { type: String, required: true },
  common_key: String,   // denormalized for common-item queries
  year: { type: Number, required: true },
  user: { type: String, default: 'unknown' },
  at: { type: Date, default: Date.now },
  // User-selected edit type codes (from edit_type_codes collection)
  edit_types: [String],
  // Free-text reason input — stored verbatim for 연도별 추적 display
  reason: String,
  // Verbatim source of truth (G2) — stored without any transformation.
  raw_reason: { type: String, default: '' },
  // SHA-256(raw_reason) for tamper detection (verifyReason).
  reason_hash: { type: String, default: '' },
  before: snapshotSchema,
  after: snapshotSchema,
  // Status at the time of save (not the target status)
  status_at_save: { type: String, default: 'none' },
  // Denormalized flag for quick filtering of배점 change history
  score_changed: { type: Boolean, default: false },
});

revisionSchema.index({ item_number: 1, at: -1 });
revisionSchema.index({ common_key: 1, at: -1 });
revisionSchema.index({ user: 1, at: -1 });
revisionSchema.index({ score_changed: 1 });
revisionSchema.index({ area_code: 1, year: 1 });

const Revision = mongoose.models.Revision ||
  mongoose.model('Revision', revisionSchema, 'item_revisions');

module.exports = Revision;
