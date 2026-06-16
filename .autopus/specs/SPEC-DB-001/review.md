# SPEC-DB-001 · 리뷰 (셀프 · 단일 프로바이더)

> Reviewer: Claude (단일/무료). Date: 2026-06-16. Strategy: 비판적 단일 검토.
> ⚠️ **셀프리뷰 한계** — 저자=리뷰어라 편향 가능. 외부 멀티프로바이더(codex/gemini)는 과금 회피로 미실행.
> 외부 교차검증이 필요하면 provider 직접 호출 또는 `auto spec review`(바이너리 확보 시) 권장.

## Verdict: APPROVED · Variant A 확정 (G-D4 수용 2026-06-16)

설계 방향(PostgreSQL 정규화 Variant A)은 타당하고 근거가 실측에 부합. 초기 판정 REVISE의 F1–F7을 SPEC
4파일에 반영 완료. **G-D4(공통 lock 동작 변경)** 는 사용자가 Variant A 수용(2026-06-16) → `status: approved`.

## Findings (반영 완료)

| ID | Sev | 파일 | 이슈 | 조치 |
|---|---|---|---|---|
| F1 | **High** | spec REQ-6 · plan T2 · acc AC-6 | ETL 소스가 seed인 flat_v2.json으로 기술 → **live Mongo의 6개 부가 컬렉션(개정이력·감사·사용자·워크리스트·수정유형·import메타) + lock/rev 상태 누락**. "전체 정보" 이행 불완전 | 소스=live Mongo 7컬렉션, REQ-6 확장·T2.7·T3.6·AC-6 추가 |
| F2 | Med | spec REQ-13(신규)·acc AC-16·research D6 | Variant A에서 **단일 PATCH가 공유 텍스트 직접 변경 시 타 분야 오염**. 공유 vs override 경계 미규정 | 단일=`*_override`, 공유전파=`applyCommonEdit` 전용으로 명문화 |
| F3 | Med | acc AC-1/AC-5 | AC-1 행수 9984 vs AC-5 중복차단 충돌(`21.405.120/2025` 미해소 시 9983) | AC-1 전제에 "23.405.120으로 해소" 명시 |
| F4 | Med | acc AC-7 | 키워드 검색 "±0 parity"는 토크나이저 차이로 비현실 | canonical 쿼리셋(기대 ID)+재현율 기준으로 완화 |
| F5 | Low | plan T8.1 | pg-mem은 generated column·tsvector·pg_trgm 미지원 가능 | testcontainers(ephemeral PG) 우선 |
| F6 | Low | plan T2.5 | sub_category 93→10코드 매핑 출처 불명 | `pdf/classification_map.json` 사용 명시 |
| F7 | Low | plan Phase 4 | 미커밋 common-item-bulk-ui와 동일 라우트 충돌 위험 | 선행 커밋·안정화 조건 추가 |

## 게이트 G-D4 — 해소됨 (2026-06-16)

- 사용자가 **Variant A + all-or-nothing lock(+admin override)** 수용. 동작 변경은 구현 시 CHANGELOG·AC-9로
  고지. → SPEC `status: approved`. (Variant B 회귀 옵션 폐기.)

## 강점 (보존)
- 14× 공통문항 중복 제거(공유 1행) = 이행의 핵심 가치를 정확히 겨냥.
- 네이티브 ACID로 replica-set 의존 제거, 제약조건으로 기존 무결성 결함(빈 분류·C/score 모순·중복키) 차단.
- Must oracle이 구체 수치(6566/9984, SQLSTATE 23514/23505)로 구조검증 회피 — 검증가능성 양호.

## 다음 단계
1. ✅ G-D4 수용(Variant A) → status approved 완료.
2. 승인 후 `auto`/provider 확보되면 외부 멀티프로바이더 교차검증(선택).
3. 구현 착수: Phase 0(인프라) → 8(테스트 이행).
