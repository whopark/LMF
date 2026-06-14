# Plan: revision-workflow — 문항 수정·개정 워크플로우 (v1 P0 갭 수정)

| 항목 | 값 |
|------|-----|
| Feature | revision-workflow |
| Phase | Plan |
| 작성일 | 2026-06-14 |
| 작성자 | whopark |
| PRD 참조 | `docs/00-pm/revision-workflow.prd.md` |
| 스코프 | **v1 P0 갭 8종만** (v1.5 P1 / v2+ 제외) |
| 전제 | 기반 기능은 Phase 4~7에서 구현 완료. 본 Plan은 다음 개정 시즌 전 신뢰성·거버넌스 갭 수정에 한정. |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 개정 워크플로우의 기반(모델·상태머신·권한·Export)은 구현되었으나, 수정사유 verbatim 미보장·revision 로그 이력 누락·공통문항 전파 시 분야특이 설명 덮어쓰기·Lock 우회(TOCTOU)·unlock 감사 부재 등 8종 갭이 "시스템본=공식본" 신뢰를 위협한다. |
| **Solution** | 8종 P0 갭을 데이터 정합성(트랜잭션·verbatim 해시·전파 보존), 거버넌스(unlock 사유·감사·민감유형 차단), 사용성(화면 A 영속화·Export 한글)으로 묶어 일괄 수정한다. MongoDB를 replica set으로 전환해 PATCH·전파·이력 기록을 ACID 트랜잭션으로 원자화한다. |
| **Function·UX Effect** | 편집자는 선택·수정사유가 절대 유실되지 않고, 심사위원은 민감 작업이 명확히 차단되며, 마스터 권한자는 모든 잠금 해제가 사유와 함께 감사 추적되고, 제출용 Export 한글이 정상 출력된다. |
| **Core Value** | 외부 감사·인증 갱신 시 "시스템 이력이 곧 공식 증빙"임을 byte 단위로 보장한다. |

---

## Context Anchor

| 키 | 값 |
|----|-----|
| **WHY** | 연 1회 개정 시즌의 결과물이 인증 공식 증빙. 데이터 정합성·거버넌스 갭이 핵심 가치("시스템본=공식본")를 직접 위협하며, 시즌 중 오류는 다음 주기까지 회복 불가. |
| **WHO** | P1 문항관리부 담당자(primary, editor) · P2 분야별 심사위원(editor) · P3 마스터 권한자(approver+admin). |
| **RISK** | ① replica set 인프라 전환 영향 ② verbatim 회귀 ③ revision 로그 누락 ④ 공통문항 전파 누락/분야특이 설명 덮어쓰기 ⑤ Lock 우회. |
| **SUCCESS** | 이력 누락 0 · verbatim 불일치 0 · Lock 우회 0 · unlock 감사 충족 100% · 전파 시 분야특이 설명 보존 100% · Export 한글 깨짐 0 · 민감유형 editor 차단 100% · 화면 A 선택 영속 100%. |
| **SCOPE** | v1 P0 갭 8종(R-08/10/12/20/22/23/29 + R-06). v1.5(미리보기·ZIP·전파결과 UI·레이블·진행률 대시보드)와 v2+(검색·5년이력·ETL 순서)는 **비목표**. |

---

## 1. 배경 및 문제 정의

PRD §2·§5 참조. 기반 기능(Revision/Worklist/AuditLog 모델, `revisionState.js` 상태머신 `none→draft→review→final(locked)`, 권한 분기, Export 라우트, 프론트 RevisionPanel/DiffText/SideBySideItem/HistoryView)은 코드베이스에 존재한다.

본 Plan은 **이미 동작하는 기능의 신뢰 경계를 강화**하는 것이 목적이다. 신규 화면이나 신규 흐름을 추가하지 않으며, 회귀 방지를 최우선으로 한다.

## 2. 목표 / 비목표

### 목표 (Goals)
- v1 P0 갭 8종을 다음 개정 시즌 개시 전까지 해소한다.
- 기존 Phase 4~7 동작에 회귀를 발생시키지 않는다 (기존 테스트 그린 유지).
- 변경 모듈의 테스트 커버리지 ≥ 80%.

### 비목표 (Non-Goals)
- v1.5 P1 항목(verbatim 미리보기 UI, 분야별 ZIP Export, 전파 결과 확인 UI, 수정유형 레이블 명확화, 진행률 대시보드).
- v2+ 항목(화면 A 이전 단계 내재화, 중분류 순서/제공서비스 ETL, 검색 활성화, 5년 이력 마이그레이션).
- 신규 권한 역할 추가 (기존 조회/수정/승인/관리자 유지).

## 3. 요구사항 (P0 갭 8종 — 확정 결정 반영)

> 우선순위는 PRD §14 순서를 따른다. 각 항목에 Checkpoint 2 결정사항을 명시한다.

| # | ID | 요구사항 | 확정 접근 | 영향 파일(예상) |
|---|----|---------|-----------|----------------|
| G1 | R-22 | revision 로그 생성 실패 시 Item 업데이트 롤백 (이력 누락 방지) | **MongoDB replica set 전환 + `session.withTransaction()`**: PATCH 경로에서 Item 업데이트·Revision 생성·공통문항 전파를 단일 트랜잭션으로 원자화. 트랜잭션 실패 시 전체 롤백. | `server.js`(연결 옵션), `routes/items.js`, `routes/revisions.js`, `tests/setup.js`(`MongoMemoryReplSet`), 배포 문서 |
| G2 | R-12 | 수정사유 verbatim 보존 (자동요약 절대 금지) | **`raw_reason`(source of truth) + `reason_hash`(SHA-256) 컬럼 추가.** 입력 원문을 변환 없이 저장, `reason`은 `raw_reason` 값으로 채워 하위호환 유지. 마이그레이션: 기존 `reason`→`raw_reason` 복사. 읽기 시 해시 무결성 검증(불일치 경고 로그). | `models/Revision.js`, `routes/items.js:268`, `scripts/`(마이그레이션), export 3종(읽기 유지) |
| G3 | R-08/R-24 | 화면 A 개정대상 선택이 새로고침 후에도 화면 B에 유지 | **조사 우선(OQ-02)**: `FilterContext`가 서버 `Worklist`와 동기화되는지 확인 후, 선택을 Worklist 모델에 서버 영속화 + 프론트 load-on-mount. | `contexts/FilterContext.jsx`, `models/Worklist.js`, `routes/worklists.js`, 화면 A/B 컴포넌트 |
| G4 | R-20 | unlock은 admin만, 사유 필수, 감사로그 강제 | **무제한 허용 + 매번 사유 필수(없으면 400) + AuditLog 기록(트랜잭션 내 강제).** | `routes/revisions.js`(또는 items), `models/AuditLog.js`, `utils/revisionState.js` |
| G5 | R-23 | 잠금 체크 원자성 (TOCTOU 방지) | `find().lean()→check→update` 패턴을 **`findOneAndUpdate({_id, 'revision.locked': false}, …)` 조건부 원자 업데이트**로 교체 (트랜잭션과 병행). | `routes/items.js`, `routes/revisions.js`, `utils/revisionState.js` |
| G6 | R-10 | 민감 수정유형(신규문항·문항삭제·분야추가·분류체계 수정) editor 차단 | **프론트 비활성(회색)+'approver 전용' 툴팁 + 서버 403 이중 차단.** | `components/ItemModal.jsx`(수정유형 선택), `routes/items.js`(서버 검증), 권한 미들웨어 |
| G7 | R-29 | 공통문항 전파 시 분야특이 설명(field_specific_description) 보존 | 전파 로직이 `field_specific_description`를 **명시적으로 제외**하도록 보장 + 회귀 테스트. | `routes/items.js`(전파 로직), `models/Item.js` |
| G8 | R-06 | Export PDF 한글 폰트 번들 | PDF 생성기에 한글 폰트(Noto Sans KR 또는 Nanum Gothic) 번들·`registerFont` + CI 폰트 존재 검증 + E2E Export 테스트. | `utils/exportPdf.js`, `assets/`(폰트), CI 설정 |

## 4. 성공 기준 (Success Criteria — Do/Check에서 추적)

| SC | 기준 | 측정 방법 | 목표 |
|----|------|----------|------|
| SC-1 | revision 이력 누락 | 트랜잭션 실패 주입 테스트(TS-09): Item 변경 시 Revision 누락 0 | 0건 |
| SC-2 | verbatim 불일치 | TS-01/02: 입력 원문 vs `raw_reason` byte 동일, 해시 일치 | 0건 |
| SC-3 | Lock 우회 | TS-03/TS-11: final 후 PATCH 403, 동시요청 race에서 1건만 성공 | 0건 |
| SC-4 | unlock 감사 충족 | TS-04/05: 사유 없으면 400, 사유 포함 시 AuditLog 기록 | 100% |
| SC-5 | 전파 시 분야특이 설명 보존 | TS-06: 공통문항 설명 수정 후 `field_specific_description` 불변 | 100% |
| SC-6 | Export 한글 정상 | TS-08: PDF Export 후 한글 깨짐 없음 | 0건 |
| SC-7 | 민감유형 editor 차단 | TS-10: editor UI 비활성 + 서버 403 | 100% |
| SC-8 | 화면 A 선택 영속 | TS-07: 새로고침 후 선택 유지 | 100% |
| SC-9 | 회귀 방지 + 커버리지 | 기존 테스트 그린 유지, 변경 모듈 커버리지 | ≥80% |

## 5. 기술 결정사항 (Checkpoint 2 확정)

1. **트랜잭션 인프라**: MongoDB를 replica set으로 전환(개발=단일노드 RS `rs.initiate()`, 테스트=`MongoMemoryReplSet`, 배포=RS 구성). `session.withTransaction()`으로 PATCH·전파·이력·unlock을 원자화. → 가장 큰 리스크이자 SC-1·SC-3·SC-4의 기반.
2. **verbatim**: `raw_reason` source of truth + `reason_hash`(SHA-256). 기존 `reason` 유지(하위호환), 마이그레이션으로 기존값 복사. 저장 시 변환 금지.
3. **민감유형**: UI 비활성(회색)+툴팁 + 서버 403 이중 차단.
4. **unlock**: 무제한 허용, 매번 사유 필수, AuditLog 트랜잭션 내 강제 기록.

## 6. 리스크 및 대응

| # | 리스크 | 가능성 | 영향 | 대응 |
|---|--------|:------:|:----:|------|
| 1 | replica set 전환이 개발/CI/배포 전 환경에 영향 (가장 큰 리스크) | 높음 | 심각 | 단일노드 RS로 점진 전환, `tests/setup.js`를 `MongoMemoryReplSet`로 먼저 교체해 CI에서 검증, 배포 RS 구성 문서화, 롤백 절차 준비 |
| 2 | reason→raw_reason 마이그레이션 데이터 손상 | 중간 | 심각 | 마이그레이션 전 백업(`scripts/lib/backup.js`), 멱등 스크립트, dry-run + 카운트 검증 |
| 3 | 트랜잭션 도입으로 기존 비트랜잭션 경로 회귀 | 중간 | 높음 | 기존 테스트 그린 게이트, 트랜잭션 래핑은 PATCH·전파·unlock 경로로 한정 |
| 4 | 전파 로직 변경이 정상 전파까지 막음 | 중간 | 높음 | TS-06 회귀 테스트 + 정상 전파 테스트 동시 추가 |
| 5 | PDF 폰트 번들 누락이 배포에서만 재현 | 중간 | 높음 | CI에 폰트 존재·렌더 스모크 검증 단계 추가 |

## 7. 작업 분해 (권장 구현 순서)

> 의존성 기반 순서. G1(트랜잭션 기반)이 G4/G7의 원자성 전제.

1. **인프라 선행**: replica set 연결 옵션 + `tests/setup.js`→`MongoMemoryReplSet` 전환 → 기존 테스트 그린 확인 (G1 기반)
2. **G2 verbatim**: 스키마(`raw_reason`/`reason_hash`) + 쓰기 경로 + 마이그레이션 스크립트 + TS-01/02
3. **G1 트랜잭션 래핑**: PATCH(Item+Revision+전파) `withTransaction` + TS-09
4. **G5 TOCTOU**: `findOneAndUpdate` 원자 잠금 + TS-03/11
5. **G4 unlock**: 사유 필수 + AuditLog 강제(트랜잭션 내) + TS-04/05
6. **G7 전파 보존**: `field_specific_description` 제외 보장 + TS-06
7. **G6 민감유형**: 서버 403 + 프론트 비활성/툴팁 + TS-10
8. **G3 화면 A 영속화**: FilterContext↔Worklist 조사 후 영속화 + TS-07
9. **G8 Export 한글**: 폰트 번들 + CI 검증 + TS-08
10. **마무리**: 커버리지 측정(SC-9), 전체 회귀 테스트, 코드리뷰

## 8. 테스트 전략

PRD §7.3 Test Scenarios(TS-01~TS-12)를 그대로 채택. 각 갭은 최소 1개 BDD 테스트로 검증하며, 트랜잭션 롤백(TS-09)·동시성(TS-11)은 실패 주입/경쟁 시나리오로 작성. 기존 테스트(`revision-workflow.test.js`, `worklists.test.js`, `audit-log.test.js`, `export.test.js`)는 RS 전환 후 그린 유지가 게이트.

## 9. 미해결 질문 (Plan 단계 잔여 — Design/Do에서 해소)

| # | 질문 | 해소 시점 |
|---|------|----------|
| OQ-A | replica set 배포 토폴로지(단일노드 vs 3노드)와 운영 책임 주체 | Design 또는 배포 결정 시 |
| OQ-B | `FilterContext`가 현재 서버 Worklist와 동기화되는가, 메모리만인가 (G3 선행 조사) | G3 구현 전 (Design) |
| OQ-C | 과거 reason 데이터 규모와 마이그레이션 윈도우 | G2 마이그레이션 전 |
| OQ-D | 민감 수정유형 4종 목록을 코드 상수로 고정할지, 설정으로 둘지 | G6 구현 시 |

## 10. 다음 단계

```
/pdca design revision-workflow
```
→ 3가지 아키텍처 옵션(Minimal / Clean / Pragmatic)을 제시하고, 본 Plan의 8종 갭과 트랜잭션 도입을 어떻게 구조화할지 선택한다. Plan의 Context Anchor가 Design에 전파된다.
