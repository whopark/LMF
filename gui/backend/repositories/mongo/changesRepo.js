// SPEC-DB-001 Phase 4 · changesRepo Mongoose impl (read; DB parts of routes/changes.js).
// Diff/snapshot/normalize logic stays in the route (pure); only fetches live here.
const Item = require('../../models/Item')
const Revision = require('../../models/Revision')
const { areaCodeClause } = require('../../utils/areaFilter')

async function getYearItems(year, area) {
  const clause = areaCodeClause(area)
  const query = clause !== undefined ? { year, area_code: clause } : { year }
  return Item.find(query).lean()
}

// Latest verbatim reason per item_number for the target year (G-Y4).
async function getRevisionReasons(year, itemNumbers) {
  if (!itemNumbers.length) return new Map()
  const revisions = await Revision.find({ year, item_number: { $in: itemNumbers } })
    .sort({ at: -1 }).lean()
  const latest = new Map()
  for (const rev of revisions) {
    if (!latest.has(rev.item_number)) latest.set(rev.item_number, rev.reason || '')
  }
  return latest
}

module.exports = { getYearItems, getRevisionReasons }
