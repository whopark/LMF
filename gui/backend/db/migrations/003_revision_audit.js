// SPEC-DB-001 Phase 1 · revision history / audit / worklist / import metadata.
// item_revision is immutable (REQ-4, AC-3 atomic write target).

exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE item_revision (
      id             bigserial PRIMARY KEY,
      item_number    text NOT NULL,
      area_code      char(2),
      common_key     char(7),
      year           smallint,
      edit_type_code text REFERENCES edit_type_code(code),
      before_json    jsonb,
      after_json     jsonb,
      raw_reason     text,            -- verbatim 수정사유 (AC-8 diff에 첨부)
      score_changed  boolean,
      revised_by     text,
      revised_at     timestamptz NOT NULL DEFAULT now(),
      content_hash   text
    );

    CREATE TABLE audit_log (
      id      bigserial PRIMARY KEY,
      event   text NOT NULL,
      actor   text,
      target  text,
      detail  jsonb,
      at      timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE revision_worklist (
      id          bigserial PRIMARY KEY,
      owner       text NOT NULL,
      item_number text,
      year        smallint,
      status      text,
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE checklist_import (
      id           bigserial PRIMARY KEY,
      source_name  text,
      year         smallint,
      page         int,
      meta         jsonb,
      imported_at  timestamptz NOT NULL DEFAULT now()
    );
  `)
}

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE IF EXISTS checklist_import, revision_worklist, audit_log, item_revision CASCADE;
  `)
}
