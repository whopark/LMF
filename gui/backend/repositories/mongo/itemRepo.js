// SPEC-DB-001 Phase 4 · itemRepo Mongoose impl (read paths moved from routes/items.js).
// Returns flat Item-shape lean docs; routes apply toResponse() for the API contract.
const Item = require('../../models/Item')
const Revision = require('../../models/Revision')
const { areaCodeClause } = require('../../utils/areaFilter')

function safeYear(value) {
  const n = parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) ? n : undefined
}

async function buildQuery(opts) {
  const {
    area, sub_category, year, search, search_field, classification,
    revised_only, score_min, score_max, score_null, modified_after, modified_before,
  } = opts
  const query = {}
  const areaClause = areaCodeClause(area)
  if (areaClause !== undefined) query.area_code = areaClause
  const parsedYear = safeYear(year)
  if (parsedYear !== undefined) query.year = parsedYear
  if (sub_category) query.sub_category = sub_category
  if (classification) query.classification = classification
  if (revised_only === 'true') query['revision.revised'] = true

  if (score_null === 'true') {
    query.$or = [{ score: null }, { score: { $exists: false } }, { classification: 'C' }]
  } else {
    const sMin = score_min !== undefined ? parseInt(score_min) : undefined
    const sMax = score_max !== undefined ? parseInt(score_max) : undefined
    if (!Number.isNaN(sMin) && sMin !== undefined) query.score = { ...(query.score || {}), $gte: sMin }
    if (!Number.isNaN(sMax) && sMax !== undefined) query.score = { ...(query.score || {}), $lte: sMax }
  }

  if (modified_after || modified_before) {
    const dateFilter = {}
    if (modified_after) { const d = new Date(String(modified_after)); if (!isNaN(d.getTime())) dateFilter.$gte = d }
    if (modified_before) {
      const d = new Date(String(modified_before))
      if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); dateFilter.$lte = d }
    }
    if (Object.keys(dateFilter).length > 0) query['last_modified.at'] = dateFilter
  }

  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')
    if (search_field === 'item_number') query.item_number = regex
    else if (search_field === 'question') query.question = regex
    else if (search_field === 'description') query.description = regex
    else if (search_field === 'modifier') query['last_modified.user'] = regex
    else if (search_field === 'edit_type') {
      const matching = await Revision.distinct('item_number', { edit_types: regex })
      query.item_number = { $in: matching }
    } else {
      query.$or = [{ item_number: regex }, { question: regex }, { description: regex }]
    }
  }
  return query
}

async function listItems(opts, { skip, limit }) {
  const query = await buildQuery(opts)
  const total = await Item.countDocuments(query)
  const items = await Item.find(query)
    .sort({ sub_category_order: 1, item_order: 1 })
    .skip(skip).limit(limit).lean()
  return { items, total }
}

async function getCategories(year) {
  const query = year ? { year: parseInt(year) } : {}
  const areas = await Item.aggregate([
    { $match: query },
    { $group: { _id: '$area_code', area_name: { $first: '$area_name' }, year: { $first: '$year' } } },
    { $sort: { _id: 1 } },
  ])
  return areas.map(a => ({ category: a._id, title: `${a._id}.${a.area_name || ''}_${a.year || ''}` }))
}

async function getByNumber(code) {
  return Item.find({ item_number: code }).sort({ year: -1 }).lean()
}

module.exports = { listItems, getCategories, getByNumber }
