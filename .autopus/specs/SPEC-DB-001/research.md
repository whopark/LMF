# SPEC-DB-001 · 조사 노트

## 현황 측정 (근거)

`pdf/checklist_items_flat_v2.json`(정본, 9,984) + `gui/backend` 구현(Explore) 실측:

| 발견 | 측정 | 증거 |
|---|---|---|
| 총 문항 | 9,984 (2020~2026; 2026=1,635) | flat_v2 길이·연도 카운트 |
| 분야 | 22 area_code(논리 14, 임상미생물30~36·수혈40~46 분할) | area_code 분포 |
| 공통문항 중복 | `(year,common_key)` 공유(≥2분야) 649그룹·3,893행, 최대 14분야/그룹 | bykey 집계 |
| 공유 내용 동일 | `010.090`/2026 → 14분야 distinct 질문 1종 | question 카운터 |
| 논리 문항 | distinct `(year,common_key)` 6,566 / distinct common_key 1,242 | set 크기 |
| 무결성 결함 | 분류 EMPTY 1,601 · C+score=num 10 · B+score=null 81 · `21.405.120/2025` 중복 · description bleed 702 | classification×score 집계·ETL v9 노트 |
| 현행 영속 | MongoDB+Mongoose, 7컬렉션, **RS 트랜잭션**, JWT 역할, 감사로그, 연도 diff | Explore 매핑·prd-v2 §5 |

현행 7컬렉션: checklist_items, item_revisions, audit_logs, edit_type_codes, auth_users,
revision_worklists, lab_checklists_2026_v8.

> ETL 소스는 **live Mongo 7컬렉션**(이력·감사·lock 보존). flat_v2.json은 초기 seed 전용(편집·이력 없음).

## 결정과 근거

### D1: PostgreSQL 채택 (vs Mongo 유지/Graph/검색엔진)
관계형 신호 5종(공통문항 정규화·ACID 요구·제약부재 결함·참조엔티티·연도 self-join). 규모<10만행이라
성능 무관 → 모델적합성·무결성·트랜잭션이 기준. Mongo는 RS 트랜잭션·N-way 동기화·앱레벨 검증이 구조부채.
Graph=과설계, 검색엔진=주저장소 부적합(트랜잭션/무결성 없음, 보조 인덱스로만 가치).

### D2: 정규화 Variant A (공유콘텐츠 분리) — 채택. Variant B fallback
- **A(채택)**: `item_content(common_key,year)` 공유 1행 + `checklist_item(area,common_key,year)` 분야별
  editorial(workflow/lock/score/분류/na/분야특이/override). 공통편집=1 UPDATE. 중복·동기화 제거.
- **B(fallback)**: 분야당 전체필드 1행(현 Mongo 1:1 포트) + 제약/FK/트랜잭션만 추가. 공통전파는 단일
  SQL 트랜잭션 내 다중행 UPDATE(여전히 ACID, RS 불요). dedup은 못하나 저위험.
- 선택 A 이유: 마이그레이션의 핵심 가치(14× 중복 제거)를 실현. workflow/lock을 분야 행에 두어 per-area
  독립성 보존, 텍스트 분기는 override로 흡수.

#### 핵심 DDL(발췌)
```sql
CREATE TABLE item_content(
  common_key char(7), year smallint, sub_category_id int REFERENCES sub_category(id),
  question text NOT NULL, description text, blocks jsonb,
  PRIMARY KEY(common_key, year));
CREATE TABLE checklist_item(
  area_code char(2) REFERENCES area(area_code), common_key char(7), year smallint,
  item_number text GENERATED ALWAYS AS (area_code||'.'||common_key) STORED,
  item_order int,
  classification char(1) REFERENCES classification(code),  -- nullable=미해결
  score int, na_available bool NOT NULL DEFAULT false,
  field_specific_description text,
  question_override text, description_override text, blocks_override jsonb,
  rev_status text NOT NULL DEFAULT 'none' CHECK (rev_status IN ('none','draft','review','final')),
  locked bool NOT NULL DEFAULT false, revised bool NOT NULL DEFAULT false,
  last_modified_user text, last_modified_at timestamptz, source jsonb,
  PRIMARY KEY(area_code, common_key, year),
  FOREIGN KEY(common_key, year) REFERENCES item_content(common_key, year),
  CHECK (classification <> 'C' OR score IS NULL),
  CHECK (classification NOT IN ('B','R') OR score IS NOT NULL));
ALTER TABLE item_content ADD COLUMN search tsvector GENERATED ALWAYS AS
  (to_tsvector('simple', coalesce(question,'')||' '||coalesce(description,''))) STORED;
```

### D3: 드라이버/마이그레이션 = `pg` + `knex` (vs raw pg / Drizzle / Prisma)
백엔드가 JS(비TS). knex=마이그레이션+쿼리빌더+파라미터화(주입 방지) 일체, 학습비용 낮음. Prisma=과중·
스키마 이중관리, Drizzle=TS 우선이라 차기 TS 전환 시 후보. raw pg+node-pg-migrate도 가하나 knex가 균형.

### D4: 공통 lock 정책 = all-or-nothing + admin override (동작 변경)
현행: 공통편집 시 locked 분야만 skip, 나머지 전파(`skipped_locked`). Variant A는 공유 텍스트가 단일 행
→ 분야별 부분 skip 불가. 정책: 대상에 locked 분야 1+ 존재 시 차단(blocked_locked 반환), admin override로만
강행. final=terminal이라 공통문항이 전 분야 final 도달은 정상 흐름 → 수용 가능. CHANGELOG·AC-9에 명시.
(현 semantics 절대보존이 요건이면 Variant B로 회귀.)
> **확정(2026-06-16)**: 사용자 Variant A + all-or-nothing 수용 → SPEC approved. 동작 변경은 구현 시 CHANGELOG·AC-9 고지.

### D5: 검색 = pg_trgm(문항번호/부분) + tsvector simple(키워드). pgroonga/mecab=차기
§6 검색은 현행 Mongo text index 수준 parity가 목표. simple config tsvector + trgm으로 충분, 한국어
형태소 정밀도는 pgroonga/mecab-ko로 후속 강화(비목표).

### D6: 단일 편집=override, 공유 전파=applyCommonEdit 전용 (REQ-13)
Variant A는 공유 텍스트가 1행 → 단일 문항 PATCH가 공유를 직접 변경하면 타 분야가 의도치 않게 오염된다.
∴ 단일 편집은 분야별 `*_override`에 기록하고, 공유 전파는 명시적 `applyCommonEdit` 경로로만 한정한다.

## Semantic Invariant Inventory

| ID | source 절 | 불변식 유형 | 영향 출력 | AC |
|---|---|---|---|---|
| INV-COMMON-1 | 공통문항=끝6자리 동일 → 동일 문항 | grouping/공유 | 공통 GET/편집 전파 | AC-1, AC-2 |
| INV-COMMON-LOCK | 공통편집 시 locked 분야 처리 | cross-entity 잠금 | applyCommonEdit 결과 | AC-9 (동작 변경 D4) |
| INV-CLASS-SCORE | 핵심C⇒배점없음, 필요/기본⇒배점있음 | numeric/paired | 배점 표시·제약 | AC-4 |
| INV-UNIQUE | 분야-연도당 문항 유일 | dedup/uniqueness | 적재·중복차단 | AC-5 |
| INV-PARITY | 이행 무손실 | parser/migration | ETL 리포트 | AC-6 |
| INV-YEAR-DIFF | 연도 비교 6필드 + verbatim 사유 | ordering/diff | 화면 B | AC-8 |
| INV-FIELD-SPEC | 분야특이 설명 비전파 | override 격리 | 공통 편집 | AC-10 |
| INV-SINGLE-OVR | 단일 편집은 공유 미변형 | override 격리 | 단일 PATCH | AC-16 |
| INV-ATOMIC | item+revision+audit 원자성 | transaction | 편집 저장 | AC-3 |

## 위험
| 위험 | 완화 |
|---|---|
| lock semantics 변경 거부감 | Variant B fallback 문서화, admin override, 고지 |
| 정규화 override 복잡도 | 현 데이터는 공유 시 동일 → override 거의 미사용, ETL이 분기만 격리 |
| 한국어 검색 차이 | parity 스냅샷(AC-7), pgroonga 차기 |
| 테스트 인프라(RS→PG) | pg-mem 우선, 불가 시 testcontainers |

## Self-Verify Summary
| Q | status | attempt | files | reason |
|---|---|---|---|---|
| Q-CORR-01 | PASS | 1 | spec/research | 인용 경로·필드(routes/common.js, withTransaction.js, flat_v2 필드, 7컬렉션) 실측 확인 |
| Q-CORR-02 | PASS | 1 | plan | [NEW] 마커가 신규 산출물에 일관 적용 |
| Q-CORR-03 | PASS | 1 | acceptance | Must oracle이 구체 입력·기대값(6566/9984/14분야/SQLSTATE) 포함, 구조검증 아님 |
| Q-COMP-05 | PASS | 1 | spec | source 절을 evidence로만 인용, 비밀·자격증명·특권경로 미포함, 단일 응집 스토리로 후속작업 비은닉(§5) |

> 셀프리뷰(2026-06-16): F1–F7 반영(review.md 참조). G-D4 수용 확정 → status approved.
