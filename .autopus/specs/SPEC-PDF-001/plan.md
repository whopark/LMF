# SPEC-PDF-001 · 구현 계획

> WORKING_DIR=`pdf/`. 언어=Python(기존 파이프라인). PG=lmf-pg:5435(SPEC-DB-001 스키마).
> 드라이버=`psycopg[binary]`(신규). 입력=`checklist_items_flat_v2.json`(파서 산출물).

## Phase 0: 준비
- T0.1 `pip install "psycopg[binary]"` (또는 requirements.txt 추가). `PG_URL` 환경변수 사용
       (`gui/backend/.env`와 동일 값 또는 별도 export).
- T0.2 `pdf/classification_map.json` 확인 — sub_category 텍스트→10코드·display_order 매핑 소스.

소요: ~30분.

## Phase 1: 참조 시드 로더 (REQ-7)
- T1.1 `pdf/import_to_pg.py` [NEW] 골격: argparse(`--commit` 없으면 dry-run), psycopg 연결, 트랜잭션.
- T1.2 시드: classification(C/R/B), area(flat_v2 distinct area_code+area_name),
       sub_category(classification_map.json), edit_type_code(있으면), app_user(admin 1).
- T1.3 upsert(`INSERT ... ON CONFLICT DO UPDATE`)로 멱등.

소요: ~3시간. 의존: T0.

## Phase 2: 정규화 적재 (REQ-1, REQ-2)
- T2.1 flat_v2 로드 → 레코드별 변환(`mapping.md`): classification ''→None, score 정규화(T2.2),
       common_key는 레코드값 사용, blocks→json, revision.*→rev_status/locked/revised, source→json.
- T2.2 **item_content dedup**: `(common_key, year)`로 그룹 → 공유 1행 upsert.
       **base = area_code 최소 행**(결정론적). 다른 분야 값 상이 시 `*_override` 격리 + 리포트.
- T2.3 **checklist_item**: 분야별 editorial 행 upsert(area_code,common_key,year PK). FK 충족 순서
       (reference→item_content→checklist_item).
- T2.4 score 정규화: 숫자→int; 비수치("점수"/"예"/"필수"/공백)→None(별도 플래그 없음, 의미는 classification).
- T2.5 **배치 트랜잭션**: N건 배치별 트랜잭션(또는 savepoint). 예기치 못한 PG 오류 시 그 배치만 롤백 +
       리포트(REQ-8). 멱등 upsert로 재실행 복구.

소요: ~1.5일. 의존: T1.

## Phase 3: 위반 격리·리포트 (REQ-3)
- T3.1 적재 전/중 CHECK·UNIQUE 위반 후보를 사전 판정(C+score, B/R+null, 중복키) → **별도 적재 보류**
       리스트로 모아 `etl_report.md`에 유형별 집계(드롭 금지).
- T3.2 `dropped=0` 보장: 소스 9984 = PG 적재 + 격리 합(set diff=∅) 검증.

소요: ~4시간. 의존: T2.

## Phase 4: parity 검증 (REQ-6)
- T4.1 행 수: checklist_item=9984, item_content=6566 → AC-1.
- T4.2 빈분류: NULL=1601, '' = 0 → AC-2. C는 score NULL, B/R는 score not null → AC-3.
- T4.3 dedup spot: `010.090`/2026 → 14행 1 content → AC-4.
- T4.4 연도 분포 일치(2026=1635 등) → AC-9. (`validate_etl.py` 패턴 재사용.)
- T4.5 **item_number parity**: 생성 item_number = 소스 item_number 불일치 0, 비표준 포맷 격리 → AC-13.

소요: ~4시간. 의존: T2, T3.

## Phase 5: 멱등·재파싱 경로 (REQ-4, REQ-5)
- T5.1 재실행 시 행 수 불변(upsert) → AC-6.
- T5.2 (선택) `parse_pdf_2026.py` → flat_v2 갱신 → import_to_pg 멱등 반영 → AC-10.

소요: ~3시간. 의존: T2.

## 의존 그래프
```
T0 → T1 → T2 → {T3, T4} → T5
```

## 위험 및 완화
| 위험 | 영향 | 완화 |
|---|---|---|
| score 비수치 정규화 오류 | 배점 무결성 깨짐 | T2.4 규칙 명시 + AC-3 CHECK 정합, 위반은 리포트(T3) |
| sub_category 미매핑 | FK 실패/누락 | classification_map.json 확인(T0.2), 미매핑은 리포트(AC-8) |
| dedup 시 분야 간 question 상이 | 공유 1행 오염 | question_override 격리(T2.2) + 리포트 |
| 편집·이력 부재(flat_v2 한계) | 이력 미적재 | 비목표 명시(seed only) — 별도 SPEC |
| 멱등 실패(중복 증가) | 재실행 오염 | ON CONFLICT upsert(T1.3/T2) + AC-6 |
