# SPEC-DB-001 · 심사점검표 DB를 PostgreSQL로 재설계

> Status: approved
> Approved: 2026-06-16 (사용자 G-D4 수용 — Variant A + all-or-nothing lock)
> Domain: DB (persistence)
> Target module: `gui` (backend Express + ETL `pdf/`)
> Related: SPEC-CLEANUP-001(위생), prd-v2.md(§1–§8 커버리지), ARCHITECTURE.md
> Source-of-truth: 심사점검표(불변). 본 SPEC은 저장 엔진만 교체하며 도메인 의미는 보존한다.

## 1. 배경 / 문제 (PRD 프레이밍)

현행 영속 계층은 **MongoDB(Mongoose) + 단일노드 replica set rs0**다. 데이터(9,984문항,
2020~2026)는 본질적으로 **관계형**인데 문서 모델 위에 관계형 동작을 수작업으로 흉내내고 있다:

- **공통문항 14× 중복**: 동일 논리 문항이 한 연도에 최대 14개 분야 행으로 물리 복제됨
  (측정: `(year,common_key)` 공유 그룹 649개·3,893행, `010.090`=14분야 동일 질문 1종).
  공통 편집은 `applyCommonEdit`가 N개 분야 행을 앱 코드로 동기화하며 drift 위험을 떠안는다.
- **트랜잭션을 위해 replica set 필수**: `services/withTransaction.js`가 RS를 요구 →
  standalone에서 모든 편집 저장이 500(이미 prd-v2 §5에서 rs0로 우회). ACID를 얻으려 인프라를 추가.
- **무결성을 앱이 전담**: 빈 분류 1,601개, C인데 배점 숫자 10개, B인데 배점 null 81개,
  `21.405.120/2025` 중복 — 전부 DB 제약으로 쓰기 시점 차단 가능했던 결함.

> 규모는 작다(<10만 행). 성능은 선택 기준이 아니다. 기준은 **모델 적합성·무결성·트랜잭션**이며
> 셋 모두 관계형이 유리하다. 본 SPEC은 PostgreSQL로 재설계하여 위 부채를 구조적으로 제거한다.

## 2. 목표 / 비목표

**목표**
- 전체 정보(문항·공통문항·개정이력·감사·권한·연도추적·검색)를 정규화 PostgreSQL 스키마로 수용.
- 공통문항 공유 콘텐츠를 **연도당 1행**으로 저장(중복·동기화 코드·drift 제거).
- 네이티브 ACID 트랜잭션(replica set 불필요)으로 문항+개정이력+감사로그를 원자 기록.
- 제약조건(UNIQUE/FK/CHECK)으로 현행 무결성 결함을 쓰기 시점에 차단.
- 검색(§6)·연도추적(§4)·권한/감사(§7)를 현행과 동등(parity)하게 재현.
- 라우트 계약을 깨지 않는 **Repository 추상화**로 엔진 교체(Mongoose→pg) 캡슐화.

**비목표**
- 새 도메인 기능 추가 없음(엔진 교체 + 의미 보존만).
- 프론트엔드 UI 변경 없음(API 계약 동일).
- 5년 이력 신규 마이그레이션·분야특이 데이터 적재(별도 백로그).
- 운영 PostgreSQL HA/이중화 설계(로컬 단일 인스턴스 + 백업 범위로 한정).

## 3. 요구사항 (EARS)

- **REQ-1 (ubiquitous)** 시스템은 모든 심사점검표 정보를 PostgreSQL에 정규화 저장하며,
  각 공통문항의 공유 콘텐츠(질문/설명/blocks)는 `(common_key, year)`당 **1행**으로 보관한다.
- **REQ-2 (ubiquitous)** 스키마는 무결성을 제약으로 강제한다: 분야-연도당 문항 UNIQUE,
  area/classification/sub_category/edit_type/user FK, classification↔score CHECK.
- **REQ-3 (event-driven)** editor가 공통문항 공유필드 편집을 저장하면, 시스템은 단일 `item_content`
  행 UPDATE로 전 참여 분야에 **1트랜잭션** 내 전파한다(N-way 앱 동기화 제거).
- **REQ-4 (event-driven)** 임의 문항 편집 저장 시, 시스템은 문항 변경 + 불변 `item_revision` +
  `audit_log`를 **단일 ACID 트랜잭션**으로 원자 기록한다(replica set 불요).
- **REQ-5 (unwanted)** 쓰기가 UNIQUE 또는 classification/score CHECK를 위반하면, 시스템은 그 쓰기를
  거부하고 위반을 표면화한다(부분/중복 행 없음).
- **REQ-6 (complex)** **live MongoDB(source of truth)**에서 이행하는 동안, 시스템은 9,984문항뿐 아니라
  나머지 6개 컬렉션(item_revisions·audit_logs·auth_users[hash verbatim]·revision_worklists·
  edit_type_codes·lab_checklists)을 **필드·행 parity**로 적재하고 lock/rev/감사 상태를 보존하며,
  제약 위반 레코드는 조용히 누락하지 않고 리포트한다. (flat_v2.json은 편집·이력 없는 seed라 단독 소스 부적합.)
- **REQ-7 (event-driven)** 사용자가 문항번호/키워드/수정유형/수정자/수정일자로 검색하면, 시스템은
  `pg_trgm + tsvector`로 현행 Mongo 검색과 동등한 결과를 반환한다.
- **REQ-8 (optional)** 분야가 텍스트 분기 또는 분야특이 설명을 요구하는 경우, 시스템은 공유 콘텐츠를
  복제하지 않고 분야별 override로 저장한다.
- **REQ-9 (event-driven)** 리뷰어가 연도별 비교를 요청하면, 시스템은 `(common_key, year)` 조인으로
  6필드 diff(질문/설명/분야특이/분류/배점/해당없음)를 계산한다.
- **REQ-10 (unwanted)** 공유 콘텐츠 편집 대상 `(common_key, year)`에 final(locked) 분야가 하나라도
  있으면, 시스템은 admin override 없이는 편집을 차단한다(Mongo의 부분 skip 대비 **문서화된 동작 변경**).
- **REQ-11 (ubiquitous)** 백엔드는 Repository 추상화를 통해 데이터에 접근하여, 라우트 핸들러 계약 변경
  없이 영속 엔진을 교체(Mongoose→pg)할 수 있어야 한다.
- **REQ-12 (ubiquitous)** 본 SPEC 4개 파일(spec/plan/acceptance/research)은 각 300줄 이하여야 한다.
- **REQ-13 (event-driven)** 단일 문항 PATCH로 공통문항의 공유 텍스트필드(질문/설명/blocks)를 한 분야에서만
  편집하면, 시스템은 공유 `item_content`를 변형하지 않고 **분야별 *_override**에 기록하여 타 분야를 보존한다.
  (공유 전파는 전용 applyCommonEdit 경로에서만 발생.)

## 4. 목표 스키마 (요약 — 상세 DDL은 research.md D2)

정규화 Variant A 채택. 공유 텍스트와 분야별 편집상태를 분리한다.

| 테이블 | 키 | 역할 |
|---|---|---|
| `area` | area_code | 분야(22코드) |
| `classification` | code C/R/B | 핵심/필요/기본 |
| `sub_category` | id | 중분류(MMM 10코드 분류, display_order=점검표순) |
| `edit_type_code` | code | 수정유형 드롭다운 |
| `app_user` | id | 역할(viewer/editor/approver/admin) |
| `item_content` | (common_key, year) | **공유 콘텐츠 1행** = question/description/blocks/sub_category |
| `checklist_item` | (area_code, item_number, year) | 분야 투영: item_order/classification/score/na/분야특이·override/rev_status/locked/revised/last_modified/source/field_code |
| `item_revision` | id | 불변 개정 이력(before/after/reason/hash) |
| `audit_log` | id | 감사 이벤트 |
| `revision_worklist` | id | 사용자별 개정 워크리스트 |
| `checklist_import` | id | PDF 파싱 메타(현 `lab_checklists_2026_v8`) |

핵심 효과: 공통 편집 = `item_content` 1행 UPDATE → 전 분야 자동 반영. workflow/lock은 분야 행에
독립 유지. `item_number`는 소스 원본을 그대로 저장(분할분야 논리 prefix 보존), `field_code`는
`split_part(item_number,'.',1)` 생성컬럼(논리 분야).

> **개정 (2026-06-17): 분할분야 스키마.** 임상미생물(물리 area 36)·수혈의학(area 46)은 여러 논리
> 분야가 한 물리 area_code에 통합 저장되고 item_number가 논리 prefix를 보존(예: area 36 + 30.301.340).
> 구 스키마(item_number 생성컬럼 = area_code‖common_key, PK (area_code,common_key,year))는 168 PK 충돌 +
> 이상치 1(21.405.120/2025)로 9815만 적재됐다. → `item_number` 생성컬럼 폐기·소스 원본 저장, `field_code`
> 생성컬럼 신설, PK를 **(area_code, item_number, year)**로 변경 → 충돌 0, **전체 9984 무손실 적재 완료**
> (item_content 6570). 마이그레이션 `002_items.js`/`004_search_index.js`, 적재 `pdf/import_to_pg.py`(commit `ee50eca`).

## 5. Feature Completion Scope

본 SPEC은 "Mongo→PG 이행"이라는 **하나의 응집된 변경 스토리**를 phase로 종결한다(plan.md):
스키마 → ETL parity → Repository/트랜잭션 → 검색/연도추적 parity → 컷오버/롤백 → 테스트 이행.
phase 4(Repository 컷오버)를 별도 릴리스 게이트로 쪼갤 경우 **sibling SPEC-DB-002**로 분리 가능
(현재는 단일 SPEC로 충분; 분리 시 plan.md 의존성·acceptance 소유권을 교차참조). 숨긴 후속작업 없음.

## 6. 수용 / 검증
acceptance.md의 Must oracle(공통전파 1-UPDATE, 제약 거부, 행 parity, 분류/배점 oracle, 연도 diff)을
구조검증이 아닌 **이종 입력·구체 기대값**으로 통과해야 한다.
