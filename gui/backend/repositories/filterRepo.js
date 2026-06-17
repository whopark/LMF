// SPEC-DB-001 Phase 4 · filterRepo factory.
// Routes call domain methods only; the engine toggle picks mongo|pg per call.
// Contract (1:1 with legacy routes/filters.js):
//   getFilters()        -> { years:[desc], areas:[{code,name}], subCategories:[name] }
//   getItemNumbers(area)-> [item_number] (sorted; area = single code or comma-joined group)
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/filterRepo')
const pgImpl = require('./pg/filterRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  getFilters: (...args) => impl().getFilters(...args),
  getItemNumbers: (...args) => impl().getItemNumbers(...args),
}
