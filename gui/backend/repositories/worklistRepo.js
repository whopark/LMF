// SPEC-DB-001 (read+write cutover) · worklistRepo factory (mongo|pg).
//   get(user, year) -> { item_numbers, updated_at }
//   set(user, year, item_numbers) -> { item_numbers, year }
//   clear(user, year) -> void
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/worklistRepo')
const pgImpl = require('./pg/worklistRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  get: (...args) => impl().get(...args),
  set: (...args) => impl().set(...args),
  clear: (...args) => impl().clear(...args),
}
