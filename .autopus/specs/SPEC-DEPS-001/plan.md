# SPEC-DEPS-001 · 구현 계획

> 대상: `gui/frontend`. 모든 build/test 명령은 `cd gui/frontend` 에서 실행.

## Phase 1: 호환 매트릭스 조사 (REQ-1, REQ-9, REQ-10, Q-FEAS-01/02)

- T1.1 registry 확인: `npm view vite version`(=8.0.16 기준), `npm view vite@8 peerDependencies` + `engines`
- T1.2 `npm view @vitejs/plugin-react versions --json` 에서 vite 8 peer 지원 최소/안정 버전 확정
- T1.3 `npm view vitest@<후보> peerDependencies` + `@vitest/coverage-v8` 로 vite 8 호환 버전 확정 (선결 대상, REQ-10)
- T1.4 vite **6→7→8** 누적 마이그레이션 노트에서 breaking change 추출
       (특히 Vite 7 default build target `'baseline-widely-available'` — 관측된 esbuild target 오류 연관)
- T1.5 `gui/frontend/package.json` 전체 deps 를 훑어 vite 를 peer 로 갖는 패키지 일괄 식별 (REQ-10)
- T1.6 Vite 8 Node 하한(≥20.19/≥22.12) 확인 후 `.github/workflows/ci.yml`·`deploy.yml` 의
       `node-version` 및 로컬 `node -v` 와 대조 (REQ-9)

소요: ~25분. 의존: 없음.

## Phase 2: 업그레이드 적용 (REQ-1, REQ-2, REQ-10)

- T2.1 `npm install -E vite@<8.x> @vitejs/plugin-react@<호환버전>` (정확 버전으로 lockfile 갱신)
- T2.2 Phase 1.3 결과 기반 `vitest`·`@vitest/coverage-v8` 를 vite 8 호환 버전으로 동반 업그레이드
- T2.3 `npm ls vite @vitejs/plugin-react vitest @vitest/coverage-v8 esbuild` 로 트리/peer 검증 → AC-1, AC-11
- T2.4 `npm audit` 으로 high 0 확인 → AC-2

소요: ~15분. 의존: T1 완료 후.

## Phase 3: config + 환경 마이그레이션 (REQ-6, REQ-9)

- T3.1 `vite.config.js` 검토: `plugins:[react()]`·`base` 분기·`server.proxy['/api']` 보존.
       Vite 7 default target 변경으로 인한 산출물 회귀를 막기 위해 `build.target` 을 **명시 결정**
       (관측된 "destructuring target not supported" 재발 방지, Q-FEAS-02) → AC-3, AC-6
- T3.2 vite 8 에서 deprecated 된 옵션/기본값 확인 후 보정
- T3.3 config 로드 스모크: `npm run build` 가 "failed to load config" 없이 진행되는지 → AC-6
- T3.4 `gui/frontend/package.json` 에 `engines.node` 하한 추가 +
       `.github/workflows/ci.yml`·`deploy.yml` 의 `node-version` 갱신 (REQ-9) → AC-10

소요: ~20분. 의존: T2 완료 후.

## Phase 4: 검증 (REQ-3, REQ-4, REQ-5)

- T4.1 `npm run build` → exit 0 + dist 산출물 → AC-3
- T4.2 `GITHUB_ACTIONS=true npm run build` → dist/index.html 에셋 경로 `/LMF/` 접두 grep → AC-4
- T4.3 `npm run test:run` → 9 files / 55 tests pass → AC-5
- T4.4 (Nice) `npm run dev` 짧은 기동 스모크 → AC-9

소요: ~15분. 의존: T3 완료 후.

## Phase 5: 문서화 + 롤백 안전성 (REQ-7, REQ-8)

- T5.1 `.autopus/project/tech.md` Vite/esbuild 버전·audit 현황·Node 요건 갱신 → AC-8
- T5.2 변경(package.json/lock, vite.config.js, .github/workflows/*.yml, tech.md)을 **단일 커밋**으로
       격리(다른 SPEC 작업 미혼합) → AC-7
- T5.3 `git show --stat HEAD` 로 변경 파일 범위 확인, `git revert` 가능성 확인

소요: ~10분. 의존: T4 PASS 후.

## 의존 그래프

```
T1 (조사: peer+Node 포함) ──► T2 (업그레이드+vitest) ──► T3 (config+engines+CI) ──► T4 (검증) ──► T5 (문서/커밋)
                                  │                                                   ▲
                                  └── audit/ls 검증 (AC-1,2,11) ─────────────────────┘
```

순차 의존이 강함(메이저 업그레이드 특성). 병렬화 여지 거의 없음.

## 위험 및 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| Vite 6→7→8 누적 breaking (특히 7의 default build target) | 산출물/빌드 회귀 | T1.4 누적 노트 추출 + T3.1 `build.target` 명시 + AC-3 stderr 검사 |
| Vite 8 Node 하한 > CI node-version | CI 빌드·배포 실패 (로컬만 통과) | T1.6/T3.4 에서 `node-version`·`engines` 갱신, AC-10 검증 |
| 미식별 vite-peer 패키지 | 설치/런타임 충돌 | T1.5 전체 deps 감사 + AC-11 `npm ls` peer 무오류 |
| @vitejs/plugin-react peer 불일치 | 설치/빌드 실패 | T1.2 호환 버전 선확정, `npm ls` peer 검증(AC-1) |
| vitest 4.1.5 vite 8 비호환 | 테스트 실행 불가 | T1.3 선결 확인 + T2.2 동반 업그레이드 (선결 대상) |
| GitHub Pages base 회귀 | 배포 시 에셋 404 | AC-4 로 `/LMF/` 접두 강제 검증 (배포 불변식) |
| dev proxy 설정 변경 | 로컬 API 호출 깨짐 | AC-6 로 proxy 보존 검증 |
| lockfile 대규모 재정렬 | noisy diff / 리뷰 부담 | 단일 커밋 격리(AC-7), 기능은 build+test 로 검증 |

## 롤백 절차

```
git revert <upgrade-commit>      # package.json/lock/config/workflows 원복
cd gui/frontend && npm ci        # lockfile 기준 재설치
npm run build && npm run test:run # vite 6 상태 복구 확인
```
