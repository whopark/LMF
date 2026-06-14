# Design — answer-marker-bleed (§5 잔여 정제)

> PDCA Design · 2026-06-14 · 아키텍처: spec5 통합(기존 변환 라이브 + 오케스트레이터 재사용)

## Context Anchor (Plan 승계)
WHY §5 정합성 완결 · RISK 질문 절단 과다(타깃 가드) · SUCCESS bleed 0·12건만·기타 불변 · SCOPE 12건 question 정제.

## 1. 모듈 변경 (최소)
```
scripts/lib/spec5/
  cleanBleed.js   # 신규 — 순수: bleed 가드 + 임베드 제거 + ? 절단
  index.js        # MOD — applyPatches에 cleanBleed 합성(split 후 question에 적용)
tests/
  spec5-transforms.test.js  # MOD — cleanBleed 단위테스트 추가
  spec5-migrate.test.js     # MOD — bleed 시드 통합 케이스 추가
```
오케스트레이터 `migrate-spec5.js`는 **변경 없음**(applyPatches가 cleanBleed를 포함하므로 기존 dry-run/apply/백업/사후검증 그대로 동작).

## 2. `cleanBleed(question) → { question } | null`
```
const GUARD = /예\s*\(\s*(?:필수|필요|기본)\s*\)|\?\s*\(\s*(?:필수|필요|기본)\s*\)/;
// 1) 가드: bleed 시그니처 없으면 null (타깃 한정 — 2020 병합/일반 질문 불변)
// 2) 임베드 제거: replace(/예\s*\(\s*(?:필수|필요|기본)\s*\)/g, ' ')   // 2025형
// 3) 첫 '?'까지 절단                                                    // 2021형 cruft 제거
// 4) 공백 정규화(\s+→' ', trim)
// 5) orig와 같으면 null (멱등)
```
- **가드가 핵심**: 절단(`?`)은 위험하므로 bleed 매칭 문항에만 적용. 2020 병합 질문엔 `(필수)`/`예 (필수)` 없음 → 미적용.
- **멱등**: 정제 후 가드 실패 → 재실행 null.

## 3. applyPatches 합성 (index.js)
```
const split = splitMerged(doc);
let q = split ? split.question : doc.question;
if (split) { patch.question = split.question; patch.description = split.description; }
const bleed = cleanBleed(q);          // split 후 question에 적용
if (bleed) patch.question = bleed.question;
... (backfill / buildBlocks 기존대로, description 기반 — bleed는 question만 건드림)
```
- bleed 12건은 desc 비어있지 않음 → splitMerged null → cleanBleed가 question 정제.
- blocks는 description 기반 → 불변(SC-B3). split↔bleed 비충돌(서로 다른 문항).

## 4. Success Criteria 매핑
SC-B1/B2/B3 → cleanBleed 가드·question-only · SC-B4 멱등 가드 · SC-B5/B6 → migrate-spec5 사후검증 재사용(MERGED_Q에 bleed 미포함이므로 별도 카운트 추가) + 브라우저.

> 사후검증 보강: `verifyMetrics`에 `bleedRemaining`(GUARD 매칭 수) 추가 → SC-B1 증거.

## 5. 테스트 계획
- 단위: cleanBleed(2025 임베드·2021 ?절단·가드 미매칭 null·멱등·실설명 보존확인).
- 통합: bleed 시드(2025형·2021형) → runMigration(apply) → bleed 0·question 정제·desc/blocks 불변·멱등.

## 6. 구현 순서
1. cleanBleed.js + 단위테스트(RED→GREEN). 2. index.applyPatches 합성. 3. verifyMetrics에 bleedRemaining. 4. 통합테스트. 5. 로컬 dry-run→apply→재조사. 6. 브라우저 SC-B6.

## 다음
`/pdca do answer-marker-bleed`.
