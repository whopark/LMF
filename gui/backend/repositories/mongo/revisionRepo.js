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

module.exports = { listForExport }
