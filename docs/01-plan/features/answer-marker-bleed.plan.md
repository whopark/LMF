# Plan — answer-marker-bleed (§5 잔여: 답안마커 bleed 12건)

> PDCA Plan · 2026-06-14 · data-integrity 후속 · 접근: spec5 통합 마이그레이션(타깃 12건)

## Executive Summary
| 관점 | 내용 |
|---|---|
| **Problem** | 질문 본문에 답안/분류 마커가 혼입된 12건 — 2025 `예 (필수)` 중간 삽입(2), 2021 `(필수) ∙ 중복설명`이 `?` 뒤 잔존(10). |
| **Solution** | 순수함수 `cleanBleed(question)`로 ① `예 (필수/필요/기본)` 임베드 제거 ② 첫 `?`까지 절단. spec5/migrate-spec5에 통합(타깃 한정·멱등·백업). |
| **기능·UX 효과** | 질문이 깨끗하게 표시(예: "…인증 심사를 받는가?"). description/blocks/분류 불변. |
| **핵심 가치** | §5 데이터 정합성 마지막 잔여 해소. |

## Context Anchor
WHY: §5 정합성 완결 · WHO: 심사위원/관리자 · RISK: 질문 절단 과다(타깃 한정·` ?`까지만) · SUCCESS: bleed 0·12건만 변경·기타 불변 · SCOPE: IN 12건 question 정제, OUT 다른 필드·다른 문항.

## 요구사항
- **FR-1**: `예 (필수|필요|기본)` 임베드 마커 제거(공백 정규화) — 2025형.
- **FR-2**: bleed 매칭 시 질문을 첫 `?`까지 절단 — 2021형 `(필수) ∙ 중복설명` 제거(실설명은 description에 이미 보존, descLen 509~725).
- **FR-3**: **타깃 한정** — bleed 시그니처(`예 (필수)` 또는 `? 직후 (필수)`) 매칭 문항만. 그 외 불변.
- **FR-4**: question만 수정 — description/blocks/classification 불변.
- **NFR**: 멱등(재실행 0), 백업/dry-run/롤백(기존 migrate-spec5 재사용), 총 9,984 유지.

## Success Criteria
- **SC-B1** bleed 잔여 = 0 (정제 후 매칭 0).
- **SC-B2** 12건만 변경(타깃 한정 — 다른 문항 question 불변).
- **SC-B3** description/blocks/classification 불변.
- **SC-B4** 멱등(재실행 changed=0).
- **SC-B5** 회귀 — 총 9,984 유지 + 백엔드 테스트 통과.
- **SC-B6** 브라우저 — 2025 `01.010.020` 질문 "…인증 심사를 받는가?" 깨끗 표시.

## 범위 밖
다른 §5 항목(완료), 탭/공백 표 blocks, 프론트 band-aid 제거.

## 리스크/완화
질문 절단 과다 → bleed 시그니처 가드로 타깃 한정 + 첫 `?`까지만 + 백업/롤백. 실설명 보존 확인(descLen>0).

## 다음
`/pdca design answer-marker-bleed` (또는 본 세션 Design 진행).
