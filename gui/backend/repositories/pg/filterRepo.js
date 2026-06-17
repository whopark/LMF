// SPEC-DB-001 Phase 4 · filterRepo knex impl (PostgreSQL).
// Mirrors mongo/filterRepo.js output shape exactly. Normalized schema:
//   years/areas from checklist_item; sub_category via item_content.sub_category_id.
const { knex } = require('../../config/db')

async function getFilters() {
  const k = knex()

  const yearRows = await k('checklist_item').distinct('year').orderBy('year', 'desc')
  const years = yearRows.map(r => r.year).filter(v => v != null)

  // area_code present in data, joined to area.name, collapsed by name (분할분야 → joined codes).
  const areaRows = await k('checklist_item as ci')
    .join('area as a', 'a.area_code', 'ci.area_code')
    .distinct('ci.area_code as code', 'a.name as name')
    .orderBy('ci.area_code', 'asc')
  const byName = new Map()
  for (const a of areaRows) {
    const code = a.code.trim()
    const name = a.name || code
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(code)
  }
  const areas = [...byName.entries()].map(([name, codes]) => ({ code: codes.join(','), name }))

  // 중분류: display_order(심사점검표순). min defends ties; tie-break by name.
  const subRows = await k('item_content as ic')
    .join('sub_category as sc', 'sc.id', 'ic.sub_category_id')
    .whereNotNull('ic.sub_category_id')
    .groupBy('sc.name')
    .min('sc.display_order as ord')
    .select('sc.name as name')
    .orderBy('ord', 'asc')
    .orderBy('sc.name', 'asc')
  const subCategories = subRows.map(r => r.name)

  return { years, areas, subCategories }
}

async function getItemNumbers(area) {
  const k = knex()
  let q = k('checklist_item').distinct('item_number').orderBy('item_number', 'asc')
  const codes = area ? String(area).split(',').map(s => s.trim()).filter(Boolean) : []
  if (codes.length === 1) q = q.where('area_code', codes[0])
  else if (codes.length > 1) q = q.whereIn('area_code', codes)
  const rows = await q
  return rows.map(r => r.item_number).filter(Boolean)
}

module.exports = { getFilters, getItemNumbers }
