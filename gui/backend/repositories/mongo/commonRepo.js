// SPEC-DB-001 Phase 4 · commonRepo Mongoose impl (read; moved from routes/common.js GET).
const Item = require('../../models/Item')

// G-1 year isolation: scope to ONE year (explicit ?year, else latest year present).
// Returns { common_key, year, items:[lean] } or null (404).
async function getCommon(key, year) {
  const query = { common_key: key }
  if (year) {
    query.year = parseInt(year, 10)
  } else {
    const latest = await Item.findOne({ common_key: key }).sort({ year: -1 }).select('year').lean()
    if (!latest) return null
    query.year = latest.year
  }
  const items = await Item.find(query).sort({ area_code: 1 }).lean()
  if (items.length === 0) return null
  return { common_key: key, year: query.year, items }
}

module.exports = { getCommon }
