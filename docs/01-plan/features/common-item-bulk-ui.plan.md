# Plan — common-item-bulk-ui (공통문항 일괄 보기·편집 UI, 스펙 §2)

> PDCA Plan · 2026-06-15 · 프론트 전용(백엔드 완비) · 진입점: ItemModal '공통문항 일괄' 버튼

## Executive Summary
| 관점 | 내용 |
|---|---|
| **Problem** | 공통문항(끝 6자리 동일·앞 2자리 분야만 상이, 2026 기준 **133그룹**)을 화면에서 **전 분야 나란히 보거나 일괄 편집할 UI가 없음**(현재 `공통` 배지뿐). 일괄 변경은 백엔드 API로만 가능. |
| **Solution** | ItemModal에 공통문항이면 **'공통문항 일괄' 버튼** → 패널에서 `GET /api/common/:key`로 전 분야 표시 + shared(질문/설명/배점) **일괄 편집**(`PATCH /api/common/:key`, editor). **백엔드 무변경**(applyCommonEdit 재사용). |
| **기능·UX 효과** | 공통문항 한 번 편집으로 전 분야 일괄 반영, 분야특이 설명은 보존. 누락·불일치 방지. |
| **핵심 가치** | 스펙 §2-3 완성 — "공통문항 변경 시 전 분야 일괄 변경(또는 일괄 확인)". |

## Context Anchor
- **WHY** 공통문항 분야별 수기 반복편집 → 누락·불일치 위험. 일괄 UI로 해소(§2). 백엔드는 이미 완비, UI만 부재.
- **WHO** 문항 관리자(editor+).
- **RISK** 일괄 변경 = 다분야 동시 변이. 백엔드 원자성·revision 기록·field_specific 미전파는 보장됨. editor 인증 필요.
- **SUCCESS** ItemModal 진입점 · 전 분야 조회 · shared 일괄 편집 저장(전 분야 반영, field_specific 불변) · 인증/에러 처리 · 프론트+브라우저 검증.
- **SCOPE** IN: 프론트 공통문항 패널(view+edit) + ItemModal 진입점. OUT: 백엔드 변경, field_specific 편집/데이터 적재(차기), 비공통 문항.

## 1. 배경 (idea 평가 근거)
- **백엔드 완비**: `routes/common.js` GET `/:key`(전 분야 조회, area+year 정렬) · PATCH `/:key`(`requireAuth('editor')`, `applyCommonEdit`, COMMON_SHARED=`question/description/score`, 원자·revision 기록·field_specific 미전파). `common-items.test.js` 존재.
- **프론트 갭**: `DashboardView`의 `공통` 배지뿐 — `/api/common` 호출/편집 UI 없음.
- **데이터**: 2026 공통문항(2분야+) **133그룹**. `field_specific_description` 현재 **0건**(분야특이는 표시만, 데이터는 차기).

## 2. 요구사항
- **FR-1**: ItemModal에 `common_key` 존재 시 **'공통문항 일괄'** 진입점(버튼) 노출.
- **FR-2**: 패널이 `GET /api/common/:key` → 전 분야 항목 나란히(분야·연도·질문/설명/배점/분류/해당없음 + 분야특이 설명).
- **FR-3**: shared 필드(질문/설명/배점) **일괄 편집** → 분야 선택(기본 전체) + 수정유형 + 수정사유 입력 → `PATCH /api/common/:key`(authHeader, editor).
- **FR-4**: 분야특이 설명은 일괄 대상 아님(읽기 전용 표시), 미전파(백엔드 보장) 명시.
- **FR-5**: 저장 후 갱신 반영 + 에러 처리(401/403 권한, 400 허용필드).
- **NFR**: editor 인증(authHeader) · 기존 RevisionPanel/ItemModal 패턴·verbatim 수정사유 재사용 · 프론트 테스트(Vitest+RTL) · 파일 ≤300줄.

## 3. Success Criteria
- **SC-1** ItemModal 진입점이 공통문항(common_key)일 때만 노출.
- **SC-2** 패널이 전 분야 항목 정확히 표시(GET 응답 = 분야 수).
- **SC-3** shared 일괄 편집 저장 → 선택 분야 전부 반영(PATCH), **field_specific 불변**.
- **SC-4** 인증/에러 처리(비-editor 403, 미허용 필드 400).
- **SC-5** 프론트 테스트 + 브라우저(공통문항 패널 전 분야 표시·저장).

## 4. 범위 밖
백엔드 변경, 분야특이 설명 편집/데이터 적재(차기), 비공통 문항 편집(기존 RevisionPanel), 신규 분야 추가.

## 5. 리스크 / 완화
| 리스크 | 완화 |
|---|---|
| 다분야 동시 변이 | 백엔드 원자(applyCommonEdit) + revision 기록 + 분야 선택(기본 전체, 축소 가능) |
| 권한 오용 | PATCH editor 인증, 프론트 authHeader + 버튼 권한 가드 |
| field_specific 오전파 | 백엔드가 COMMON_SHARED만 전파(미포함) — UI도 편집 대상 제외 |
| 프론트 E2E 인프라 | 컴포넌트 테스트(RTL) + Playwright 수동 검증 |

## 6. 다음 단계
`/pdca design common-item-bulk-ui` — 패널 컴포넌트 아키텍처(신규 CommonItemPanel vs ItemModal/RevisionPanel 확장) 3안 + Session Guide.
