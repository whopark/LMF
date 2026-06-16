# SPEC-PDF-001 · 조사 노트

## 발견 경위 (실측)

| 발견 | 증거 |
|---|---|
| Mongo `lab_accreditation` drop | oplog dropDatabase + checklist_items/audit_logs drop ([[spec-db-001-progress]]) |
| PDF 원천 | `pdf/<연도> 심사점검표/*.pdf` (분야별, 2009~2026 폴더) |
| 기존 파서 | `parse_pdf_2026.py`·`build_2026_final.py`·`etl_v9.py` → `checklist_items_flat_v2.json` |
| 산출물 형상 = Mongo Item | flat_v2 keys = item_number/area_code/common_key/year/area_name/sub_category/sub_category_order/item_order/question/description/score/classification/na_available/revision/source (9,984) |
| Mongo write 지점 | `import_to_mongodb.py:49` `collection.insert_many` / `transform_and_upload.py:158` |
| PG 코드 부재 | `grep psycopg/postgres pdf/*.py` = 0건 → 신규 어댑터 필요 |
| 샘플 | `01.201.010`/2020 검사실운영, classification='C', score=null (핵심=배점없음, CHECK 정합) |

## 결정과 근거

### D1: 옵션 B(파서 재사용 + PG 어댑터) 채택 — BS-001
- A(Node loader): 더 빠르나 "PDF 구조 분석" 의도와 별개. C(신규 파서): 난이도↑·기존 자산 낭비.
- B: 기존 Python 파서 생태계 재사용 + `import_to_mongodb.py`의 PG 대응(`import_to_pg.py`)만 추가.
  실제 파서가 PDF 구조를 분석하고, 어댑터는 그 산출물을 PG로. **언어 일치(Python)·재파싱 경로 확보**.

### D2: score 정규화 규칙
flat_v2 샘플의 question 말미에 "점수" 잔재 관찰 → score 필드의 비수치값 가능. 규칙:
숫자형 → int; 그 외(공백/"예"/"필수"/"점수") → NULL. classification='C'는 항상 NULL(핵심).
B/R인데 NULL이면 위반 후보 → etl_report 격리(현측정 B+null=81). 드롭 금지(REQ-3).

### D3: dedup = 적재 시 그룹핑(앱 코드), 제약은 DB가 강제
`(common_key,year)`로 그룹해 공유필드 1행(item_content) upsert. 분야 간 question이 다르면(현 데이터는
동일하나 방어) question_override로 격리. 무결성(분야-연도 UNIQUE, C↔score)은 PG CHECK/PK가 쓰기 차단.

### D4: psycopg(직접 SQL) vs ORM
Python 단발 적재 → ORM 과중. `psycopg[binary]` + 파라미터화 INSERT/ON CONFLICT로 충분(주입 방지).
knex(Node)는 SPEC-DB-001 마이그레이션 전용 — 적재는 Python 라인 유지.

## Semantic Invariant Inventory

| ID | source 절 | 불변식 유형 | 영향 출력 | AC |
|---|---|---|---|---|
| INV-DEDUP | 공통문항=공유 1행 | grouping/dedup | item_content 행수 | AC-1, AC-4 |
| INV-NULLCLASS | 빈 분류는 미해결(NULL) | mapping/null | classification 적재 | AC-2 |
| INV-CLASS-SCORE | 핵심C⇒배점없음, B/R⇒배점 | numeric/paired | score·CHECK | AC-3 |
| INV-NOLOSS | 위반도 누락 아님 | parser/report | etl_report·set diff | AC-5 |
| INV-IDEMPOTENT | 재실행=동일 결과 | idempotency | 행 수 불변 | AC-6 |
| INV-DRYRUN | 기본은 미적재 | safety | 테이블 불변 | AC-7 |

> oracle AC-1~5는 구조검증이 아닌 구체 기대값(6566/9984/1601/14/dropped=0)으로 통과해야 한다.

## Self-Verify Summary

| Q | status | files | reason |
|---|---|---|---|
| Q-CORR-01 | PASS | spec/research | 인용 경로(import_to_mongodb.py, parse_pdf_2026.py, flat_v2 키) 실측 확인 |
| Q-CORR-02 | PASS | plan | [NEW] 마커가 import_to_pg.py에 적용 |
| Q-CORR-03 | PASS | acceptance | Given/When/Then + 구체 기대값(6566/9984/1601/14/0) |
| Q-COMP-01 | PASS | spec↔acceptance | REQ-1~8 → AC-1~10 추적 |
| Q-COMP-05 | PASS | research | Semantic Invariant Inventory(INV 6종) + oracle 연결 |
| Q-FEAS-01 | PASS | research | flat_v2 형상=Item 모델 일치, PG 스키마 존재 → 적재 경로 실재 |
| Q-FEAS-02 | PARTIAL | spec Open Issues | score 비수치·sub_category 미매핑 규칙은 구현 시 데이터로 확정 |
| Q-SEC-01 | PASS | research | psycopg 파라미터화(주입 방지), PG_URL은 env(.env gitignored) |
| Q-SEC-02 | PASS | spec | 비밀·자격증명 미포함, 적재는 로컬 dev DB |

## Revision 1 closure (멀티 프로바이더 리뷰 반영)

리뷰: gemini = REVISE, claude(judge) = REVISE. 합의 findings 종결:

| F-ID | source/sev | category | 종결 | 반영 |
|---|---|---|---|---|
| F1 | gemini/HIGH | feasibility | 배치 트랜잭션 경계 + 예기치못한 오류 배치롤백 + 멱등 재실행 복구 | REQ-8·AC-12·T2.5 |
| F2 | gemini/HIGH | correctness | dedup base = area_code 최소(결정론), 상이분야 override | REQ-1·AC-11·T2.2 |
| F3 | gemini/HIGH | completeness | 비수치 score→NULL(별도 플래그 없음, 의미는 classification/na) | REQ-2·D7 |
| F4 | gemini/MEDIUM | completeness | 미매핑 sub_category→sub_category_id NULL + 리포트 | REQ-7·AC-8 |
| F5 | gemini/MEDIUM | feasibility | 부분적재 복구 = 배치롤백 + 멱등재실행 (F1 통합) | REQ-8·AC-12 |
| F6 | gemini/LOW | completeness | item_number parity(생성=소스), 비표준 격리 | REQ-6·AC-13·T4.5 |

### 추가 결정
- **D5 (dedup base)**: 공유 1행 = `area_code` 최소 행. 결정론·재현 가능. 현 데이터는 분야 간 동일하나 방어.
- **D6 (트랜잭션)**: 단일 거대 트랜잭션 회피 → N건 배치별 경계. 사전판정으로 위반은 PG 미도달,
  예외는 배치 롤백+리포트, 멱등으로 복구(전체 중단 없음).
- **D7 (score 타깃)**: 비수치 score는 NULL. "예/필수/핵심" 의미는 classification(C/R/B)이 보유 →
  전용 score-flag 컬럼 불필요. 분류로 설명 안 되는 이상치만 리포트.

> 갱신: Q-FEAS-02 PARTIAL→PASS (score 타깃 D7로 확정). 잔여 Open Issue는 데이터 의존 이상치뿐.

## Related
- 선행: SPEC-DB-001(PG 스키마 + `mapping.md`) — 본 SPEC은 그 스키마에 데이터만 적재.
- 후속: 편집/이력 소스 확보 시 audit/revision 적재 sibling SPEC; SPEC-DB-001 Phase 4(Repository 스왑).
