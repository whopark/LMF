// SPEC-DB-001 Phase 4 · itemRepo factory (read paths; writes still on Mongo via revisionTxn).
// Contract (1:1 with legacy routes/items.js):
//   listItems(opts, {skip,limit}) -> { items:[leanItem], total }
//   getCategories(year)           -> [{category, title}]
//   getByNumber(code)             -> [leanItem] (year desc)
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/itemRepo')
const pgImpl = require('./pg/itemRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  listItems: (...args) => impl().listItems(...args),
  getCategories: (...args) => impl().getCategories(...args),
  getByNumber: (...args) => impl().getByNumber(...args),
  listAllForExport: (...args) => impl().listAllForExport(...args),
}
