# SPEC-CLEANUP-001 · 초기 위생 정리

- Status: implemented
- Priority: Must
- Owner: 메인 세션
- Created: 2026-05-03
- Related SPECs: 없음 (첫 SPEC)

## Context

리뷰 결과 발견된 6개 결함을 한 번에 정리하여 다음 작업의 출발선을 깨끗이 한다. 변경은 모두 reorganization/config 수준이며 제품 동작에는 영향이 없다.

대상 코드베이스: `gui/backend` (Express + MongoDB), `gui/frontend` (React 19 + Vite), 루트 하네스 설정.

## Requirements

### REQ-1 (Ubiquitous, Priority: Must)

저장소 루트와 `gui/` 하위에 빈 스트레이 디렉토리(`guibackendmodels/`, `guibackendroutes/`, `guifrontendsrccomponents/`, `guifrontendsrchooks/`, `guifrontendsrcutils/`)와 Windows 예약 이름 파일(`nul`)이 존재하지 않는다.

### REQ-2 (Ubiquitous, Priority: Must)

`gui/frontend/src/App.css` 및 그로부터 import 되는 모든 CSS 파일은 각각 300줄 이하여야 한다. 분할은 관심사 단위(tokens · layout · components · views · legacy)를 따른다.

### REQ-3 (Ubiquitous, Priority: Must)

App.css 분할 후에도 `npx vite build`가 성공하고, 빌드된 CSS bundle에 누락된 셀렉터가 없다.

### REQ-4 (Event-driven, Priority: Must)

WHEN 백엔드 서버가 기동될 때, THE SYSTEM SHALL `dotenv`를 통해 `.env` 파일에서 `MONGO_URI`, `ANTHROPIC_API_KEY`, `LLM_MODEL`, `LLM_MAX_TOKENS`, `LLM_RATE_LIMIT_PER_MIN`을 읽어들인다. 각 값은 코드에 하드코딩되지 않는다.

### REQ-5 (Event-driven, Priority: Must)

WHEN `/api/llm/reason` 엔드포인트에 요청이 도달할 때, THE SYSTEM SHALL 분당 `LLM_RATE_LIMIT_PER_MIN`회를 초과하는 요청을 HTTP 429로 거부한다. 기본값은 20이며 환경 변수로 조정 가능하다.

### REQ-6 (Ubiquitous, Priority: Must)

WHEN Express JSON body parser가 요청을 수신할 때, THE SYSTEM SHALL 32 KB를 초과하는 페이로드를 거부한다.

### REQ-7 (Ubiquitous, Priority: Should)

`gui/backend/import-data.js`는 `gui/backend/models/ChecklistItem.js`의 스키마를 재사용하며, `MONGO_URI`는 환경 변수로 읽는다. 스키마 정의는 한 파일(`models/ChecklistItem.js`)에만 존재한다.

### REQ-8 (Optional, Priority: Should)

WHILE 프로젝트에 단 하나의 자동화된 테스트도 없는 동안, `autopus.yaml`의 `methodology.enforce`는 `false`다. 첫 통과 테스트가 도입되면 이 값을 `true`로 되돌린다.

### REQ-9 (Ubiquitous, Priority: Should)

`.autopus/specs/SPEC-CLEANUP-001/`에 `spec.md`, `plan.md`, `acceptance.md`, `research.md` 4개 파일이 존재하며 모두 300줄 이하다.

## Out of Scope

- legacy CSS 클러스터(`comparison-card.css`, `comparison-doc.css`, `comparison-panels.css`)의 실제 제거 — 별도 SPEC에서 다룬다.
- 인증/권한 도입(PATCH `/api/items/:id` 누구나 호출 가능 문제) — 별도 SPEC.
- 테스트 스위트 도입(Vitest + supertest) — 별도 SPEC.
- ItemModal의 `alert()` UX 개선, Sidebar/HistoryView의 인라인 hex 색상 → 토큰 변수 마이그레이션 — 별도 SPEC.

## Open Issues

| Q | Category | Reason |
|---|---|---|
| Q-COMP-04 | completeness | P3 LLM rate limit 설정값 20/min은 임의 — 실제 사용 패턴이 확보되면 재조정 필요 |
| Q-FEAS-03 | feasibility | P4 import-data.js refactor 검증 시 sub-process가 실제 import를 일부 트리거하여 MongoDB 데이터 무결성 미확인. 사용자 환경에서 `node import-data.js` 재실행 필요 |
