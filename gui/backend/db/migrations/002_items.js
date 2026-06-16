// SPEC-DB-001 Phase 1 · normalized item tables (Variant A, REQ-1/2/8/13).
// item_content = shared content 1 row per (common_key, year).
// checklist_item = per-area projection (editorial state + per-area overrides).
// Constraints enforce AC-4 (classification<->score) and AC-5 (per-area-year UNIQUE = PK).

exports.up = async (knex) => {
  await knex.raw(`
    CREATE TABLE item_content (
      common_key       char(7) NOT NULL,
      year             smallint NOT NULL,
      sub_category_id  int REFERENCES sub_category(id),
      question         text NOT NULL,
      description      text,
      blocks           jsonb,
      PRIMARY KEY (common_key, year)
    );

    CREATE TABLE checklist_item (
      area_code                 char(2) NOT NULL REFERENCES area(area_code),
      common_key                char(7) NOT NULL,
      year                      smallint NOT NULL,
      item_number               text GENERATED ALWAYS AS (area_code || '.' || common_key) STORED,
      item_order                int,
      classification            char(1) REFERENCES classification(code),  -- NULL = 미해결(허용)
      score                     int,
      na_available              boolean NOT NULL DEFAULT false,
      field_specific_description text,
      question_override         text,
      description_override      text,
      blocks_override           jsonb,
      rev_status                text NOT NULL DEFAULT 'none'
                                  CHECK (rev_status IN ('none','draft','review','final')),
      locked                    boolean NOT NULL DEFAULT false,
      revised                   boolean NOT NULL DEFAULT false,
      last_modified_user        text,
      last_modified_at          timestamptz,
      source                    jsonb,
      PRIMARY KEY (area_code, common_key, year),
      FOREIGN KEY (common_key, year) REFERENCES item_content (common_key, year),
      -- 핵심(C)은 배점 없음
      CONSTRAINT ck_core_no_score   CHECK (classification <> 'C' OR score IS NULL),
      -- 기본(B)/필요(R)는 배점 필수 (분류 NULL=미해결은 허용)
      CONSTRAINT ck_scored_has_score CHECK (classification NOT IN ('B','R') OR score IS NOT NULL)
    );
  `)
}

exports.down = async (knex) => {
  await knex.raw(`
    DROP TABLE IF EXISTS checklist_item, item_content CASCADE;
  `)
}
