# Design — data-integrity (§5 데이터 오염 정제)

> PDCA Phase: **Design** · 2026-06-14 · 선택 아키텍처: **B 클린(변환별 모듈 분리)** · 접근: 일회성 멱등 마이그레이션

## Context Anchor (Plan 승계)

| 축 | 값 |
|---|---|
| **WHY** | 과거연도(2020·2021) 오염이 5년 이력·연도별 비교 신뢰성 훼손. 2026 클린 데이터를 백필 소스로 활용. |
| **WHO** | 인증심사 문항 관리자·심사위원(연도별 추적/이력 사용자). |
| **RISK** | 1,500+ 문항 변이 — 오분리·오백필 회귀. 백업/dry-run/멱등/롤백 필수. 클린연도(2026) 손상 금지. |
| **SUCCESS** | 2020 병합 잔여 0 · 2021 미분류 대폭↓ · blocks 100% · 2026 불변 · 총 9,984 유지. |
| **SCOPE** | IN: 2020 분리·2021 백필·blocks·툴. OUT: 답안마커 12건·ETL 재파싱·신규 적재. |

## 1. Overview

순수 변환 모듈 + 안전 오케스트레이터로 구성된 일회성 CLI 마이그레이션. 변환은 **DB 무관 순수함수**(입력 doc/문자열 → 패치 또는 null), 오케스트레이터가 IO·백업·dry-run·배치쓰기·리포트를 담당. 멱등(가드 내장) — 재실행 0 변경.

## 2. 아키텍처 (선택: B 클린)

```
scripts/
  migrate-spec5.js            # CLI 오케스트레이터 (connect/backup/classMap/loop/write/report)
  lib/
    backup.js                 # [기존 재사용] 타임스탬프 컬렉션 백업
    diff-report.js            # [기존 재사용] 리포트 포맷 보조
    spec5/
      splitMerged.js          # 순수: ∙ 기준 질문/설명 분리
      classMap.js             # 클린연도 common_key→classification 맵 구축
      backfillClassification.js  # 순수: classMap으로 분류 백필
      buildBlocks.js          # 순수: description → blocks[] (text/bullet/table)
      index.js                # 변환 묶음 export + applyPatches(doc, classMap)
tests/
  spec5-transforms.test.js    # 변환 단위테스트 (DB 무관)
  spec5-migrate.test.js       # 통합테스트 (MongoMemoryReplSet)
```

### 데이터 흐름
```
connect → backup(전체) → classMap = buildClassMap(db, [2026,2025,2024,2023,2022])
       → cursor(checklist_items) 각 doc:
            patch = applyPatches(doc, classMap)
              ├ split = splitMerged(doc)              // {question,description} | null
              ├ desc' = split?.description ?? doc.description
              ├ cls   = backfillClassification(doc, classMap)  // {classification} | null
              └ blk   = buildBlocks(desc')            // {blocks} | null (기존과 동일하면 null)
       → dry-run? 리포트 누적 : bulkWrite(unordered, batch 500)
       → 요약(SC 지표) + reports/spec5-<ts>.md
```

## 3. 모듈 명세 (순수함수 — 멱등 가드 포함)

### 3.1 `splitMerged(doc) → {question, description} | null`  *(SC-1)*
- **가드**: `description` 빈값/null **AND** `question`에 `∙`(또는 `•`) 포함. 아니면 `null`(미변경).
- **규칙**: 첫 `∙` 인덱스 `i`. `question = doc.question.slice(0,i).trim()`, `description = doc.question.slice(i).trim()`.
- **안전**: 분리 후 `question`이 빈값이면 `null`(원본 파괴 방지). `∙` 없으면 `null`(FR-1: 원본 보존).
- **멱등**: 실행 후 description 채워짐 → 재실행 시 가드 실패.

### 3.2 `buildClassMap(docs, years) → Map<common_key, classification>`  *(SC-2 보조)*
> 시그니처: 이미 로드된 doc 배열을 받는 순수함수(DB 무관 — 테스트 용이). 오케스트레이터가 `Item.find().lean()` 후 전달.
- 우선순위 연도 배열(`[2026,2025,2024,2023,2022]`) 순회, common_key별 **최초로 만난 비어있지 않은 classification** 채택(2026 우선).
- 반환 Map. (2021/2020 자신은 소스에서 제외 — 오염원 회피.)

### 3.3 `backfillClassification(doc, classMap) → {classification} | null`  *(SC-2)*
- **가드**: `doc.classification` 빈값/'' **AND** `doc.common_key` 존재 **AND** `classMap`에 비어있지 않은 값.
- **규칙**: `{ classification: classMap.get(doc.common_key) }`. 없으면 `null`(추측 금지, '' 유지).
- **멱등**: 채워지면 가드 실패.

### 3.4 `buildBlocks(description) → {blocks} | null`  *(SC-3)*
- **입력**: 분리 후 description(있으면) 또는 기존 description. 빈값 → `null`.
- **파싱(라인 단위, trim·빈줄 제거)**:
  - `∙/•/-/*` 시작 → `bullet` 블록(연속 묶음 → `content: string[]`).
  - 표 패턴(라인에 `|`/`│` 컬럼 구분 2회 이상) → `table` 블록(`content: string[][]`). **파이프 표만 인식 — 탭/공백 정렬 표는 정상 텍스트 오탐 위험으로 이번 제외(차기).**
  - 그 외 → `text` 블록(`content: string`).
- **멱등/무낭비**: 생성 결과가 기존 `doc.blocks`와 deep-equal이면 `null`(쓰기 생략).

### 3.5 `applyPatches(doc, classMap) → patch | null`
- split → backfill → (desc' 기준)buildBlocks 합성. 비어있으면 `null`. 한 doc당 `updateOne` 1회.

## 4. 오케스트레이터 (`migrate-spec5.js`)

- **CLI**: `--dry-run`(기본 안전: 쓰기 없음·리포트만), `--apply`(실제 쓰기), `--year=N`(필터), `--skip-backup`(비권장, 기존 import-items.js와 동일 명명), `--limit=N`.
- **단계**: connect → (apply 시)backup → buildClassMap → cursor 순회 patch 계산 → dry-run 리포트 또는 bulkWrite(500 배치, unordered) → 요약.
- **요약 지표(SC 증거)**: split 적용 수·2020 잔여 병합 수, 백필 수·미분류 잔여+2026 매칭률, blocks 적용 수·적재율, 변경 0 doc 수, **총 문항수 불변 확인**, 2026 변경 0 확인.
- **롤백**: 백업 경로 출력 → 문제 시 기존 `rollback-items.js`로 복구.

## 5. 데이터 모델 접점 (`checklist_items` flat)

쓰기 필드: `question`, `description`, `blocks`, `classification`. **불변**: `item_number/common_key/year/area_code/score/na_available/field_specific_description/revision`. 인덱스(`question/description text`)는 자동 갱신.

> 프론트 `getDisplayData`의 "?" band-aid는 분리 안정화 후 **별도 차기**에 제거(이번 OUT) — 데이터 정합 후 중복이지만 무해.

## 6. 테스트 계획

- **단위(`spec5-transforms.test.js`, DB 무관)**: splitMerged(∙유/무·빈질문 가드·멱등), backfillClassification(맵 hit/miss·가드·멱등), buildBlocks(불릿 묶음·텍스트·표·빈값·기존동일 null), buildClassMap(우선순위·오염원 제외).
- **통합(`spec5-migrate.test.js`, MongoMemoryReplSet)**: 혼합 시드(2020 병합·2021 미분류·2026 클린) → applyPatches 일괄 → SC-1(병합 잔여 0)·SC-2(미분류↓)·SC-3(blocks 100%)·SC-5(2026 불변·총수 유지) + **2회차 0 변경(멱등)**.

## 7. 리스크/완화

| 리스크 | 완화 |
|---|---|
| ∙ 오분리(질문 내 ∙) | dry-run 샘플 수동검수 + 빈질문 가드 + 백업/롤백 |
| 백필 연도 변동 | 2026 우선·동일 common_key·불일치 '' 유지 |
| 클린연도 손상 | 변환 가드 + SC-5 회귀검증(2026 변경 0) |
| 대량 사고 | apply 전 전체 백업 + rollback-items.js |

## 8. Implementation Guide

### 8.1 구현 순서
1. `lib/spec5/` 순수 변환 4종 + `index.applyPatches` → 단위테스트 GREEN.
2. `migrate-spec5.js` 오케스트레이터(backup/classMap/dry-run/bulkWrite/report).
3. 통합테스트(멱등 포함) GREEN.
4. 로컬 DB **dry-run → 검수 → apply** → SC 지표 확인.
5. 브라우저 SC-6(2020 `01.010.020` 분리 표시) 검증.

### 8.2 Session Guide (Module Map — `/pdca do --scope`)
| scope key | 산출물 | SC |
|---|---|---|
| `transforms` | `lib/spec5/{splitMerged,classMap,backfillClassification,buildBlocks,index}.js` + 단위테스트 | SC-1·2·3 |
| `orchestrator` | `migrate-spec5.js`(backup/dry-run/bulkWrite/report 재사용) | SC-4·5 |
| `verify` | 통합테스트 + 로컬 dry-run/apply + 브라우저 검증 | SC-1~6 |

권장 세션: `transforms` → `orchestrator` → `verify`.

## 9. 다음 단계
`/bkit:pdca do data-integrity --scope transforms` 부터 구현 시작.
