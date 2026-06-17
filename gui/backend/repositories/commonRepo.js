// SPEC-DB-001 Phase 4 · commonRepo factory (read; PATCH stays on Mongo via applyCommonEdit).
//   getCommon(key, year?) -> { common_key, year, items:[lean] } | null
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/commonRepo')
const pgImpl = require('./pg/commonRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  getCommon: (...args) => impl().getCommon(...args),
}
