# Completion Report — subcategory-order (중분류 10코드 분류 통합)

> PDCA 완료 · 2026-06-15 · Option C · Match Rate ~99% · SC 5/5 Met · 스펙 §1/§8

## 1. Executive Summary
| 관점 | 내용 |
|---|---|
| **Problem** | 중분류 93종이 분야별 `sub_category_order` 제각각·라벨 비일관, 드롭다운 가나다 정렬 → 심사점검표 순서 미보장(§1/§8). |
| **Solution** | MMM(문항번호 중간 3자리) 백자리 기준으로 **10코드 분류 통합**(01 심사범위…11 제공서비스). `sub_category`=코드라벨·`order`=코드, 드롭다운 코드순. 백업/멱등 마이그레이션. |
| **기능·UX 효과** | 대시보드 중분류 드롭다운이 사용자 지정 10코드 점검표 순서로 표시, 분야 무관 일관. |
| **핵심 가치** | 심사점검표 정합성 — 가나다 아닌 점검표 순서, 검사특이 노이즈(80종) 정리. |

### 1.3 Value Delivered (실측)
| 지표 | 결과 |
|---|---|
| 중분류 | 93종(노이즈) → **10코드 분류**(01~09 + 11 제공서비스; 10 검사실이전 예약) |
| 변경 | **9,984문항** sub_category+order 통합 · 백업 `..._20260614-5` |
| 분류당 order | distinct=1 (`inconsistentNames=0`) |
| 멱등 | 재실행 `changed=0` |
| 드롭다운 | 가나다 → **01 심사범위→…→11 제공서비스**(브라우저 확인) |
| 회귀 | 백엔드 **198 테스트** · 총수 불변 |

## 2. Key Decisions & Outcomes
| 결정 | 따랐는가 | 결과 |
|---|:---:|---|
| 적용 단위 = 전역 단일 order | ✅ | 분류당 order 1개 |
| 순서 기준 = MMM(백자리) | ✅ | PDF 헤딩 파싱 불필요(ETL도 회피) — MMM에 점검표 순서 인코딩 |
| **B(라벨유지·min-MMM) → C(10코드 통합) 피벗** | ✅ | dry-run에서 B가 "기록 정확성…" 엉뚱 순서 → 사용자 정정으로 C 채택 |
| 엣지: 제공=11·기타=06·이전=10예약·980=04 | ✅ | 사용자 결정대로 |
| 검사특이 80종 → 06 흡수 | ✅(사용자 결정) | granularity 상실 수용(차기 sub_category_group 후보) |

## 3. Success Criteria — Final (5/5 Met)
SC-1 분류당 order 1개 ✅ · SC-2 드롭다운 점검표순 ✅ · SC-3 안전(백업·멱등·롤백) ✅ · SC-4 엣지 ✅ · SC-5 브라우저 ✅

## 4. 구현 산출물
- `scripts/lib/subcatOrder.js` (middleCode·categoryCode·categoryFor·CATEGORY)
- `scripts/migrate-subcat-order.js` (통합 마이그레이션·verifyMetrics)
- `routes/filters.js` (드롭다운 order 정렬)
- 테스트: `tests/subcat-order.test.js`(단위+통합) · `tests/api.test.js`(+드롭다운 순서)
- 적용: 로컬 DB 9,984문항, 백업 `checklist_items_backup_20260614-5`

## 5. 잔여 / 후속
- **차기**: 검사특이 granularity 복원용 `sub_category_group`(10) + `sub_category_detail`(원 93) 분리 검토 · 검사실이전(10)·제공서비스 라벨/위치 점검표 PDF 재확인.
- **프론트**: ItemModal/연도별추적 등 sub_category 표시처는 코드라벨로 자동 반영(별도 작업 없음).

## 6. 학습 (Learnable)
- **추측 매핑 금지**: 사용자 10개 라벨이 DB 93종과 불일치 → 프로브로 MMM 구조 발견 후에야 올바른 접근(C) 도출.
- **파생 순서 < 사용자 캐논**: B(데이터 파생 min-MMM)는 기술적으로 맞지만 사용자가 원한 캐논(10코드)과 달랐음 → 도메인 캐논이 우선. dry-run 결과를 사용자와 대조하는 게 피벗을 빨리 잡음.
- **MMM = 점검표 순서**: 문항번호 중간 3자리가 권위 순서를 인코딩 — PDF 헤딩 파싱보다 견고.
