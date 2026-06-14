# Design: revision-workflow — 문항 수정·개정 (v1 P0 갭 수정)

| 항목 | 값 |
|------|-----|
| Feature | revision-workflow |
| Phase | Design |
| 작성일 | 2026-06-14 |
| 아키텍처 | **Option C — 실용 균형 (횡단관심사 추출)** |
| Plan 참조 | `docs/01-plan/features/revision-workflow.plan.md` |
| PRD 참조 | `docs/00-pm/revision-workflow.prd.md` |
| 스코프 | v1 P0 갭 8종 (R-06/08/10/12/20/22/23/29) |

---

## Context Anchor

| 키 | 값 |
|----|-----|
| **WHY** | 연 1회 개정 시즌 결과물이 인증 공식 증빙. 시즌 중 오류는 다음 주기까지 회복 불가. "시스템본=공식본" 신뢰가 핵심. |
| **WHO** | P1 담당자(editor) · P2 심사위원(editor) · P3 마스터 권한자(approver+admin) |
| **RISK** | replica set 인프라 전환 · verbatim 회귀 · 이력 누락 · 전파 누락/덮어쓰기 · Lock 우회 |
| **SUCCESS** | 이력누락 0 · verbatim 불일치 0 · Lock 우회 0 · unlock 감사 100% · 분야특이 설명 보존 100% · Export 한글 깨짐 0 · 민감유형 차단 100% · 화면 A 영속 100% |
| **SCOPE** | v1 P0 갭 8종만 (v1.5/v2+ 비목표) |

---

## 1. Overview

기존 Phase 4~7 구현(routes 중심) 위에 **위험 횡단관심사(트랜잭션·verbatim·민감유형 가드)만 경계 모듈로 추출**한다. 라우트는 얇아지고 헬퍼를 호출하며, 이미 동작하는 코드의 재작성을 최소화해 회귀 위험을 낮춘다.

**현 상태 grounding**:
- `routes/items.js` 281줄 — 인라인 확장 시 300줄 룰 위반 → 추출 필수.
- `items.js:229` PATCH는 이미 `findOneAndUpdate({_id,'revision.locked':{$ne:true}})` 원자 조건부 업데이트 사용 → **G5(TOCTOU)는 PATCH 경로 충족**. transition 경로만 검증·확장.
- `services/` 레이어 부재.

## 2. 선택 아키텍처 (Option C) 및 근거

| 결정 | 근거 |
|------|------|
| 위험 부분만 모듈 추출 | 300줄 룰 충족 + Phase 4-7 회귀 위험 최소화 + 데드라인 적합 |
| 서비스 1개(`revisionTxn`)만 도입 | 전면 서비스/리포지토리 레이어(Option B)는 재작성 위험 과다. 트랜잭션 오케스트레이션만 응집 |
| 트랜잭션 = MongoDB replica set | Checkpoint 2 결정. ACID 보장으로 SC-1/3/4 기반 |

## 3. 모듈 구조

```
gui/backend/
├─ utils/withTransaction.js        (NEW) session.withTransaction 래퍼 + 재시도
├─ utils/reason.js                 (NEW) verbatim 저장 + SHA-256 해시/검증 (G2)
├─ constants/sensitiveEditTypes.js (NEW) 민감유형 상수 + assertEditTypesAllowed 가드 (G6)
├─ services/revisionTxn.js         (NEW) PATCH·unlock·전파 트랜잭션 오케스트레이션 (G1/G4/G7)
├─ routes/items.js                 (MOD, 슬림화) revisionTxn 호출, findOneAndUpdate 유지
├─ routes/revisions.js             (MOD) unlock 사유필수+감사, transition TOCTOU 검증 (G4/G5)
├─ models/Revision.js              (MOD) raw_reason + reason_hash 추가 (G2)
├─ utils/exportPdf.js              (MOD) 한글 폰트 registerFont (G8)
├─ assets/fonts/NotoSansKR-Regular.ttf (기존 번들) 한글 폰트 (G8 — 이미 구현/테스트됨)
├─ tests/setup.js                  (MOD) MongoMemoryReplSet 전환 (G1)
└─ scripts/migrate-reason.js       (NEW) 기존 reason→raw_reason 복사 (G2)

gui/frontend/src/
├─ components/RevisionPanel.jsx    (MOD) 민감유형 비활성+툴팁 (G6) — 수정유형 UI 위치
└─ contexts/FilterContext.jsx      (MOD) 화면 A 선택 localStorage 영속화 (G3)
```

> 정정(Check 반영): ① 수정유형 UI는 ItemModal이 아닌 RevisionPanel에 존재 → 구현은 RevisionPanel 수정.
> ② 한글 폰트는 NotoSansKR-Regular.ttf(기존 번들). ③ 화면 A 영속은 서버 Worklist가 아닌 localStorage(Checkpoint 4 결정).

각 파일은 300줄 이하·함수 50줄 이하 유지. `revisionTxn.js`가 커지면 G1/G4/G7 함수별로 추가 분리.

## 4. 데이터 모델 변경 (G2)

`models/Revision.js`에 필드 추가 (불변 — 기존 필드 유지):

```js
raw_reason:  { type: String, default: '' },  // source of truth — 변환 없이 저장
reason_hash: { type: String, default: '' },  // SHA-256(raw_reason)
// reason 필드 유지 = raw_reason 값 (export/프론트 하위호환)
```

- **저장 규칙**: 입력 원문을 trim·요약·정규화 **없이** 그대로 `raw_reason`에 저장. `reason = raw_reason`로 동기화.
- **무결성**: 읽기 시 `verifyReason()`로 `SHA-256(raw_reason) === reason_hash` 검증, 불일치 시 경고 로그(운영 감지).
- **마이그레이션**(`scripts/migrate-reason.js`): 기존 레코드의 `reason`을 `raw_reason`에 복사하고 `reason_hash` 계산. 멱등(이미 raw_reason 있으면 skip), dry-run 카운트 출력, 실행 전 `scripts/lib/backup.js` 백업.

## 5. 트랜잭션 설계 (G1)

### 5.1 인프라
- 개발: 단일노드 replica set(`rs.initiate()`).
- 테스트: `tests/setup.js`를 `MongoMemoryReplSet`로 전환.
- 배포: replica set 구성(토폴로지는 OQ-A).

### 5.2 `utils/withTransaction.js`
```js
const mongoose = require('mongoose');
// Runs fn(session) inside a transaction; withTransaction auto-retries transient errors.
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => { result = await fn(session); });
    return result;
  } finally {
    session.endSession();
  }
}
module.exports = { withTransaction };
```

### 5.3 `services/revisionTxn.js` — 오케스트레이션
- `applyItemEdit({ id, updates, editTypes, rawReason, user }, role)`:
  1. `assertEditTypesAllowed(editTypes, role)` (G6, 트랜잭션 밖 선검증)
  2. `withTransaction(session ⇒ { ... })` 내부:
     - `Item.findOneAndUpdate({_id:id,'revision.locked':{$ne:true}}, $set updates, {session,new:true})` → null이면 잠금/부재 → throw(403/404) → 롤백
     - `Revision.create([{...before/after, ...buildReasonFields(rawReason), edit_types, user}], {session})`
     - 공통문항이면 전파(§8, session 전달)
  - 어느 단계든 throw → 전체 롤백 (이력 누락·전파 누락 불가) → SC-1
- `unlockItem({ id, rawReason, user })` (admin): 사유 없으면 호출 전 400. `withTransaction`: `locked=false` 업데이트 + `AuditLog.create([{action:'unlock', item, user, reason: rawReason}],{session})` → SC-4

## 6. API 변경

| 엔드포인트 | 변경 | 에러 |
|-----------|------|------|
| `PATCH /api/items/:id` | revisionTxn.applyItemEdit 호출. 잠금 시 403, 부재 404 | 403(locked)·404·422(editTypes 빈값) |
| `POST .../transition` (revisions) | review→final 등 상태전환을 조건부 원자 업데이트로 검증 (G5) | 409(동시성)·403 |
| `POST .../unlock` (admin) | 사유 필수(400), AuditLog 강제, 무제한 허용 | 400(no reason)·403(non-admin) |
| 민감 editTypes 포함 PATCH | non-approver → 403 (G6) | 403 |

## 7. 권한·민감유형 가드 (G6)

`constants/sensitiveEditTypes.js`:
```js
// codes MUST match edit_type_codes collection — verify actual values before merge (OQ-D)
const SENSITIVE_EDIT_TYPES = ['신규문항', '문항삭제', '분야추가', '문항분류체계 수정'];
function assertEditTypesAllowed(editTypes = [], role) {
  if (role === 'approver' || role === 'admin') return;
  const blocked = editTypes.filter(t => SENSITIVE_EDIT_TYPES.includes(t));
  if (blocked.length) { const e = new Error(`Sensitive edit types require approver: ${blocked.join(', ')}`); e.status = 403; throw e; }
}
```
- **서버**: applyItemEdit 진입 시 선검증 → 403.
- **프론트**(`RevisionPanel.jsx`): non-approver에게 민감 4종 체크박스 `disabled`(회색) + `title="approver 전용"` 툴팁. 클라 우회해도 서버가 차단. (수정유형 UI는 ItemModal이 아닌 RevisionPanel에 위치)

## 8. 공통문항 전파 보존 (G7)

전파는 `common_key`(중분류+일련번호 last-6) 동일 문항 대상. 전파 `$set`은 **공유 필드만 허용 목록**으로 구성하고 `field_specific_description`(분야특이 설명)은 **명시적 제외**:
```js
// 전파 대상(공유 필드)은 question/description/score 3개 (구현: COMMON_SHARED_FIELDS).
const COMMON_SHARED_FIELDS = ['question', 'description', 'score'];
// na_available·classification·field_specific_description은 분야별로 다를 수 있어 전파 제외.
// (na_available 전파 금지는 common-items.test.js가 강제. classification 전파는 추후 도메인 결정.)
// 별도로 revision before/after 스냅샷은 5개 필드(SNAPSHOT_FIELDS)를 기록.
```
- 전파도 동일 트랜잭션(session) 내에서 수행 → 전파 실패 시 전체 롤백.
- 회귀 테스트 TS-06으로 분야특이 설명 불변 검증.

## 9. Export 한글 폰트 (G8)

`utils/exportPdf.js`: pdfkit 문서에 `doc.registerFont('KR', path.join(__dirname,'../assets/fonts/NanumGothic.ttf'))` 후 `.font('KR')` 적용. 폰트 파일은 `assets/fonts/`에 번들. CI에 폰트 존재 검증 + E2E Export 스모크(TS-08).

## 10. 화면 A 영속화 (G3)

- **OQ-B 조사 결과(해소)**: `FilterContext.jsx`는 선택을 `_id` 기반 메모리(useState)로만 보관 → 새로고침 시 소실. 서버 `Worklist`(item_number 기반)는 존재하나 미연동. 연동 시 `_id↔item_number` 매핑·선택 객체 재조회 필요.
- **설계(확정, Checkpoint 4)**: 화면 A 선택(selectedItemIds/Objects)을 **localStorage**에 저장/복원하여 새로고침 후 유지(SC-8). 서버 Worklist 연동(멀티디바이스·서버 단일원천)은 v1.5로 이연.

## 11. Implementation Guide

### 11.1 구현 순서 (의존성 기반)
1. 인프라+데이터: withTransaction · tests/setup RS · Revision 스키마 · reason.js · migrate-reason → 기존 테스트 그린
2. 트랜잭션 오케스트레이션: revisionTxn.applyItemEdit · items.js PATCH 리팩터 · transition TOCTOU 검증 (G1/G5/G7)
3. 거버넌스: unlock(사유+감사) · sensitiveEditTypes(서버 403 + 프론트 비활성) (G4/G6)
4. 사용성: 화면 A 영속화(G3) · exportPdf 한글(G8)
5. 마무리: 커버리지(≥80%)·전체 회귀·코드리뷰

### 11.2 핵심 파일
§3 모듈 구조 참조. NEW 6개 / MOD 7개.

### 11.3 Session Guide (Module Map)

| 모듈 키 | 범위 | 갭 | 핵심 파일 | 의존 |
|---------|------|----|----------|------|
| `infra-data` | replica set 전환 + verbatim 스키마/헬퍼 + 마이그레이션 | G2(기반) | withTransaction.js, reason.js, models/Revision.js, tests/setup.js, scripts/migrate-reason.js | — |
| `txn` | 트랜잭션 오케스트레이션 + PATCH 리팩터 + 전파 보존 + TOCTOU | G1, G5, G7 | services/revisionTxn.js, routes/items.js | infra-data |
| `governance` | unlock 사유·감사 + 민감유형 가드(서버+프론트) | G4, G6 | routes/revisions.js, constants/sensitiveEditTypes.js, AuditLog, RevisionPanel.jsx | txn |
| `ux` | 화면 A 영속화(localStorage) + Export 한글(기존완료) | G3, G8 | FilterContext.jsx, exportPdf.js, assets/fonts | infra-data |
| `finalize` | 커버리지·회귀·리뷰 | SC-9 | 전체 테스트 | 전부 |

**권장 세션 분할** (멀티 세션 시):
```
/pdca do revision-workflow --scope infra-data
/pdca do revision-workflow --scope txn
/pdca do revision-workflow --scope governance
/pdca do revision-workflow --scope ux
/pdca do revision-workflow --scope finalize
```

## 12. 테스트 설계 (PRD §7.3 매핑)

| 갭 | 테스트 | 유형 |
|----|--------|------|
| G2 | TS-01(verbatim byte 동일), TS-02(요약 없음·해시 일치) | 단위/통합 |
| G1 | TS-09(revision 실패 시 PATCH 롤백 — 실패 주입) | 통합(트랜잭션) |
| G5 | TS-03(final 후 403), TS-11(동시요청 race 1건만 성공) | 통합/동시성 |
| G4 | TS-04(사유 없으면 400), TS-05(unlock 감사로그 기록) | 통합 |
| G7 | TS-06(전파 시 분야특이 설명 불변) | 통합 |
| G6 | TS-10(editor 민감유형 UI 비활성 + 서버 403) | 단위/통합 |
| G3 | TS-07(새로고침 후 화면 A 선택 유지) | E2E |
| G8 | TS-08(PDF 한글 정상) | E2E/스모크 |

기존 테스트 4종(revision-workflow/worklists/audit-log/export)은 RS 전환 후 그린 유지가 게이트.

## 13. 리스크 및 마이그레이션 전략

| 리스크 | 대응 |
|--------|------|
| replica set 전환이 전 환경 영향 | tests/setup RS 먼저 전환→CI 검증, 단일노드 RS 점진, 배포 RS 문서화·롤백 절차 |
| reason 마이그레이션 손상 | 사전 백업 + 멱등 스크립트 + dry-run 카운트 |
| 트랜잭션 도입 회귀 | 래핑 범위를 PATCH·전파·unlock로 한정, 기존 테스트 그린 게이트 |
| 전파 변경이 정상 전파 차단 | 정상 전파 + TS-06 회귀 동시 작성 |

## 14. 미해결 질문

| # | 질문 | 해소 시점 |
|---|------|----------|
| OQ-A | replica set 배포 토폴로지(단일 vs 3노드)·운영 주체 | 배포 결정/`infra-data` |
| OQ-B | FilterContext ↔ 서버 Worklist 동기화 현황 | `ux` 착수 전 |
| OQ-C | 기존 reason 데이터 규모·마이그레이션 윈도우 | `infra-data` 마이그레이션 전 |
| OQ-D | sensitiveEditTypes 코드값이 edit_type_codes 실제 값과 일치하는지 | `governance` 구현 시 |

## 15. 다음 단계

```
/pdca do revision-workflow --scope infra-data    # 권장: 모듈 단위 시작
# 또는
/pdca do revision-workflow                        # 전체 범위
```
