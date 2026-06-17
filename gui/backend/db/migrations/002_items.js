// SPEC-DB-001 Phase 1 · normalized item tables (Variant A, REQ-1/2/8/13).
// item_content = shared content 1 row per (common_key, year).
// checklist_item = per-(area, item_number) projection (editorial state + per-area overrides).
// Constraints enforce AC-4 (classification<->score) and AC-5 (per-area-item-year UNIQUE = PK).
//
// Split-area data model: 임상미생물(물리 area 30~36)·수혈의학(40~46)은 여러 논리 분야가
// 하나의 물리 area_code(36/46)에 통합 저장되며, item_number가 논리 분야 prefix를 보존한다
// (예: area_code=36 + item_number=30.301.340). 따라서 item_number는 소스 원본을 그대로 저장하고
// (생성컬럼 아님), PK는 (area_code, item_number, year) — 분할분야 168 + 이상치 1 충돌을 0으로 해소.

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
      item_number               text NOT NULL,  -- 소스 원본 (분할분야 논리 prefix 보존, parity 100%)
      field_code                text GENERATED ALWAYS AS (split_part(item_number, '.', 1)) STORED,  -- 논리 분야 (임상미생물 30~36, 수혈 40~46)
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
      PRIMARY KEY (area_code, item_number, year),
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
