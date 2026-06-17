// SPEC-DB-001 Phase 4 · changesRepo knex impl (PostgreSQL, read).
const { knex } = require('../../config/db')
const { base, cols, toLean } = require('./itemQuery')

async function getYearItems(year, area) {
  const k = knex()
  let q = base(k).select(cols(k)).where('ci.year', year)
  const codes = area ? String(area).split(',').map(s => s.trim()).filter(Boolean) : []
  if (codes.length === 1) q = q.where('ci.area_code', codes[0])
  else if (codes.length > 1) q = q.whereIn('ci.area_code', codes)
  const rows = await q
  return rows.map(toLean)
}

// Latest verbatim reason (item_revision.raw_reason) per item_number for the target year.
async function getRevisionReasons(year, itemNumbers) {
  if (!itemNumbers.length) return new Map()
  const k = knex()
  const rows = await k('item_revision')
    .whereIn('item_number', itemNumbers)
    .where('year', year)
    .orderBy('revised_at', 'desc')
    .select('item_number', 'raw_reason')
  const latest = new Map()
  for (const r of rows) {
    if (!latest.has(r.item_number)) latest.set(r.item_number, r.raw_reason || '')
  }
  return latest
}

module.exports = { getYearItems, getRevisionReasons }
