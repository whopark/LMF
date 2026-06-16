# SPEC-DEPS-001 · 수락 기준

## Must scenarios

### AC-1: vite/플러그인 버전 (REQ-1)

```
Given gui/frontend 디렉토리
When `npm ls vite @vitejs/plugin-react` 를 실행한다
Then vite 의 해석 버전은 8.x 이다 (major == 8)
And @vitejs/plugin-react 의 해석 버전은 vite 8 을 peer 로 허용하는 버전이다
And `npm ls` 가 peer 의존성 오류(invalid/unmet)를 출력하지 않는다
```

### AC-2: audit high 0 + esbuild 패치 (REQ-2)

```
Given 업그레이드 적용 후 gui/frontend
When `npm audit` 와 `npm ls esbuild` 를 실행한다
Then `npm audit` 의 high severity 카운트는 0 이다
And 해석된 esbuild 의 모든 인스턴스 버전은 0.28.1 이상이다
```

### AC-3: 기본 빌드 성공 (REQ-3)

```
Given gui/frontend
When `npm run build` 를 실행한다
Then exit code 는 0 이다
And dist/index.html 이 존재한다
And dist/assets/ 하위에 최소 1개의 *.js 와 1개의 *.css 가 생성된다
And stderr 에 "is not supported yet" 또는 esbuild/rollup 오류가 없다
```

### AC-4: GitHub Pages base 보존 (REQ-4) — 배포 불변식

```
Given gui/frontend
When `GITHUB_ACTIONS=true npm run build` (또는 `npm run build:gh`) 를 실행한다
Then dist/index.html 내 <script> 와 <link> 의 src/href 가 "/LMF/assets/" 로 시작한다
And "/assets/"(LMF 접두 없음) 로 시작하는 에셋 참조가 존재하지 않는다
```

### AC-5: 테스트 회귀 0 (REQ-5)

```
Given 업그레이드 적용 후 gui/frontend
When `npm run test:run` 을 실행한다
Then exit code 는 0 이다
And "Test Files  9 passed (9)" 가 출력된다
And "Tests  55 passed (55)" 가 출력된다 (이전 baseline 과 동일)
```

### AC-6: vite.config 유효성 + 프록시 보존 (REQ-6)

```
Given gui/frontend/vite.config.js
When `npm run build` 실행 시 vite 가 config 를 로드한다
Then "failed to load config" 오류가 없다
And vite.config.js 의 server.proxy['/api'] 가 "http://localhost:5000" 으로 유지된다
And base 표현식이 `process.env.GITHUB_ACTIONS ? '/LMF/' : '/'` 의미를 유지한다
```

### AC-7: 단일 커밋 롤백 가능성 (REQ-7)

```
Given 업그레이드 변경
When `git show --stat HEAD` 로 업그레이드 커밋을 확인한다
Then 변경 파일은 gui/frontend/package.json, package-lock.json, vite.config.js,
     .github/workflows/*.yml, (선택) tech.md 로 한정된다
And `git revert HEAD` 로 단일 커밋 원복이 가능하다 (다른 SPEC 변경과 미혼합)
```

### AC-10: Node.js 버전 + CI 워크플로 (REQ-9)

```
Given gui/frontend 와 .github/workflows/
When `node -v` 와 `grep -rn "node-version" .github/workflows/` 를 실행한다
Then 로컬 node 버전은 20.19 이상 또는 22.12 이상이다
And ci.yml / deploy.yml 의 actions/setup-node node-version 값이 그 하한 이상이다
And gui/frontend/package.json 의 engines.node 가 동일 하한을 명시한다
```

### AC-11: 전체 vite-peer 정렬 (REQ-10)

```
Given 업그레이드 적용 후 gui/frontend
When `npm ls 2>&1` 전체 출력을 확인한다
Then "invalid"·"unmet peer"·"peer dep missing" 문자열이 vite 관련 패키지에 없다
And @vitejs/plugin-react, vitest, @vitest/coverage-v8 의 해석 버전이 모두 vite 8 을 peer 로 허용한다
```

## Should scenarios

### AC-8: tech.md 갱신 (REQ-8)

```
Given .autopus/project/tech.md
When 파일 내용을 읽는다
Then Frontend Build 행의 Vite 버전이 "8.x" 로 갱신되어 있다
And "npm audit: 0 vulnerabilities" 또는 잔여 현황 기술이 실제 audit 결과와 일치한다
```

## Nice scenarios

### AC-9: dev 서버 기동 스모크

```
Given 업그레이드 후 gui/frontend
When `npm run dev` 로 vite dev 서버를 기동한다 (수동 또는 짧은 헤드리스)
Then 서버가 포트에 바인딩되고 콘솔에 vite 8.x 배너가 출력된다
And index 페이지가 200 으로 응답한다
```
