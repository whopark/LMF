// SPEC-DB-001 (read cutover) · editTypeRepo knex impl. edit_type_code(code, label, display_order);
// all rows are active (no 'active' column). Seeds DEFAULT_CODES on first call when empty.
const { knex } = require('../../config/db')
const { DEFAULT_CODES } = require('../../models/EditTypeCode')

function select(k) {
  return k('edit_type_code').select('code', 'label', 'display_order as order').orderBy('display_order')
}

async function listActive() {
  const k = knex()
  let rows = await select(k)
  if (rows.length === 0) {
    await k('edit_type_code')
      .insert(DEFAULT_CODES.map(c => ({ code: c.code, label: c.label, display_order: c.order })))
      .onConflict('code').ignore()
    rows = await select(k)
  }
  return rows.map(r => ({ code: r.code, label: r.label, order: r.order, active: true }))
}

module.exports = { listActive }
