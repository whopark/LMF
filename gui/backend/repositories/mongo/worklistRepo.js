// SPEC-DB-001 (read+write cutover) · worklistRepo Mongoose impl. One doc per (user, year)
// with an item_numbers array.
const Worklist = require('../../models/Worklist')

async function get(user, year) {
  const wl = await Worklist.findOne({ user, year }).lean()
  return { item_numbers: wl?.item_numbers || [], updated_at: wl?.updated_at || null }
}

async function set(user, year, item_numbers) {
  const wl = await Worklist.findOneAndUpdate(
    { user, year },
    { item_numbers, updated_at: new Date() },
    { upsert: true, new: true },
  ).lean()
  return { item_numbers: wl.item_numbers, year: wl.year }
}

async function clear(user, year) {
  await Worklist.findOneAndUpdate({ user, year }, { item_numbers: [], updated_at: new Date() })
}

module.exports = { get, set, clear }
