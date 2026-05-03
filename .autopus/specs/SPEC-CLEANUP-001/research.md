# SPEC-CLEANUP-001 · 조사 노트

## 발견 경위

리뷰 시 다음을 확인했다:

| 발견 | 위치 | 증거 |
|---|---|---|
| 빈 스트레이 디렉토리 5개 | 루트 | `ls -la` 결과, 모두 0 entries, 5월 2일 15:53~15:56 생성 (컴포넌트 분리 리팩터링 시각과 일치) |
| Windows 예약 이름 파일 | 루트/nul | 0 bytes, 5월 2일 16:57 생성, `> nul` 리다이렉트 사고 추정 |
| App.css 1449줄 | gui/frontend/src/ | `wc -l`, file-size-limit 하드 한계(300)의 4.83배 |
| LLM 엔드포인트 무방비 | routes/llm.js | 인증/rate limit/body size 제한 없음, ANTHROPIC_API_KEY 주입 경로 미문서화 |
| 스키마 중복 정의 | import-data.js + models/ChecklistItem.js | `grep "new mongoose.Schema"` 2건 |
| TDD enforce: true 정책 vs 테스트 0개 | autopus.yaml + package.json | 정책-현실 모순, 거짓 안전감 |

## CSS 사용 분석

`grep "className=" gui/frontend/src/**/*.jsx` 결과로 클래스 사용 매트릭스 작성.

### 사용 클래스 (App.css 1449줄 중)

- App shell: `app-container`, `main-content`, `sidebar`, `logo`, `mode-toggle`, `active-mode`, `header`, `search-container`, `search-icon`, `search-input`, `items-list`, `history-view`, `pagination`, `loader-container`, `placeholder-text`, `filter-section`, `filter-group`, `filter-label`
- Components: `select-input`, `item-number-list`, `item-number-option`, `selected`, `badge-core`, `item-type-tag`, `type-core`, `type-basic`, `type-required`, `edit-input`, `edit-textarea`, `btn-save`, `btn-cancel`, `close-btn`, `bullet-list`, `stats-card`
- Dashboard: `items-grid`, `item-card`, `item-header`, `item-id`, `item-question`, `item-footer`
- Modal: `modal-overlay`, `modal-content`, `modal-actions-header`, `modal-body-content`, `modal-metadata`, `review-table-container`, `review-table`, `label-cell`, `item-content-cell`, `option-cell`, `item-main-header`, `description-text`
- History: `history-timeline`, `history-entry`, `history-year`, `history-card`, `history-card-header`, `history-card-body`
- Compare SBS: `sbs-*` (전체, ~25개)

### 미사용 클래스

`change-card*`, `change-*-badge`, `change-before/after`, `change-content`, `change-card-title`, `change-item-title`, `change-area-tag`, `change-comparison-body`, `comparison-row*`, `comparison-line`, `tag-before/after/new/deleted` (non-doc), `arrow`, `desc-change-label`, `desc-comparison`, `desc-before/after`, `desc-label`, `desc-detail`, `desc-box`, `desc-title`, `change-divider`, `change-reason`, `changes-list*`, `change-item-simple`, `item-number-header`, `change-line`, `change-reason-line`, `compare-container`, `compare-header*`, `compare-year-badge`, `compare-panels`, `compare-item*`, `change-badge`, `compare-body`, `compare-panel`, `panel-*`, `compare-footer`, `change-item-doc*`, `tag-before/after-doc`, `change-text-before/after`, `arrow-doc`, `change-note`, `change-divider-doc`, `change-reason-doc`, `tag-reason`

총 ~1000줄의 dead CSS. 즉시 제거하지 않고 `legacy/`에 격리한 이유는 grep이 100% 보장은 아니기 때문(동적 className concat 가능성, 향후 컴포넌트 부활 시 재사용 등).

## 결정과 근거

### D1: CSS 분할 전략 = B (관심사 단위)

대안:
- A 컴포넌트 단위 — 분리는 쉬우나 토큰 분산
- C CSS Modules — 모든 className 매핑 변경 필요, 범위 초과
- D Tailwind — 솔로 프로젝트 과잉

선택: B. DESIGN.md의 palette/typography/layout/depth 축과 직접 매핑되며, tokens.css가 향후 디자인 시스템화의 출발점이 된다.

### D2: legacy CSS 즉시 제거 vs 격리

선택: 격리. 격리 비용은 디스크 ~30 KB로 무시 가능, 즉시 제거 시 시각적 회귀 위험 감수 불가.

### D3: TDD enforce = false (자기 부정 아님)

`autopus.yaml`의 `mode: tdd`는 의도 선언으로 보존, `enforce`만 false로 내려서 거짓 안전감 제거. 첫 테스트가 도입되는 시점에 SPEC-TEST-INTRO-001 (가칭) 마지막 단계로 enforce: true 복원.

### D4: rate limit 분당 20회

근거 없는 임의값임을 인정. 일일 사용량 추정 불가 상태에서 보수적 시작. 실제 트래픽 관찰 후 환경 변수로 조정.

## Self-Verify Summary

| Q | status | attempt | files | reason |
|---|---|---|---|---|
| Q-CORR-01 | PASS | 1 | spec.md, plan.md | 인용된 모든 기존 경로(routes/llm.js, models/ChecklistItem.js, App.css 등) 실제 존재 확인 |
| Q-CORR-02 | PASS | 1 | plan.md | [NEW] 마커가 신규 파일에 일관되게 적용됨 |
| Q-CORR-03 | PASS | 1 | acceptance.md | EARS/Gherkin 형식 준수 (Given/When/Then) |
| Q-COMP-01 | PASS | 1 | 4개 파일 | 4개 파일 모두 작성, 각자 역할 분리됨 |
| Q-COMP-02 | PASS | 1 | spec.md, acceptance.md | REQ-1~9 → AC-1~11에 1:1 추적 가능 |
| Q-COMP-03 | PASS | 1 | spec.md | 각 REQ에 EARS type 명시, 관측 지점은 acceptance에 정의 |
| Q-COMP-04 | PARTIAL | 1 | spec.md Open Issues | 추가 후속 SPEC들(테스트 도입, 인증 도입, dead CSS 제거)이 out-of-scope로 명시되었으나 별도 SPEC 미생성. 수동 후속 등록 필요 |
| Q-COMP-05 | N/A | 1 | - | semantic invariant 부재 (cleanup work) |
| Q-FEAS-01 | PASS | 1 | spec.md | 변경은 모두 reorganization/config 수준, runtime behavior 보장 약속 없음 |
| Q-FEAS-02 | PASS | 1 | plan.md | 경로는 실제 repo 구조와 일치, source of truth 명시 |
| Q-FEAS-03 | PARTIAL | 1 | research.md | import-data.js 검증 시 sub-process가 실제 import 일부 실행. MongoDB 데이터 무결성 미확인 → spec.md Open Issue로 등록 |
| Q-STYLE-01 | PASS | 1 | spec.md | "should" 같은 모호어 description 회피, EARS 표준 준수 |
| Q-STYLE-02 | PASS | 1 | spec.md | Priority(Must/Should/Nice)와 EARS type을 별도 axis로 표기 |
| Q-STYLE-03 | PASS | 1 | acceptance.md | bare Given/When/Then 사용, 마침표로 종결 |
| Q-SEC-01 | PASS | 1 | spec.md REQ-5,6 | LLM 엔드포인트 외부 입력 경계와 완화책(rate limit, body size) 명시 |
| Q-SEC-02 | PASS | 1 | .env.example | API key는 .env.example에 placeholder만, 실제 값은 git ignored .env에서 |
| Q-SEC-03 | PASS | 1 | - | 새 영구 artifact 생성 없음, 로깅 변경 없음 |

PARTIAL 항목 2건은 본 SPEC 범위에서 의도적으로 후속 작업으로 분리한 결과이며, 모두 spec.md의 Open Issues 또는 Out of Scope에 명시되어 있다.

## Related Work

- 후속 SPEC 권장:
  - SPEC-TEST-INTRO-001 (가칭): Vitest + supertest 도입 + 첫 acceptance 테스트, enforce 복원
  - SPEC-AUTH-001 (가칭): PATCH 엔드포인트 인증 추가
  - SPEC-DEAD-CSS-001 (가칭): legacy/comparison-*.css 실제 제거
  - SPEC-DESIGN-TOKEN-001 (가칭): 인라인 hex → CSS variable 마이그레이션
