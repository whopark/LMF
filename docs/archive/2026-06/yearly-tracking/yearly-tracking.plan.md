# Plan: yearly-tracking — 문항 연도별 추적 (화면 B, §4) · P0 핵심 갭

| 항목 | 값 |
|------|-----|
| Feature | yearly-tracking |
| Phase | Plan |
| 작성일 | 2026-06-14 |
| 작성자 | whopark |
| PRD 참조 | `docs/00-pm/yearly-tracking.prd.md` |
| 스코프 | **P0 핵심 갭** (5년 이력 R-13~15 · Export ZIP R-25 · 1:1 PDF R-12 제외) |
| 전제 | Phase 5에서 기반 구현(changes.js·HistoryView·DiffText·SideBySideItem). 과거 5년 데이터 미존재(추후 마이그레이션) → 5년 이력 후순위. |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 화면 B 수정사유가 LLM 자동생성이라 verbatim `Revision.reason`(직전 사이클 구현)과 다른 소스 → 화면·Export 불일치로 신뢰 저하. diff가 4필드만·한글 공백차이 오탐, 화면 A 선택이 화면 B로 연동 안 됨, changes.js 비인증 노출. |
| **Solution** | 화면 B 수정사유를 verbatim 단일 파이프라인으로 통일(LLM은 초안 제안→편집·저장 시 Revision.reason 반영) + diff 6필드 확장 + 한글 비교 전용 정규화로 오탐 제거 + 화면 A→B mount 자동 필터 + changes.js 인증. |
| **Function·UX Effect** | 심사위원이 작년 대비 6필드를 정확한 색상 diff로 보고, 화면=Export가 일치하는 verbatim 수정사유를 확인하며, 화면 A에서 고른 개정대상이 화면 B에 자동으로 이어진다. |
| **Core Value** | "화면 = 공식 증빙" — 연도별 추적 화면과 Export 산출물이 동일 verbatim 소스로 일치하여 인증 증빙 신뢰를 확립. |

---

## Context Anchor

| 키 | 값 |
|----|-----|
| **WHY** | 연도별 추적은 인증갱신 증빙의 핵심. 화면과 Export가 불일치하면 증빙 신뢰가 무너진다. 직전 사이클의 verbatim 가치를 화면 B까지 완결. |
| **WHO** | P2 분야별 심사위원(primary, 연도 비교) · P1 담당자(Export·제출) · P3 마스터 권한자(감사) |
| **RISK** | LLM/verbatim 이중성 잔존 · diff 오탐(한글) · 화면 A→B 단절 · changes.js 비인증 · 5년 데이터 부재로 빈 화면 |
| **SUCCESS** | changes.js 인증 100% · 화면 B 수정사유=Revision.reason 불일치 0 · 화면 A→B 자동필터 100% · diff 6필드·오탐 0 · empty-state 안내 |
| **SCOPE** | P0 핵심 갭(R-04/05/07/08/11/16/17/19/20)만. 5년 이력·ZIP·1:1 PDF는 비목표. |

---

## 1. 배경 및 문제 정의

PRD §2·§5 참조. 화면 B(연도별 추적) 기반은 Phase 5에 구현(`changes.js` 1:1 diff 엔진, `HistoryView`/`SideBySideItem`/`DiffText`). 본 Plan은 **신뢰성·정확도·연동 갭을 닫아 "화면=Export" 일치**를 달성하는 것이 목적이다. 5년 이력은 데이터 부재로 후순위(빈 상태 처리만).

## 2. 목표 / 비목표

### 목표
- P0 갭 9종 해소: 화면 B verbatim 통일, diff 6필드·한글 정규화, 화면 A→B 자동 필터, changes.js 인증, empty-state.
- 기존 Phase 5 동작 회귀 0. 변경 모듈 커버리지 ≥80%.
- 직전 사이클 verbatim(raw_reason) 가치사슬을 화면 B까지 완결.

### 비목표
- 과거 5년 이력 타임라인 diff·DELETED 부활 탐지 (R-13/14/15) — 데이터 마이그레이션 후 v.next.
- 분야별 ZIP 일괄 Export (R-25), 1:1 비교 PDF 좌우 레이아웃 (R-12) — P1 후속.
- 5년 데이터 마이그레이션 자체 (사용자 추후 진행).

## 3. 요구사항 (P0 갭 — 확정 결정 반영)

| # | ID | 요구사항 | 확정 접근 | 영향 파일(예상) |
|---|----|---------|-----------|----------------|
| G-Y1 | R-08 | changes.js 인증 | `requireAuth('viewer')` 적용 (read 엔드포인트) | `routes/changes.js` |
| G-Y2 | R-19/20 | 화면 B 수정사유 verbatim | SideBySideItem이 `Revision.reason`(verbatim) 표시. LLM은 **'초안 제안' 버튼**으로 격하 → 편집 후 저장 시 PATCH(reason)로 Revision.reason 반영(기존 verbatim 쓰기경로 재사용) | `SideBySideItem.jsx`, (GET revisions 조회) |
| G-Y3 | R-17 | 화면 A→B 자동 필터 | CompareView/TrackView mount 시 `selectedItemObjects`(localStorage)로 item_number 필터. 선택 비면 전체 | `FilterContext` 소비, CompareView/TrackView |
| G-Y4 | R-11 | ComparisonTable 필드 확장 | 질문·설명 외 배점·분류·**verbatim 수정사유**(대상연도 최신 Revision) 추가 | ComparisonTable, changes.js(또는 프론트 revisions 조회) |
| G-Y5 | R-04/R-05 | diff 필드 확장 | `detectChanges`·`itemSnapshot`에 field_specific_description·na_available 추가, score·classification에 **DiffText 인라인 색상** 적용 | `routes/changes.js`, DiffText 적용 컴포넌트 |
| G-Y6 | R-07 | 한글 정규화(비교 전용) | `utils/normalizeKo.js` — 공백 축약·trim·∙·개행 정규화. **detectChanges 비교에만** 적용, 표시는 원문. 순수 공백차이 MODIFIED 제외 | `utils/normalizeKo.js`(NEW), `routes/changes.js` |
| G-Y7 | R-16 | empty-state UX | 데이터 없는 연도/빈 비교 시 "해당 연도 데이터 없음(추후 추가 예정)" + 보유 연도 범위 안내 | TrackView/CompareView |

## 4. 성공 기준 (Success Criteria)

| SC | 기준 | 측정 | 목표 |
|----|------|------|------|
| SC-Y1 | changes.js 인증 | 비인증 GET /api/changes/:year → 401 | 100% |
| SC-Y2 | 화면 B 수정사유 verbatim | SideBySideItem 표시 텍스트 = Revision.reason(=Export) | 불일치 0 |
| SC-Y3 | 화면 A→B 자동 필터 | 화면 A에서 N개 선택 → 화면 B 비교 대상 N개 | 100% |
| SC-Y4 | ComparisonTable 필드 | 질문·설명·배점·분류·분야특이·수정사유(verbatim) 표시 | 6필드 |
| SC-Y5 | diff 정확도 | 순수 공백/∙/개행 차이 MODIFIED 미분류, 실변경만 검출 | 오탐 0 |
| SC-Y6 | empty-state | 데이터 없는 연도 안내 표시 | 충족 |
| SC-Y7 | 회귀+커버리지 | 기존 테스트 그린 + 변경 모듈 커버리지 | 회귀 0 / ≥80% |

## 5. 기술 결정사항 (Checkpoint 2 확정)

1. **LLM 격하**: LLM 수정사유는 '초안 제안'으로 격하. 사용자 편집·저장 시 기존 PATCH(reason) → revisionTxn이 raw_reason/reason_hash 기록(직전 사이클 재사용). 화면 표시는 Revision.reason verbatim.
2. **화면 A→B**: mount 시 자동 필터(selectedItemObjects), 선택 비면 전체.
3. **한글 정규화**: 비교 전용(detectChanges). 표시는 원문 보존. 공백 1개 차이 MODIFIED 제외.
4. **인증**: changes.js `requireAuth('viewer')`. **verbatim 출처**: 대상연도 최신 Revision.

## 6. 리스크 및 대응

| # | 리스크 | 가능성 | 영향 | 대응 |
|---|--------|:------:|:----:|------|
| 1 | 5년 데이터 부재로 빈 화면 오해 | 높음 | 중 | empty-state 안내(SC-Y6), 5년 이력 비목표 명시 |
| 2 | LLM 격하 시 기존 사용자 흐름 변경 | 중 | 중 | '초안 제안' 버튼으로 LLM 유지, 저장 경로만 verbatim 연결 |
| 3 | 한글 정규화 과도 → 실변경 누락 | 중 | 높음 | 비교 전용·표시 원문, 정규화 규칙 테스트 고정 |
| 4 | changes.js 인증 추가가 기존 프론트 호출 깨뜨림 | 중 | 중 | 프론트 호출에 authHeader 적용 확인, viewer 레벨 |
| 5 | ComparisonTable verbatim 조회 N+1 | 낮음 | 중 | 대상연도 Revision 일괄 조회(item_number $in) |

## 7. 작업 분해 (권장 순서)

1. **인프라/보안**: G-Y1 changes.js requireAuth + 프론트 호출 authHeader → 기존 테스트 그린
2. **diff 정확도**: G-Y6 normalizeKo.js + G-Y5 detectChanges/itemSnapshot 6필드 + DiffText 확장 + 테스트
3. **verbatim 화면 B**: G-Y2 SideBySideItem verbatim 표시 + LLM 초안 격하 + 저장(PATCH reason) 연결
4. **연동/표시**: G-Y3 화면 A→B 자동 필터 + G-Y4 ComparisonTable 필드 확장
5. **마무리**: G-Y7 empty-state + 커버리지 + 회귀

## 8. 테스트 전략

PRD §7.3 Test Scenarios 채택. 백엔드(changes.js diff 정확도·정규화·인증)는 단위/통합 테스트로 검증. 프론트(verbatim 표시·화면 A→B·empty-state)는 인프라 부재로 vite build + 가능 시 컴포넌트 테스트. 기존 테스트(changes 관련 포함) 그린이 게이트.

핵심 테스트:
- changes.js: 비인증 401, 정규화 후 공백차이 MODIFIED 미분류, 6필드 변경 검출, field_specific_description/na_available diff.
- verbatim: 저장된 reason = Revision.reason = 화면 표시(소스 일치).

## 9. 미해결 질문

| # | 질문 | 해소 시점 |
|---|------|----------|
| OQ-Y1 | LLM '초안 제안' 호출 비용/지연 — 자동 호출 vs 버튼 클릭 시 호출? | G-Y2 Design |
| OQ-Y2 | ComparisonTable verbatim: 대상연도 다중 Revision 시 최신 1건 vs 전체 | G-Y4 구현 시 |
| OQ-Y3 | normalizeKo 규칙 범위(∙ vs ·, 따옴표 종류, NFC 정규화 포함?) | G-Y6 구현 시 |
| OQ-Y4 | changes.js viewer 인증이 비로그인 대시보드 미리보기를 막는지(프론트 영향) | G-Y1 구현 시 |

## 10. 다음 단계

```
/pdca design yearly-tracking
```
→ 3가지 아키텍처 옵션 제시 후 선택. 직전 사이클 verbatim 쓰기경로(revisionTxn) 재사용을 전제로 화면 B 연결을 설계한다. Context Anchor가 Design에 전파된다.
