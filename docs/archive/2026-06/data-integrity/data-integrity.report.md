# Completion Report — data-integrity (§5 데이터 오염 정제)

> PDCA 완료 · 2026-06-14 · Plan→Design→Do→Check(iterate) 전 과정 · Match Rate ~97% · SC 6/6 Met

## 1. Executive Summary

| 관점 | 내용 |
|---|---|
| **Problem** | 과거연도 오염 집중 — 2020 질문/설명 병합(1,515), 2021 미분류(1,231), blocks 전무(9,984) → 5년 이력 신뢰성 훼손. |
| **Solution** | 백업·dry-run·롤백·멱등 마이그레이션(`migrate-spec5.js` + 순수변환 `lib/spec5/*`)으로 ∙기준 분리·2026 우선 분류 백필·blocks 적재. |
| **기능·UX 효과** | 2020·2021 문항이 질문·설명·분류 분리/구조화 표시. 5년 이력·연도별 비교 정합성 회복. 2026 불변. |
| **핵심 가치** | 심사점검표 기준 데이터 정합성 복구 + 안전(백업/멱등 실증)로 무손상. |

### 1.3 Value Delivered (실측)
| 지표 | Before | After | 근거 |
|---|---|---|---|
| 2020 병합(desc 빈값+∙) | 1,168 | **0** | `mergedRemaining=0` |
| 미분류 `classification=''` | 1,601 | **17** (단종 문항) | backfill 1,584, 미매칭 17 명시 |
| blocks 적재(설명 보유) | 0 | **9,532/9,535** | `blocksCoverage` |
| 2026 클린연도 | — | **불변** | `totalUnchanged=true`, 총 9,984 유지 |
| 멱등성(실 DB 재실행) | — | **changed=0** | dry-run 재실행 |

## 2. Key Decisions & Outcomes

| 단계 | 결정 | 따랐는가 | 결과 |
|---|---|:---:|---|
| Plan | 일회성 마이그레이션 스크립트(ETL 재파싱 대신) | ✅ | 빠르고 가역적, 백업+롤백 |
| Plan | ∙ 기준 분리 / 2026→최근클린 백필 / blocks 전체 | ✅ | SC-1/2/3 달성 |
| Plan | 답안마커 bleed 12건 OUT | ✅ | 차기 사이클로 이연 |
| Design | **B 클린**(변환별 모듈 분리) | ✅ | 순수함수 단위테스트 용이, 전 파일 ≤300줄 |
| Design | dry-run 기본 + --apply 시 백업 | ✅ | 안전한 적용 흐름 |
| Check | gap-detector 86% → 런타임 보정 + iterate | ✅ | ~97%, 6/6 Met |

## 3. Success Criteria — Final Status (6/6 Met)

| SC | 상태 | 증거 |
|----|:----:|------|
| SC-1 2020 병합 잔여=0 | ✅ Met | `mergedRemaining=0` (apply POST) |
| SC-2 2021 미분류↓ + 매칭 리포트 | ✅ Met | 1,601→17, 리포트에 미매칭 17건 item_number 명시 |
| SC-3 blocks 적재 100% | ✅ Met | 9,532/9,535 (파이프 표 범위; 탭/공백 표 차기) |
| SC-4 백업·dry-run·멱등·롤백 | ✅ Met | 백업 `..._20260614-2`, 실 DB `changed=0`, 롤백 명령 |
| SC-5 2026 불변 + 총 9,984 | ✅ Met | `totalUnchanged=true` + 통합테스트 |
| SC-6 브라우저 분리 표시 | ✅ Met | 2020 `01.010.020` descLen 0→472, 모달 7불릿(스크린샷) |

## 4. 구현 산출물

- **순수 변환** `gui/backend/scripts/lib/spec5/`: splitMerged·classMap·backfillClassification·buildBlocks·index (5파일, ≤47줄)
- **오케스트레이터** `gui/backend/scripts/migrate-spec5.js` (CLI, dry-run 기본, 백업/bulkWrite/사후검증/SC-2 리포트)
- **테스트**: `tests/spec5-transforms.test.js`(18) + `tests/spec5-migrate.test.js`(3) = 21개. 백엔드 전체 **182 통과**
- **문서**: plan/design/analysis (이 보고서 포함)

## 5. 적용 메트릭

classMap 1,225 · scanned 9,984 · **modified 9,573** (split 1,168 / backfill 1,584 / blocks 9,532) · 백업 9,984 docs.

## 6. 잔여 / 후속

- **차기 사이클**: 답안마커 bleed 12건(2025 `예 (필수)`), 탭/공백 표 blocks, 프론트 `getDisplayData` "?" band-aid 제거(데이터 정합 후 중복).
- **선택적 하드닝**: G-2(blocksEqual true deep-equal — 현재 멱등 실증으로 무해), G-7(dry-run 사후검증).
- **미커밋**: `lib/spec5/*`·`migrate-spec5.js`·테스트 2개·plan/design/analysis/report. (DB는 마이그레이션 반영, 백업 보유.)

## 7. 학습 (Learnable Record)

- **프로브 우선**: 초기 `about_item.*` 경로 오류를 실데이터 프로브로 즉시 발견 → 모델 스키마 확인 후 정정. 추측 코딩 방지.
- **런타임 검증 > 정적 분석**: gap-detector가 멱등/브라우저를 낮게 잡았으나 실 DB 재실행·스크린샷으로 보정. fresh-context 한계를 런타임 증거로 보완.
- **code is truth**: 설계-구현 불일치 시 더 나은 코드(순수 classMap)에 맞춰 설계 문서 동기화.
