// SPEC-DB-001 Phase 4b · writeRepo factory (engine-aware atomic writes).
// 4b-1 applyItemEdit · 4b-2 applyCommonEdit · 4b-3 unlockItem + transitionItem.
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/writeRepo')
const pgImpl = require('./pg/writeRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  applyItemEdit: (...args) => impl().applyItemEdit(...args),
  applyCommonEdit: (...args) => impl().applyCommonEdit(...args),
  unlockItem: (...args) => impl().unlockItem(...args),
  transitionItem: (...args) => impl().transitionItem(...args),
}
