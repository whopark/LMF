// SPEC-DB-001 Phase 4b · item_revision fields to match the Mongo Revision shape (no-loss).
// 003 stored edit_type_code (single) + content_hash but lacked the array edit_types[] and
// status_at_save that the write path captures. Add them so PG revision writes round-trip
// faithfully. Additive — applies via migrate:latest WITHOUT touching loaded data (001~004).
exports.up = async (knex) => {
  await knex.raw(`
    ALTER TABLE item_revision
      ADD COLUMN edit_types     jsonb,
      ADD COLUMN status_at_save text;
  `)
}

exports.down = async (knex) => {
  await knex.raw(`
    ALTER TABLE item_revision
      DROP COLUMN IF EXISTS status_at_save,
      DROP COLUMN IF EXISTS edit_types;
  `)
}
