// SPEC-DB-001 (read cutover) · auditRepo Mongoose impl (GET /api/audit).
const AuditLog = require('../../models/AuditLog')

function buildQuery(filters) {
  const q = {}
  if (filters.user) q.user = new RegExp(String(filters.user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  if (filters.action) q.action = filters.action
  if (filters.resource_type) q.resource_type = filters.resource_type
  return q
}

async function list(filters, { skip, limit }) {
  const q = buildQuery(filters)
  const total = await AuditLog.countDocuments(q)
  const logs = await AuditLog.find(q).sort({ at: -1 }).skip(skip).limit(limit).lean()
  return { logs, total }
}

module.exports = { list }
