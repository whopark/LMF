// SPEC-DB-001 (read cutover) · revisionRepo Mongoose impl. Serves export (and later the
// revisions-list GET). Returns Revision-shape lean docs.
const Revision = require('../../models/Revision')
const { areaCodeClause } = require('../../utils/areaFilter')

function buildQuery(filters) {
  const q = {}
  const areaClause = areaCodeClause(filters.area)
  if (areaClause !== undefined) q.area_code = areaClause
  if (filters.year) q.year = parseInt(filters.year)
  if (filters.score_changed === 'true') q.score_changed = true
  return q
}

async function listForExport(filters) {
  return Revision.find(buildQuery(filters)).sort({ at: -1 }).lean()
}

// Revision-history search (GET /api/revisions) with pagination.
function buildListQuery(filters) {
  const q = {}
  if (filters.item_number) q.item_number = filters.item_number
  if (filters.area_code) q.area_code = filters.area_code
  if (filters.year) q.year = parseInt(filters.year)
  if (filters.user) q.user = new RegExp(String(filters.user).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  if (filters.score_changed === 'true') q.score_changed = true
  if (filters.edit_types) {
    const types = Array.isArray(filters.edit_types)
      ? filters.edit_types
      : String(filters.edit_types).split(',').map(t => t.trim()).filter(Boolean)
    if (types.length > 0) q.edit_types = { $in: types }
  }
  return q
}

async function list(filters, { skip, limit }) {
  const q = buildListQuery(filters)
  const total = await Revision.countDocuments(q)
  const revisions = await Revision.find(q).sort({ at: -1 }).skip(skip).limit(limit).lean()
  return { revisions, total }
}

module.exports = { listForExport, list }
