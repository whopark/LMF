# LMF_all — 다음 세션 진입 가이드

> 2026-05-03 세션 종료 시점의 미완료 작업 + 후속 권장사항. 새 세션에서 가장 먼저 읽을 문서.

## 🚨 즉시 처리해야 할 검증 부채

### 1. MongoDB 데이터 무결성 확인 (HIGH)

SPEC-CLEANUP-001 P4 검증 중 `node -e "require('./import-data.js')"`가 실수로 import를 트리거했고 100ms 후 강제 종료됐다. `deleteMany({})`는 성공한 흔적이 있고 `insertMany`는 실행 전이었을 가능성이 있다.

```bash
cd gui/backend && node import-data.js
# 정상 종료 확인: "Imported 9831 items" 메시지
```

이후 빠른 sanity check:

```bash
node -e "
const m = require('mongoose');
const C = require('./models/ChecklistItem');
(async () => {
  await m.connect('mongodb://127.0.0.1:27017/lab_accreditation');
  console.log('count:', await C.countDocuments());
  console.log('years:', (await C.distinct('metadata.year')).sort());
  await m.disconnect();
})();
"
# 기대: count >= 9000, years includes 2020~2026
```

### 2. import-data.js의 require-시-실행 가드 (LOW, 같은 함정 재발 방지)

```js
// import-data.js 마지막 줄 변경
if (require.main === module) {
  importData();
}
```

다음 세션에서 테스트 도입 시 `require('./import-data.js')`로 모듈 로드만 하고 실행은 막을 수 있게 한다. SPEC-CLEANUP-001 회고에서 발견된 함정 회피.

---

## 📋 후속 SPEC 후보 (ICE 순위)

| Rank | SPEC ID (가칭) | 설명 | 의존 | 예상 크기 |
|---|---|---|---|---|
| 1 | **SPEC-TEST-INTRO-001** | Vitest + supertest 도입 → 첫 acceptance test → `autopus.yaml: methodology.enforce` 복원 | 없음 | LARGE |
| 2 | **SPEC-AUTH-001** | PATCH `/api/items/:id` 인증 추가. 다중 사용자 시 데이터 무결성 보호 | 1 | MEDIUM |
| 3 | **SPEC-CONTEXT-001** | Sidebar 28-prop drilling → React Context API. useFilters 추출(157247a)의 자연스러운 다음 단계 | 없음 | MEDIUM |
| 4 | **SPEC-ROUTES-SPLIT-001** | `routes/api.js` (277줄, 26 분기점) → `filters.js`/`items.js`/`changes.js` 분할. /auto map 핫스팟 1위 | 없음 | SMALL |
| 5 | **SPEC-DEAD-CSS-001** | `gui/frontend/src/styles/legacy/comparison-*.css` 약 700줄 실제 제거. 격리는 SPEC-CLEANUP-001 P2에서 완료 | 없음 | SMALL |
| 6 | **SPEC-DESIGN-TOKEN-001** | 인라인 hex 색상 → `var(--accent-primary)` 등 토큰화. tokens.css는 이미 정의됨, migration만 필요 | 없음 | MEDIUM |
| 7 | **SPEC-DATA-CLEANUP-001** | `pdf/` ETL v1~v4 누적 정리. `migrate_v2.py`, `verification_reports_v3.json` 등 | 없음 | SMALL |
| 8 | **SPEC-PDF-EMBEDDED-REPO-001** | `pdf/01~90` 14개 분류 디렉토리의 임베디드 `.git` 정체 조사 + 정리 | 없음 | TINY |

추천 시작점: **SPEC-TEST-INTRO-001** (모든 다른 SPEC의 회귀 안전망)

---

## 🔍 조사 필요한 발견들

### A. `pdf/01 검사실운영` ~ `pdf/90 분자진단검사` — 14개 임베디드 git repo

각 분류 디렉토리가 자체 `.git`을 가지고 있다. 의도된 것인지, 누군가의 init 사고인지, 외부 clone 잔재인지 미상. `pdf/*/`로 gitignored 되어 push에는 영향 없지만 로컬 정리 필요.

```bash
# 조사 시작
find pdf -name ".git" -type d -maxdepth 3
for d in pdf/[0-9]*/.git; do
  echo "--- $d ---"
  git -C "${d%/.git}" log --oneline -3 2>&1 | head -5
done
```

### B. LLM rate limit 값 (분당 20회) 적정성

SPEC-CLEANUP-001 Open Issue Q-COMP-04. 임의값으로 시작했음. 실제 사용 패턴 1주일 관찰 후 조정.

```bash
# 1주일 후 access log 분석 (현재는 console.error만 있어 부족)
grep "rate limit" gui/backend/server.log 2>/dev/null  # 로그 도입 필요
```

→ SPEC 후보: **SPEC-OBSERVABILITY-001** (구조화된 로깅 + 메트릭).

### C. autopus.yaml `methodology.enforce: false` 복원 시점

SPEC-CLEANUP-001 P5에서 일시 완화. 첫 통과 테스트 도입(SPEC-TEST-INTRO-001) 마지막 단계에서 `true`로 복원해야 정책-현실 일치 회복.

### D. README.md 부재

GitHub `whopark/LMF` 페이지가 비어 보인다. `.autopus/project/product.md`의 "한 줄 설명" + "핵심 기능" 표를 끌어다 README로 만들면 즉시 의미 있는 첫 페이지가 된다.

```bash
# 빠른 시작
cat .autopus/project/product.md | head -40 > README.md
# 이후 손질
```

### E. License 결정

현재 미정. 의료/임상 도메인 + private repo이지만 향후 공개 가능성 대비 결정 필요. MIT/Apache-2.0/proprietary 중 선택.

---

## 🛠 GitHub repo 폴리싱 (선택 사항)

| 항목 | 명령 | 효용 |
|---|---|---|
| README.md 추가 | `/auto fix "Add README.md from product.md"` | 첫 페이지 의미 부여 |
| License 추가 | 수동 결정 후 `gh repo edit --license <SPDX>` | 법적 명확성 |
| GitHub Actions CI | `.github/workflows/build.yml` 작성 | PR마다 빌드 검증 |
| Branch protection | `gh api ... -X PUT branches/master/protection` | force-push 차단 |
| Issue templates | `.github/ISSUE_TEMPLATE/` | 외부 기여 받기 시 |

---

## 🚀 다음 세션 진입점

새 세션에서 처음 실행할 명령어 후보:

```bash
# 1. 현재 상태 점검
/auto status              # 모든 SPEC 대시보드
/auto doctor              # 하네스 health check

# 2. 검증 부채 처리
node gui/backend/import-data.js   # MongoDB 무결성 회복
/auto canary              # H1~H10 health check 자동 실행

# 3. 다음 SPEC 시작 (권장)
/auto plan "SPEC-TEST-INTRO-001: Vitest + supertest 도입" --skip-prd

# 4. 또는 docs sync
/auto sync                # 이번 세션 변경분을 project docs에 반영
```

---

## 📊 이번 세션 요약 (참고)

- **commits 추가**: 12개 (master에 총 15개)
- **GitHub push**: `https://github.com/whopark/LMF` (private, LFS 1 객체)
- **주요 산출물**:
  - SPEC-CLEANUP-001 (4개 파일, status: implemented)
  - `/auto setup` 컨텍스트 7개 파일 (ARCHITECTURE.md + .autopus/project/*)
  - useFilters hook 추출 (refactor 사례)
  - 5개 dead code/orphan 정리 (useFilters 1차, format_changes, App.css 분할의 legacy 격리, 빈 디렉토리 5개, nul 파일)
- **자세한 회고**: `.autopus/specs/SPEC-CLEANUP-001/research.md`

---

## ⚠️ 잊지 말 것

- 한국 임상병리학회 점검표 PDF는 절대 git에 넣지 않는다 (저작권). gitignore가 보호 중이지만 향후 패턴 추가 시 검증 필요.
- LFS 한도 무료 1GB. checklist_items_final.json은 11MB로 여유 있지만 향후 데이터 증가 시 모니터링.
- `autopus-adk/`는 형제 repo. parent에서 추적하지 않는다.
- 사용자의 사전 작업(SBS UI 도입)은 5629a21에 commit 됨 — 이전 무명의 working tree 변경이 정식 history로 들어왔다.

🐙
