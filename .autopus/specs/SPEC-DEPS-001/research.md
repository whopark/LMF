# SPEC-DEPS-001 · 조사 노트

## 발견 경위 (2026-06-16 의존성 보안 정리 세션, 실측 증거)

| 발견 | 증거 |
|---|---|
| frontend esbuild ≤0.28.0 high 3건 | `npm audit`: esbuild GHSA-gv7w-rqvm-qjhr → vite (≤8.0.3) → @vitejs/plugin-react (≤5.1.4) |
| vite 6.4.3 이 esbuild 0.25.x 고정 | `npm ls esbuild` → `vite@6.4.3 → esbuild@0.25.12` |
| esbuild 패치 = 0.28.1 | `npm view esbuild version` → 0.28.1 |
| esbuild override 강제는 vite 6 빌드 파괴 | `overrides:{esbuild:^0.28.1}` 적용 후 `npm run build` 실패: "Transforming destructuring to the configured target environment ... is not supported yet" |
| 패치 esbuild 를 포함하는 vite = 8 | `npm view vite version` → 8.0.16 (audit `--force` 도 vite@8.0.16 breaking 제안) |
| backend 는 이미 클린 | uuid override(^11.1.1) + form-data 4.0.6 + qs 6.15.2 적용 후 `npm audit` 0건, 테스트 209/209 통과 |

esbuild 권고(GHSA-gv7w-rqvm-qjhr)는 **Deno 모듈 + 공격자 제어 `NPM_CONFIG_REGISTRY`** 조건의
**빌드타임 dev 의존성** 이슈다. 본 앱은 Node+vite 로 빌드하고 산출물은 GitHub Pages 정적 `dist/`
이므로 프로덕션 런타임에 esbuild 가 포함되지 않아 실질 노출도는 낮으나, 의존성 정책상 정리한다.

## Semantic Invariant Inventory

| ID | 불변식 | source clause | 타입 | 영향 산출물 | acceptance |
|----|--------|---------------|------|-------------|-----------|
| INV-1 | 배포 빌드 에셋 경로는 `/LMF/` 로 접두된다 | package.json `build:gh`(`--base=/LMF/`) + vite.config `base: GITHUB_ACTIONS?'/LMF/':'/'` + homepage | grouping/ordering(경로 prefix) | dist/index.html 의 script/link src | AC-4 |
| INV-2 | dev 서버 `/api` 는 `http://localhost:5000` 으로 프록시된다 | vite.config `server.proxy['/api']` | parser/config 의미 | dev 런타임 API 호출 | AC-6 |
| INV-3 | frontend 테스트 수는 회귀 없이 55 (9 파일) 유지 | 현행 baseline (`vitest run` 실측) | numeric/count | 테스트 통과 집합 | AC-5 |
| INV-4 | esbuild 해석 버전은 모든 인스턴스에서 ≥0.28.1 | REQ-2 / audit 정책 | numeric(version) | node_modules 트리 | AC-2 |

INV-1·INV-2 는 구조 검증만으로 충족되지 않으므로 oracle 형태(구체 기대 출력)로 AC-4/AC-6 에 정의했다.

## 결정과 근거

### D1: esbuild override 가 아닌 vite 8 업그레이드

대안 비교:
- A `overrides:{esbuild}` — **실측 빌드 파괴**(vite 6 의 transform target 불일치). 기각.
- B `--force`(vite@8 자동) — npm 이 제안하나 무검증 breaking 적용은 위험. 본 SPEC 으로 통제된 업그레이드.
- C 수용+문서화 — 리스크는 낮으나 "클린 우선" 요구에 미충족.

선택: **통제된 vite 6→8 업그레이드 + @vitejs/plugin-react 동반**. 단일 클린 경로.

### D2: vitest 는 기본 유지, 조건부 승격

vite 8 peer 충족 시 vitest 4.1.5 유지(범위 최소화). 비호환이면 Gate 후 동반 업그레이드로 한정 확장.
(Q-COMP-01)

### D3: 단일 커밋 격리

vite 메이저 업그레이드는 회귀 위험이 있어 `git revert` 1회로 원복 가능하도록 다른 SPEC 변경과
혼합하지 않는다(REQ-7/AC-7). lockfile 대규모 재정렬 diff 는 기능 검증(build+test)으로 상쇄.

## Self-Verify Summary

| Q | status | files | reason |
|---|---|---|---|
| Q-CORR-01 | PASS | spec.md, plan.md | 인용 경로(vite.config.js, package.json scripts build/build:gh/test:run) 실존 확인 |
| Q-CORR-02 | PASS | acceptance.md | EARS/Gherkin(Given/When/Then) 형식 준수 |
| Q-COMP-01 | PASS | spec.md↔acceptance.md | REQ-1~8 → AC-1~9 추적 가능 |
| Q-COMP-02 | PARTIAL | spec.md Open Issues | vite8↔plugin-react↔vitest 호환 버전은 구현 시 registry 확정(Q-FEAS-01/Q-COMP-01) |
| Q-COMP-05 | PASS | research.md | Semantic Invariant Inventory(INV-1~4) 작성, oracle AC 연결 |
| Q-FEAS-01 | PASS | research.md | vite 8 존재·esbuild 0.28.1 포함을 registry 로 확인. 업그레이드 경로 실재 |
| Q-FEAS-02 | PARTIAL | spec.md, plan.md | build target 변화 영향은 T3.1/AC-3 에서 검증, 사전 미확정 → Open Issue |
| Q-STYLE-01 | PASS | spec.md | Priority(Must/Should) 와 EARS type 별도 axis 표기 |
| Q-SEC-01 | PASS | research.md | 외부 입력 경계 없음(빌드타임 dev 의존성). 새 런타임 노출 미도입 |
| Q-SEC-02 | PASS | acceptance.md | 검증은 읽기 전용 명령(npm ls/audit/build/test), 비밀 노출 없음 |

PARTIAL 2건은 본 SPEC 에서 의도적으로 구현 시점(registry/실측)으로 미룬 호환 버전 확정 사항이며
모두 Open Issues 로 명시했다.

## Revision 1 closure (멀티 프로바이더 리뷰 반영)

리뷰: gemini(독립) = REVISE, claude(judge) = REVISE. 합의 findings 및 종결:

| F-ID | source/severity | category | 종결 방법 | 반영 위치 |
|------|-----------------|----------|-----------|-----------|
| G1 | gemini/HIGH | completeness | Node.js 하한 + CI 워크플로 갱신을 요구사항화 | REQ-9, AC-10, plan T1.6/T3.4, 위험표 |
| G2 | gemini/HIGH | completeness | plugin-react 외 전체 vite-peer 감사 의무화 | REQ-10, AC-11, plan T1.5, 위험표 |
| G3 | gemini/MEDIUM | feasibility | 6→7→8 누적 메이저로 Context·계획 재기술 | Context, plan T1.4, Q-FEAS-02, 위험표 |
| G4 | gemini/MEDIUM | completeness | vitest 를 Open Issue→1급 선결 대상으로 승격 | REQ-10, plan T1.3/T2.2 (Out-of-Scope 제거) |
| C1 | claude/HIGH | feasibility | Vite 7 default target 변경↔관측 esbuild 오류 연결, build.target 명시 | Q-FEAS-02, plan T3.1, AC-3 |
| C2 | claude/MEDIUM | completeness | CI는 GITHUB_ACTIONS로 INV-1 강제 → CI Node 미달 시 배포 파괴 명시 | REQ-9 근거, AC-10 |

추가 불변식: **INV-5 (Node 하한)** — CI·로컬 모두 Vite 8 Node 요건 충족(REQ-9/AC-10). 미충족 시 INV-1(배포 base)
이 CI에서 깨진다.

## Related Work

- 본 SPEC 의 선행: 2026-06-16 backend 의존성 클린(uuid override, form-data/qs) — 이미 적용, 별도 커밋 후보.
- 후속 권장: frontend `package-lock.json` 대규모 재정렬 diff 정리(별도), CI(`deploy.yml`) 에서 vite 8 빌드 검증.
