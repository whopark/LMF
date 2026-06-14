# Analysis (Check): revision-workflow — v1 P0 갭 8종

| 항목 | 값 |
|------|-----|
| Feature | revision-workflow |
| Phase | Check (Gap Analysis) |
| 분석일 | 2026-06-14 |
| Match Rate | **96%** |
| SC 충족 | 8.5 / 9 (94%) |
| 판정 | ✅ Report 진행 권장 (≥90%) |
| 에이전트 | bkit:gap-detector |

## Context Anchor

| 키 | 값 |
|----|-----|
| **WHY** | 연 1회 개정 시즌 결과물 = 인증 공식 증빙. "시스템본=공식본" 신뢰가 핵심. |
| **WHO** | P1 담당자(editor) · P2 심사위원(editor) · P3 마스터 권한자(approver+admin) |
| **RISK** | replica set 전환 · verbatim 회귀 · 이력 누락 · 전파 누락 · Lock 우회 |
| **SUCCESS** | 이력누락 0 · verbatim 0 · Lock 우회 0 · unlock 감사 100% · 분야특이 보존 100% · Export 한글 0 · 민감유형 100% · 화면A 영속 100% |
| **SCOPE** | v1 P0 갭 8종 |

## 1. Match Rate: 96%

설계 명세 36개 항목 검증: NEW 6/6 · MOD 8/8 · 8종 갭 핵심 8/8 · 세부 13.5/14.
아키텍처 준수(Option C 횡단관심사 추출) 100%, 컨벤션(300줄/50줄) 100%.

## 2. 전략 정합성 (PRD WHY 해소)

| PRD 핵심 문제 (Pre-mortem 상위) | 해소 | 근거 |
|------|:----:|------|
| ① verbatim 유실 | ✅ | raw_reason source + SHA-256 회귀고정 |
| ② revision 이력 누락 | ✅ | non-blocking→blocking 트랜잭션, 실패주입 롤백 |
| ③ 공통문항 전파 누락/덮어쓰기 | ✅ | 트랜잭션 전파 + field_specific_description 제외 (GAP-1 참고) |
| ④ Lock 우회 | ✅ | PATCH+transition 원자 가드 + 409 |
| ⑤ unlock 감사 부재 | ✅ | admin전용+사유필수+AuditLog 강제 |

PRD "v1 출시 전 반드시 해결" 상위 3 리스크(verbatim·이력누락·전파누락) **모두 해소**.

## 3. Success Criteria 검증

| SC | 기준 | 상태 | 근거 |
|----|------|:----:|------|
| SC-1 | 이력 누락 0 | ✅ Met | revision-txn.test.js:42-57 (실패주입 롤백), revisionTxn.js:33-64 |
| SC-2 | verbatim 0 | ✅ Met | reason.test.js, revision-txn.test.js:26-38 (byte 동일·해시) |
| SC-3 | Lock 우회 0 | ✅ Met | revision-txn.test.js:61-71, revisions.js:101-108 (409), PATCH guard |
| SC-4 | unlock 감사 100% | ✅ Met | governance.test.js:28-84 (admin/사유/감사/무제한) |
| SC-5 | 분야특이 보존 100% | ✅ Met | revision-txn.test.js:81-91, revisionTxn.js:16 제외 |
| SC-6 | Export 한글 0 | ✅ Met | export.test.js:205-218 (NotoSansKR 번들), exportPdf.js |
| SC-7 | 민감유형 차단 100% | ✅ Met | governance.test.js:88-114, sensitiveEditTypes.js + RevisionPanel |
| SC-8 | 화면 A 영속 100% | ⚠️ Partial | FilterContext localStorage (새로고침 유지 ✅) — 설계 "서버 Worklist"와 방식 차이 (GAP-3) |
| SC-9 | 회귀+커버리지 ≥80% | ✅ Met | 16파일/152통과, Line 80.47%(신규 85~100%) |

## 4. Decision Record 준수 (4/4)

| 결정 | 준수 | 근거 |
|------|:----:|------|
| replica set 트랜잭션 | ✅ | withTransaction.js, setup.js MongoMemoryReplSet |
| raw_reason + 해시 | ✅ | Revision.js:24-26, reason.js |
| 민감유형 비활성+403 | ✅ | sensitiveEditTypes.js(403) + RevisionPanel(disabled) |
| unlock 무제한+사유+감사 | ✅ | revisionTxn.js:112-133, governance.test.js |

## 5. Gap 목록

### GAP-1 — 공통문항 전파 필드 (설계 5개 vs 구현 3개)
- **Severity**: Important(gap-detector) → **재분류: Minor(문서)**
- **근거**: 설계 §8은 `SHARED_FIELDS = [question,description,score,classification,na_available]`(5). 구현 `revisionTxn.js:16 COMMON_SHARED_FIELDS = [question,description,score]`(3).
- **도메인 재검증**: `na_available`은 **분야특이 필드(전파 금지)** — `common-items.test.js:80-88`이 전파 후 불변을 강제. 즉 구현이 도메인 규칙·기존 테스트를 정확히 준수. `classification`(C/R/B) 전파 여부는 도메인 결정 필요(현행/기존 모두 미전파).
- **결론**: 코드 정확(기존 동작·테스트 보존). 설계 §8이 snapshot 필드(5)와 전파 필드(3)를 혼동·과다명세. **조치 = 설계 §8 정정** (na_available/classification 전파 제외 명시). classification 전파를 원하면 별도 도메인 확정 후 코드 추가.

### GAP-2 — G6 프론트 파일명 (설계 ItemModal vs 구현 RevisionPanel)
- **Severity**: Minor (문서)
- **근거**: 설계 §3/§7은 `ItemModal.jsx`. 실제 수정유형 UI는 `RevisionPanel.jsx:98-114`(ItemModal엔 edit_types UI 부재). 기능 무결, 올바른 위치.
- **조치 = 설계 §3/§7 파일명 정정** (RevisionPanel.jsx).

### GAP-3 — 화면 A 영속 방식 (설계 서버 Worklist vs 구현 localStorage)
- **Severity**: Minor (Checkpoint 4에서 사용자 승인된 방식)
- **근거**: 설계 §10 "서버 Worklist 영속화". 구현 `FilterContext.jsx:51-60` localStorage. OQ-B 조사 결과(_id↔item_number 불일치·객체 재조회 복잡) 반영해 Checkpoint 4에서 localStorage 선택. SC-8 사용자 가치(새로고침 유지) 충족. E2E TS-07 테스트는 프론트 인프라 부재로 미작성.
- **조치 = 설계 §10을 localStorage로 정정** + 멀티디바이스 필요 시 v1.5 서버 Worklist.

## 6. 종합 판정

**Match Rate 96% ≥ 90% → Report 단계 진행 가능.**

3개 GAP 모두 **코드 결함이 아니라 설계 문서를 (정확한) 구현에 맞춰 정정하는 성격**(code=truth 원칙). 회귀 리스크 없음. 유일한 실질 의사결정: GAP-1의 `classification` 공통문항 전파 여부(도메인).

미해결: E2E TS-07/08(화면 A 영속·Export 한글 시각검증)은 프론트 테스트 인프라 부재로 백엔드 단위/통합 + build로 대체 검증.
