# Completion Report — answer-marker-bleed (§5 잔여: 답안마커 bleed 12건)

> PDCA 완료 · 2026-06-14 · data-integrity 후속 · Match Rate ~98% · SC 6/6 Met

## 1. Executive Summary
| 관점 | 내용 |
|---|---|
| **Problem** | 질문 본문에 답안/분류 마커 혼입 12건 — 2025 `예 (필수)` 중간 삽입(2)·2021 `(필수) ∙ 중복설명` `?` 뒤 잔존(10). |
| **Solution** | 순수함수 `cleanBleed`(타깃 가드 + 임베드 제거 + 첫 `?` 절단)를 spec5/migrate-spec5에 통합. 백업·dry-run·멱등·롤백 재사용. |
| **기능·UX 효과** | 질문이 깨끗하게 표시(연도 간 일관). description/blocks/분류 불변. |
| **핵심 가치** | §5 데이터 정합성 마지막 잔여 해소 — 마이그레이션이 §5 4종 변환 완비. |

### 1.3 Value Delivered (실측)
| 지표 | 결과 |
|---|---|
| bleed 잔여 | 12 → **0** (`bleedRemaining=0`) |
| 변경 범위 | **12건 question만** (modified=12, desc/blocks 불변) |
| 멱등 | 재실행 `changed=0` |
| 회귀 | 총 9,984 유지 · 백엔드 **189 테스트** |
| 브라우저 | 2025 `01.010.020` `hasBleed=false`(스크린샷) |

## 2. Key Decisions & Outcomes
| 결정 | 따랐는가 | 결과 |
|---|:---:|---|
| 2021형 = 첫 `?` 절단(실설명 description 보존) | ✅ | `(필수) ∙ 중복` 제거, descLen 580 불변 |
| 2025형 = `예 (필수)` 임베드 제거 | ✅ | "…인증 심사를 받는가?" |
| 타깃 한정(GUARD) — 2020 병합 등 불변 | ✅ | modified 정확히 12 |
| 아키텍처 = spec5 통합(별도 스크립트 X) | ✅ | 백업/오케스트레이터 재사용, 1신규+합성 |

## 3. Success Criteria — Final (6/6 Met)
SC-B1 bleed 0 ✅ · SC-B2 12건만 ✅ · SC-B3 question-only ✅ · SC-B4 멱등 ✅ · SC-B5 회귀(189 테스트·총수) ✅ · SC-B6 브라우저 ✅

## 4. 구현 산출물
- `gui/backend/scripts/lib/spec5/cleanBleed.js` (신규, 순수)
- `index.js`(applyPatches 합성)·`migrate-spec5.js`(verifyMetrics `bleedRemaining`) 수정
- 테스트: spec5-transforms(+6: cleanBleed 5·applyPatches 1)·spec5-migrate(+1) → 백엔드 **189**
- 적용: 로컬 DB **12건**, 백업 `checklist_items_backup_20260614-3`, 롤백 명령 보유

## 5. 잔여 / 후속
- **차기(선택)**: G1 다중 `?` 절단 회귀테스트 · G4 리포트 파일에 `bleedRemaining` 기록 · G3 `stat.bleed` 분리 · G2 공백정규화 테스트.
- **§5 전체 종료**: 2020 병합·2021 미분류·blocks(data-integrity) + 답안마커 bleed(본 사이클) → §5 클러스터 데이터 오염 정제 완결.

## 6. 학습
- **통합 재사용**: 기존 spec5 변환 프레임에 1개 순수함수만 추가해 백업/dry-run/멱등/사후검증 인프라 전부 재사용 — 작은 변경으로 안전한 데이터 마이그레이션.
- **타깃 가드의 중요성**: `?` 절단은 위험 연산 → bleed 시그니처 가드로 한정해 2020 병합 등 무손상.
