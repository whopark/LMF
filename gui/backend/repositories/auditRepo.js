// SPEC-DB-001 (read cutover) · auditRepo factory (mongo|pg).
//   list(filters, {skip,limit}) -> { logs, total }; filters: user, action, resource_type
const { engine } = require('../config/db')
const mongoImpl = require('./mongo/auditRepo')
const pgImpl = require('./pg/auditRepo')

function impl() {
  return engine() === 'pg' ? pgImpl : mongoImpl
}

module.exports = {
  list: (...args) => impl().list(...args),
}
