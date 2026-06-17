// SPEC-DB-001 (read cutover) · revisionRepo factory (mongo|pg).
//   listForExport(filters) -> [Revision-shape lean] (sorted at desc); filters: area, year, score_changed
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/revisionRepo')
const pgImpl = require('./pg/revisionRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  listForExport: (...args) => impl().listForExport(...args),
}
