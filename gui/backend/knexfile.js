// Knex configuration for the PostgreSQL persistence engine (SPEC-DB-001).
// Connection comes from PG_URL (gui/backend/.env, gitignored). The Mongo engine
// stays the default until cutover (Phase 7); this only wires migrations/queries.
require('dotenv').config()

const connection =
  process.env.PG_URL || 'postgresql://localhost:5432/lab_accreditation'

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  connection,
  migrations: {
    directory: './db/migrations',
    tableName: 'knex_migrations',
  },
  pool: { min: 0, max: 10 },
}
