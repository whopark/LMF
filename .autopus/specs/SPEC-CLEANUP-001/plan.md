# SPEC-CLEANUP-001 · 구현 계획

## Phase 1: 파일 시스템 정리 (REQ-1)

- T1.1 `Remove-Item -Recurse -Force`로 5개 빈 디렉토리 삭제
- T1.2 `cmd /c del "\\?\E:\LMF_all\nul"`로 Windows 예약 이름 파일 삭제

소요: ~1분. 의존: 없음.

## Phase 2: CSS 분할 (REQ-2, REQ-3)

신규 디렉토리 트리 [NEW]:

```
gui/frontend/src/styles/
  tokens.css                 [NEW]  semantic palette CSS variables
  layout.css                 [NEW]  app shell, sidebar frame, header, search, pagination
  components.css             [NEW]  select-input, badges, edits, btns, bullet-list, stats-card
  views/
    dashboard.css            [NEW]
    modal.css                [NEW]
    history.css              [NEW]
    compare-sbs.css          [NEW]  current SBS comparison UI
  legacy/
    README.md                [NEW]  cleanup audit guide
    comparison-card.css      [NEW]  unused legacy v1
    comparison-doc.css       [NEW]  unused legacy v2
    comparison-panels.css    [NEW]  unused legacy v3
```

- T2.1 className 사용 매트릭스 작성: `grep -E "className=" src/**/*.jsx`
- T2.2 사용/미사용 분류
- T2.3 사용 클래스를 tokens · layout · components · views로 분배
- T2.4 미사용 legacy 클래스를 `legacy/` 3개 파일에 격리
- T2.5 `App.css`를 import 인덱스로 축소
- T2.6 `npx vite build`로 syntactic 검증
- T2.7 brace count 비교 + 누락 클래스 grep으로 의미 보존 검증

소요: ~30분. 의존: T1 완료 후.

## Phase 3: 환경 변수 + Rate Limit (REQ-4, REQ-5, REQ-6)

- T3.1 `gui/backend/.env.example` [NEW] 작성: PORT, MONGO_URI, ANTHROPIC_API_KEY, LLM_MODEL, LLM_MAX_TOKENS, LLM_RATE_LIMIT_PER_MIN
- T3.2 `gui/backend/package.json`에 `dotenv@^16.4.5`, `express-rate-limit@^7.4.1` 추가
- T3.3 `gui/backend/server.js`에 `require('dotenv').config()` 최상단 추가
- T3.4 `app.use(express.json({ limit: '32kb' }))`로 body 크기 제한
- T3.5 `gui/backend/routes/llm.js`에 `rateLimit({ windowMs: 60000, max: LLM_RATE_LIMIT })` 적용
- T3.6 LLM model/max_tokens를 env 변수로 읽기
- T3.7 `npm install` 실행
- T3.8 `node -e "require('./routes/llm.js'); require('./routes/api.js')"`로 모듈 로드 검증

소요: ~20분. 의존: 없음 (P2와 병렬 가능).

## Phase 4: import-data.js 리팩터 (REQ-7)

- T4.1 schema 중복 정의 제거 → `require('./models/ChecklistItem')`
- T4.2 `MONGO_URI`를 `process.env.MONGO_URI || '...'`로
- T4.3 `IMPORT_JSON` 환경 변수로 데이터 경로도 override 가능하게
- T4.4 `node -c import-data.js`로 syntax 검증

소요: ~10분.

## Phase 5: TDD 정책 완화 (REQ-8)

- T5.1 `autopus.yaml`의 `methodology.enforce: true` → `false`
- T5.2 의도 보존 코멘트 추가 (언제 다시 true로 돌릴지)

소요: ~5분.

## Phase 6: SPEC 문서화 (REQ-9)

- T6.1 `.autopus/specs/SPEC-CLEANUP-001/` 생성
- T6.2 `spec.md`, `plan.md`, `acceptance.md`, `research.md` 작성
- T6.3 각 파일 300줄 이하 확인

소요: ~15분.

## 의존 그래프

```
T1 ─────────────┐
                ▼
T2 ──────► (build verify)
T3 ──────► (module load verify)
T4 ──────► (syntax verify)
T5 ──────► (yaml verify)
T6 ──────► (line count verify)
```

T1은 T2가 의존하지 않지만 자연스러운 시작점이라 가장 먼저 실행.
T2/T3/T4/T5/T6은 서로 독립적이며 어떤 순서든 가능.

## 위험 및 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| CSS 분할 중 클래스 누락 | 시각적 회귀 | brace count + 클래스 diff + vite build 3단 검증 |
| dotenv 도입으로 기존 `process.env` 동작 변경 | 백엔드 기동 실패 | server.js 최상단에서 require, 기존 fallback 값 모두 보존 |
| import-data 검증 시 실제 import 트리거 | DB 데이터 손상 | 후속에서 사용자가 `node import-data.js` 직접 실행 필요 (Open Issue) |
| TDD enforce 완화로 품질 게이트 약화 | 회귀 누적 | 첫 테스트 도입 SPEC을 즉시 후속으로 등록 권장 |
