// SPEC-DB-001 Phase 4 · itemRepo knex impl (PostgreSQL, read paths).
// Query builders (base/cols/toLean) shared via ./itemQuery so common/changes reuse them.
const { knex } = require('../../config/db')
const { base, cols, toLean } = require('./itemQuery')

function applyFilters(q, k, opts) {
  const {
    area, sub_category, year, classification, revised_only,
    score_min, score_max, score_null, modified_after, modified_before, search, search_field,
  } = opts
  const codes = area ? String(area).split(',').map(s => s.trim()).filter(Boolean) : []
  if (codes.length === 1) q.where('ci.area_code', codes[0])
  else if (codes.length > 1) q.whereIn('ci.area_code', codes)
  const y = parseInt(String(year ?? ''), 10)
  if (Number.isFinite(y)) q.where('ci.year', y)
  if (sub_category) q.where('sc.name', sub_category)
  if (classification) q.where('ci.classification', classification)
  if (revised_only === 'true') q.where('ci.revised', true)

  if (score_null === 'true') {
    q.where(function () { this.whereNull('ci.score').orWhere('ci.classification', 'C') })
  } else {
    const sMin = score_min !== undefined ? parseInt(score_min) : undefined
    const sMax = score_max !== undefined ? parseInt(score_max) : undefined
    if (Number.isFinite(sMin)) q.where('ci.score', '>=', sMin)
    if (Number.isFinite(sMax)) q.where('ci.score', '<=', sMax)
  }

  if (modified_after) { const d = new Date(String(modified_after)); if (!isNaN(d.getTime())) q.where('ci.last_modified_at', '>=', d) }
  if (modified_before) {
    const d = new Date(String(modified_before))
    if (!isNaN(d.getTime())) { d.setHours(23, 59, 59, 999); q.where('ci.last_modified_at', '<=', d) }
  }

  if (search) {
    const like = `%${String(search)}%`
    if (search_field === 'item_number') q.where('ci.item_number', 'ilike', like)
    else if (search_field === 'question') q.whereRaw('COALESCE(ci.question_override, ic.question) ILIKE ?', [like])
    else if (search_field === 'description') q.whereRaw('COALESCE(ci.description_override, ic.description) ILIKE ?', [like])
    else if (search_field === 'modifier') q.where('ci.last_modified_user', 'ilike', like)
    else if (search_field === 'edit_type') {
      q.whereIn('ci.item_number', k('item_revision').distinct('item_number').where('edit_type_code', 'ilike', like))
    } else {
      q.where(function () {
        this.where('ci.item_number', 'ilike', like)
          .orWhereRaw('COALESCE(ci.question_override, ic.question) ILIKE ?', [like])
          .orWhereRaw('COALESCE(ci.description_override, ic.description) ILIKE ?', [like])
      })
    }
  }
  return q
}

async function listItems(opts, { skip, limit }) {
  const k = knex()
  const [{ count }] = await applyFilters(base(k), k, opts).count({ count: '*' })
  const rows = await applyFilters(base(k), k, opts)
    .select(cols(k))
    .orderBy('sc.display_order', 'asc')
    .orderBy('ci.item_order', 'asc')
    .offset(skip).limit(limit)
  return { items: rows.map(toLean), total: parseInt(count, 10) }
}

async function getCategories(year) {
  const k = knex()
  let q = k('checklist_item as ci').leftJoin('area as a', 'a.area_code', 'ci.area_code')
  const y = parseInt(String(year ?? ''), 10)
  if (Number.isFinite(y)) q = q.where('ci.year', y)
  const rows = await q
    .select('ci.area_code as code')
    .max('a.name as area_name')
    .max('ci.year as year')
    .groupBy('ci.area_code')
    .orderBy('ci.area_code', 'asc')
  return rows.map(a => {
    const code = (a.code || '').trim()
    return { category: code, title: `${code}.${a.area_name || ''}_${a.year || ''}` }
  })
}

async function getByNumber(code) {
  const k = knex()
  const rows = await base(k).select(cols(k)).where('ci.item_number', code).orderBy('ci.year', 'desc')
  return rows.map(toLean)
}

module.exports = { listItems, getCategories, getByNumber }
