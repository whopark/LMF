# ETL v9 — 위원 검토 및 수기 보정 가이드

**작성일**: 2026-06-13  
**대상 파일**: `checklist_items_flat.json` (9,832 items)  
**보정 파일**: `manual_corrections.json` (14 placeholder entries)

---

## 1. ETL 실행 결과 요약

| 연도 | 항목 수 | 분야 수 | 비고 |
|------|---------|---------|------|
| 2020 | 1,597 | 14 | |
| 2021 | 1,250 | 14 | |
| 2022 | 1,414 | 14 | |
| 2023 | 1,187 | 12 | 2개 분야 누락 (알 수 없음) |
| 2024 | 1,415 | 14 | |
| 2025 | 1,486 | 14 | |
| 2026 | 1,483 | 14 | |
| **합계** | **9,832** | | |

**분류(classification) 미확인 항목**: 1,601개  
원인: `item_type=null` 이면서 배점이 숫자인 항목 → B/R 구분 불가 (ETL 한계)

---

## 2. 알려진 데이터 오류

### 2-1. 중복 item_number: `21.405.120` / 2025년

- **상황**: 분야 21(임상화학)과 분야 23(요검경) 모두 동일 item_number `21.405.120`이 2025년 소스 데이터에 존재
- **원인**: PDF 파서가 분야 23 문항의 번호를 잘못 추출 (21.xxx.xxx로 파싱)
- **정확한 번호**: 분야 23의 해당 문항은 심사점검표에서 `23.405.120`이어야 할 것으로 추정
- **현재 영향**: `checklist_items_flat.json`에 두 항목 모두 포함 → MongoDB import 시 duplicate key 오류 발생 가능
- **수동 조치 필요**:
  1. 심사점검표 PDF에서 `23.405.120`에 해당하는 문항 내용 확인
  2. `manual_corrections.json`에 아래 형식으로 수정 항목 추가:
     ```json
     {
       "item_number": "21.405.120",
       "year": 2025,
       "area_code": "23",
       "patch": { "item_number": "23.405.120", "area_code": "23", "common_key": "405.120" }
     }
     ```
     단, etl_v9.py의 patch 로직은 `item_number`를 key로 사용하므로 분야 21의 정상 항목을 건드리지 않도록 주의. 현재 코드로는 자동 수정 불가 — **직접 flat.json 수정 후 import** 권장.

### 2-2. 분류 미확인 1,601개

- **상황**: `classification` 필드가 빈 문자열(`""`)인 항목
- **원인**: 소스의 `item_type`이 null이고 배점이 숫자인 경우 B/R 구분 신호 없음
- **영향**: UI에서 핵심/필요/기본 분류 표시 오류 가능
- **수동 조치**: 우선순위 높은 분야(임상화학·진단혈액·수혈의학)부터 심사점검표 대조 후 `manual_corrections.json`에 patch 추가

### 2-3. 2023년 분야 2개 누락

- **상황**: 2023년 소스 JSON에 12개 분야만 있음 (14개 중 2개 없음)
- **원인 미상**: 소스 PDF 불완전 추출 또는 해당 연도 분야 미인증
- **수동 조치**: 2023년 심사점검표 원본 확인

---

## 3. 제공서비스 문항 수기 보정 절차

`manual_corrections.json`에 14개 분야의 제공서비스 placeholder 항목이 등록되어 있습니다.  
각 항목의 `question` 필드에 `"TO BE FILLED: ..."` 값이 있으며, **import 전 반드시 실제 내용으로 교체**해야 합니다.

### 작업 순서

1. 심사점검표 PDF에서 각 분야의 **제공서비스** 중분류 항목 내용 확인
2. `manual_corrections.json`에서 해당 분야 항목(`{area_code}.제공.001`)을 찾아 수정:
   - `question`: 실제 문항 내용
   - `description`: 설명 내용 (있으면)
   - `score`: 배점 (null = 핵심문항)
   - `classification`: `"C"` / `"R"` / `"B"` 중 하나
   - `na_available`: 해당없음 가능 여부
3. 제공서비스 문항이 여러 개인 분야는 `.001`을 복사해서 `.002`, `.003` 추가
4. `item_order`는 1부터 순서대로 부여

### 현재 placeholder 항목 목록

| 분야코드 | 분야명 | item_number | 상태 |
|---------|-------|------------|------|
| 01 | 검사실운영 | 01.제공.001 | TO BE FILLED |
| 07 | 종합검증 | 07.제공.001 | TO BE FILLED |
| 08 | 현장검사 | 08.제공.001 | TO BE FILLED |
| 09 | 수탁검사 | 09.제공.001 | TO BE FILLED |
| 10 | 진단혈액 | 10.제공.001 | TO BE FILLED |
| 21 | 임상화학 | 21.제공.001 | TO BE FILLED |
| 23 | 요검경 | 23.제공.001 | TO BE FILLED |
| 36 | 임상미생물 | 36.제공.001 | TO BE FILLED |
| 46 | 수혈의학 | 46.제공.001 | TO BE FILLED |
| 50 | 진단면역 | 50.제공.001 | TO BE FILLED |
| 60 | 유세포검사 | 60.제공.001 | TO BE FILLED |
| 70 | 조직적합성검사 | 70.제공.001 | TO BE FILLED |
| 80 | 세포유전검사 | 80.제공.001 | TO BE FILLED |
| 90 | 분자진단검사 | 90.제공.001 | TO BE FILLED |

> **주의**: import 스크립트(`import-items.js`)는 TO BE FILLED 항목을 감지하면 콘솔 경고를 출력합니다. 실제 내용을 채우기 전까지는 `--skip-backup` 없이 import를 진행하더라도 TO BE FILLED 문항은 DB에 들어갑니다 — 위원 검토 전 별도 확인 필요.

---

## 4. 위원 Spot-Check 체크리스트

import 완료 후 아래 항목을 웹 UI에서 직접 확인합니다.

### 4-1. 분류 표시 확인

- [ ] 핵심(C) 문항: 배점 칸에 "핵심"/"필수" 표시, 점수 0 아님
- [ ] 필요(R) 문항: `예 → 배점(점수)` 형식
- [ ] 기본(B) 문항: `예 → 배점(점수)` 형식
- [ ] 분류 빈 항목(1,601개) 중 샘플 5개 이상 심사점검표 대조

### 4-2. 중분류 순서 확인

- [ ] 심사범위가 첫 번째 중분류로 표시되는지
- [ ] 검사실운영(01) 분야: 22개 이상 중분류 순서가 심사점검표와 일치

### 4-3. 공통문항 확인

- [ ] `01.010.090` 검색 → 14개 분야 모두 동일 내용으로 표시
- [ ] 한 분야에서 내용 수정 시 다른 분야에도 반영 여부 확인 (시스템 요건)

### 4-4. 불릿 문자 확인

- [ ] 문항 설명의 `∙` (U+2219, BULLET OPERATOR)가 화면에 올바르게 렌더링
- [ ] `•` (U+2022) 또는 `⋅` (U+22C5)가 남아있는 항목 없는지 DB 직접 쿼리

```js
// MongoDB 확인 쿼리
db.checklist_items.find({
  description: { $regex: '\\u2022|\\u22C5|\\u00B7' }
}).count()
```

### 4-5. 제공서비스 확인

- [ ] TO BE FILLED 항목 필터링: `db.checklist_items.find({ question: /TO BE FILLED/ }).count()`
- [ ] 보정 완료 전 UI에서 제공서비스 중분류가 표시되는지 (placeholder로도 중분류 자체는 보여야 함)

### 4-6. 2025년 중복 항목 확인

- [ ] `21.405.120` 2025년 항목이 분야 21에만 있는지, 분야 23에 별도 `23.405.120`이 있는지 확인
- [ ] 없다면 섹션 2-1 조치 선행

---

## 5. MongoDB import 실행 절차

```bash
# 1. MongoDB 기동 확인
mongosh --eval "db.runCommand({ ping: 1 })"

# 2. diff 검토 (제거되는 항목 없는지 확인)
cd LMF/gui/backend
npm run etl:diff -- \
  --input ../../pdf/checklist_items_flat.json \
  --output reports/diff-$(date +%Y%m%d).md

# 3. diff 보고서 검토 후 import
npm run etl:import -- --input ../../pdf/checklist_items_flat.json

# 4. 기존 데이터 있으면 diff에서 "removed" 항목 발생 → exit 1
#    제거 항목을 허용하려면 diff-items.js의 exit 1 조건 확인 후 결정

# 5. 회귀 테스트
npm run test:run

# 6. 제공서비스 보정 후 재실행
# manual_corrections.json 내용 채우기 → etl_v9.py 재실행 → import 재실행
python ../../pdf/etl_v9.py \
  --corrections ../../pdf/manual_corrections.json \
  --output ../../pdf/checklist_items_flat_v2.json
npm run etl:import -- --input ../../pdf/checklist_items_flat_v2.json
```

> **롤백**: `npm run etl:rollback -- --list` 로 백업 목록 확인 후  
> `npm run etl:rollback -- --from checklist_items_backup_YYYYMMDD`

---

## 6. 수기 보정 완료 기준

- [ ] 전체 `TO BE FILLED` 항목 0개
- [ ] `21.405.120` 중복 해소 (분야 23에 `23.405.120` 존재)
- [ ] 2023년 누락 2개 분야 원인 확인 및 조치
- [ ] 분류 빈 항목 중 우선순위 분야 (임상화학, 진단혈액, 수혈의학) 100% 완료
- [ ] Spot-Check 체크리스트 전 항목 통과
- [ ] `npm run test:run` 131개 테스트 통과
