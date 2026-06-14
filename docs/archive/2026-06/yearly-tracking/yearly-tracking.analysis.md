# Analysis (Check): yearly-tracking — 문항 연도별 추적 (화면 B, §4) · P0 갭

| 항목 | 값 |
|------|-----|
| Feature | yearly-tracking |
| Phase | Check (Gap Analysis) |
| 분석일 | 2026-06-14 |
| Match Rate | **99%** (Checkpoint 5: G-A1 수정 반영) |
| SC 충족 | 7 Met / 0 Partial / 0 Not Met |
| 판정 | ✅ Report 진행 권장 (≥90%) |
| 에이전트 | bkit:gap-detector |

## Context Anchor

| 키 | 값 |
|----|-----|
| **WHY** | 연도별 추적 = 인증갱신 증빙 핵심. 화면≠Export면 신뢰 붕괴. 직전 사이클 verbatim 가치를 화면 B까지 완결. |
| **WHO** | P2 심사위원(primary) · P1 담당자(Export) · P3 마스터(감사) |
| **RISK** | LLM/verbatim 이중성 · diff 한글 오탐 · 화면 A→B 단절 · changes.js 비인증 · 5년 데이터 부재 |
| **SUCCESS** | 인증 100% · 수정사유 불일치 0 · 화면 A→B 100% · diff 6필드·오탐 0 · empty-state |
| **SCOPE** | P0 핵심 갭 (R-04/05/07/08/11/16/17/19/20) |

## 1. Match Rate: 97%

설계 NEW 2 / MOD 4 파일 전부 구현. 9종 갭 전부 충족. Backend 100% · Frontend 95% · Decision Record 100% · 전략 정합성 100%. 감점(3%)은 G-A1(ComparisonTable 분야특이 설명 행 미표시 — 화면 5필드).

## 2. 전략 정합성 (PRD WHY 해소) — 4/4

| PRD 핵심 문제 | 해소 | 근거 |
|--------------|:----:|------|
| LLM/verbatim 이중성 | ✅ | LLM=미저장 draft, 화면 표시=Revision.reason verbatim 단일화 |
| diff 한글 오탐 | ✅ | normalizeKo(공백/∙/NFC) + 테스트 고정 |
| 화면 A→B 단절 | ✅ | selectedItemObjects(localStorage) 자동필터 연결 |
| changes.js 비인증 | ✅ | requireAuth('viewer') |

## 3. Success Criteria 검증

| SC | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| SC-Y1 | changes.js 인증 401 | ✅ Met | year-diff.test.js:41 (401), :44 (200) |
| SC-Y2 | 화면 B 수정사유=Revision.reason | ✅ Met | SideBySideItem curr.reason + ComparisonTable revisions 조회 (단일 소스) |
| SC-Y3 | 화면 A→B 자동필터 | ✅ Met | HistoryView.jsx:41-46 |
| SC-Y4 | ComparisonTable 6필드 | ✅ Met | G-A1 수정 — ComparisonTable·SideBySideItem buildDiffLines에 분야특이 설명·해당없음 행 추가. 6필드 화면 완전 노출 (HistoryView.jsx, SideBySideItem.jsx) |
| SC-Y5 | diff 오탐 0 | ✅ Met | year-diff.test.js:62-67 (공백차이 미분류) |
| SC-Y6 | empty-state | ✅ Met | HistoryView.jsx:90-95 |
| SC-Y7 | 회귀+커버리지 ≥80% | ✅ Met | 161 통과, Line 83.84%(changes.js 88.33%) |

## 4. Decision Record 준수 (4/4)

| 결정 | 준수 | 근거 |
|------|:----:|------|
| LLM 초안격하+편집저장 분리 | ✅ | SideBySideItem '초안 제안'·미저장 draft, 저장 RevisionPanel 위임 |
| 화면 A→B mount 자동필터 | ✅ | CompareView useFilterContext 필터 |
| 한글 비교전용 정규화 | ✅ | normalizeKo 비교에만, 표시 원문 |
| changes.js viewer 인증 | ✅ | requireAuth('viewer') |

## 5. Gap 목록

### G-A1 — ComparisonTable 분야특이 설명 행 미표시 → ✅ 해소 (2026-06-14, Checkpoint 5)
- **Severity**: Minor → **Resolved**
- **조치 완료**: `SideBySideItem.jsx` buildDiffLines + `HistoryView.jsx` ComparisonTable에 **분야특이 설명·해당없음 행 추가** → 6필드 화면 완전 노출. vite build 통과, 백엔드 무변경(161 그린 유지). SC-Y4 Partial → Met.

### 초과 달성
- **G-Y4 verbatim 2경로**: 설계는 changes.js batch→SideBySideItem만 명시했으나, TrackView 1:1 비교도 GET /api/revisions로 독립 verbatim 조회(HistoryView.jsx:113-122) → 양쪽 화면 모두 Revision.reason 단일 소스. SC-Y2 견고화.

**Critical / Important: 없음** ✅

## 6. 종합 판정

**Match Rate 99% → Report 진행.** Critical/Important/Minor 0 (G-A1 해소). SC 7/7 Met. iterate 불필요.

미해결: 프론트 테스트 인프라 부재 → SideBySideItem/HistoryView/App은 코드 리뷰 + vite build 검증(백엔드 갭은 year-diff.test로 이중 검증). 향후 Playwright 도입 권장.
