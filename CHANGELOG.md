# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Security
- **SEC-001**: CORS wildcard를 whitelist 방식으로 변경 (`CORS_ORIGINS` 환경변수)
- **SEC-002**: API key 비교를 timing-safe 방식으로 변경 (`crypto.timingSafeEqual`)
- **SEC-003**: 보안 이벤트 로깅 추가 (AUTH_FAILURE, AUTHZ_DENIED, RATE_LIMIT_EXCEEDED)

### Added
- Canary 런타임 검증 결과 저장 (`.autopus/canary/latest.json`)
- 보안 로거 유틸리티 (`gui/backend/utils/securityLogger.js`)

### Changed
- Backend 테스트 14개 통과 (SPEC-TEST-INTRO-001)
- Frontend 테스트 9개 통과 (SPEC-TEST-FRONTEND-001)

### Verified
- 전체 빌드 검증 완료 (H1, H2, H3)
- API 엔드포인트 검증 완료 (H4, H5, H6, H7)
- 인증 검증 완료 (H11a, H11b, H11c)
- LLM 수정사유 생성 기능 검증 완료
