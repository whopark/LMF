# Design: yearly-tracking — 문항 연도별 추적 (화면 B, §4) · P0 핵심 갭

| 항목 | 값 |
|------|-----|
| Feature | yearly-tracking |
| Phase | Design |
| 작성일 | 2026-06-14 |
| 아키텍처 | **Option C — 실용 균형 (한글 정규화만 추출 + in-place)** |
| Plan 참조 | `docs/01-plan/features/yearly-tracking.plan.md` |
| PRD 참조 | `docs/00-pm/yearly-tracking.prd.md` |
| 스코프 | P0 핵심 갭 (R-04/05/07/08/11/16/17/19/20) |

---

## Context Anchor

| 키 | 값 |
|----|-----|
| **WHY** | 연도별 추적 = 인증갱신 증빙 핵심. 화면≠Export면 신뢰 붕괴. 직전 사이클 verbatim 가치를 화면 B까지 완결. |
| **WHO** | P2 심사위원(primary) · P1 담당자(Export) · P3 마스터(감사) |
| **RISK** | LLM/verbatim 이중성 · diff 한글 오탐 · 화면 A→B 단절 · changes.js 비인증 · 5년 데이터 부재 빈화면 |
| **SUCCESS** | 인증 100% · 수정사유 불일치 0 · 화면 A→B 100% · diff 6필드·오탐 0 · empty-state |
| **SCOPE** | P0 갭만. 5년 이력·ZIP·1:1 PDF 비목표. |

---

## 1. Overview

Phase 5 화면 B(연도별 추적) 위에 **신뢰성·정확도·연동 갭**만 닫는다. 핵심 위험인 한글 정규화(diff 오탐)만 `utils/normalizeKo.js`로 추출해 단위 테스트로 고정하고, 나머지는 크기 여유가 있는 기존 파일(changes.js 97줄, HistoryView 179줄, SideBySideItem 115줄)에 in-place로 수정한다.

**현 상태 grounding**: `changes.js`는 인증 없음(R-08)·4필드 비교(R-05 누락)·정규화 없음(R-07). `SideBySideItem`은 LLM 생성 수정사유 표시(R-19, verbatim 불일치). HistoryView는 화면 A 선택 미연동(R-17).

## 2. 선택 아키텍처 (Option C) 근거

| 결정 | 근거 |
|------|------|
| normalizeKo만 추출 | diff 정확도(SC-Y5)의 핵심 → 단위 테스트로 회귀 고정. 재사용성. |
| 나머지 in-place | 파일 크기 여유 + Phase 5 뷰 분해 회귀 위험 회피 + 데드라인 |
| verbatim은 기존 쓰기경로 재사용 | 직전 사이클 `revisionTxn`(PATCH reason → raw_reason) 그대로 활용 |

## 3. 모듈 구조

```
gui/backend/
├─ utils/normalizeKo.js   (NEW) 한글 비교전용 정규화 (G-Y6)
├─ routes/changes.js      (MOD) requireAuth(viewer) + 6필드 diff + normalizeKo + 수정사유 batch (G-Y1/G-Y5/G-Y6/G-Y4)
└─ tests/year-diff.test.js (NEW) 정규화·인증·6필드 diff·verbatim 첨부

gui/frontend/src/components/
├─ HistoryView.jsx     (MOD) 화면A→B 자동필터(G-Y3) + ComparisonTable 6필드(G-Y4) + empty-state(G-Y7)
├─ SideBySideItem.jsx  (MOD) verbatim 표시 + LLM 초안격하 + 저장(PATCH reason) (G-Y2)
└─ DiffText.jsx        (재사용) score/classification 인라인 적용 (G-Y5 UI)
```

## 4. 한글 정규화 설계 (G-Y6)

`utils/normalizeKo.js`:
```js
// Design Ref: §4 (G-Y6) — 비교 전용 정규화. 표시는 원문 보존.
function normalizeKo(text) {
  return String(text ?? '')
    .normalize('NFC')                 // 한글 자모 합성 통일
    .replace(/[•∙ㆍ·]/g, '·')          // bullet 기호 통일
    .replace(/\s+/g, ' ')             // 공백/개행 축약
    .trim();
}
```
- detectChanges 비교에만 사용: `normalizeKo(a) !== normalizeKo(b)`. 순수 공백/∙/개행 차이는 변경 아님(SC-Y5).
- 표시 텍스트·저장값은 원문 유지. (따옴표 종류·심사점검표 원문 보존)
- OQ-Y3(따옴표·NFC 포함 여부)는 구현 시 테스트로 확정.

## 5. changes.js 설계 (G-Y1/G-Y5/G-Y4)

- **G-Y1 인증**: `router.get('/:year', requireAuth('viewer'), …)`. 프론트 호출에 `authHeader()` 추가.
- **G-Y5 6필드**: `itemSnapshot`·`detectChanges`에 `field_specific_description`·`na_available` 추가. 비교는 normalizeKo 경유(텍스트 필드) + 원시 비교(score·na_available bool).
  ```js
  const FIELDS = ['question','description','classification','score','field_specific_description','na_available'];
  // 텍스트(question/description/field_specific_description): normalizeKo 비교
  // score: 원시 비교, classification·na_available: 원시 비교
  ```
- **G-Y4 verbatim 수정사유 batch**: changes 빌드 후 대상연도 item_number 집합으로 Revision 일괄 조회(`Revision.find({year:targetYear, item_number:{$in:[...]}}).sort({at:-1})`), item별 최신 `reason`(verbatim)을 `change.current.reason`에 첨부. N+1 방지(리스크 5).

## 6. verbatim 화면 B 설계 (G-Y2)

`SideBySideItem.jsx`:
- 표시: 해당 문항의 **`Revision.reason`(verbatim)** 우선 표시 (GET /api/revisions?item_number=… 최신 또는 changes.js가 내려준 reason).
- LLM: `generateReason` 버튼을 **'초안 제안'**으로 리라벨 → 결과를 **편집 가능한 textarea(draft)**에 채움(자동 확정 아님).
- 저장: '저장' 시 `PATCH /api/items/:id { reason }` (authHeader) → `revisionTxn`이 raw_reason/reason_hash 기록(직전 사이클 재사용). 저장 후 표시 = Revision.reason → **화면=Export 일치(SC-Y2)**.
- OQ-Y1(LLM 호출 시점): 버튼 클릭 시에만 호출(자동 호출 금지) — 비용·지연 절감.

## 7. 화면 A→B 연동 + ComparisonTable + empty-state (G-Y3/G-Y4 UI/G-Y7)

`HistoryView.jsx`:
- **G-Y3**: mount 시 `useFilterContext().selectedItemObjects`(localStorage 영속, 직전 사이클)에서 item_number 추출 → CompareView 필터. 선택 비면 전체.
- **G-Y4 UI**: ComparisonTable에 배점·분류 컬럼 + verbatim 수정사유 행 추가. 질문·설명은 DiffText, score·classification도 **DiffText 인라인 색상**(G-Y5 UI).
- **G-Y7**: 비교 결과 빈/연도 데이터 없을 때 "해당 연도 데이터 없음(추후 추가 예정)" + 보유 연도 범위 안내(distinct year). 5년 데이터 부재 대응.

## 8. API 변경

| 엔드포인트 | 변경 |
|-----------|------|
| `GET /api/changes/:year` | `requireAuth('viewer')` + change.current.reason(verbatim) 첨부 + 6필드 diff(정규화) |
| `PATCH /api/items/:id` | (기존 재사용) reason 저장 시 verbatim 기록 — G-Y2 저장 경로 |
| `GET /api/revisions` | (기존 재사용) item_number 최신 reason 조회 |

## 9. 리스크 및 대응
Plan §6 동일. 추가: changes.js 인증으로 비로그인 미리보기 영향(OQ-Y4) → 프론트 호출 authHeader 일괄 확인.

## 10. Implementation Guide

### 10.1 구현 순서
1. diff-core: normalizeKo + changes.js(인증·6필드·정규화·reason batch) + year-diff.test → 기존 그린
2. verbatim-b: SideBySideItem verbatim 표시 + LLM 초안 격하 + 저장(PATCH reason)
3. integration: HistoryView 화면A→B + ComparisonTable 6필드 + DiffText score/classification + empty-state
4. finalize: 커버리지·회귀

### 10.2 핵심 파일
§3 모듈 구조. NEW 2(normalizeKo·year-diff.test) / MOD 3(changes·HistoryView·SideBySideItem) + DiffText 재사용.

### 10.3 Session Guide (Module Map)

| 모듈 키 | 범위 | 갭 | 핵심 파일 | 의존 |
|---------|------|----|----------|------|
| `diff-core` | 인증 + 6필드 diff + 한글 정규화 + verbatim batch | G-Y1·G-Y5(BE)·G-Y6·G-Y4(data) | normalizeKo.js, changes.js, year-diff.test.js | — |
| `verbatim-b` | 화면 B 수정사유 verbatim + LLM 초안격하 + 저장 | G-Y2 | SideBySideItem.jsx | diff-core |
| `integration` | 화면A→B 자동필터 + ComparisonTable 6필드 + DiffText 확장 + empty-state | G-Y3·G-Y4(UI)·G-Y5(UI)·G-Y7 | HistoryView.jsx, DiffText.jsx | diff-core |
| `finalize` | 커버리지·회귀 | SC-Y7 | 전체 테스트 | 전부 |

**권장 세션 분할**:
```
/pdca do yearly-tracking --scope diff-core
/pdca do yearly-tracking --scope verbatim-b
/pdca do yearly-tracking --scope integration
/pdca do yearly-tracking --scope finalize
```

## 11. 테스트 설계

| 갭 | 테스트 | 유형 |
|----|--------|------|
| G-Y1 | 비인증 GET /api/changes/:year → 401 | 통합 |
| G-Y6 | normalizeKo: 공백/∙/개행 차이 동일 판정 | 단위 |
| G-Y5 | 6필드 변경 검출, field_specific_description/na_available diff | 통합 |
| G-Y4 | change.current.reason = Revision.reason(verbatim) | 통합 |
| G-Y5(오탐) | 순수 공백차이 → MODIFIED 미분류 | 통합 |
| G-Y2 | (프론트, build 검증) 저장된 reason = Revision.reason | 수동/통합 |

프론트(G-Y2/3/7)는 인프라 부재로 vite build + 백엔드 통합테스트로 대체 검증.

## 12. 미해결 질문
Plan §9 OQ-Y1~Y4 동일. diff-core/verbatim-b 구현 시 해소.

## 13. 다음 단계
```
/pdca do yearly-tracking --scope diff-core    # 권장: 모듈 단위 시작
```
