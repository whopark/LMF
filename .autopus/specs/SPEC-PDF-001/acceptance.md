# SPEC-PDF-001 · 수락 기준

> 환경: PG(lmf-pg:5435, SPEC-DB-001 스키마 적용) + `pdf/checklist_items_flat_v2.json`(9,984).
> Must는 구조검증 불가 — 이종 입력·구체 기대값 oracle.

## Must scenarios

### AC-1: 정규화 적재 행 수 (REQ-1)
```
Given dry-run=false로 import_to_pg.py 실행 완료
When  SELECT count(*) FROM item_content;  AND  SELECT count(*) FROM checklist_item;
Then  checklist_item = 9984
And   item_content = 6566 (= distinct (common_key, year))
And   9984 - 6566 = 3418 (공통문항 중복 제거분)
```

### AC-2: classification 빈값 → NULL (REQ-2)
```
Given flat_v2에 classification='' 인 레코드가 존재(현 측정 EMPTY=1601)
When  적재 후 SELECT count(*) FROM checklist_item WHERE classification IS NULL;
Then  결과 = 1601 (빈 문자열이 NULL로 적재됨, '' 행 0)
And   SELECT count(*) FROM checklist_item WHERE classification='';  = 0
```

### AC-3: score 정규화 + CHECK 정합 (REQ-2)
```
Given classification='C' 레코드 (핵심)
When  적재 결과를 조회
Then  모든 C 행의 score IS NULL (CHECK ck_core_no_score 위반 0건으로 적재 성공)
And   classification IN ('B','R') 행은 모두 score IS NOT NULL
And   적재 중 CHECK 위반으로 거부된 행은 etl_report에 격리(아래 AC-5)
```

### AC-4: 공통문항 dedup (REQ-1)
```
Given common_key='010.090', year=2026 (14개 분야 공유)
When  SELECT count(DISTINCT (ci.common_key,ci.year)) ... JOIN item_content
Then  checklist_item 행 14개가 모두 동일 item_content 1행을 참조
And   해당 item_content.question 은 1종(분야 간 동일)
```

### AC-5: 위반 리포트 (드롭 금지) (REQ-3)
```
Given flat_v2의 무결성 결함(C+숫자score=10, B+null=81, 21.405.120/2025 중복 등)
When  적재 후 etl_report.md 를 확인
Then  위반 유형별 집계가 사전측정과 일치(EMPTY 1601, C+score 10, B+null 81)
And   "dropped=0" — 위반은 격리/플래그이며 누락이 아님
And   소스 9984건 중 PG 적재+격리 합 = 9984 (set diff = ∅)
```

### AC-6: 멱등 (REQ-4)
```
Given 1회 적재 완료(dry-run=false)
When  동일 명령을 재실행
Then  checklist_item/item_content 행 수가 1회차와 동일(중복 증가 0)
And   재실행은 upsert로 처리(에러 없이 완료)
```

### AC-7: dry-run 기본 (REQ-4)
```
Given 플래그 없이 import_to_pg.py 실행
When  실행 종료
Then  PG에 어떤 행도 INSERT/UPDATE되지 않는다(테이블 행 수 불변)
And   stdout에 "DRY RUN" 과 적재 예정 건수 요약이 출력된다
```

### AC-8: 참조 시드 (REQ-7)
```
Given import_to_pg.py 실행(실적재)
When  SELECT count(*) FROM area;  SELECT count(*) FROM classification;
Then  area >= 22 (flat_v2의 distinct area_code 수와 일치)
And   classification = 3 (C,R,B)
And   미매핑 sub_category 가 있으면 etl_report에 리포트(누락 0)
```

### AC-11: dedup base 결정론 (REQ-1)
```
Given common_key 'K'/year Y 가 분야 01·02·03 에 존재, 02의 question이 다름(분기)
When  적재 후 item_content.question 과 분야별 question_override 확인
Then  item_content.question = 분야 01(area_code 최소)의 question (결정론적 base)
And   분야 02 의 question_override = 02 고유값, 분야 01·03 의 override = NULL
And   동일 입력 재실행 시 base 선정 결과가 동일하다(비결정성 없음)
```

### AC-12: 배치 트랜잭션·복구 (REQ-8)
```
Given 적재 중 한 배치에서 예기치 못한 PG 오류를 강제(테스트 훅)
When  import_to_pg.py --commit 실행
Then  해당 배치만 롤백되고 나머지 배치는 커밋된다(전체 적재 중단 아님)
And   오류가 etl_report 에 기록된다
And   수정 후 재실행 시 멱등 반영(중복 0)으로 적재가 완결된다
```

### AC-13: item_number parity (REQ-6)
```
Given 적재 완료
When  생성 item_number 와 소스 flat_v2.item_number 를 (area_code,common_key,year)로 대조
Then  불일치 = 0 (PG 생성 item_number = area_code‖'.'‖common_key = 소스 item_number)
And   비표준 포맷(common_key 파생 불가) 레코드는 etl_report 에 격리되어 불일치 집계에서 제외
```

## Should scenarios

### AC-9: parity 검증 통과 (REQ-6)
```
Given 적재 완료 후 validate 단계
When  연도별 분포를 SELECT year, count(*) FROM checklist_item GROUP BY year
Then  flat_v2의 연도 분포와 일치(2026=1635 등)
```

## Nice scenarios

### AC-10: PDF 재파싱 경로 (REQ-5)
```
Given pdf/<연도> 심사점검표/*.pdf 변경
When  parse_pdf_2026.py 재실행 → flat_v2 갱신 → import_to_pg.py
Then  갱신분이 PG에 멱등 반영(AC-6)
```
