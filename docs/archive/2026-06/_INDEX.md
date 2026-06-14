# Archive Index — 2026-06

| Feature | Phase | Match Rate | Archived | Path |
|---------|-------|:----------:|----------|------|
| revision-workflow (문항 수정·개정) | completed | 96% | 2026-06-14 | `revision-workflow/` |
| yearly-tracking (문항 연도별 추적) | completed | 99% | 2026-06-14 | `yearly-tracking/` |
| data-integrity (§5 데이터 오염 정제) | completed | ~97% | 2026-06-14 | `data-integrity/` |

---

## revision-workflow — 문항 수정·개정 워크플로우 (v1 P0 갭 8종)

- **기간**: 2026-06-13 ~ 2026-06-14
- **레벨**: Dynamic · **아키텍처**: Option C (실용 균형 — 횡단관심사 추출)
- **결과**: Match Rate **96%** · SC **8.5/9** · 테스트 **152/152**(회귀 0) · 커버리지 Line **80.47%**(신규 85~100%)
- **문서**: prd · plan · design · analysis · report (5종)
- **요약**: Phase 4~7에 구현된 개정 워크플로우의 신뢰성·거버넌스 갭 8종(R-06/08/10/12/20/22/23/29)을 다음 개정 시즌 전 해소.
  - G1 이력누락 0(replica set 트랜잭션) · G2 verbatim(raw_reason+SHA256) · G5 Lock 우회 0(원자 가드) · G7 분야특이 보존 · G4 unlock 감사 · G6 민감유형 차단(서버403+프론트) · G8 Export 한글(NotoSansKR) · G3 화면A 영속(localStorage)
- **잔여(Act 백로그)**: v1.5(서버 Worklist·미리보기·ZIP Export·진행률 대시보드) / 도메인(classification 공통문항 전파) / 프론트 E2E 인프라 / 운영(프로덕션 RS 구성·reason 마이그레이션)

---

## yearly-tracking — 문항 연도별 추적 (화면 B, §4) · P0 핵심 갭 9종

- **기간**: 2026-06-14 (revision-workflow 후속)
- **레벨**: Dynamic · **아키텍처**: Option C (실용 균형 — 한글 정규화 추출 + in-place)
- **결과**: Match Rate **99%**(G-A1 수정) · SC **7/7 Met** · 테스트 **161/161**(회귀 0) · 커버리지 Line **83.84%**(changes.js 88.33%)
- **문서**: prd · plan · design · analysis · report (5종)
- **요약**: Phase 5에 구현된 연도별 추적의 신뢰성·정확도·연동 갭 9종 해소. 직전 사이클 verbatim(raw_reason)을 화면 B까지 완결.
  - G-Y1 changes.js 인증 · G-Y6 한글 비교전용 정규화(normalizeKo) · G-Y5 6필드 diff · G-Y4 verbatim reason batch + ComparisonTable 6필드 · G-Y2 화면B verbatim 표시(LLM 초안 격하) · G-Y3 화면A→B 자동필터 · G-Y7 empty-state · G-A1(Check) 분야특이/해당없음 행 추가
- **핵심 가치**: "화면 = Export 동일 소스"(verbatim Revision.reason 통일)
- **잔여(v.next)**: 5년 이력 타임라인·DELETED 부활(과거 5년 데이터 마이그레이션 후) / 분야별 ZIP Export(R-25) / 1:1 PDF 좌우(R-12) / 프론트 E2E(Playwright)

---

## data-integrity — §5 데이터 오염 정제 (2020 병합·2021 미분류·blocks)

- **기간**: 2026-06-14 (yearly-tracking 후속)
- **레벨**: Dynamic · **아키텍처**: Option B (클린 — 변환별 모듈 분리)
- **결과**: Match Rate **~97%** · SC **6/6 Met** · 백엔드 테스트 **182/182**(spec5 21 신규) · 멱등 실증(재실행 `changed=0`)
- **문서**: plan · design · analysis · report (4종 · PRD 생략 — 버그/데이터 정합 성격)
- **적용(로컬 DB)**: **9,573 변경** — 2020 병합분리(→0) · 2021 미분류(1,601→17 단종) · blocks(9,532) · 백업 `checklist_items_backup_20260614-2`
- **요약**: 과거연도 구조 오염 정제 — ∙기준 질문/설명 분리, 2026 우선 common_key 분류 백필, description→blocks 적재. 순수변환(`lib/spec5/*`) + 오케스트레이터(dry-run 기본·백업·bulkWrite·사후검증). 안전: 백업·dry-run·멱등·롤백.
- **검증**: gap-detector 86% → 런타임 보정(멱등 실증·브라우저 SC-6) + iterate(설계 동기화·SC-2 리포트) → ~97%
- **잔여(차기)**: 답안마커 bleed 12건(2025 `예 (필수)`) · 탭/공백 표 blocks · 프론트 `getDisplayData` band-aid 제거 · 선택적 하드닝(blocksEqual deep-equal·dry-run 사후검증)
