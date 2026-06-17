// SPEC-DB-001 (read+write cutover) · worklistRepo knex impl. revision_worklist stores one ROW
// per (owner, item_number, year) — the Mongo Worklist's item_numbers[] expanded (mapping.md).
const { knex } = require('../../config/db')

async function get(user, year) {
  const k = knex()
  const rows = await k('revision_worklist').where({ owner: user, year })
    .select('item_number').orderBy('created_at')
  const upd = await k('revision_worklist').where({ owner: user, year }).max('created_at as m').first()
  return { item_numbers: rows.map(r => r.item_number), updated_at: upd?.m || null }
}

// Replace the user's worklist for the year atomically (delete + re-insert the array as rows).
async function set(user, year, item_numbers) {
  const k = knex()
  return k.transaction(async (trx) => {
    await trx('revision_worklist').where({ owner: user, year }).del()
    if (item_numbers.length) {
      await trx('revision_worklist').insert(
        item_numbers.map(n => ({ owner: user, year, item_number: n })))
    }
    return { item_numbers, year }
  })
}

async function clear(user, year) {
  const k = knex()
  await k('revision_worklist').where({ owner: user, year }).del()
}

module.exports = { get, set, clear }
