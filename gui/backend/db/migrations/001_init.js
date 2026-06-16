// SPEC-DB-001 Phase 1 · reference tables (REQ-2 FK targets).
// area / classification / sub_category / edit_type_code / app_user.

exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE area (
      area_code     char(2) PRIMARY KEY,
      name          text NOT NULL,
      logical_area  text
    );

    CREATE TABLE classification (
      code  char(1) PRIMARY KEY CHECK (code IN ('C','R','B')),
      name  text NOT NULL
    );

    CREATE TABLE sub_category (
      id             serial PRIMARY KEY,
      code           char(3),
      name           text NOT NULL,
      display_order  int NOT NULL DEFAULT 0
    );

    CREATE TABLE edit_type_code (
      code           text PRIMARY KEY,
      label          text NOT NULL,
      display_order  int NOT NULL DEFAULT 0
    );

    CREATE TABLE app_user (
      id             serial PRIMARY KEY,
      username       text UNIQUE NOT NULL,
      password_hash  text,
      role           text NOT NULL DEFAULT 'viewer'
                       CHECK (role IN ('viewer','editor','approver','admin')),
      created_at     timestamptz NOT NULL DEFAULT now()
    );
  `)
}

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE IF EXISTS app_user, edit_type_code, sub_category, classification, area CASCADE;
  `)
}
