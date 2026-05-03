# LMF_all — 다음 세션 진입 가이드

> 2026-05-04 세션 업데이트. 새 세션에서 가장 먼저 읽을 문서.

## ✅ 완료된 검증 부채 (2026-05-04)

### 1. MongoDB 데이터 무결성 확인 ✅

```bash
# 실행 완료: 9831 items imported, years 2020~2026 확인
cd gui/backend && node import-data.js
```

### 2. import-data.js require 가드 ✅

```js
// f069dd5 커밋으로 적용 완료
if (require.main === module) {
  importData();
}
```

---

## ✅ 완료된 SPEC (2026-05-04)

### SPEC-TEST-INTRO-001 ✅

- **커밋**: `75cd89e test(backend): Vitest + supertest 테스트 프레임워크 도입`
- **산출물**:
  - `app.js` — testable Express 구조 분리
  - `vitest.config.js` — Vitest 설정
  - `tests/setup.js` — mongodb-memory-server 설정
  - `tests/api.test.js` — 7개 API 테스트 (filters, items, items/:number)
- **테스트 명령**: `cd gui/backend && npm run test:run`

### SPEC-ROUTES-SPLIT-001 ✅

- **커밋**: `0e28304 refactor(backend): routes/api.js 도메인별 분할`
- **산출물**:
  - `api.js` (12줄) — 라우터 통합 index
  - `filters.js` (35줄) — 필터 옵션 조회
  - `items.js` (112줄) — 체크리스트 CRUD
  - `changes.js` (141줄) — 연도별 변경 비교
- **Before/After**: 277줄 단일 파일 → 4개 파일 (최대 141줄)

### SPEC-AUTH-001 ✅

- **커밋**: `1644be1 feat(backend): PATCH /api/items/:id API Key 인증 추가`
- **산출물**:
  - `middleware/auth.js` — x-api-key 헤더 검증 미들웨어
  - `routes/items.js` — PATCH에 requireApiKey 적용
  - `tests/auth.test.js` — 7개 인증 테스트
- **사용법**: `x-api-key` 헤더에 `API_KEY` 환경변수 값 전달
- **테스트 현황**: 14개 (기존 7 + 인증 7)

---

## 📋 후속 SPEC 후보 (ICE 순위)

| Rank | SPEC ID (가칭) | 설명 | 의존 | 예상 크기 |
|---|---|---|---|---|
| ~~1~~ | ~~SPEC-TEST-INTRO-001~~ | ~~Vitest + supertest 도입~~ | - | ✅ 완료 |
| ~~2~~ | ~~SPEC-ROUTES-SPLIT-001~~ | ~~api.js 분할~~ | - | ✅ 완료 |
| ~~3~~ | ~~SPEC-AUTH-001~~ | ~~PATCH 인증 추가~~ | - | ✅ 완료 |
| 1 | **SPEC-CONTEXT-001** | Sidebar 28-prop drilling → React Context API. useFilters 추출(157247a)의 자연스러운 다음 단계 | 없음 | MEDIUM |
| 2 | **SPEC-DEAD-CSS-001** | `gui/frontend/src/styles/legacy/comparison-*.css` 약 700줄 실제 제거. 격리는 SPEC-CLEANUP-001 P2에서 완료 | 없음 | SMALL |
| 3 | **SPEC-DESIGN-TOKEN-001** | 인라인 hex 색상 → `var(--accent-primary)` 등 토큰화. tokens.css는 이미 정의됨, migration만 필요 | 없음 | MEDIUM |
| 4 | **SPEC-DATA-CLEANUP-001** | `pdf/` ETL v1~v4 누적 정리. `migrate_v2.py`, `verification_reports_v3.json` 등 | 없음 | SMALL |
| 5 | **SPEC-PDF-EMBEDDED-REPO-001** | `pdf/01~90` 14개 분류 디렉토리의 임베디드 `.git` 정체 조사 + 정리 | 없음 | TINY |

추천 다음 단계: **SPEC-CONTEXT-001** 또는 **SPEC-DEAD-CSS-001**

---

## 🔍 조사 필요한 발견들

### A. `pdf/01 검사실운영` ~ `pdf/90 분자진단검사` — 14개 임베디드 git repo

각 분류 디렉토리가 자체 `.git`을 가지고 있다. 의도된 것인지, 누군가의 init 사고인지, 외부 clone 잔재인지 미상. `pdf/*/`로 gitignored 되어 push에는 영향 없지만 로컬 정리 필요.

### B. LLM rate limit 값 (분당 20회) 적정성

SPEC-CLEANUP-001 Open Issue Q-COMP-04. 임의값으로 시작했음. 실제 사용 패턴 1주일 관찰 후 조정.

### C. autopus.yaml `methodology.enforce: false` 복원 시점

SPEC-CLEANUP-001 P5에서 일시 완화. 테스트 인프라 도입 완료(SPEC-TEST-INTRO-001)로 복원 조건 충족.

### D. README.md 부재

GitHub `whopark/LMF` 페이지가 비어 보인다. `.autopus/project/product.md`의 "한 줄 설명" + "핵심 기능" 표를 끌어다 README로 만들면 즉시 의미 있는 첫 페이지가 된다.

### E. License 결정

현재 미정. 의료/임상 도메인 + private repo이지만 향후 공개 가능성 대비 결정 필요. MIT/Apache-2.0/proprietary 중 선택.

---

## 🚀 다음 세션 진입점

새 세션에서 처음 실행할 명령어 후보:

```bash
# 1. 테스트 확인
cd gui/backend && npm run test:run

# 2. 다음 SPEC 시작 (권장)
/auto plan "SPEC-CONTEXT-001: React Context 도입"
# 또는
/auto plan "SPEC-DEAD-CSS-001: legacy CSS 제거"
```

---

## 📊 세션 요약

### 2026-05-03 세션
- **commits**: 12개 (master에 총 15개)
- **GitHub push**: `https://github.com/whopark/LMF` (private, LFS 1 객체)
- **주요 산출물**:
  - SPEC-CLEANUP-001 (4개 파일, status: implemented)
  - `/auto setup` 컨텍스트 7개 파일 (ARCHITECTURE.md + .autopus/project/*)
  - useFilters hook 추출 (refactor 사례)
  - 5개 dead code/orphan 정리

### 2026-05-04 세션
- **commits**: 6개 (master에 총 21개)
- **주요 산출물**:
  - 검증 부채 해소 (MongoDB 재import + require 가드)
  - SPEC-TEST-INTRO-001 완료 (Vitest + supertest + 7개 테스트)
  - SPEC-ROUTES-SPLIT-001 완료 (api.js 277줄 → 4파일 분할)
  - SPEC-AUTH-001 완료 (API Key 인증 + 7개 테스트)

---

## ⚠️ 잊지 말 것

- 한국 임상병리학회 점검표 PDF는 절대 git에 넣지 않는다 (저작권). gitignore가 보호 중이지만 향후 패턴 추가 시 검증 필요.
- LFS 한도 무료 1GB. checklist_items_final.json은 11MB로 여유 있지만 향후 데이터 증가 시 모니터링.
- `autopus-adk/`는 형제 repo. parent에서 추적하지 않는다.
- 테스트 실행: `cd gui/backend && npm run test:run` (14개 테스트)
- PATCH 요청 시 `x-api-key` 헤더 필요

🐙
