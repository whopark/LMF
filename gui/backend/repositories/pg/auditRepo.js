// SPEC-DB-001 (read cutover) · auditRepo knex impl. Maps audit_log(event/actor/target/detail)
// back to the Mongo AuditLog shape (action←event, user←actor, role/ip←detail). resource_type
// is best-effort from detail jsonb (writers cram role/ip/score_changed into detail).
const { knex } = require('../../config/db')

function toAuditLean(r) {
  const d = r.detail || {}
  return {
    user: r.actor,
    role: d.role,
    action: r.event,
    resource_type: d.resource_type,
    resource_id: r.target,
    details: d,
    ip: d.ip,
    at: r.at,
  }
}

function applyFilters(q, filters) {
  if (filters.user) q.where('actor', 'ilike', `%${String(filters.user)}%`)
  if (filters.action) q.where('event', filters.action)
  if (filters.resource_type) q.whereRaw("detail->>'resource_type' = ?", [filters.resource_type])
  return q
}

async function list(filters, { skip, limit }) {
  const k = knex()
  const [{ count }] = await applyFilters(k('audit_log'), filters).count({ count: '*' })
  const rows = await applyFilters(k('audit_log'), filters).orderBy('at', 'desc').offset(skip).limit(limit)
  return { logs: rows.map(toAuditLean), total: parseInt(count, 10) }
}

module.exports = { list }
