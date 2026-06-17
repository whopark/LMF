// SPEC-DB-001 Phase 4 · commonRepo knex impl (PostgreSQL, read).
const { knex } = require('../../config/db')
const { base, cols, toLean } = require('./itemQuery')

// G-1 year isolation: explicit year, else MAX(year) for the common_key.
async function getCommon(key, year) {
  const k = knex()
  let y = parseInt(String(year ?? ''), 10)
  if (!Number.isFinite(y)) {
    const r = await k('checklist_item').where('common_key', key).max('year as y').first()
    if (!r || r.y == null) return null
    y = r.y
  }
  const rows = await base(k).select(cols(k))
    .where('ci.common_key', key)
    .where('ci.year', y)
    .orderBy('ci.area_code', 'asc')
  if (rows.length === 0) return null
  return { common_key: key, year: y, items: rows.map(toLean) }
}

module.exports = { getCommon }
