// SPEC-DB-001 Phase 4 · DB engine toggle.
// DB_ENGINE=pg routes READ paths to PostgreSQL via knex; writes stay on Mongoose
// until Phase 4b. Default 'mongo' = unchanged behavior (instant rollback = unset/mongo).
// engine() is read per-call so tests can flip process.env.DB_ENGINE at runtime.

function engine() {
  return (process.env.DB_ENGINE || 'mongo').toLowerCase()
}

let _knex
function knex() {
  if (!_knex) {
    const cfg = require('../knexfile')
    _knex = require('knex')(cfg)
  }
  return _knex
}

async function closeKnex() {
  if (_knex) {
    await _knex.destroy()
    _knex = undefined
  }
}

module.exports = { engine, knex, closeKnex }
