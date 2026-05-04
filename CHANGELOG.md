# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security
- **SEC-001**: CORS wildcard를 whitelist 방식으로 변경 (`CORS_ORIGINS` 환경변수)
- **SEC-002**: API key 비교를 timing-safe 방식으로 변경 (`crypto.timingSafeEqual`)
- **SEC-003**: 보안 이벤트 로깅 추가 (AUTH_FAILURE, AUTHZ_DENIED, RATE_LIMIT_EXCEEDED)

### Added
- **CI Pipeline**: GitHub Actions 기반 CI 워크플로우 (`.github/workflows/ci.yml`)
  - Backend Tests: `npm install` → `test:run` (MongoDB 7.0 서비스 컨테이너)
  - Frontend Build & Tests: `test:run` → `test:coverage` → `build`
  - Artifacts: `frontend-dist` (30일), `frontend-coverage` (14일)
- **GitHub Pages 자동 배포**: CI 성공 시 자동 배포 (`.github/workflows/deploy.yml`)
  - URL: https://whopark.github.io/LMF/
  - 트리거: `workflow_run` (CI 성공 시) 또는 `workflow_dispatch` (수동)

- Canary 런타임 검증 결과 저장 (`.autopus/canary/latest.json`)
- 보안 로거 유틸리티 (`gui/backend/utils/securityLogger.js`)
- Frontend 테스트 커버리지 도구 (`@vitest/coverage-v8`)

### Fixed
- **CI 테스트 격리**: MongoDB 서비스 컨테이너 + Vitest 순차 실행으로 테스트 격리 문제 해결
  - `fileParallelism: false` — 파일 간 순차 실행
  - `sequence.hooks: 'stack'` — 훅 실행 순서 보장
  - 각 테스트 파일에서 `beforeEach`로 컬렉션 정리

### Changed
- Backend 테스트 14개 통과 (SPEC-TEST-INTRO-001)
- Frontend 테스트 9개 통과 (SPEC-TEST-FRONTEND-001)

### Verified
- 전체 빌드 검증 완료 (H1, H2, H3)
- API 엔드포인트 검증 완료 (H4, H5, H6, H7)
- 인증 검증 완료 (H11a, H11b, H11c)
- LLM 수정사유 생성 기능 검증 완료
