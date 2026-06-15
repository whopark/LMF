# Design — common-item-bulk-ui (공통문항 일괄 보기·편집 UI)

> PDCA Design · 2026-06-15 · **Option C(실용)** · 프론트 전용(백엔드 `common.js` 재사용)

## Context Anchor (Plan 승계)
WHY 공통문항 분야별 수기편집 누락 위험 → 일괄 UI(§2) · RISK 다분야 동시 변이(백엔드 원자·revision·field_specific 미전파 보장) · SUCCESS ItemModal 진입점·전 분야 조회·shared 일괄 저장(field_specific 불변)·인증/에러·검증 · SCOPE 프론트 패널 + ItemModal 버튼.

## 1. 아키텍처 (Option C)
- **신규 `CommonItemPanel.jsx`** 단일 컴포넌트: GET 전 분야 렌더 + shared 일괄편집폼 + PATCH.
- **`ItemModal.jsx` 수정**: `common_key` 있을 때 '공통문항 일괄' 버튼 → 패널 토글.
- **재사용**: `RevisionPanel`의 수정유형(edit_types) 체크박스·수정사유 textarea·`useAuth().authHeader` 패턴, ItemModal 모달 셸 CSS.

```
gui/frontend/src/components/
  CommonItemPanel.jsx   # 신규 — GET /common/:key 렌더 + 일괄편집폼 + PATCH
  ItemModal.jsx         # MOD — common_key 시 '공통문항 일괄' 버튼 + showCommon 토글
tests/
  CommonItemPanel.test.jsx  # RTL — 렌더·편집·저장(mock axios)
```
백엔드: 당초 **무변경** 전제였으나 Check(G-1/G-2)로 **연도 정합성 보완 필요**가 드러나 `routes/common.js`(GET 연도 스코핑·`toCommonResponse`에 `field_specific_description`)·`services/revisionTxn.js`(`applyCommonEdit` year 격리) **소폭 변경**(2026-06-15 iterate).

## 2. 컴포넌트 `CommonItemPanel`
- **Props**: `{ commonKey, onClose, onSaved }`.
- **데이터 로드**: mount 시 `GET /api/common/:key` → `{ common_key, year, items: [{item_number, area_code, area_name, year, question, description, score, classification, na_available, field_specific_description, revision}] }`. **단일 연도 스코핑(G-1)**: 기본 최신 연도(분야당 1행), `?year=`로 특정 연도. (GET 인증 불요)
- **표시(전 분야 나란히)**: 분야(area_code·name)별 행 — 문항번호·연도·배점·분류·해당없음 + **분야특이 설명(읽기전용)**. shared(질문/설명) 공통값 헤더 1회 표시 + 분야 간 불일치 시 ⚠️.
- **일괄 편집폼**:
  - shared 필드 입력(질문/설명/배점) — 최신연도 대표값 prefill.
  - **분야 선택**(체크박스, **기본 미선택 — 명시 선택 강제**, 실수로 전 분야 변경 방지) → `area_codes`. 저장은 ≥1 분야 선택 필요.
  - 수정유형(edit_types) 체크박스 + 수정사유(reason, 필수) — RevisionPanel 패턴 재사용.
  - 저장 → `PATCH /api/common/:key` body `{ question?, description?, score?, area_codes, edit_types, reason }` + `headers: authHeader()`.
- **저장 후**: 응답 반영 + `onSaved()`(상위 갱신). 에러: 401/403(권한)·400(허용필드 외) 메시지.
- **분야특이 미전파**: 편집폼에 field_specific 없음(백엔드도 COMMON_SHARED만 전파) — 읽기전용 표시만.

## 3. ItemModal 진입점
- `item.common_key`(또는 `about_item`) 존재 시 헤더에 **'공통문항 일괄'** 버튼.
- 클릭 → `setShowCommon(true)` → `<CommonItemPanel commonKey={key} onClose={()=>setShowCommon(false)} onSaved={refresh} />` 렌더(중첩 모달/섹션).
- `common_key` 없으면 버튼 미노출(SC-1).

## 4. API 계약 (iterate 반영)
- `GET /api/common/:key[?year=]` → **단일 연도** 전 분야 items(+`year`, `field_specific_description`). 기본 최신 연도. (인증 불요)
- `PATCH /api/common/:key` (requireAuth **editor**) — body `{ question?, description?, score?, area_codes, edit_types, reason, year }`. `applyCommonEdit`(원자·revision 기록·COMMON_SHARED=question/description/score만 전파·field_specific 미전파·**year 격리 G-1**). 400=미허용 필드, 403=권한.

## 5. Success Criteria
- **SC-1** ItemModal 진입점이 `common_key` 있을 때만 노출.
- **SC-2** 패널이 전 분야 항목 표시(렌더 행 수 = GET items 수).
- **SC-3** shared 일괄 편집 저장 → 선택 분야 반영(PATCH), field_specific 불변.
- **SC-4** 인증/에러 처리(비-editor 403, 미허용 필드 400, reason 빈값·**분야 미선택 시 저장 차단**).
- **SC-5** RTL 컴포넌트 테스트 + 브라우저(패널 전 분야 표시·저장).

## 6. 리스크/완화
| 리스크 | 완화 |
|---|---|
| 다분야 동시 변이 | 백엔드 원자 + revision 기록 + 분야 선택(기본 전체, 축소) + 수정사유 필수 |
| 권한 | PATCH editor, 프론트 authHeader + 저장버튼 권한 가드(user.role) |
| shared 분야 간 불일치 prefill | 최신연도 대표값 + 불일치 ⚠️ 표시 |
| field_specific 오전파 | 편집폼 제외 + 백엔드 미전파(이중 보장) |

## 7. Implementation Guide / Session Guide
| scope | 산출물 | SC |
|---|---|---|
| `panel` | `CommonItemPanel.jsx`(GET 렌더+일괄폼+PATCH) + RTL 테스트 | SC-2·3·4 |
| `entry` | `ItemModal.jsx` 버튼+토글 | SC-1 |
| `verify` | 브라우저(공통문항 패널 열기·전 분야 표시·일괄 저장·반영 확인) | SC-1~5 |

권장 세션: `panel` → `entry` → `verify`.

## 8. 다음
`/pdca do common-item-bulk-ui --scope panel`
