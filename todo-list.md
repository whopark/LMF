# LMF_all — 다음 세션 진입 가이드

> **2026-06-14 갱신.** 새 세션에서 가장 먼저 읽을 문서.
> 작업 추적이 **SPEC-XXX 방식 → bkit PDCA 사이클**(`docs/archive/`)로 전환됨.
> 이전 2026-05 SPEC 로그(테스트 도입·라우트 분할·CSS 정리 등)는 git 히스토리 참조.

---

## 🧭 현재 상태 (2026-06-14)

- **데이터**: 로컬 MongoDB `lab_accreditation/checklist_items`에 **9,984문항(2020~2026)** 적재(2026 = 1,635).
  셋업: scoop `mongod`, dbpath `C:/Users/whopa/mongodb-data`.
- **앱 스택**: backend Express(:5000) + frontend React/Vite(:5173) + mongod(:27017). dev 로그인 `admin / admin123`.
- **git**: master에 이번 세션 **8커밋 추가**, `origin/master` 대비 **8 ahead (미push)**.
  checklist 본문 JSON·PDF는 gitignore로 git 제외(저작권).

---

## ✅ 2026-06 주요 완료 (git 히스토리 기준)

- **Phase 1~7** (`74e2a57`…`92578b1`): 평탄 데이터 모델 → ETL v9 정합성 → 대시보드 검색/필터 + 공통문항 배지
  → 개정 워크플로우/수정이력/공통문항 일괄 → 화면 A/B + DiffText + 워크리스트 → Excel/Word 내보내기 + 검색 고도화
  → JWT 역할권한 + 감사로그.
- **보안 수정**(`e8a4a80`), **개정 워크플로우 P0 갭 8종**(`529f671`).
- **PDCA 2사이클 아카이브**(`docs/archive/2026-06/`): `revision-workflow`, `yearly-tracking` (PRD/plan/design/analysis/report).

### 이번 세션(2026-06-14) — 미커밋 워킹트리 → 관심사별 8커밋 정리

| # | 커밋 | 내용 |
|---|------|------|
| 1 | `chore` | gitignore 추가 (coverage/reports/.bkit/agent-memory/checklist data) |
| 2 | `feat(dashboard)` | 검색·필터 고도화(배점/수정자/수정유형/수정일자) + 문항편집 분류선택·분야특이설명 + 설명 불릿 렌더 |
| 3 | `feat(yearly-tracking)` | 화면 B 6필드·verbatim 수정사유 연동 + **1493 렌더 페이지네이션(50/p)·stagger 캡** (성능 프리즈 해소) |
| 4 | `feat(export)` | PDF 내보내기(items/revisions) + 한글폰트 NotoSansKR |
| 5 | `feat(scripts)` | import/diff/rollback 데이터 툴링(백업+전체교체) |
| 6 | `test(revision)` | 개정 워크플로우 테스트 보강 |
| 7 | `docs(pdca)` | PDCA 산출물 아카이브 |
| 8 | `chore(pdf)` | ETL v9 스크립트·매뉴얼 보정 갱신 + 종합검증 스키마 md 제거 |

> 검증: 연도별 추적 화면 브라우저 구동 + `vite build`(2056 modules, 0 error) 통과 후 커밋.

### §5 데이터 오염 클러스터 — **완결 (커밋·아카이브 완료)**

2개 PDCA 사이클로 §5 구조 오염 전부 정제. 백엔드 **189 테스트**, 로컬 DB 적용(백업 `..._20260614-2`·`-3`).
- **data-integrity** (~97%, SC 6/6): 2020 병합분리(→0)·2021 미분류(1,601→17)·blocks(9,532) — 9,573 변경
- **answer-marker-bleed** (~98%, SC 6/6): 답안마커 bleed 12건 — 2025 `예 (필수)` 제거·2021 `?` 뒤 cruft 절단 (question만, 12 변경)
- 아카이브: `docs/archive/2026-06/{data-integrity,answer-marker-bleed}/` (plan·design·analysis·report)
- 검증: 멱등 실증(재실행 `changed=0`) · 브라우저(2020 분리·2025 bleed 제거 스크린샷)

---

## 🔭 열린 항목 / 다음 후보

| 우선 | 항목 | 메모 |
|---|---|---|
| ~~done~~ | ~~§5 데이터 오염(구조+bleed)~~ | ✅ **완결** — data-integrity + answer-marker-bleed, 커밋·아카이브 완료 |
| ~~done~~ | ~~checklist data git 정책~~ | ✅ **정본 LFS 교체** — `flat_v2`(9,984) LFS 추적, final.json 언트랙, 나머지 hold (`dbda755`) |
| **P1** | **push 여부** | `origin/master` **18 ahead**(전부 커밋, flat_v2 LFS 포함). 공개 시 history purge 별도 필요. |
| P2 | **License 결정 (구 E)** | 미정. 의료/임상 + private. MIT/Apache-2.0/proprietary 택1. **공개 결정 시 checklist blob history purge 동반.** |
| P3 | **LLM rate limit (구 B)** | 분당 20회 임의값. 실사용 관찰 후 조정. |
| P4 | **§5 선택 백로그** | 탭/공백 표 blocks · 프론트 `getDisplayData` band-aid 제거 · 다중 `?` 회귀테스트(G1)·리포트 `bleedRemaining` 기록(G4) |

---

## 🚀 다음 세션 진입점

```bash
# 1. 스택 기동
mongod --dbpath "C:/Users/whopa/mongodb-data" --port 27017 --bind_ip 127.0.0.1 --quiet
cd gui/backend && npm start           # :5000
cd gui/frontend && npm run dev         # :5173  (로그인 admin/admin123)

# 2. 테스트
cd gui/backend && npm run test:run     # tests/*.test.js  (19개 파일, 189 테스트)
cd gui/frontend && npm run test:run    # tests/*.test.jsx (6개 파일)
#   ※ 정확한 케이스 수는 위 명령으로 확인

# 3. PDCA 상태
/bkit:pdca status
```

---

## ⚠️ 잊지 말 것

- **PDF 절대 git 금지**(저작권). `pdf/*/`·`*.pdf` gitignore 보호 중. `git add pdf/` 같은 일괄 add 금지 — **명시 경로만** 스테이징.
- **checklist 본문 JSON**: `pdf/checklist_items_*.json` gitignore hold. **단, 정본 `flat_v2.json`만 LFS 추적**(private, 재현성). 다른 checklist JSON 신규 커밋 금지. 공개 전환 시 history purge 필요.
- `.bkit/`·`.claude/agent-memory/`·`gui/backend/coverage/`·`gui/backend/reports/`는 gitignore(런타임/생성물, 로컬 보존).
- PATCH/민감 작업 요청 시 인증 필요(JWT viewer+ 또는 `x-api-key`).
- `autopus-adk/`는 형제 repo, parent에서 추적 안 함.
- 날짜/요일/기간 계산은 절대 암산 금지 — `date`/`python3` 사용.

🐙
