# Analysis (Check) — answer-marker-bleed (§5 잔여 정제)

> PDCA Check · 2026-06-14 · gap-detector + 런타임 증거 종합

## Match Rate: **gap-detector 96% → 보정 ~98%**
보정 사유: gap-detector(fresh-context)가 SC-B5(in-mem만 관측)·SC-B6(브라우저 미관측)를 낮게 잡음. 본 세션 런타임 증거로 둘 다 Met.

## SC 판정표 (보정 후 — 6/6 Met)
| SC | 판정 | 증거 |
|----|:----:|------|
| SC-B1 bleed 잔여=0 | ✅ Met | `bleedRemaining=0`(apply POST) · 통합테스트 `r.post.bleedRemaining===0` |
| SC-B2 12건만 변경 | ✅ Met | `cleanBleed` GUARD 가드 · 실측 `modified=12` · 비-bleed/2020병합 null 단위테스트 |
| SC-B3 question만 수정 | ✅ Met | `index.js` bleed→patch.question만 · descLen 582/580 불변 · blocksCoverage 9532/9535 그대로 |
| SC-B4 멱등 | ✅ Met | 재실행 `changed=0`(실 DB) · 멱등 단위/통합테스트 |
| SC-B5 회귀(총수·테스트) | ✅ Met | 실 DB `totalUnchanged=true` · 백엔드 **189 테스트 통과** |
| SC-B6 브라우저 클린 표시 | ✅ Met | 5년 이력 2025 `01.010.020` `hasBleed=false`(스크린샷) |

## Gap (gap-detector, 보정 후 — Critical 0)
| ID | 심각도 | 위치 | 내용 | 조치 |
|----|:---:|---|---|---|
| G1 | Important→deferred | `cleanBleed.js:12` | 다중 `?` 절단 경계 회귀테스트 부재(실측 12건은 안전) | 차기 회귀테스트 1건 |
| G2 | Minor | `cleanBleed.js:14` | 공백 정규화(\n\t) 명시 케이스 부재 | 차기 |
| G3 | Minor | `migrate-spec5.js` | `stat.split`이 bleed question 변경 포함(표기 혼입) | 선택적 `stat.bleed` 분리 |
| G4 | Minor→deferred | `migrate-spec5.js:writeReport` | `bleedRemaining` 콘솔엔 출력되나 리포트 파일 미기록 | 1줄 추가(선택) |

> GUARD↔BLEED_Q 정규식 문자 단위 동일(MongoDB `(?:...)` 호환) — 불일치 갭 없음(gap-detector 확인).

## 결론
- **목표 달성**: SC-B1~B6 6/6 Met, bleed 0, question-only(desc/blocks 불변), 멱등 실증, 회귀 0.
- **잔여는 비기능적**: G1/G2(회귀테스트 보강)·G3/G4(리포트 가독성). Critical 0.
- Match Rate ~98% ≥90% → report 진행. G1/G4는 차기(선택) 백로그.
