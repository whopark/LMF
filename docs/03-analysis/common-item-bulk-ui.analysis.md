# Analysis (Check) — common-item-bulk-ui (공통문항 일괄 보기·편집, §2)

> PDCA Check · 2026-06-15 · gap-detector 독립 대조 + 브라우저 런타임 검증 · **Match Rate 82%**

## Context Anchor (Design 승계)
WHY 공통문항 분야별 수기편집 누락 위험 → 일괄 UI(§2) · RISK 다분야 동시 변이(백엔드 원자·revision·field_specific 미전파 보장) · SUCCESS ItemModal 진입점·전 분야 조회·shared 일괄 저장(field_specific 불변)·인증/에러·검증 · SCOPE 프론트 패널 + ItemModal 버튼.

## 1. 전략 정합성 (PRD/Plan WHY)
- **핵심 문제 해결?** ✅ 부분 — 공통문항을 한 화면에서 전 분야 일괄 보기·편집 가능(스펙 §2-3 핵심). 단 아래 G-1로 "분야" 단위가 아닌 "분야×연도" 단위가 되어 의도 일부 훼손.
- **백엔드 무변경 전제** — G-1·G-2 수정이 백엔드 변경을 요구 → 설계 §4·§6 전제와 충돌(설계 갱신 필요).

## 2. Success Criteria 평가
| SC | 상태 | 증거 |
|----|:----:|------|
| **SC-1** 진입점 게이팅(common_key 시만) | ✅ Met | `ItemModal.jsx:110` `{selectedItem.common_key && !showCommon && …}`; 테스트 `ItemModal.test.jsx`(노출/미노출) PASS |
| **SC-2** 전 분야 표시(행수=GET items수) | ⚠️ Partial | `CommonItemPanel.jsx:109` `items.map`; 행수=GET수 ✅. 단 GET 연도 미필터(`common.js:30-31`)로 "전 분야×전 연도"(런타임 65행) |
| **SC-3** shared 일괄 저장·field_specific 불변 | ⚠️ Partial | 변경분만 전송(`:59-65,80-85`), `COMMON_SHARED_FIELDS`만 전파·field_specific 미전파(`revisionTxn.js:16,71-73`) ✅. 단 PATCH 대상 쿼리에 year 조건 부재(`revisionTxn.js:79-82`) → 선택 분야의 과거 연도까지 덮어씀 |
| **SC-4** 인증/에러·저장 차단 | ✅ Met | `canSave`(`:74`) reason·분야·변경 가드; 401/403/400 분기(`:90`); 백엔드 `requireAuth('editor')`(`common.js:46`); 테스트 PASS |
| **SC-5** RTL + 브라우저 | ✅ Met | CommonItemPanel 3 + ItemModal 3 RTL PASS; 브라우저 검증 PASS(저장 후 GET 재조회 반영) |

**SC 집계**: Met 3 · Partial 2 · NotMet 0.

## 3. 갭 목록
### 🔴 Critical
- **G-1 연도 미격리(데이터 정합성)** — `GET /common/:key`(`common.js:30-31`)·`applyCommonEdit` query(`revisionTxn.js:79-82`) 모두 year 조건 없음 → 패널이 분야×연도 행, 일괄 저장이 선택 분야의 **과거 연도(상이한 설명)까지 덮어씀**(실측: area01 저장 시 2020/2021/2022 → 2026값). 신뢰도 95%.
  - **권고**: GET에 `?year=`(기본 최신연도) 필터 + `applyCommonEdit` query에 year 조건. **GET·PATCH 양쪽** 필요(GET만 고치면 PATCH가 여전히 전 연도 변경).

### 🟡 Important
- **G-2 분야특이 설명 GET 미반환** — `toCommonResponse`(`common.js:10-25`)에 `field_specific_description` 누락(모델엔 존재 `Item.js`). 패널 `:114` 렌더 시도하나 항상 `undefined` → **읽기전용 표시 기능 死(dead)**. 신뢰도 90%.
  - **권고**: `toCommonResponse`에 `field_specific_description` 추가(1줄).

### 🔵 Minor
- **G-3 prefill `list[0]`** vs 설계 "최신연도 대표값"(§2·§6) — `CommonItemPanel.jsx:36`. G-1 연도 필터 적용 시 자동 해소 가능. 신뢰도 85%.
- **G-4 about_item 폴백 미구현** — `ItemModal.jsx:110,133`은 `common_key`만 검사. 설계는 "또는 about_item"으로 느슨. 데이터에 common_key 보장 시 무영향 → 설계 단순화 권장. 신뢰도 80%.

## 4. 설계 결정 준수 (6/8 준수)
**준수**: 신규 CommonItemPanel 단일 컴포넌트 · ItemModal 버튼+토글+저장후 머지 · RevisionPanel 패턴(edit_types·reason·SENSITIVE 게이팅·authHeader) · 분야 기본 미선택 강제 · 변경분만 전송·field_specific 미전파(이중 보장) · 파일 ≤300줄(161/288).
**이탈**: ❌ "백엔드 무변경" 전제가 G-1·G-2 수정으로 불가피하게 깨짐(설계 §2 데이터 로드에 연도 차원 누락, §4 GET 계약에 field_specific 누락) → 설계 §2·§4 갱신 필요. ⚠️ G-3 prefill 미세 이탈.

## 5. Match Rate 산출
구조 결정 6/8 준수 + SC(Met 3 + Partial 2). 기능 일치 ~90%이나, G-1(Critical 데이터 정합성)·G-2(Important 기능 死) 2건이 SC-2·3 실동작을 훼손 → **82%**.

## 6. 결론 (초기)
90% 미만 → **iterate 권장**(G-1 우선, G-2 동반). 수정은 백엔드(`common.js`) 변경을 요하므로 설계 §2·§4 갱신 동반(코드=truth). G-3은 G-1 수정 시 흡수, G-4는 데이터 확인 후 설계 단순화.

---

## 7. Iterate 결과 (2026-06-15) — **Match Rate 82% → ~97%**
사용자 결정 "지금 모두 수정" → G-1·G-2 수정 완료.

| 갭 | 조치 | 증거 |
|---|---|---|
| 🔴 **G-1** 연도 미격리 | GET `?year=`+기본 최신연도(`common.js:28-46`) · `applyCommonEdit` query에 `year`(`revisionTxn.js:80-82`) · 프론트 PATCH에 `year` 전송(`CommonItemPanel.jsx`) | 백엔드 테스트 `scopes the update to the given year only`(과거연도 unchanged) · 브라우저 010.090 **65→14행, 2026 단일** |
| 🟡 **G-2** field_specific GET 누락 | `toCommonResponse`에 `field_specific_description` 추가(`common.js:21`) | 백엔드 테스트 `includes field_specific_description` PASS |
| 🔵 **G-3** prefill | GET 단일 연도화로 자동 흡수(list[0]=최신연도) | — |
| 🔵 **G-4** about_item 폴백 | 미수정(데이터에 common_key 보장, 무영향) — 잔존 Minor | — |

**SC 재평가**: SC-1·2·3·4·5 **전부 Met**(SC-2/3 Partial→Met). 
**테스트**: 백엔드 **202**(common +4 신규: 연도 격리·`?year=`·field_specific·기본 최신연도) · 프론트 **52**(회귀 0). 
**설계 갱신**: §1·§2·§4 백엔드 변경 반영(연도 스코핑·field_specific·PATCH year). 
**잔여**: G-4(Minor, about_item 폴백) — 차기 설계 단순화 시 정리.

→ **Match Rate ~97%** (≥90%) → **report 진행 가능**.
