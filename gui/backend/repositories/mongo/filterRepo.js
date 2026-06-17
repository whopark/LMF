// SPEC-DB-001 Phase 4 · filterRepo Mongoose impl (legacy behavior, moved from routes/filters.js).
const Item = require('../../models/Item')
const { areaCodeClause } = require('../../utils/areaFilter')

async function getFilters() {
  const years = await Item.distinct('year')

  // Group by area_code, collapse by area_name so a 분야 spanning multiple codes
  // (임상미생물 30~36, 수혈의학 40/43/46) appears once; code = joined group.
  const areaDocs = await Item.aggregate([
    { $group: { _id: '$area_code', name: { $first: '$area_name' } } },
    { $sort: { _id: 1 } },
  ])
  const byName = new Map()
  for (const a of areaDocs) {
    const name = a.name || a._id
    if (!byName.has(name)) byName.set(name, [])
    byName.get(name).push(a._id)
  }
  const areas = [...byName.entries()].map(([name, codes]) => ({ code: codes.join(','), name }))

  // 중분류: 가나다 아닌 sub_category_order(심사점검표순). min은 방어, 동률은 _id tie-break.
  const subCatDocs = await Item.aggregate([
    { $match: { sub_category: { $nin: [null, ''] } } },
    { $group: { _id: '$sub_category', ord: { $min: '$sub_category_order' } } },
    { $sort: { ord: 1, _id: 1 } },
  ])
  const subCategories = subCatDocs.map(d => d._id)

  return { years: years.filter(Boolean).sort((a, b) => b - a), areas, subCategories }
}

async function getItemNumbers(area) {
  const clause = areaCodeClause(area)
  const query = clause !== undefined ? { area_code: clause } : {}
  const numbers = await Item.distinct('item_number', query)
  return numbers.filter(Boolean).sort()
}

module.exports = { getFilters, getItemNumbers }
