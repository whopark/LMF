# Design — subcategory-order (중분류 10코드 분류 통합)

> PDCA Design · 2026-06-14 · **Option C (10코드 통합)** · 기준: MMM(문항번호 중간 3자리) 백자리 → 점검표 10분류

## 설계 변경 이력 (B → C 피벗)
- Checkpoint3에서 **Option B(라벨 유지·min-MMM dense-rank)** 선택 → 구현·적용했으나, dry-run 결과 드롭다운이 "기록의 정확성·실시 주기 준수…" 순으로 나와 **사용자 의도와 불일치**.
- 사용자 정정: "중분류 순서는 **반드시 10개 코드 분류**(01 심사범위 … 10 검사실이전)로". → **Option C(93개 노이즈 라벨 → 10 코드 분류 통합)** 로 전환.
- 통합 방식 확정: **10개로 완전 통합** · 엣지: 제공서비스=11(별도 끝)·기타(005)=06·검사실이전(10)=데이터없음 예약.

## Context Anchor (Plan 승계)
WHY 심사점검표 순서 정합(§1/§8) · RISK 전 문항 sub_category 라벨 변이(백업/멱등) · SUCCESS 10코드 분류·점검표순 드롭다운·안전 · SCOPE 중분류 10코드 통합 + order=코드 + 드롭다운 정렬.

## 1. 핵심 결정 (Option C)
- **중분류 = 10개 코드 분류**로 통합. 93개 노이즈 라벨(검사특이 ~80종 포함)을 흡수.
- **코드 = MMM(문항번호 중간 3자리) 백자리**로 결정 → item_number 기반이라 **멱등**(라벨 노이즈 무관).
- 표시 라벨 = `"NN 이름"`(코드 동반). order = 코드 정수(01→1 … 11→11).

### 코드 매핑 (MMM → 코드)
| 코드 | 라벨 | MMM 규칙 |
|---|---|---|
| 01 | 01 심사범위 | 백자리 0 (010 등) |
| 02 | 02 질관리:일반 | 백자리 2 |
| 03 | 03 질관리:검사단계 | 백자리 3 (정도관리·시약) |
| 04 | 04 질관리:검사전후단계 | 백자리 4 + **980**(검사결과 보고) |
| 05 | 05 일반기구 및 장비 | 백자리 5 |
| 06 | 06 검사수행 및 장비운용 | 백자리 6(검사특이 흡수) + **005 기타** |
| 07 | 07 인력 | 백자리 7 |
| 08 | 08 시설 및 환경 | 백자리 8 |
| 09 | 09 안전 | 백자리 9 |
| 10 | 10 검사실이전 | (2026 데이터 없음 — 코드 예약) |
| 11 | 11 제공서비스 | MMM 비숫자('제공') |

## 2. 모듈
```
scripts/lib/subcatOrder.js     # 순수: middleCode·categoryCode·categoryFor·CATEGORY
scripts/migrate-subcat-order.js# 오케스트레이터: connect/backup/categoryFor 적용/dry-run/verify
gui/backend/routes/filters.js  # MOD: 드롭다운을 sub_category_order(=코드) 정렬
tests/subcat-order.test.js     # 단위(categoryCode/categoryFor) + 통합(통합·멱등)
tests/api.test.js              # +1: 드롭다운 점검표순 단언
```
재사용: `scripts/lib/backup.js`·`db-connect.js`. `routes/items.js` 정렬(`{sub_category_order:1,item_order:1}`) 무변경.

## 3. 순수함수 (`subcatOrder.js`)
```
middleCode(item_number) → int|null    // "NN.MMM.NNN" → MMM, 비숫자 → null
categoryCode(item_number) → '01'..'11'
  mid===null → '11'(제공) · mid===5 → '06'(기타) · mid===980 → '04'
  · else 백자리 매핑(0→01,2→02,…,9→09), 미정의 → '06'
categoryFor(item_number) → { code, label: CATEGORY[code], order: int(code) }
```
- 전부 item_number 기반 → **멱등**(재실행 시 라벨이 이미 코드화돼도 동일 결과).

## 4. 오케스트레이터 (`migrate-subcat-order.js`)
- CLI: `--dry-run`(기본)·`--apply`·`--skip-backup`.
- 흐름: connect → (apply)backup → 각 doc `{label,order}=categoryFor(item_number)` → `sub_category`,`sub_category_order` 다르면 patch → bulkWrite(500)/dry-run 리포트 → 사후검증.
- **사후검증**: `categories`(distinct 분류 수), `inconsistentNames`(분류당 order≠1 수=0 기대), `totalOk`(총수 불변). 멱등: 재실행 changed=0.
- 롤백: `rollback-items.js --from <backup>`.

## 5. 프론트 (`routes/filters.js`)
- `distinct('sub_category').sort()`(가나다) → aggregate `{$group:{_id, ord:{$min:'$sub_category_order'}}},{$sort:{ord:1,_id:1}}` → 코드순 배열. Sidebar는 배열 순서 그대로 렌더.

## 6. Success Criteria
- **SC-1** 분류당 sub_category_order distinct=1 · 분류 수 ≤ 11.
- **SC-2** 드롭다운 = 10코드 점검표 순서(01 심사범위 → … → 11 제공서비스), 가나다 아님.
- **SC-3** 안전 — 백업·dry-run·멱등(재실행 changed=0)·롤백·총수 불변.
- **SC-4** 엣지 — 제공서비스=11(끝)·기타=06·검사실이전(10) 예약·980=04.
- **SC-5** 브라우저 — Sidebar 중분류 드롭다운 코드 순서 렌더.

## 7. 트레이드오프 / 리스크
| 항목 | 메모 |
|---|---|
| 검사특이 granularity 상실 | 혈액응고검사·MALDI-TOF 등 ~80종이 '06'으로 흡수 — 사용자 결정(10코드 통합). 세부 필터 필요 시 차기 별도 필드(sub_category_group) 검토. |
| 전 문항 라벨 변이(9,984) | apply 전 백업 + dry-run + 멱등 + 롤백. |
| 원 93라벨 유실 | 백업 컬렉션에 보존(롤백 가능). |

## 8. Implementation Guide / Session Guide
| scope | 산출물 | SC |
|---|---|---|
| `transform` | `lib/subcatOrder.js` + 단위테스트 | SC-1·2·4 |
| `migrate` | `migrate-subcat-order.js` + 통합테스트 | SC-1·3 |
| `frontend` | `routes/filters.js` + api 테스트 | SC-2·5 |
| `verify` | 로컬 dry-run/apply + 브라우저 | SC-1~5 |

## 9. 다음
`/pdca analyze subcategory-order` (Check).
