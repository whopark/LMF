// SPEC-DB-001 Phase 4 · changesRepo factory (read).
//   getYearItems(year, area)              -> [lean]
//   getRevisionReasons(year, itemNumbers) -> Map<item_number, reason>
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/changesRepo')
const pgImpl = require('./pg/changesRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  getYearItems: (...args) => impl().getYearItems(...args),
  getRevisionReasons: (...args) => impl().getRevisionReasons(...args),
}
