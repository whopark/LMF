# SPEC-DEPS-001 · 멀티 프로바이더 리뷰

- Date: 2026-06-16
- Strategy: debate (2-provider fallback)
- Providers: **claude (opus, judge)** + **gemini (gemini-3.1-pro-preview, 독립)**
- Judge: claude
- **Final Verdict: PASS** → Status `draft` → `approved`

> 비고: `autopus.yaml`의 review_gate(claude+codex)를 구동하는 `auto` 오케스트라 CLI가
> 미설치(`auto: command not found`)되어, 사용자 승인 하에 claude+gemini 2-프로바이더로 대체 실행했다.
> codex(full-auto)는 리뷰 중 파일 수정 리스크가 있어 제외.

## Iteration 1 — REVISE

| 프로바이더 | Verdict |
|---|---|
| gemini | REVISE |
| claude (judge) | REVISE |

Findings (합의):

| F-ID | source/sev | finding |
|------|-----------|---------|
| G1 | gemini/HIGH | Node.js 최소 버전 상향 + CI/CD 워크플로 갱신 계획 누락 |
| G2 | gemini/HIGH | @vitejs/plugin-react 외 다른 패키지의 vite peer 의존 맹점 |
| G3 | gemini/MEDIUM | vite 6→7→8 더블 메이저 점프 breaking change 과소평가 |
| G4 | gemini/MEDIUM | vitest 호환을 선결이 아닌 후순위로 취급 |
| C1 | claude/HIGH | Vite 7 default `build.target` 변경 ↔ 관측된 esbuild "destructuring target" 오류 연결 누락 |
| C2 | claude/MEDIUM | CI는 GITHUB_ACTIONS로 INV-1 강제 → CI Node 미달 시 로컬 통과해도 배포 파괴 |

## Revision — 적용 내역

- REQ-9 신설: Node 하한(≥20.19/≥22.12) + CI 워크플로 + `engines.node` (G1, C2)
- REQ-10 신설: 전체 vite-peer 일괄 정렬 + vitest 1급 선결 (G2, G4)
- Context/plan T1.4·위험표: 6→7→8 누적 메이저 명시 (G3)
- Q-FEAS-02 강화 + plan T3.1: build.target 명시 결정 (C1)
- acceptance AC-10(Node/CI)·AC-11(peer) 추가, AC-7 파일 범위에 workflows 포함
- research INV-5(Node 하한) + Revision 1 closure 표 기록

## Iteration 2 — PASS

| 프로바이더 | Verdict | Finding closure |
|---|---|---|
| gemini | **PASS** | 1~4 전부 CLOSED, 신규 블로킹 이슈 no |
| claude (judge) | **PASS** | 개정이 모든 findings 종결, 잔여 Open Issue는 구현 시점 확정 사항(Q-FEAS-01/02)으로 적정 |

## 최종 판정

**PASS** — SPEC-DEPS-001 승인. 다음 단계: `/auto go SPEC-DEPS-001`.

잔여 Open Issue(Q-FEAS-01 호환 버전 확정, Q-FEAS-02 build.target)는 구현 Phase 1에서
registry/실측으로 닫히도록 설계되어 승인을 차단하지 않는다.
