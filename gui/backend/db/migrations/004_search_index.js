// SPEC-DB-001 Phase 1 · search vector + indexes (REQ-7, plan T1.4).
// pg_trgm is a "trusted" extension since PG13 → the DB owner can create it
// without superuser. tsvector uses 'simple' config (Korean morphology = 차기, D5).

exports.up = async (knex) => {
  await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    ALTER TABLE item_content
      ADD COLUMN search tsvector GENERATED ALWAYS AS (
        to_tsvector('simple', coalesce(question,'') || ' ' || coalesce(description,''))
      ) STORED;

    CREATE INDEX idx_item_content_search        ON item_content USING gin (search);
    CREATE INDEX idx_item_content_question_trgm ON item_content USING gin (question gin_trgm_ops);

    CREATE INDEX idx_checklist_item_year_area   ON checklist_item (year, area_code, common_key);
    CREATE INDEX idx_checklist_item_common_year ON checklist_item (common_key, year);
    CREATE INDEX idx_checklist_item_field_year  ON checklist_item (field_code, year);

    CREATE INDEX idx_item_revision_item_at      ON item_revision (item_number, revised_at DESC);
  `)
}

exports.down = async (knex) => {
  await knex.raw(`
    DROP INDEX IF EXISTS idx_item_revision_item_at,
                         idx_checklist_item_field_year,
                         idx_checklist_item_common_year,
                         idx_checklist_item_year_area,
                         idx_item_content_question_trgm,
                         idx_item_content_search;
    ALTER TABLE item_content DROP COLUMN IF EXISTS search;
    -- pg_trgm extension is left in place (may be shared by other objects).
  `)
}
