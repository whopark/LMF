// SPEC-DB-001 Phase 4b · writeRepo factory (engine-aware atomic writes).
// Phase 4b-1: applyItemEdit. applyCommonEdit/unlockItem/transition follow (still on Mongo).
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/writeRepo')
const pgImpl = require('./pg/writeRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  applyItemEdit: (...args) => impl().applyItemEdit(...args),
}
