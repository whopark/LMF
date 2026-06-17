# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Completed SPECs
- **SPEC-CLEANUP-001**: 초기 위생 정리 완료
  - 빈 스트레이 디렉토리 및 Windows 예약 이름 파일 제거 (REQ-1)
  - App.css 분할: tokens/layout/components/views 구조 (REQ-2, REQ-3)
  - dotenv 환경변수 설정: MONGO_URI, ANTHROPIC_API_KEY, LLM_* (REQ-4)
  - `/api/llm/reason` 분당 20회 rate limit 적용 (REQ-5)
  - Express JSON body parser 32KB 제한 (REQ-6)
  - import-data.js 스키마 재사용 리팩토링 (REQ-7)
  - SPEC 문서화 4개 파일 구성 (REQ-9)
- **SPEC-DEPS-001**: Vite 6→8 업그레이드 + esbuild 취약점 해소 완료
  - vite 6.4.3 → 8.0.16, @vitejs/plugin-react 4.3.4 → 6.0.2 (REQ-1)
  - esbuild ≤0.28.0 (GHSA-gv7w-rqvm-qjhr) 해소, npm audit high 0 (REQ-2)
  - vitest 4.1.5 유지(이미 vite 8 호환), engines.node 명시 + CI node 20→22 (REQ-9/10)
  - 검증: build·build:gh(/LMF/)·test:run(55/55)·audit(0) 전 AC PASS — 멀티 프로바이더 리뷰(claude+gemini) PASS
- **SPEC-PDF-001**: PDF→PG 적재 로더 구현 + 2026 적재·검증 완료 (부분)
  - `pdf/import_to_pg.py` + `pg_load.py`: flat_v2.json → PG 정규화 스키마 적재 (멱등 ON CONFLICT, dry-run 기본, 배치 트랜잭션 경계, 위반 리포트, 참조 시드) (REQ-1~8)
  - 2026 적재: checklist_item 1635 / item_content 1026 (dedup 609 제거), 무손실, AC-3/4/5/13 위반 0, FK orphan 0
  - `verify_2026.sql` AC 오라클 V1~V11 PASS · 멀티 프로바이더 리뷰(claude+gemini) PASS
  - 전체 적재 완료(2020~2026): checklist_item 9984 / item_content 6570 — SPEC-DB-001 분할분야 스키마 개정(`ee50eca`) 후
- **SPEC-DB-001 (개정)**: 분할분야 스키마 — 전체 9984 적재 가능화
  - `checklist_item.item_number` 생성컬럼 → 일반 text(소스 원본 보존), `field_code` 생성컬럼 신설(논리 분야 = item_number prefix)
  - PK `(area_code,common_key,year)` → `(area_code,item_number,year)`: 분할분야(임상미생물 area 36·수혈 46) PK 충돌 168 + 이상치 1 → 0
  - 검증: 9984 무손실 / 6570 content, 연도분포 2020~2026 일치, FK orphan 0, 이상치 21.405.120/2025 양분야 보존 (`pdf/verify_full.sql` V1~V13 PASS)
- **SPEC-DB-001 Phase 4 (Repository 컷오버)**: 앱 런타임 Mongo↔PG 전환 (`DB_ENGINE=pg|mongo` 토글, 기본 mongo=무변경·즉시 롤백)
  - 읽기 4종(filters·items·common·changes) + 쓰기 4종(applyItemEdit·applyCommonEdit·unlock·transition) Repository 추상화 + 트랜잭션(`knex.transaction`)
  - 마이그레이션 005: item_revision에 edit_types jsonb + status_at_save (Revision 형상 무손실)
- **SPEC-DB-001 Phase 5 — ⚠️ 동작 변경 (REQ-10 lock 정책)**: 공통문항 일괄편집의 lock 처리가 **부분 skip → all-or-nothing**으로 변경
  - 대상 (common_key, year)에 locked 분야가 하나라도 있으면 편집 전체가 **409로 차단**(`blocked_locked` 반환, 부분 편집 없음)
  - **admin 권한 + `admin_override: true`** 전송 시에만 locked 분야를 건너뛰고 나머지를 편집
  - 단일편집(PATCH /items/:id)·transition은 기존대로 개별 lock guard(403) 유지

### Security
- **DEPS(backend)**: 의존성 취약점 정리 — uuid override(^11.1.1 via exceljs), form-data 4.0.6, qs 6.15.2 (npm audit 0)
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
