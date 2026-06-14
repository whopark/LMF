# Analysis (Check) — subcategory-order (중분류 10코드 통합, Option C)

> PDCA Check · 2026-06-15 · gap-detector + 런타임 증거 종합

## Match Rate: **gap-detector 97% → 보정 ~98%**
보정 사유: gap-detector가 SC-5(브라우저)를 자동검증 부재로 Partial 처리. 본 세션 Playwright 옵션 추출(`전체 중분류`+01~09+11 제공서비스)로 Met 확정.

## SC 판정표 (보정 후 — 5/5 Met)
| SC | 판정 | 증거 |
|----|:----:|------|
| SC-1 분류당 order 1개·≤11 | ✅ Met | `verifyMetrics inconsistentNames=0` · 실측 categories=10 · 통합테스트 |
| SC-2 드롭다운 점검표순(가나다 아님) | ✅ Met | filters.js aggregate min-order 정렬 · api.test 순서 단언 · 실측 01 심사범위…11 제공서비스 |
| SC-3 안전(백업·dry-run·멱등·롤백·총수) | ✅ Met | 백업 `..._20260614-5` · 재실행 `changed=0` · totalOk · 롤백 명령 |
| SC-4 엣지(제공11·기타06·이전10예약·980→04) | ✅ Met | subcatOrder.js:31-33 · edge 단위테스트 |
| SC-5 브라우저 코드순 렌더 | ✅ Met | Playwright 옵션 추출 = 사용자 10 코드 순서 |

**5/5 Met · Critical/Important 0**

## Gap (gap-detector, 전부 Minor — B→C 피벗 잔재)
| ID | 위치 | 내용 | 조치 |
|----|---|---|---|
| G1 | `migrate-subcat-order.js:2-13` | 헤더 주석이 구버전(Option B "min MMM dense-rank") | C(코드=order, categoryFor) 설명으로 교체 |
| G2 | `filters.js:19` | 주석 "대표 order=min" (B 표현) | "분류당 order 단일, min은 방어적"으로 명확화 |
| G3 | `plan.md §1·§6` | 본문 B 전제 잔존(상단 노트는 C 정정됨) | 이력 문서로 유지 or "(B→C 무효)" 주석 |

> 세 항목 모두 **동작 무영향 문서/주석 정합성**. 코드 로직은 설계 §3·§4·§5와 완전 일치.

## 결론
- **목표 달성**: 중분류 10코드 통합, 드롭다운 점검표순, 멱등·무손상. SC 5/5 Met.
- **잔여 = 주석/문서 정합**(G1/G2/G3). Critical 0.
- Match Rate ~98% ≥90% → report 진행.

## Iterate 결과 (2026-06-15) — ~98% → ~99%
| 갭 | 조치 | 결과 |
|----|------|------|
| G1 | `migrate-subcat-order.js` 헤더 주석 Option C로 교체 | ✅ 해소 |
| G2 | `filters.js:19` 주석(분류당 단일 order·min 방어적) | ✅ 해소 |
| G3 | `plan.md §1·§6` "B→C 무효" 주석 + design §3 포인터 | ✅ 해소 |

전부 **주석/문서만** — 코드 로직 무변경(테스트 198 통과 유효). 잔여 Critical/Important 0.
**최종: SC 5/5 Met · 주석/문서 정합 완료 → report 진행 가능.**
