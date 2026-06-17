// SPEC-DB-001 (read cutover) · editTypeRepo factory (mongo|pg).
//   listActive() -> [{ code, label, order, active }] (seeds DEFAULT_CODES when empty)
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/editTypeRepo')
const pgImpl = require('./pg/editTypeRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  listActive: (...args) => impl().listActive(...args),
}
