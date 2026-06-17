// SPEC-DB-001 (read cutover) · revisionRepo knex impl. Maps item_revision rows back to the
// Mongo Revision shape the export generators expect (user←revised_by, at←revised_at,
// reason←raw_reason, before/after←*_json jsonb, edit_types jsonb array).
const { knex } = require('../../config/db')

function toRevisionLean(r) {
  return {
    item_number: r.item_number,
    area_code: (r.area_code || '').trim(),
    common_key: (r.common_key || '').trim(),
    year: r.year,
    user: r.revised_by,
    at: r.revised_at,
    edit_types: r.edit_types || [],
    reason: r.raw_reason || '',
    raw_reason: r.raw_reason || '',
    before: r.before_json || {},
    after: r.after_json || {},
    score_changed: r.score_changed,
    status_at_save: r.status_at_save,
  }
}

async function listForExport(filters) {
  const k = knex()
  let q = k('item_revision').orderBy('revised_at', 'desc')
  const codes = filters.area ? String(filters.area).split(',').map(s => s.trim()).filter(Boolean) : []
  if (codes.length === 1) q = q.where('area_code', codes[0])
  else if (codes.length > 1) q = q.whereIn('area_code', codes)
  if (filters.year) q = q.where('year', parseInt(filters.year))
  if (filters.score_changed === 'true') q = q.where('score_changed', true)
  const rows = await q
  return rows.map(toRevisionLean)
}

// Revision-history search (GET /api/revisions) with pagination. user uses ILIKE (substring,
// matching the Mongo regex). edit_types matches ANY of the requested codes in the jsonb array.
function applyListFilters(q, filters) {
  if (filters.item_number) q.where('item_number', filters.item_number)
  if (filters.area_code) q.where('area_code', filters.area_code)
  if (filters.year) q.where('year', parseInt(filters.year))
  if (filters.user) q.where('revised_by', 'ilike', `%${String(filters.user)}%`)
  if (filters.score_changed === 'true') q.where('score_changed', true)
  if (filters.edit_types) {
    const types = Array.isArray(filters.edit_types)
      ? filters.edit_types
      : String(filters.edit_types).split(',').map(t => t.trim()).filter(Boolean)
    if (types.length > 0) {
      q.whereRaw('EXISTS (SELECT 1 FROM jsonb_array_elements_text(edit_types) e WHERE e = ANY(?))', [types])
    }
  }
  return q
}

async function list(filters, { skip, limit }) {
  const k = knex()
  const [{ count }] = await applyListFilters(k('item_revision'), filters).count({ count: '*' })
  const rows = await applyListFilters(k('item_revision'), filters)
    .orderBy('revised_at', 'desc').offset(skip).limit(limit)
  return { revisions: rows.map(toRevisionLean), total: parseInt(count, 10) }
}

module.exports = { listForExport, list }
