// SPEC-DB-001 Phase 4 · shared knex builders for the PG item read model.
// De-normalizes checklist_item ⨝ item_content ⨝ area ⨝ sub_category back into the flat
// Item-shape the routes expect. Shared fields come from item_content unless the per-area
// row carries an override (COALESCE). _id is synthesized (PG has no ObjectId); editing
// stays on Mongo until Phase 4b, so the synthetic id is read-only display only.

function base(k) {
  return k('checklist_item as ci')
    .leftJoin('item_content as ic', function () {
      this.on('ic.common_key', 'ci.common_key').andOn('ic.year', 'ci.year')
    })
    .leftJoin('area as a', 'a.area_code', 'ci.area_code')
    .leftJoin('sub_category as sc', 'sc.id', 'ic.sub_category_id')
}

function cols(k) {
  return [
    'ci.area_code', 'ci.item_number', 'ci.common_key', 'ci.year',
    'ci.classification', 'ci.score', 'ci.na_available',
    'ci.field_specific_description', 'ci.item_order',
    'ci.rev_status', 'ci.locked', 'ci.revised',
    'ci.last_modified_user', 'ci.last_modified_at',
    k.raw('COALESCE(ci.question_override, ic.question) as question'),
    k.raw('COALESCE(ci.description_override, ic.description) as description'),
    k.raw('COALESCE(ci.blocks_override, ic.blocks) as blocks'),
    'a.name as area_name',
    'sc.name as sub_category',
    'sc.display_order as sub_category_order',
  ]
}

function toLean(r) {
  const ac = (r.area_code || '').trim()
  return {
    _id: `${ac}.${r.item_number}.${r.year}`,
    area_code: ac,
    sub_category: r.sub_category || '',
    item_number: r.item_number,
    common_key: (r.common_key || '').trim(),
    year: r.year,
    area_name: r.area_name || '',
    question: r.question || '',
    description: r.description || '',
    field_specific_description: r.field_specific_description || '',
    blocks: r.blocks || [],
    score: r.score,
    classification: r.classification || '',
    na_available: r.na_available || false,
    revision: { status: r.rev_status, locked: r.locked, revised: r.revised },
    last_modified: (r.last_modified_user || r.last_modified_at)
      ? { user: r.last_modified_user, at: r.last_modified_at } : null,
  }
}

// Decode the synthetic _id (`area_code.item_number.year`) back to PK parts.
// area_code = first segment (char(2)), year = last segment (4 digits), item_number = the
// middle (it contains dots itself). Returns null if malformed. encodeId mirrors toLean's _id.
function encodeId(area_code, item_number, year) {
  return `${area_code}.${item_number}.${year}`
}

function decodeId(id) {
  const parts = String(id ?? '').split('.')
  if (parts.length < 3) return null
  const area_code = parts[0]
  const year = parseInt(parts[parts.length - 1], 10)
  const item_number = parts.slice(1, -1).join('.')
  if (!area_code || !item_number || !Number.isFinite(year)) return null
  return { area_code, item_number, year }
}

module.exports = { base, cols, toLean, encodeId, decodeId }
