# SPEC-DEPS-001 · Vite 6→8 업그레이드 및 esbuild 취약점 해소

- Status: completed
- Priority: Must
- Owner: 메인 세션
- Created: 2026-06-16
- Related SPECs: SPEC-CLEANUP-001 (frontend 빌드/CSS 정리), SPEC-DB-001 (진행 중)

## Context

2026-06-16 의존성 보안 정리 작업 중, `gui/frontend`에 esbuild ≤0.28.0 취약점
(GHSA-gv7w-rqvm-qjhr, **high** 3건: esbuild → vite → @vitejs/plugin-react)이 잔존함을 확인했다.

근본 원인은 **vite 6.4.3이 esbuild 0.25.x로 고정**하는 것이며, esbuild 패치 버전(0.28.1+)은
**vite 8(메이저)** 부터 포함된다. 같은 세션에서 `overrides: { esbuild: ^0.28.1 }`로 esbuild만
강제하는 우회를 실측했으나 vite 6와 비호환으로 **빌드가 파괴**됨을 확인했다:

```
Transforming destructuring to the configured target environment
("chrome87","edge88","es2020","firefox78","safari14" +2 overrides) is not supported yet
```

따라서 유일한 클린 경로는 **vite 6→8 메이저 업그레이드**(esbuild 0.28.1+ 동반)이며,
이는 vite 6→7→8 **두 번의 메이저**를 건너뛰는 변경이다. `@vitejs/plugin-react`, `vitest`,
`@vitest/coverage-v8` 등 vite를 peer로 갖는 모든 패키지와 **Node.js 최소 버전·CI 워크플로**까지
함께 정렬해야 한다.

대상: `gui/frontend` (React 19 + Vite + Vitest). 산출물은 GitHub Pages 정적 `dist/`(base `/LMF/`).
backend는 본 SPEC 이전에 이미 `npm audit` 0건으로 정리 완료 → 범위 밖.

## Requirements

### REQ-1 (Ubiquitous, Priority: Must)

`gui/frontend`의 `vite`는 8.x로, `@vitejs/plugin-react`는 vite 8을 peer로 지원하는 버전으로
업그레이드된다. 두 패키지의 설치 버전은 서로의 peerDependencies 제약을 충족한다.

### REQ-2 (Ubiquitous, Priority: Must)

업그레이드 후 `npm audit`(`gui/frontend`) 결과 **high severity 취약점이 0건**이다.
특히 해석된 esbuild 버전은 **0.28.1 이상**이다.

### REQ-3 (Event-driven, Priority: Must)

WHEN `npm run build`를 실행할 때, THE SYSTEM SHALL exit code 0으로 성공하고
`dist/index.html`, `dist/assets/*.js`, `dist/assets/*.css`를 생성한다.

### REQ-4 (Event-driven, Priority: Must)

WHEN `npm run build:gh`(또는 `GITHUB_ACTIONS=true`)로 빌드할 때, THE SYSTEM SHALL
모든 에셋 참조 경로가 `/LMF/`로 시작하는 산출물을 생성한다. (GitHub Pages 배포 불변식 보존)

### REQ-5 (Event-driven, Priority: Must)

WHEN `npm run test:run`을 실행할 때, THE SYSTEM SHALL 업그레이드 이전과 동일하게
**기존 55개 테스트를 전부 통과**시킨다 (회귀 0).

### REQ-6 (Ubiquitous, Priority: Must)

`vite.config.js`는 vite 8 API에서 유효하게 로드되며, dev 서버의 `/api` → `http://localhost:5000`
프록시와 `base` 분기(`GITHUB_ACTIONS ? '/LMF/' : '/'`)가 보존된다.

### REQ-7 (Unwanted, Priority: Must)

IF 업그레이드가 빌드·테스트 회귀를 유발하면, THE SYSTEM SHALL `package.json` /
`package-lock.json` / `vite.config.js` / `.github/workflows/*.yml` 변경을 **단일 커밋**으로 격리해
git revert 1회로 원복 가능하게 한다.

### REQ-8 (Optional, Priority: Should)

`.autopus/project/tech.md`의 frontend 빌드 스택 표(Vite 6.x → 8.x, esbuild 버전)와
"npm audit" 현황 기술을 업그레이드 결과에 맞게 갱신한다.

### REQ-9 (Ubiquitous, Priority: Must)

`gui/frontend` 빌드·테스트는 Vite 8이 요구하는 Node.js 최소 버전(≥20.19 또는 ≥22.12) 이상에서
실행된다. `gui/frontend/package.json`에 `engines.node`로 그 하한을 명시하고, CI 워크플로
(`.github/workflows/ci.yml`, `deploy.yml`)의 `actions/setup-node` `node-version`이 하한을 충족하도록
갱신·검증한다. (배포 경로가 로컬과 동일한 Node 요건을 만족해야 INV-1이 CI에서도 성립)

### REQ-10 (Ubiquitous, Priority: Must)

업그레이드 적용 전, `gui/frontend`의 모든 dependency·devDependency 중 `vite`를 peerDependency로
갖는 패키지(`@vitejs/plugin-react`, `vitest`, `@vitest/coverage-v8` 등)를 일괄 식별해 각각 Vite 8
호환 버전으로 정렬한다. 정렬 후 `npm ls`는 vite 관련 어떤 `unmet`/`invalid` peer도 출력하지 않는다.
`vitest`는 테스트 실행 가능성(REQ-5)에 직접 의존하므로 **1급 선결 대상**이며, 비호환 시 Vite 8 호환
버전으로 동반 업그레이드한다.

## Out of Scope

- backend 의존성 — 본 SPEC 이전에 `npm audit` 0건 정리 완료(uuid override + form-data/qs).
- React 19 추가 업그레이드, framer-motion/lucide-react 등 vite-peer 없는 의존성.
- frontend `package-lock.json`의 기존 대규모 재정렬 diff 정리 — 별도.

## Open Issues

| Q | Category | Reason |
|---|---|---|
| Q-FEAS-01 | feasibility | vite 8 ↔ @vitejs/plugin-react ↔ vitest 호환 버전은 구현 시점 registry/peerDeps로 확정 (REQ-10이 정렬 보장) |
| Q-FEAS-02 | feasibility | Vite 7의 default build target 변경('baseline-widely-available')이 본 세션에서 관측된 esbuild "destructuring target not supported" 오류의 유력 원인 — T3.1에서 `build.target` 명시 결정, AC-3 stderr 검사로 회귀 차단 |
