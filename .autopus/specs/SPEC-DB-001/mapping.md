# SPEC-DB-001 · MongoDB → PostgreSQL 스키마 매핑

> 스키마 only 매핑(데이터 미포함). 출처 = Mongoose 모델(`gui/backend/models/*.js`,
> Mongo `lab_accreditation` 데이터는 drop된 상태). 대상 = PG Phase 1 정규화 스키마
> (`gui/backend/db/migrations/001~004`, 적용 완료). 정규화 = Variant A(공유 콘텐츠 분리).

## 컬렉션 → 테이블 개요

| Mongo 컬렉션 (모델) | → PG 테이블 | 관계 |
|---|---|---|
| `checklist_items` (Item) | **`item_content` + `checklist_item`** | 1 doc → 공유 1행 + 분야 1행 (dedup 분리) |
| `item_revisions` (Revision) | `item_revision` | 1:1 |
| `audit_logs` (AuditLog) | `audit_log` | 1:1 (필드 통합) |
| `edit_type_codes` (EditTypeCode) | `edit_type_code` | 1:1 |
| `auth_users` (User) | `app_user` | 1:1 |
| `revision_worklists` (Worklist) | `revision_worklist` | 1 doc → N행 (item_numbers[] 펼침) |
| `lab_checklists_2026_v8` (ChecklistItem) | `checklist_import` | 1:1 (메타→jsonb) |
| (파생) area_name/sub_category/classification | `area`·`sub_category`·`classification` | 참조 테이블 시드 |

---

## 1. `checklist_items` → `item_content` + `checklist_item` (핵심 분리)

공유 텍스트는 `(common_key, year)`당 1행으로 dedup, 분야별 편집상태는 분야 행에 둔다.

| Mongo 필드 | 타입 | → PG | 변환/비고 |
|---|---|---|---|
| `item_number` | String | `checklist_item.item_number` | **소스 원본 저장**(개정 2026-06-17, 생성컬럼 폐기) — 분할분야 논리 prefix 보존. PK 일부 |
| `area_code` | String | `checklist_item.area_code` | FK → `area`. PK 일부 (물리 분야) |
| — (item_number prefix) | — | `checklist_item.field_code` | **GENERATED** = `split_part(item_number,'.',1)` — 논리 분야(임상미생물 30~36, 수혈 40~46) |
| `common_key` | String | `checklist_item.common_key` + FK→`item_content` | item_number 끝 7자(`NNN.NNN`). 개정 후 PK 아님(FK만) |
| `year` | Number | PK 일부 | smallint. PK = (area_code, item_number, year) |
| `area_name` | String | `area.name` | 참조 테이블로 정규화 |
| `sub_category` | String | `item_content.sub_category_id` | FK → `sub_category` (텍스트→id, `classification_map.json` 10코드·display_order) |
| `sub_category_order` | Number | `sub_category.display_order` | 참조 테이블 |
| `item_order` | Number | `checklist_item.item_order` | |
| `question` | String | **`item_content.question`** | 공유 1행 |
| `description` | String | **`item_content.description`** | 공유 1행 |
| `field_specific_description` | String | `checklist_item.field_specific_description` | 분야별(미전파) |
| `blocks` | [Mixed] | **`item_content.blocks`** jsonb (+ `checklist_item.blocks_override`) | 공유 jsonb, 분기 시 override |
| `score` | Mixed | `checklist_item.score` int | ⚠️ "예/필수"류 비수치는 적재 시 정규화 필요(CHECK 적용) |
| `classification` | enum C/R/B/'' | `checklist_item.classification` char(1) | **`''`→NULL**(미해결). CHECK: C⇒배점없음, B/R⇒배점필수 |
| `na_available` | Boolean | `checklist_item.na_available` | |
| `revision.status` | enum | `checklist_item.rev_status` | none/draft/review/final |
| `revision.locked` | Boolean | `checklist_item.locked` | |
| `revision.revised` | Boolean | `checklist_item.revised` | |
| `last_modified.{user,at}` | sub | `checklist_item.last_modified_user`,`_at` | |
| `source.{filename,page}` | sub | `checklist_item.source` jsonb | |
| — | | `checklist_item.{question,description}_override` | **신규**: 단일 편집 격리(REQ-13). Mongo엔 없음 |
| — | | `item_content.search` tsvector | 생성컬럼(검색, REQ-7) |

> 효과: 동일 `(common_key,year)`의 14개 분야 행 → `item_content` 1행 공유 → 14× 중복 제거.

---

## 2. `item_revisions` → `item_revision`

| Mongo 필드 | → PG | 비고 |
|---|---|---|
| `item_number`,`area_code`,`common_key`,`year` | 동명 컬럼 | |
| `user` | `revised_by` | |
| `at` (Date) | `revised_at` timestamptz | |
| `edit_types` [String] | `edit_type_code` (단일 FK) | ⚠️ **갭**: Mongo는 배열, PG는 단일 FK → 다중 시 junction 필요(미해결) |
| `reason` | (없음) | ⚠️ 갭: PG는 `raw_reason`만 보유 |
| `raw_reason` | `raw_reason` | verbatim(REQ 연도추적) |
| `reason_hash` | `content_hash` | SHA-256 |
| `before` / `after` (snapshot) | `before_json` / `after_json` jsonb | {question,description,score,classification,na_available} |
| `status_at_save` | (없음) | ⚠️ 갭: 필요 시 컬럼 추가 또는 before_json에 포함 |
| `score_changed` | `score_changed` | |

---

## 3. `audit_logs` → `audit_log` (필드 통합)

| Mongo | → PG | 비고 |
|---|---|---|
| `action` | `event` | |
| `user` | `actor` | |
| `resource_type`+`resource_id` | `target` | 결합(예: `item:07.405.420`) |
| `role`,`ip`,`details` | `detail` jsonb | 통합 보관 |
| `at` | `at` timestamptz | |

## 4. `edit_type_codes` → `edit_type_code`

| Mongo | → PG | 비고 |
|---|---|---|
| `code`(unique) | `code` PK | |
| `label` | `label` | |
| `order` | `display_order` | |
| `active` | (없음) | ⚠️ 갭: 비활성 표현 불가 → 컬럼 추가 또는 적재 시 active만 |

## 5. `auth_users` → `app_user`

| Mongo | → PG | 비고 |
|---|---|---|
| `name` | `username` (UNIQUE) | |
| `role` enum | `role` | viewer/editor/approver/admin (CHECK 동일) |
| `password_hash` | `password_hash` | **verbatim 이행**(재해싱 금지) |
| `created_at` | `created_at` | |
| `active`,`last_login` | (없음) | ⚠️ 갭: 필요 시 컬럼 추가 |

## 6. `revision_worklists` → `revision_worklist` (배열 펼침)

| Mongo | → PG | 비고 |
|---|---|---|
| `user` | `owner` | |
| `year` | `year` | |
| `item_numbers` [String] | `item_number` (N행) | ⚠️ 1 doc → item당 1행으로 **denormalize** |
| `updated_at` | `created_at` | (의미 근접; 명칭 차이) |
| — | `status` | Mongo엔 없음(기본 NULL) |

## 7. `lab_checklists_2026_v8` → `checklist_import` (메타→jsonb)

| Mongo | → PG | 비고 |
|---|---|---|
| `filename` | `source_name` | |
| `year` | `year` | |
| `page_count` | `page` | (또는 meta) |
| `imported_at` | `imported_at` | |
| 나머지(category,title,structured_sections,total_items,tags,status,parsed_at,parser_version,imported_via) | `meta` jsonb | 통합 |

---

## 스키마 갭 요약 (Phase 4/5 ETL 전 결정 필요)

1. **edit_types[] → 단일 FK**: 다중 수정유형/개정 시 `item_revision_edit_type` junction 테이블 또는 배열 컬럼 필요.
2. **누락 컬럼**: `item_revisions.reason`/`status_at_save`, `edit_type_codes.active`, `auth_users.active`/`last_login` — 보존하려면 마이그레이션 추가.
3. **score Mixed**: 비수치(예/필수) 값의 적재 규칙(별도 플래그 vs 정규화) 확정 필요(현 데이터: C+숫자 10, B+null 81).
4. **`*_override` 신규**: Mongo엔 없는 PG 고유 컬럼(단일편집 격리) — ETL 시 모두 NULL로 적재(분기는 question 텍스트 상이 시에만 격리).
5. **참조 시드**: area(22)·classification(3)·sub_category(10코드)·edit_type_code·app_user는 Mongo 1:1이 아닌 파생/시드(plan T2.5).

> 이 문서는 스키마 매핑만 다룬다. 실제 데이터 ETL/parity(Phase 2~3)는 live Mongo 데이터 복원 후 진행.
