# SPEC-DB-001 · 구현 계획

> 엔진 교체 = 1 응집 스토리. Phase 0→8 순차, 일부 병렬 가능. WORKING_DIR=`gui/backend` + `pdf/`.
> 전략: 9,984행은 소량이라 **one-shot 컷오버 + 즉시 롤백 가능**(이중쓰기 불필요). Mongo는 컷오버
> 검증 통과까지 source of truth로 보존.

## Phase 0: 결정 · 인프라 (REQ-1, REQ-11)

- T0.1 의사결정 확정: 정규화 Variant A, 드라이버=`pg`+`knex`(마이그레이션/쿼리빌더), lock 정책=
  all-or-nothing+admin override, 검색=pg_trgm+tsvector (research.md D1–D5).
- T0.2 PostgreSQL 16 로컬 프로비저닝(docker 또는 네이티브), DB `lab_accreditation`.
- T0.3 확장 설치: `CREATE EXTENSION pg_trgm;` (선택 `pgroonga`/`mecab-ko`는 차기).
- T0.4 `gui/backend/package.json`에 `pg@^8`, `knex@^3` 추가. `.env.example`에 `PG_URL` 추가.

소요: ~30분. 의존: 없음.

## Phase 1: 스키마 DDL + 마이그레이션 (REQ-1, REQ-2, REQ-8, REQ-10)

- T1.1 `gui/backend/db/migrations/001_init.js` [NEW]: reference 테이블(area/classification/
  sub_category/edit_type_code/app_user).
- T1.2 `002_items.js` [NEW]: `item_content`, `checklist_item`(생성컬럼 item_number, FK, CHECK).
- T1.3 `003_revision_audit.js` [NEW]: `item_revision`, `audit_log`, `revision_worklist`, `checklist_import`.
- T1.4 `004_search_index.js` [NEW]: `item_content.search` tsvector 생성컬럼 + GIN, `question` trgm GIN,
  `checklist_item(year, area_code, ...)` 복합, `(common_key, year)`, revision `(item_number, at desc)`.
- T1.5 CHECK 정의: `classification<>'C' OR score IS NULL`,
  `classification NOT IN ('B','R') OR score IS NOT NULL`(분류 null=미해결 허용).
- T1.6 `knex migrate:latest`로 적용·검증.

소요: ~3시간. 의존: T0.

## Phase 2: ETL Mongo→PG parity (REQ-6)

- T2.1 `gui/backend/scripts/migrate-mongo-pg.js` [NEW]: 입력=**live MongoDB rs0(source of truth)**.
  flat_v2.json은 신규 설치 시 seed로만 사용(편집·이력 부재).
- T2.2 정규화 변환: 분야 무관 공유필드(question/description/blocks/sub_category)를 `(common_key,year)`로
  **dedup** 적재(공유 1행) → 분야별 행은 editorial 필드만.
- T2.3 분기 감지: 같은 `(common_key,year)`에서 분야 간 질문 텍스트가 다르면 `question_override`에 격리하고
  리포트(현 데이터는 공유 시 동일하나 방어).
- T2.4 제약 위반 레코드(C+score, 중복키, 분류 null 등)는 **드롭 금지** → `etl_report.md`에 분류 집계.
- T2.5 reference 시드: area 22, classification 3, sub_category(93 중분류명→10코드 매핑은
  `pdf/classification_map.json` 사용, display_order=10코드순), edit_type_code, app_user(admin).
- T2.6 멱등: 재실행 시 동일 결과(upsert), dry-run 기본.
- T2.7 **나머지 6개 컬렉션 이행**: item_revisions→item_revision, audit_logs→audit_log,
  auth_users→app_user(password_hash 그대로), revision_worklists→revision_worklist,
  edit_type_codes→edit_type_code, lab_checklists_2026_v8→checklist_import. lock/rev_status/revised 보존.

소요: ~1일. 의존: T1.

## Phase 3: Parity 검증 (REQ-6)

- T3.1 행 parity: PG `checklist_item` 수 == flat_v2 9,984. 연도별 분포 일치(2026=1,635 등).
- T3.2 dedup factor: `item_content` 행 수 == distinct `(year,common_key)` == 6,566.
- T3.3 공통 spot: `010.090`/2026 → 14 분야 행이 동일 `item_content` 참조.
- T3.4 제약 커버리지: ETL 리포트의 위반 집계 == 사전 측정(EMPTY 1,601, C+num 10, B+null 81 등).
- T3.5 무손실: 모든 `item_number`+`year`가 PG에 존재(set diff = ∅).
- T3.6 부가 컬렉션 parity: item_revision/audit_log/app_user/revision_worklist 행 수가 Mongo 원본과 일치,
  locked=final 문항 수·rev_status 분포 보존.

소요: ~4시간. 의존: T2.

## Phase 4: Repository 추상화 + 엔진 스왑 (REQ-11, REQ-3, REQ-4)

- T4.1 `gui/backend/repositories/itemRepo.js` [NEW]: 인터페이스(getByNumber, listByYear, patchItem,
  getCommon, applyCommonEdit, yearDiff, search, ...) — 현 라우트가 쓰는 메서드 1:1.
- T4.2 `repositories/pg/*.js` [NEW]: knex 구현. 라우트(`routes/items.js`,`common.js`,`changes.js`,
  `filters.js`)를 repo 호출로 치환(계약·응답 형태 동일).
- T4.3 `services/withTransaction.js` → PG `knex.transaction()` 래퍼로 대체(RS 제거).
- T4.4 `models/ChecklistItem.js`(Mongoose) 의존 제거 또는 repo 뒤로 격리.

소요: ~2일. 의존: T1(스키마), T3(데이터). **분리 시 sibling SPEC-DB-002 후보.**
선행: 진행 중 common-item-bulk-ui(prd-v2 §4, 미커밋 워킹트리)를 커밋·안정화 후 착수(동일 라우트 충돌 방지).

## Phase 5: 트랜잭션·공통전파·Lock 정책 (REQ-3, REQ-4, REQ-10)

- T5.1 `patchItem`: 단일 트랜잭션에 item UPDATE(lock guard) + item_revision INSERT + audit_log INSERT.
- T5.2 `applyCommonEdit`: 공유필드 → `item_content` 1행 UPDATE + 분야별 item_revision INSERT(동일 reason).
- T5.3 Lock 정책: 대상 `(common_key,year)`에 locked 분야 존재 시 차단(admin override 플래그). 동작 변경을
  CHANGELOG·acceptance에 명시.
- T5.4 분야특이 설명/override는 전파 제외(`COMMON_SHARED_FIELDS`만).

소요: ~1일. 의존: T4.

## Phase 6: 검색·연도추적 parity (REQ-7, REQ-9)

- T6.1 검색: 문항번호=trgm ILIKE, 키워드=tsvector @@; 수정유형/수정자/수정일자=revision 조인.
- T6.2 연도 diff: `(common_key,year)` self-join 뷰 + 분야별 checklist_item 6필드 비교, verbatim reason 조인.
- T6.3 현행 결과셋과 동등성 스냅샷 비교(대표 쿼리 10종).

소요: ~1일. 의존: T4.

## Phase 7: 컷오버 · 롤백 (REQ-11)

- T7.1 서버 기동을 `PG_URL` 사용으로 전환(env 토글 `DB_ENGINE=pg|mongo`).
- T7.2 스모크: 핵심 사용자 흐름(목록·검색·단일편집·공통일괄·연도비교) 브라우저 검증.
- T7.3 롤백: `DB_ENGINE=mongo` 즉시 복귀(Mongo 보존). 통과 후 Mongo decommission는 별도 승인.

소요: ~0.5일. 의존: T5, T6.

## Phase 8: 테스트 이행

- T8.1 backend 테스트(21파일/198): `MongoMemoryReplSet` → **ephemeral PG(testcontainers) 우선**
  (pg-mem은 generated column·tsvector·pg_trgm 미지원 가능 → 단순 쿼리 한정).
- T8.2 트랜잭션/공통전파/lock/연도diff 테스트를 PG 의미로 갱신.
- T8.3 `npm run test:run` green 확인.

소요: ~1.5일. 의존: T4–T6.

## 의존 그래프
```
T0 → T1 → T2 → T3 → T4 → {T5, T6} → T7
                        T4 → T8
```

## 위험 및 완화
| 위험 | 영향 | 완화 |
|---|---|---|
| 공통 lock semantics 변경(부분skip→all-or-nothing) | 편집 UX 차이 | REQ-10 명시·admin override·CHANGELOG 고지, Variant B fallback 문서화 |
| ETL 분기/위반 누락 | 데이터 손실 | T2.4 드롭 금지·리포트, T3 set-diff=∅ 게이트 |
| Repository 스왑 회귀 | API 계약 깨짐 | T4.1 인터페이스 1:1·응답형태 동일·T8 테스트 green |
| 검색 한국어 토큰화 차이 | 결과 누락 | parity 스냅샷(T6.3), 필요 시 pgroonga/mecab 차기 |
| 컷오버 사고 | 서비스 중단 | env 토글 즉시 롤백·Mongo 보존 |
