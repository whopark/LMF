# SPEC-DB-001 · 수락 기준

> Must는 구조검증(헤딩/파일존재/exit 0)만으로 불충분 — 이종 입력·구체 기대값 oracle을 요구한다.
> 환경: PostgreSQL 16 + pg_trgm, knex 마이그레이션 적용, ETL parity 완료 상태.

## Must scenarios

### AC-1: 공유 콘텐츠 1행 정규화 (REQ-1)
```
Given PDF 적재 완료된 PG (PK=(area_code,item_number,year); 21.405.120/2025는 area 21·23 양분야 적재)
When  SELECT count(*) FROM item_content;  AND  SELECT count(*) FROM checklist_item;
Then  item_content 행 수 = 6570 (distinct (year,common_key))   -- 개정 실측(구 추정 6566)
And   checklist_item 행 수 = 9984
And   행 수 차이 3414 = 공통문항 중복 제거분과 일치
```

### AC-2: 공통 편집 = 단일 content UPDATE 전파 (REQ-3)
```
Given common_key '010.090', year 2026 이 14개 분야에 존재
And   editor가 질문을 "X"로 변경
When  applyCommonEdit(key='010.090', year=2026, {question:'X'}) 호출
Then  UPDATE 영향 item_content 행 = 정확히 1
And   SELECT DISTINCT ci... JOIN item_content 결과 14개 분야 모두 질문='X'
And   item_revision 신규 행 = 14 (분야별 1건, 동일 reason)
And   다른 연도(2025) 동일 key 행의 질문은 unchanged
```

### AC-3: 원자 트랜잭션 (REQ-4)
```
Given replica set 아닌 단일 PostgreSQL
When  patchItem 도중 audit_log INSERT를 강제 실패시킨다(테스트 훅)
Then  item UPDATE 와 item_revision INSERT 모두 롤백된다
And   해당 item_number 행 상태는 편집 전과 동일
And   에러는 호출자에 전파된다(부분 커밋 없음)
```

### AC-4: classification↔score 제약 거부 (REQ-2, REQ-5)
```
Given checklist_item 테이블
When  INSERT (classification='C', score=5) 를 시도
Then  쓰기는 CHECK 위반으로 거부된다(SQLSTATE 23514)
When  INSERT (classification='B', score=NULL) 를 시도
Then  쓰기는 거부된다
When  INSERT (classification=NULL, score=2) 를 시도
Then  쓰기는 성공한다(미해결 분류는 허용)
```

### AC-5: 분야-문항-연도 UNIQUE 중복 차단 (REQ-2, REQ-5)
```
Given area_code='21', item_number='21.405.120', year=2025 행이 이미 존재
When  동일 (area_code, item_number, year) 두 번째 INSERT 시도
Then  쓰기는 UNIQUE 위반으로 거부된다(SQLSTATE 23505)
And   테이블에 해당 키 행은 정확히 1개
Note  개정(2026-06-17): PK가 (area_code,item_number,year)로 변경 → 분할분야(area 36/46에 논리
      prefix 다른 문항 공존) + 21.405.120/2025(area 21·23)가 충돌 없이 적재(충돌 168+1 → 0)
```

### AC-6: ETL 무손실 + 위반 리포트 (REQ-6)
```
Given live MongoDB rs0 (items + 6개 부가 컬렉션)
When  ETL 실행 후 etl_report.md 와 PG를 대조
Then  모든 (item_number, year) 쌍이 PG에 존재 (source - PG = ∅)
And   item_revision/audit_log/app_user/revision_worklist 행 수 = Mongo 원본과 일치
And   locked=final 문항 수와 rev_status 분포가 보존됨
And   etl_report.md 의 분류 집계가 EMPTY=1601, C+score=10, B+null=81 과 일치
And   드롭된 레코드 수 = 0 (위반은 격리/플래그, 누락 아님)
```

### AC-7: 검색 parity (REQ-7)
```
Given PG + pg_trgm/tsvector 인덱스 + 사전정의 canonical 쿼리셋(10종, 기대 ID 명시)
When  문항번호 '07.405' 부분검색
Then  현행 Mongo 결과와 동일 item_number 집합 반환 (번호검색은 ±0)
When  키워드 '전문의' 검색
Then  canonical 기대 ID를 모두 포함 (재현율 ≥ 현행; 토크나이저 차이로 인한 초과는 허용)
When  수정자='admin' & 수정일자 범위 검색
Then  item_revision 조인으로 해당 개정 항목을 반환
Note  Phase 6 결정: 키워드 검색은 tsvector @@(simple)이 아닌 ILIKE 부분검색 사용 — 한국어 형태소
      미지원(D5)으로 tsvector simple 재현율이 substring 대비 낮음(실측 '검사실': ILIKE 1698 vs
      tsvector 845). tsvector GIN 인덱스는 차기 한국어 토크나이저(mecab/pgroonga)용 보존.
      canonical 쿼리셋 = pdf/verify_search.sql (S1~S7). 본 검증은 PG 자기일관성 — Mongo 데이터
      drop으로 PG-vs-Mongo 직접 비교는 Phase 7 컷오버 검증으로 이연.
```

### AC-8: 연도별 6필드 diff (REQ-9)
```
Given 동일 common_key 가 2025·2026 에 존재하고 질문이 변경됨
When  yearDiff(year=2026) 호출
Then  결과는 질문/설명/분야특이/분류/배점/해당없음 6필드 변경여부를 포함
And   질문 changed=true, 미변경 필드 changed=false
And   verbatim raw_reason(item_revision)이 diff에 첨부됨
```

### AC-9: 공통 lock 정책 (REQ-10)
```
Given common_key 'K'/year Y 의 분야 '01' 이 locked(final)
When  admin 아닌 editor가 applyCommonEdit(K, Y, {description:'Z'})
Then  편집은 HTTP 409로 차단되고 응답에 blocked_locked=['01.010.001'](item_number, skipped_locked과 동일 형식) 가 포함된다
And   item_content 는 unchanged (트랜잭션 롤백, 부분 편집 없음)
When  admin 권한 + admin_override:true 플래그로 동일 호출
Then  편집이 적용된다(locked 분야는 skipped_locked; 동작 변경 = 부분skip→all-or-nothing, CHANGELOG 문서화)
```

### AC-10: 분야특이 override 비전파 (REQ-8)
```
Given common_key 'K'/Y, 분야 '01' 에 field_specific_description='S01'
When  applyCommonEdit(K, Y, {description:'D'}) (shared 편집)
Then  전 분야 공유 description='D'
And   분야 '01' field_specific_description 는 여전히 'S01' (미전파)
And   COMMON_SHARED_FIELDS 외 필드는 UPDATE 문에 포함되지 않는다
```

### AC-11: Repository 계약 보존 (REQ-11)
```
Given DB_ENGINE=pg 로 기동된 백엔드
When  기존 프론트엔드가 변경 없이 핵심 API(GET 목록/검색, PATCH 단일, common GET/PATCH, changes)를 호출
Then  모든 응답의 status·JSON 형태가 Mongo 구현과 동일(스냅샷 동등)
And   라우트 핸들러 시그니처는 변경되지 않았다(repo 호출만 교체)
```

### AC-12: SPEC 파일 크기 (REQ-12)
```
Given .autopus/specs/SPEC-DB-001/
When  wc -l spec.md plan.md acceptance.md research.md
Then  네 파일 모두 ≤ 300 줄
And   spec/plan/acceptance/research 4개 파일이 모두 존재
```

### AC-16: 단일 문항 편집은 override (REQ-13)
```
Given common_key 'K'/Y 가 분야 01·02 에 존재 (공유 item_content 1행)
When  분야 01 단일 PATCH 로 question='Q1' 편집
Then  분야 01 은 question_override='Q1' 로 표시된다
And   item_content.question(공유) 는 unchanged
And   분야 02 의 표시 질문은 공유값 그대로다 (미오염)
```

## Should scenarios

### AC-13: 테스트 스위트 이행 green
```
Given 백엔드 테스트가 pg-mem/ephemeral PG 로 전환됨
When  npm run test:run
Then  기존 21파일/198 테스트가 동등 커버리지로 통과(회귀 0)
```

### AC-14: 컷오버 롤백 즉시성
```
Given DB_ENGINE=pg 운영 중 이상 발생
When  DB_ENGINE=mongo 로 환경변수 토글 후 재기동
Then  보존된 Mongo(rs0)로 즉시 복귀하며 데이터 손실 없음
```

## Nice scenarios

### AC-15: 한국어 검색 강화(선택)
```
Given pgroonga 또는 mecab-ko 토큰화 도입(차기)
When  복합 한국어 키워드 검색
Then  simple tsvector 대비 재현율이 동등 이상
```
