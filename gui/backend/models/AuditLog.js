const mongoose = require('mongoose');

// Records security-relevant events: login, item edits, transitions, user management.
const auditLogSchema = new mongoose.Schema({
  user: { type: String, default: 'unknown' },
  role: { type: String, default: 'unknown' },
  action: { type: String, required: true }, // 'login', 'patch_item', 'transition', etc.
  resource_type: { type: String, default: '' }, // 'item', 'auth', 'user', etc.
  resource_id: { type: String, default: '' },
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  at: { type: Date, default: Date.now, index: true },
});

auditLogSchema.index({ user: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });
auditLogSchema.index({ resource_type: 1, resource_id: 1 });

const AuditLog = mongoose.models.AuditLog ||
  mongoose.model('AuditLog', auditLogSchema, 'audit_logs');

module.exports = AuditLog;
