# SPEC-PDF-001 · 기존 PDF 파서 재사용 → PG 적재 (PDF 구조 데이터 PG 로드)

- Status: approved
- Priority: Must
- Owner: 메인 세션
- Created: 2026-06-17
- From: BS-001 (옵션 B)
- Related: SPEC-DB-001(PG 스키마 + `mapping.md`), `pdf/` Python 파서 파이프라인
- Source-of-truth: 심사점검표 PDF (`pdf/<연도> 심사점검표/*.pdf`). 본 SPEC은 적재 경로만 추가.

## 1. 배경 / 문제

SPEC-DB-001로 PG 정규화 스키마(11테이블)는 구축됐으나, **Mongo `lab_accreditation` 데이터가
drop**돼 ETL 소스가 없다. PDF가 원천이고, 기존 Python 파이프라인이 PDF를 파싱해
`pdf/checklist_items_flat_v2.json`(9,984 레코드)으로 산출한다. 그 산출물(=Mongo `Item` 문서 형상과
동일)을 **PG로 적재하는 어댑터**만 추가하면 Mongo 없이 PG에 실데이터를 확보한다. 현재 PG 출력
코드는 없다(psycopg 미사용).

## 2. 목표 / 비목표

**목표**: 기존 파서 출력(flat_v2.json, 필요 시 파서 재실행)을 읽어 PG에 적재하는 `import_to_pg.py`를
추가한다. `import_to_mongodb.py`의 PG 대응 버전이며 `mapping.md` 변환규칙을 코드화한다.
멱등·dry-run·**배치 트랜잭션 경계**·위반 리포트·참조 시드 포함.

**비목표**: 편집/개정이력/감사 적재(flat_v2엔 없음 → seed only). Repository 스왑(SPEC-DB-001 Phase 4).
검색/연도추적. 신규 PDF 파서 재작성(기존 파서 재사용).

## 3. 요구사항 (EARS)

- **REQ-1 (ubiquitous)** `import_to_pg.py`는 파서 출력을 읽어 PG에 적재한다. 공유 콘텐츠는
  `(common_key, year)`당 1행(`item_content`), 분야별 편집상태는 `checklist_item`. **dedup base(공유 1행)는
  해당 그룹에서 `area_code` 최소 행의 question/description/blocks/sub_category로 결정론적 선정**한다.
- **REQ-2 (event-driven)** WHEN 레코드를 적재할 때, THE SYSTEM SHALL `mapping.md` 변환을 적용한다:
  classification `''`→NULL; `score` 숫자→int, **비수치/공백/'예'/'필수'/'점수'→NULL**(배점-분류 의미는
  classification·na_available가 보유 → 별도 score 플래그 컬럼 없음); `blocks`→jsonb; `revision.*`→
  rev_status/locked/revised; `source`→jsonb; `item_number`는 PG 생성컬럼이므로 미적재.
- **REQ-3 (unwanted)** IF 레코드가 UNIQUE/CHECK를 위반하면(C+score, B/R+null, 분야-연도 중복 등),
  THE SYSTEM SHALL 드롭하지 않고 `etl_report.md`에 유형별로 집계·격리한다(누락 0).
- **REQ-4 (ubiquitous)** 적재는 멱등(`ON CONFLICT ... DO UPDATE`)하며 `--dry-run`이 기본이다.
- **REQ-5 (optional)** 신규/갱신 PDF가 필요하면 기존 파서(`parse_pdf_2026.py`/`build_2026_final.py`)를
  호출해 재파싱 후 동일 적재 경로(REQ-1~4)를 탄다.
- **REQ-6 (event-driven)** WHEN 적재가 끝나면, THE SYSTEM SHALL parity를 검증한다: 행 수·dedup factor·
  위반 집계·**생성 item_number == 소스 item_number**(REQ-9 비표준 포맷 포함)를 산출.
- **REQ-7 (ubiquitous)** 참조 테이블(area/classification/sub_category/edit_type_code/app_user)을 시드한다.
  sub_category 텍스트→10코드는 `pdf/classification_map.json`. **미매핑 sub_category는 `sub_category_id=NULL`로
  적재하고 etl_report에 키별 집계**(드롭 금지).
- **REQ-8 (unwanted)** IF 사전판정으로 거르지 못한 예기치 못한 PG 오류/제약위반이 발생하면,
  THE SYSTEM SHALL **배치 단위로 롤백**(전체 적재 중단 아님)하고 오류를 리포트하며, 멱등 재실행(REQ-4)으로
  재개 가능해야 한다. 적재는 배치별 트랜잭션(또는 savepoint)으로 경계화해 부분/중복 행을 남기지 않는다.
- **REQ-9 (ubiquitous)** 본 SPEC 4파일(spec/plan/acceptance/research)은 각 ≤300줄.

## 4. Feature Completion Scope

"PDF 산출물 → PG 적재"라는 단일 스토리: 참조 시드 → 정규화 적재(결정론적 dedup) → 위반 격리·리포트 →
parity 검증. 트랜잭션 경계로 부분실패 복구는 멱등 재실행으로 닫는다. 편집/이력 적재가 필요해지면
sibling SPEC. PG 스키마/제약은 SPEC-DB-001 소유(본 SPEC은 데이터만 적재).

## 5. Open Issues
- score 비수치값의 분류-미설명 이상치(드문 케이스) 처리 — research D2(리포트 후 수동 판정).
- 비표준 `item_number` 포맷의 common_key 파생 불일치 시 생성 item_number ≠ 소스 → REQ-6 검증에서 격리(D7).
