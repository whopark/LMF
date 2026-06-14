# PRD: yearly-tracking — 문항 연도별 추적 (화면 B)

> **문서 성격**: 이 PRD는 그린필드 신규 기획서가 아닙니다. Phase 5에서 일부 구현된
> 연도별 추적 기능(HistoryView, CompareView, TrackView, changes.js)을 제품 관점으로
> 공식화하고, §4 요구사항 대비 식별된 갭과 다음 개선 기회를 정의하는 문서입니다.
> "구현됨" 항목은 2026-06-14 기준 코드베이스를 grounding 기준으로 작성했습니다.
> 직전 사이클 revision-workflow PRD와 동일한 톤·구조를 사용하되 §4 연도별 추적에 특화합니다.
>
> **경계**: revision-workflow PRD에서 이미 해소된 항목(화면 A localStorage 영속화,
> verbatim raw_reason 저장 요구, DiffText 존재, 개정 트랜잭션, 잠금/REVISED)은 중복
> 기술하지 않습니다. 본 PRD는 연도별 비교·조회·Export 특화 기능에 집중합니다.

---

## 연락처

| 역할 | 이름 | 비고 |
|------|------|------|
| PM / 문서 작성 | whopark | whopark@gmail.com |
| 구현 주체 | 개발팀 (LMF) | gui/backend/routes/changes.js + gui/frontend/src/components/HistoryView.jsx 등 |
| 도메인 전문가 | 1차 전산 TFT 위원단 | 2026-06-09 워크숍 참여자 |
| 승인 | 마스터 권한자 | 임원급 최규원 등 |

---

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 심사위원은 작년 대비 무엇이 어떻게 바뀌었는지 색상으로 즉시 파악하고 싶지만, 현재 1:1 ComparisonTable은 문항(question)·설명(description) 2필드만 비교하며 배점·수정유형·수정사유가 생략되어 있다. 화면 A에서 선택한 개정대상이 화면 B 연도별 추적에 자동으로 필터링되지 않고, 분야별 Export는 단건만 가능해 증빙 패키지 생성에 수작업이 남아 있다. 가장 심각한 문제는 SideBySideItem이 보여주는 수정사유가 Revision.reason verbatim이 아닌 LLM 자동생성 텍스트여서, 공식 이력과 화면 표시가 서로 다른 소스를 참조한다. |
| **Solution** | KSLM 심사점검표 도메인 정확 diff(4필드 → 전 필드 확장 + 한글 공백/∙/개행 정규화) + verbatim 수정사유 단일 파이프라인(LLM 버튼을 초안 제안으로 격하·편집·저장 후 Revision.reason 표시) + 화면 A selectedItemObjects → 화면 B 자동 필터 연동 + 분야별 ZIP Export를 통해 연도별 추적 화면을 인증갱신 증빙의 단일 진실 소스로 만든다. |
| **Function·UX Effect** | 좌우 색상 대비표(삭제 빨강 취소선·추가 초록, 6필드 커버), 변경문항 전용 필터 목록, 1:1 비교 PDF 출력(좌우 레이아웃), 과거 5년 이력 + DELETED 부활 탐지 강조, 화면 A→B 자동 필터 로드, verbatim 수정사유 표시, 분야별 Excel·Word·PDF + 분야 ZIP 일괄 다운로드로 담당자·심사위원·마스터 권한자가 역할에 맞는 화면에서 한 사이클을 완결한다. |
| **Core Value** | "증빙 패키지 생성 2일 → 2시간" — KSLM 도메인 정확 diff + 한글 분야별 Export + verbatim 수정사유 연동으로 인증갱신 증빙 산출에서 수기 병행을 제거하고 감사 대응력을 보장한다. |

**현재 구현 상태 (2026-06-14 기준, Phase 5 완료 후)**:
- HistoryView(CompareView + TrackView), SideBySideItem, DiffText, changes.js GET /api/changes/:year 구현됨.
- 아래 §5에서 갭 항목을 구현됨/부분/갭 세 단계로 별도 표기함.

---

## 2. 배경 (Background)

### 2.1 왜 지금인가

- **연 1회 고정 개정 사이클과 증빙 의무**: 인증갱신 시 전년 대비 변경 내역을 분야별로 문서화하여 제출해야 한다. 현재 증빙 패키지 생성에 2일 이상 소요되며, 수기 정리 오류가 공식 제출본에 포함될 위험이 있다.
- **화면 B 구현 완료 후 드러난 갭**: Phase 5에서 HistoryView가 배포되었으나 실사용 과정에서 ① 수정사유 LLM 자동생성이 verbatim 입력을 덮어쓸 위험, ② 5년 데이터 실존 미검증, ③ 화면 A→B 자동 연동 부재, ④ 분야별 ZIP 없음, ⑤ ComparisonTable이 2필드만 비교 등 §4 요구사항 대비 갭이 명확히 드러났다.
- **감사 대응 리스크 증가**: changes.js GET /api/changes/:year에 requireAuth 미들웨어가 없어 인증 없이 연도별 diff 데이터가 노출된다. export.js는 requireAuth('editor')가 적용된 것과 보안 정책이 불일치한다.
- **TFT 워크숍 결과(2026-06-09)**: §4 요구사항 3종(4-1 좌우비교·색상강조, 4-2 1:1/5년이력, 4-3 화면A→B·verbatim·분야별Export)이 확정 사양으로 합의되었다.

### 2.2 무엇이 바뀌었나

- Phase 5 이전: HistoryView 없음, changes.js 없음. 연도별 비교는 수기 엑셀.
- Phase 5 완료: HistoryView·SideBySideItem·DiffText·changes.js 기본 구현됨. 화면 A localStorage 영속화 완료(FilterContext.jsx G3 코드).
- Phase 5 이후 갭: SideBySideItem LLM 수정사유(Revision.reason과 별도 소스), ComparisonTable 2필드 한정, 화면 A→B 자동 필터 미연동, 분야별 ZIP 미구현, changes.js 인증 없음, 5년 데이터 실존 미확인.

---

## 3. 시장 세그먼트 및 ICP

### 3.1 운영 규모 (상용 TAM/SAM/SOM 대체)

| 계층 | 정의 | 규모 추정 |
|------|------|-----------|
| **전체 범위 (TAM)** | KSLM 인증 검사실 × 분야 수 | 검사실 380~450개 × 13분야 = 약 5,000~5,850 검사실-분야 |
| **접근 범위 (SAM)** | 연도별 추적 기능을 사용하는 심사 참여 검사실 + 개정대상 문항 | 1:1 비교 3,000~10,000 문항-뷰/시즌, 5년 이력 300~2,000 문항-뷰/시즌 (DELETED 조회 30~40%), 분야별 Export 47~65회/시즌 |
| **운영 범위 (SOM)** | 화면 B 실제 활성 사용자 (연 2~3개월 시즌) | 담당자 2~5명 + 심사위원 30~50명 + 마스터 3~5명 = 35~60명. Export 결함은 1:N(45~450 검사실) 파급. |

### 3.2 ICP (이상적 사용자 프로파일)

| 속성 | 내용 |
|------|------|
| **기관 유형** | KSLM/LMF 계열 인증심사 운영 기관 |
| **팀 규모** | 문항관리부 2~5명 + 분야별 심사위원 30~50명 |
| **주요 역할** | 담당자 P1 (Export·증빙 조율), 심사위원 P2 (색상 비교·수정), 마스터 P3 (변경 규모 파악·승인) |
| **핵심 JTBD** | 작년 대비 변경된 문항을 색상으로 즉시 파악하고, 5년 변천을 추적하며, verbatim 수정사유 포함 분야별 증빙을 즉시 Export한다 |
| **핵심 고통점** | 수정사유 소스 이중성, 과거 5년 데이터 실존 미검증, 화면 A→B 자동 필터 없음, 분야별 ZIP 없음, 1:1 비교에 배점·수정유형·수정사유 생략 |
| **구매 의사결정** | 기관 내 예산 자체 집행 (내재화 6/7 기준 우세) |
| **성공 지표** | 증빙 패키지 생성 시간 ≤30분/분야, verbatim 입력률 ≥95%, Export 오류율 0, 5년 데이터 완결성, 사용자 만족도 ≥4.0 |

### 3.3 Beachhead 세그먼트 분석 (Geoffrey Moore)

#### 후보 세그먼트 스코어링 (1~5점)

| 세그먼트 | 타는 고통 | 지불 의사 | 점유 가능성 | 추천 잠재력 | 합계 |
|----------|-----------|-----------|-------------|-------------|------|
| **검사실운영** (변동 연 10~30건, 공통문항 비중 최고) | 5 | 5 | 5 | 5 | **20** |
| **임상화학** (일반+요경검, 분야특이 설명·배점 복잡) | 5 | 5 | 5 | 4 | **19** |
| 종합검증 (공통문항 cross-분야, 중간 변동) | 4 | 5 | 5 | 4 | 18 |
| 수혈의학 (중간 변동, 핵심문항 비중 높음) | 4 | 5 | 5 | 3 | 17 |
| 유세포·세포유전 (저변동, 연 1~5건) | 2 | 4 | 5 | 2 | 13 |

**선정 Beachhead**: **검사실운영 + 임상화학** (고변동 분야, verbatim·5년이력·ZIP 시나리오 모두 커버)

#### 90일 도입 계획 (기관 내 롤아웃 기준)

| 기간 | 활동 |
|------|------|
| Day 0 | DB 연도별 카운트 쿼리로 5년 데이터 실존 검증, changes.js requireAuth 1줄 추가 |
| Week 1~2 | 검사실운영·임상화학 담당자 대상 P0 갭 수정 버전 파일럿 — 수정사유 verbatim 단일화, 화면 A→B 필터 연동 |
| Week 3~4 | 1:1 비교 PDF(좌우 레이아웃) + ComparisonTable 전 필드 확장 검증 |
| Week 5~6 | 분야별 ZIP Export 배포, 5년 이력 DELETED 강조 스타일 추가 |
| Week 7~9 | 전 분야 심사위원 온보딩 트레이닝 (역할별 2시간 세션) |
| Week 10~12 | 실사용 모니터링, verbatim 입력률·Export 오류율 KPI 측정, 이슈 핫픽스 |

### 3.4 GTM — 기관 내 롤아웃 전략

**채널**: 기관 내 전산 공문 + TFT 워크숍 후속 발표 + 역할별 온보딩 세션

**메시지 (역할별)**:
- 담당자: "분야별 증빙 패키지를 클릭 몇 번으로 즉시 Export합니다. verbatim 수정사유가 그대로 포함됩니다."
- 심사위원: "작년 문항과 올해 수정안을 색상(빨강 취소선·초록 추가)으로 나란히 보고, 5년 이력에서 과거 삭제문항 부활 여부까지 확인하세요."
- 마스터 권한자: "분야별 변경 건수 요약 + DELETED 강조로 5분 안에 변경 규모를 파악하고 분야 일괄 최종전이를 실행하세요."

---

## 4. 페르소나 3종 (연도별 추적 맥락)

### P2. 박진우 — 분야별 심사위원 (Primary Persona, 연도별 추적)

| 항목 | 내용 |
|------|------|
| 역할 | 담당 분야 문항 내용·설명 수정 제안, 전년 대비 비교 검토, 수정사유 확인 |
| 접속 빈도 | 개정 시즌 집중 (주 3~5회), 화면 B 연도별 추적 주 사용자 |
| 연령·배경 | 45~60세 임상교수, PC 친숙도 중간 |
| 시스템 역할 | editor |
| 핵심 JTBD | "작년 대비 무엇이 어떻게 바뀌었는지 색상으로 즉시 파악하고, 필요한 항목만 수정하며, 과거 삭제문항이 부활했는지 5년 이력으로 확인한다" |
| 주요 고통점 | ① 변경된 문항만 보기 필터 없음 — 전체 목록 클릭 탐색 필요 ② 1:1 비교에 배점·수정유형·수정사유 생략 ③ 5년 timeline에 연도간 diff 없음 ④ LLM 수정사유 버튼이 verbatim 이력과 다른 것을 구분 못함 |
| 핵심 인사이트 | 5년 이력의 진짜 목적 = 과거 삭제문항 부활 여부 확인. DELETED 추적이 5년 타임라인의 핵심 사용 시나리오. |
| 성공 기준 | 변경문항 전용 필터 목록, 1:1 ComparisonTable에 배점·수정유형·수정사유 추가, DELETED 연도 시각적 강조 |

### P1. 이수현 — 문항관리부 담당자 (Secondary Persona, 연도별 추적)

| 항목 | 내용 |
|------|------|
| 역할 | 전체 개정 프로세스 조율, 분야별 증빙 Export·제출, 화면 A→B 전체 흐름 관리 |
| 접속 빈도 | 개정 시즌 중 매일, 시즌 외 월 2~3회 |
| 시스템 역할 | editor (일부 approver 위임) |
| 핵심 JTBD | "분야별 증빙 패키지(verbatim 수정사유 포함)를 인증 마감일 전에 오류 없이 제출한다" |
| 주요 고통점 | ① LLM 수정사유가 입력한 수정사유를 덮어쓸 위험 (치명적) ② 분야별 단건 Export만 가능, ZIP 없어 분야 수만큼 반복 ③ 화면 B에서 바로 Export 연결 안됨 |
| 핵심 인사이트 | PDF보다 Word 중시 — 인증원 제출 시 추가 코멘트 삽입 관행. Word + PDF 동시 필요. |
| 성공 기준 | verbatim 수정사유 Export 일치, 분야별 ZIP 1클릭, Word + PDF 동시 다운로드 |

### P3. 최규원 — 마스터 권한자 (Approver·Admin, 연도별 추적)

| 항목 | 내용 |
|------|------|
| 역할 | 분야별 변경 규모 파악 후 승인, 릴리즈 전 게이트, 분야 일괄 최종전이 |
| 접속 빈도 | 개정 시즌 월 2~4회 (집중 검토 기간 주 1~2회), PC 친숙도 낮음 |
| 시스템 역할 | approver + admin |
| 핵심 JTBD | "분야별 변경 규모를 5분 내 파악하고 최종전이를 실행하며, revisions.pdf가 좌우 레이아웃으로 나와 심사에 제출 가능해야 한다" |
| 주요 고통점 | ① 분야간 변경 요약 대시보드 없음 ② 최종전이 버튼이 깊숙이 숨겨짐 ③ revisions.pdf가 1:1 좌우 레이아웃 아닌 목록형 |
| 핵심 인사이트 | 화면 B를 릴리즈 전 게이트로 인식. 승인 전 분야별 변경 요약이 가장 중요한 UX. |
| 성공 기준 | 분야별 변경 요약 집계(신규/수정/삭제 건수), revisions.pdf 좌우 레이아웃, 분야 일괄 최종전이 |

---

## 5. 핵심 요구사항

> 각 요구사항에 구현 상태를 표기한다: **구현됨** / **부분** / **갭**
>
> grounding 출처: changes.js, HistoryView.jsx, SideBySideItem.jsx, ComparisonTable 함수,
> FilterContext.jsx, export.js, exportPdf.js (2026-06-14 코드베이스)

### 5.1 좌우 대비 변경비교표 + 색상 강조 — §4-1

| # | 요구사항 | 상태 | 코드 근거 / 갭 상세 |
|---|----------|------|---------------------|
| R-01 | 좌우 side-by-side 변경비교표 렌더링 (이전 연도 좌측·현재 연도 우측) | **구현됨** | SideBySideItem + CompareView 존재 |
| R-02 | 변경 부분 색상 강조 — 삭제 빨강 취소선, 추가 초록 | **구현됨** | DiffText.jsx 단어 단위 diff, sbs-text-removed/added CSS |
| R-03 | diff 대상 필드: 질문(question) / 설명(description) | **구현됨** | buildDiffLines + ComparisonTable DiffText 적용 |
| R-04 | diff 대상 필드: 배점(score) / 문항유형(classification) | **부분** | buildDiffLines에 score·item_type 포함되나 **DiffText 미적용** — 변경 값만 단순 표시 (갭: DiffText 인라인 색상 없음) |
| R-05 | diff 대상 필드: 분야특이 설명(field_specific_description) / 해당없음(na_available) | **갭** | itemSnapshot·buildDiffLines·detectChanges 어디에도 없음 |
| R-06 | 변경된 문항만 보기 필터 목록 (MODIFIED/NEW/DELETED 유형별) | **부분** | CompareView 집계 숫자(신규/수정/삭제 건수)는 표시됨. **문항 유형별 필터 목록 클릭 기능 없음** (갭) |
| R-07 | 한글 공백·∙ 기호·개행 차이로 인한 diff 오탐 방지 (정규화 레이어) | **갭** | detectChanges/DiffText에 한글 정규화 없음. 공백 1개 차이도 MODIFIED로 분류 가능 |
| R-08 | changes.js GET /api/changes/:year 인증(requireAuth) 적용 | **갭** | changes.js 라우터에 requireAuth 미들웨어 없음. export.js는 requireAuth('editor') 적용 — 보안 불일치 |

### 5.2 1:1 비교 및 과거 5년 이력 — §4-2

| # | 요구사항 | 상태 | 코드 근거 / 갭 상세 |
|---|----------|------|---------------------|
| R-09 | 1:1 비교 — 직전 연도 vs 최신 연도 (좌우 ComparisonTable) | **구현됨** | TrackView 내 ComparisonTable(latest, previous). sortedItems[0]=latest, sortedItems[1]=previous |
| R-10 | 1:1 비교 ComparisonTable 필드: 질문·설명 DiffText | **구현됨** | ComparisonTable DiffText 적용됨 |
| R-11 | 1:1 비교 ComparisonTable 필드: 배점·수정유형·수정사유 추가 | **갭** | ComparisonTable에 score·classification·revision reason 없음. R-03에서 질문·설명만 확인됨 |
| R-12 | 1:1 비교 PDF 출력 — 좌우 레이아웃 (직전 연도 / 최신 연도 나란히) | **갭** | revisions.pdf는 목록형(buildRevisionsDocx 기반). 1:1 좌우 레이아웃 PDF 미구현 |
| R-13 | 과거 5년 이력 타임라인 UI (연도 클릭 → 해당 연도 문항 내용 표시) | **부분** | TrackView '5년 이력' 버튼 + sortedItems 나열 존재. **실제 5년(2022~2026) 데이터 실존 미검증** (갭: A1 최고 우선순위 가정) |
| R-14 | 5년 타임라인에서 연도간 diff 강조 (각 연도 변경 내용 색상 표시) | **갭** | timeline 모드는 history-entry 카드 나열만. 연도간 DiffText 없음 |
| R-15 | 5년 타임라인에서 DELETED 연도 시각적 강조 (삭제문항 부활 탐지) | **갭** | DELETED 타입 표시 없음. sortedItems에 삭제 연도 항목 미포함 (changes.js 기반 데이터와 분리) |
| R-16 | 데이터 없는 연도 "데이터 없음 / 해당 연도 미보유" UX 명시 | **갭** | 빈 sortedItems면 "문항 번호를 선택하세요" 플레이스홀더만 표시. 데이터 보유 연도 범위 안내 없음 |

### 5.3 화면 A→B 연동·verbatim 수정사유·분야별 Export — §4-3

| # | 요구사항 | 상태 | 코드 근거 / 갭 상세 |
|---|----------|------|---------------------|
| R-17 | 화면 A 선택(selectedItemObjects) → 화면 B CompareView 자동 필터 로드 | **갭** | FilterContext에 selectedItemObjects 존재하나 CompareView에 item_number 필터 전달 로직 없음. 두 뷰가 단절됨 |
| R-18 | 화면 B TrackView에서 직접 개정(RevisionPanel 병치) | **구현됨** | TrackView 내 RevisionPanel 컴포넌트 존재 (1:1 비교 모드에서 우측 RevisionPanel 렌더링) |
| R-19 | SideBySideItem 수정사유 표시 — verbatim Revision.reason | **갭** | SideBySideItem은 POST /llm/reason LLM 자동생성 텍스트 표시. Revision.reason(verbatim)과 별도 소스. Export(exportPdf.js)는 rev.reason verbatim 사용 — 화면·Export 소스 불일치 |
| R-20 | LLM 수정사유 "초안 제안"으로 격하 — 사용자 편집·저장 후 Revision.reason에 반영 | **갭** | 현재 LLM 생성 텍스트가 SideBySideItem 로컬 상태로만 존재. Revision.reason에 저장 경로 없음 |
| R-21 | 화면 B에서 수정 부분 색상 강조 (변경 전 vs 변경 후 인라인 표시) | **구현됨** | DiffText 컴포넌트 적용됨 (R-03 확인) |
| R-22 | 분야별 Export: Excel (.xlsx) | **부분** | export.js exportExcel 라우트 존재, area 단일 파라미터. **분야별 ZIP 일괄 없음** |
| R-23 | 분야별 Export: Word (.docx) | **부분** | buildRevisionsDocx 라우트 존재. **1:1 좌우 레이아웃 미구현, 목록형** |
| R-24 | 분야별 Export: PDF | **부분** | exportPdf.js + NotoSansKR 번들됨(한글 지원). **1:1 좌우 레이아웃 미구현** |
| R-25 | 분야별 ZIP 일괄 Export (한 번의 요청으로 전체 분야 압축) | **갭** | area 단일 파라미터만 지원. 분야 반복 요청 → 수동 병합 필요 |
| R-26 | verbatim 수정사유가 Export(Excel·Word·PDF)에 동일하게 포함 | **부분** | exportPdf.js rev.reason verbatim 출력 확인됨. **화면 표시(LLM)와 Export(verbatim)의 소스 불일치로 사용자 혼란** (갭: 화면에서도 verbatim 표시 필요) |
| R-27 | Word Export에 추가 코멘트 삽입 가능한 편집 가능 형식 | **구현됨** | .docx는 Word에서 편집 가능 (P1 이수현 인사이트 반영, 추가 구현 불필요) |

---

## 6. Value Proposition

### 고객 직무 (Customer Jobs)

| 유형 | 직무 |
|------|------|
| Functional | 작년 대비 변경된 문항을 색상으로 즉시 파악하고, 5년 변천을 추적하며, verbatim 수정사유 포함 분야별 증빙을 즉시 Export하여 인증기관에 제출한다 |
| Emotional | "내가 기록한 수정사유가 Export에도 그대로 나온다" — 화면과 공식 산출물의 일치성 신뢰 |
| Social | 연도별 추적 Export가 인증갱신 공식 증빙으로 외부 감사를 통과한다 |

### Gain (기대 이익)

- **증빙 패키지 생성 시간 단축**: 2일 → 2시간. 분야별 ZIP 1클릭으로 수작업 제거.
- **DELETED 부활 탐지**: 5년 타임라인에서 과거 삭제문항 재등장 즉시 식별.
- **색상 diff 6필드 커버**: 질문·설명·배점·분류·분야특이설명·해당없음 모두 DiffText 적용.
- **verbatim 단일 파이프라인**: 화면 B → Export까지 Revision.reason 동일 소스.
- **감사 대응력**: changes.js 인증 추가로 연도별 diff 데이터 보안 보장.

### Pain (현재 고통)

- SideBySideItem LLM 수정사유가 Revision.reason(verbatim)과 다른 소스 → 화면 신뢰 저하
- ComparisonTable이 질문·설명 2필드만 비교 → 배점·수정유형·수정사유 생략
- 5년 데이터 실존 미검증 → timeline 빈 화면 가능
- 화면 A→B 자동 필터 없음 → 선택 개정대상이 비교 화면에서 사라짐
- 분야별 ZIP 없음 → 47~65회/시즌 수동 Export 반복
- changes.js 인증 없음 → 연도별 diff 비인증 접근 가능

---

## 7. User Stories / Job Stories / Test Scenarios

### 7.1 User Stories (INVEST 체크)

#### 심사위원(P2, Primary) 핵심 스토리 — 연도별 추적

| ID | User Story | Priority | Acceptance Criteria (Given / When / Then) |
|----|-----------|----------|------------------------------------------|
| US-B01 | 심사위원으로서, 변경된 문항만 보기 필터를 클릭하여 수정·신규·삭제 유형별로 목록을 확인하고 싶다 — 전체 문항 중 관련 항목만 빠르게 탐색하기 위해 | P1 | Given CompareView에서 비교 연도 선택됨 / When "수정만 보기" 버튼 클릭 / Then MODIFIED 유형 문항만 목록에 표시됨 |
| US-B02 | 심사위원으로서, 1:1 비교 ComparisonTable에서 질문·설명 외에 배점·수정유형·수정사유도 함께 확인하고 싶다 — 변경 의도와 결과를 한 화면에서 파악하기 위해 | P1 | Given TrackView 1:1 비교 모드 / When 문항 클릭 / Then ComparisonTable에 질문·설명·배점·분류·수정사유(verbatim) 표시됨 |
| US-B03 | 심사위원으로서, 5년 타임라인에서 삭제된 연도가 시각적으로 강조(빨강·취소선)되어 과거 삭제문항 부활 여부를 즉시 알 수 있기를 원한다 | P2 | Given TrackView 5년 이력 모드, 문항이 2024년에 DELETED / When 타임라인 확인 / Then 2024년 항목에 "삭제됨" 배지 + 빨강 스타일 표시 |

#### 담당자(P1) 핵심 스토리 — Export·verbatim

| ID | User Story | Priority | Acceptance Criteria (Given / When / Then) |
|----|-----------|----------|------------------------------------------|
| US-B04 | 담당자로서, 화면 A에서 선택한 개정대상 문항이 화면 B CompareView에 자동으로 필터링되어 표시되기를 원한다 — 중복 선택 없이 개정대상만 비교하기 위해 | P1 | Given 화면 A에서 5개 문항 선택(selectedItemObjects), 화면 B CompareView 진입 / When CompareView 로드 / Then 선택된 5개 item_number에 해당하는 변경 내역만 표시됨 |
| US-B05 | 담당자로서, SideBySideItem에서 보이는 수정사유가 내가 입력한 원문(Revision.reason)이기를 원한다 — LLM 자동생성 텍스트가 공식 이력인 척 표시되는 것을 막기 위해 | P0 | Given RevisionPanel에서 수정사유 입력 후 저장 / When CompareView SideBySideItem 확인 / Then 수정사유 영역에 Revision.reason verbatim 표시 (LLM 버튼은 "초안 제안"으로 표시) |
| US-B06 | 담당자로서, 분야별 Excel·Word·PDF를 ZIP으로 한 번에 다운로드하고 싶다 — 분야 수만큼 반복 다운로드 없이 증빙 패키지를 즉시 완성하기 위해 | P2 | Given 복수 분야 final 문항 존재 / When "분야별 ZIP 다운로드" 클릭 / Then 전체 분야 Excel+Word+PDF 포함 ZIP 파일 1개 다운로드됨 |
| US-B07 | 담당자로서, 분야별 PDF Export가 좌우 대비 레이아웃(이전 연도 좌·현재 연도 우)으로 출력되기를 원한다 — 심사위원이 바로 검토할 수 있는 형식으로 제출하기 위해 | P1 | Given 특정 분야 선택 후 PDF Export / When PDF 파일 오픈 / Then 좌측 이전 연도·우측 현재 연도 나란히, 변경 부분 색상 표시, 수정사유 포함 |

#### 마스터 권한자(P3) 핵심 스토리

| ID | User Story | Priority | Acceptance Criteria (Given / When / Then) |
|----|-----------|----------|------------------------------------------|
| US-B08 | 마스터 권한자로서, 화면 B 진입 시 분야별 변경 건수(신규/수정/삭제)를 요약 집계로 즉시 확인하고 싶다 — 5분 내에 전체 변경 규모를 파악하기 위해 | P2 | Given 비교 연도 선택 후 화면 B 진입 / When 화면 상단 집계 확인 / Then 분야별 신규 N·수정 N·삭제 N 건수 테이블 표시 |
| US-B09 | 보안 담당자로서, /api/changes/:year 엔드포인트에 인증 없이 접근하는 것이 차단되기를 원한다 — 연도별 diff 데이터 비인증 노출을 막기 위해 | P0 | Given 인증 토큰 없이 GET /api/changes/2026 요청 / When 응답 수신 / Then 401 Unauthorized 반환 |

### 7.2 Job Stories (Alan Klement)

| ID | When (상황) | I want to (동기) | So I can (결과) | Priority |
|----|------------|-----------------|----------------|----------|
| JS-B01 | 개정 시즌 초반 화면 B에서 작년 대비 변경 내역을 검토할 때 | 배점·수정유형·수정사유가 1:1 ComparisonTable에 함께 나오길 원한다 | 변경 의도를 한 화면에서 파악하고 추가 클릭 없이 검토를 완료할 수 있다 | P1 |
| JS-B02 | Export 직전에 수정사유가 내가 입력한 원문인지 확인하고 싶을 때 | 화면 B에서 보이는 수정사유가 Revision.reason verbatim임을 확신하고 싶다 | LLM 자동생성 텍스트가 공식 증빙에 섞이지 않았다고 신뢰하며 제출할 수 있다 | P0 |
| JS-B03 | 증빙 패키지를 마감일 3일 전에 완성해야 할 때 | 전체 분야 Excel·Word·PDF를 ZIP으로 한 번에 다운로드하고 싶다 | 분야별 반복 다운로드 없이 2시간 안에 증빙 패키지를 완성할 수 있다 | P2 |
| JS-B04 | 특정 문항이 2년 전에 삭제되었다가 올해 부활한 것 같을 때 | 5년 타임라인에서 DELETED 연도가 빨강으로 강조된 항목을 확인하고 싶다 | 문항 부활 여부를 5초 내에 판단하고 심사 의견을 작성할 수 있다 | P1 |
| JS-B05 | 화면 A에서 개정대상을 선정한 직후 화면 B로 이동할 때 | 선택한 문항만 CompareView에 자동 필터링되어 나타나길 원한다 | 화면 A에서 한 선택을 다시 반복하지 않고 바로 비교·검토를 시작할 수 있다 | P1 |
| JS-B06 | 5년 이력을 보려 했는데 데이터가 없는 연도가 섞여 있을 때 | 보유한 연도 범위와 없는 연도에 "데이터 없음" 안내가 명확히 표시되길 원한다 | 빈 화면이 오류인지 데이터 부재인지 혼동하지 않을 수 있다 | P1 |

### 7.3 Test Scenarios (BDD-style)

| ID | Story Ref | Scenario | 전제조건 | 테스트 단계 | 기대 결과 | Priority |
|----|-----------|----------|----------|------------|----------|----------|
| TS-B01 | US-B05 | verbatim 수정사유 — 화면 표시가 Revision.reason과 일치 | 심사위원 로그인, 문항에 Revision.reason="∙ 배점 기준 모호하여 3점으로 조정" 저장됨 | 1) CompareView SideBySideItem 진입 2) 수정사유 영역 확인 | "∙ 배점 기준 모호하여 3점으로 조정" verbatim 표시, LLM 생성 텍스트 없음 | P0 |
| TS-B02 | US-B09 | changes.js 인증 차단 | 인증 토큰 없이 GET /api/changes/2026 | HTTP 요청 전송 | 401 Unauthorized 반환 | P0 |
| TS-B03 | US-B05 | LLM 버튼 "초안 제안" 격하 표시 | 심사위원 로그인 | CompareView SideBySideItem 렌더링 확인 | 버튼 레이블 "🤖 수정사유 초안 생성(편집 후 저장 필요)" 또는 유사 안내 텍스트. Revision.reason 표시 후 LLM 버튼은 보조 위치 | P0 |
| TS-B04 | US-B02 | ComparisonTable 배점 필드 diff 표시 | TrackView, 문항 배점 2026=5, 2025=3 | 1:1 비교 모드 진입, ComparisonTable 확인 | 배점 행: 좌측 "3점", 우측 "5점" + 색상 강조 | P1 |
| TS-B05 | US-B04 | 화면 A→B 자동 필터 로드 | 화면 A에서 item_number "01.010.090", "07.020.010" 선택(selectedItemObjects) | 화면 B CompareView 진입 | 2개 문항에 해당하는 변경 내역만 표시됨 (나머지 문항 필터 제외) | P1 |
| TS-B06 | US-B03 | 5년 DELETED 연도 강조 | 문항 01.010.090, 2024년 DB에 DELETED 상태 데이터 존재 | TrackView 5년 이력 모드 진입 | 2024년 항목 "삭제됨" 배지 + 빨강 스타일 표시 | P1 |
| TS-B07 | R-13 | 5년 이력 — 데이터 없는 연도 안내 | 문항 01.010.090, 2022·2023년 DB 데이터 없음 | TrackView 5년 이력 모드 진입 | 2022·2023 위치에 "해당 연도 데이터 없음" 카드 표시, 오류 메시지 아님 | P1 |
| TS-B08 | US-B06 | 분야별 ZIP Export 다운로드 | editor 로그인, 복수 분야 final 문항 존재 | "분야별 ZIP 다운로드" 클릭 | ZIP 파일 다운로드됨, ZIP 내 각 분야 폴더에 Excel·Word·PDF 포함 | P2 |
| TS-B09 | US-B07 | PDF Export 좌우 레이아웃 확인 | final 문항 포함 분야 선택 후 PDF Export | PDF 파일 오픈 | 페이지당 2열 레이아웃: 좌측 이전 연도·우측 현재 연도, 변경 텍스트 색상 표시, 수정사유 하단 포함 | P1 |
| TS-B10 | R-07 | diff 오탐 방지 — 공백 정규화 | 문항 question 앞뒤 공백 1개 차이만 있음 | changes.js detectChanges 호출 | MODIFIED 분류 안됨 (정규화 후 동일 텍스트로 처리) | P1 |
| TS-B11 | R-07 | diff 오탐 방지 — ∙ 기호 정규화 | 문항 description에 "∙" vs "·" (유니코드 다름) | detectChanges 호출 | 기호 정규화 후 동일 처리, MODIFIED 미분류 | P1 |
| TS-B12 | R-05 | ComparisonTable field_specific_description diff | 문항에 분야특이 설명 이전연도 "A", 현재연도 "B" | 1:1 비교 모드 진입 | 분야특이 설명 행 표시 + DiffText "A→B" 색상 강조 | P2 |
| TS-B13 | R-26 | Export verbatim 일치 — Word 파일 수정사유 | 수정사유 "∙ 개정 근거: CAP 2025 개정 반영" 저장 | 분야 Word Export 다운로드 후 열기 | 수정사유 셀에 "∙ 개정 근거: CAP 2025 개정 반영" 동일 텍스트 포함 | P0 |
| TS-B14 | R-08 | changes.js 인증 통과 후 정상 응답 | editor 토큰으로 GET /api/changes/2026 | HTTP 요청 전송 | 200 OK + 연도별 diff JSON 반환 | P0 |

---

## 8. 대안 비교 (Competitive Battlecard)

### 8.1 대안 매트릭스 — 연도별 변경 추적 특화

| 기준 | LMF 화면 B | CAP Checklist | 수기 엑셀 | Confluence / Git | 범용 SaaS (MediaLab 등) |
|------|------------|---------------|-----------|-----------------|------------------------|
| 한국어 DiffText 색상 강조 | **구현됨** (갭: 2필드 한정) | 없음 (영문) | 없음 | 없음 | 없음 |
| verbatim 수정사유 이력 연동 | **부분** (LLM 불일치 갭) | 없음 (사유 비공개) | 사용자 수동 관리 | 커밋 메시지 | 제품별 다름 |
| 과거 5년 이력 검색 | **부분** (데이터 실존 미검증) | 없음 (년도별 검색 불가) | 파일별 수동 | Git history | 없음 |
| DELETED 문항 부활 탐지 | **갭** (5년 DELETED 강조 없음) | 없음 | 수동 | Git blame 가능 | 없음 |
| 분야별 증빙 Export (Word/PDF) | **부분** (ZIP·좌우레이아웃 갭) | 예 (레이아웃 미흡) | 수동 완성 필요 | 없음 | 있음 |
| 한글 분야별 ZIP 일괄 Export | **갭** | 없음 | 없음 | 없음 | 없음 |
| 화면 A→B 자동 연동 | **갭** | N/A | N/A | N/A | N/A |
| KSLM 도메인 모델 (공통문항·C/R/B·심사점검표 순서) | **완전** | 없음 | 없음 | 없음 | 없음 |
| 한국어 지원·데이터 주권 | **필수** (내부) | 없음 | 완전 | 완전 | 없음 |

### 8.2 Win Strategies

**vs 수기 엑셀**: "분야별 증빙을 엑셀로 만들면 47~65회/시즌 수동 작업입니다. ZIP Export 1클릭으로 전체 분야를 2시간 안에 완성합니다."

**vs CAP Checklist**: "CAP는 색상 diff 없음·수정사유 비공개·5년 검색 불가입니다. LMF는 한국어 DiffText·verbatim 수정사유 이력·심사점검표 정합 구조를 내재화했습니다."

**vs Confluence·Git**: "Git은 DELETED 문항 부활을 git blame으로 찾을 수 있지만, KSLM 중분류 순서·배점 분류·공통문항 공유 키가 없습니다. 비기술자 사용자에게 git blame은 진입장벽이 너무 높습니다."

### 8.3 공통 반론 대응

| 반론 | 대응 |
|------|------|
| "LLM 수정사유가 더 잘 정리되어 있다" | "공식 이력에 남는 것은 담당자가 입력한 원문이어야 합니다. LLM은 '초안 제안' 역할만 하며, 편집·확인 후 저장해야 공식 Revision.reason이 됩니다." |
| "5년 이력 데이터가 없으면 의미 없다" | "Day 0에 DB 연도별 카운트 쿼리로 보유 데이터를 확인합니다. 없는 연도는 '데이터 없음'으로 명시하고, ETL 마이그레이션 계획을 병행합니다." |
| "분야별 Export는 지금도 하나씩 되지 않나" | "시즌당 47~65회 반복이 필요합니다. ZIP 1클릭은 이 반복을 제거합니다." |

---

## 9. Growth Loops (기관 내 확산)

### 9.1 사용 주도 확산 (Product-Led)

| Loop | 트리거 | 행동 | 산출 | 지표 |
|------|--------|------|------|------|
| 증빙 자동화 루프 | 인증갱신 마감일 D-30 | 담당자가 분야별 ZIP 1클릭으로 증빙 패키지 완성 | "2시간 완성" 경험 → 다음 시즌 의존도 상승, 수기 병행 제거 | 증빙 패키지 생성 시간, ZIP 다운로드 건수 |
| verbatim 신뢰 루프 | 심사위원이 수정사유를 입력하고 Export 결과를 확인 | "내가 입력한 원문이 Export에 그대로" 확인 | 다음 시즌 LLM 버튼 무시하고 직접 입력·저장 → verbatim 입력률 상승 | verbatim 입력률(목표 ≥95%), LLM 버튼 클릭률 |
| DELETED 탐지 루프 | 심사위원이 5년 타임라인에서 삭제문항 부활 발견 | 즉시 수정 의견 추가 후 RevisionPanel 저장 | "5년 이력이 실제로 유용했다" 경험 → 동료 심사위원에게 공유 | 5년 이력 조회 수, DELETED 항목 클릭률 |

### 9.2 운영 주도 확산 (Ops-Led)

| Loop | 트리거 | 행동 | 산출 | 지표 |
|------|--------|------|------|------|
| 감사 대응 루프 | 외부 감사 기관이 연도별 변경 내역 제출 요구 | changes.js 인증 통과 후 즉시 분야별 Export 제출 | "수분 내 감사 대응" 경험 → 기관장 신뢰 상승 | 감사 대응 시간 |
| 분야 확대 루프 | beachhead(검사실운영·임상화학) 담당자 추천 | 다른 분야 심사위원이 화면 B 온보딩 | 전 분야 확산, 분야별 Export 사용률 100% | 분야별 Export 사용 분야 수 |

---

## 10. 성공 지표

| 지표 | 정의 | 목표 (1개 개정 시즌 후) |
|------|------|------------------------|
| **증빙 패키지 생성 시간** | 분야별 Export 시작 → ZIP 완료까지 시간 | ≤30분/분야, 전체 ≤2시간 |
| **verbatim 입력률** | Revision.reason이 존재하는 수정 건 수 / 전체 수정 건 수 | ≥95% |
| **Export 오류율** | 한글 깨짐·분야 누락·파일 손상 건수 | 0건 |
| **diff 오탐률** | 공백·∙·개행 정규화 후 MODIFIED 오분류 건수 (샘플 50건) | <5% |
| **5년 데이터 완결성** | 보유 연도 범위 내 빈 항목(연도 있어야 하는데 없는 경우) | 0건 |
| **화면 A→B 필터 정확도** | 선택한 item_number 중 CompareView에 정상 표시되는 비율 | 100% |
| **changes.js 인증 차단율** | 비인증 요청 중 401 반환 비율 | 100% |
| **사용자 만족도 (화면 B)** | 5점 척도 설문 (담당자·심사위원·마스터 권한자 대상) | ≥4.0 |
| **수기 병행 건수** | 시스템 외 엑셀로 연도별 비교 처리된 건수 | 0건 |

---

## 11. Pre-mortem — 잠재 실패 분석 (Gary Klein)

> 가정: yearly-tracking 기능이 2027년 개정 시즌 종료 후 "화면을 믿을 수 없다"는 이유로
> 사용이 중단되었다. 무엇이 잘못되었는가?

| # | 실패 모드 | 범주 | 가능성 | 영향 | 예방 전략 |
|---|----------|------|:------:|:----:|----------|
| 1 | **과거 5년 데이터 부재** — 2026년 이전 Item 데이터가 DB에 없어 5년 타임라인이 1개 연도만 표시되거나 빈 화면. 심사위원이 "쓸모없다" 판단 | 실현가능성 | 높음 | 심각 | Day 0 DB 연도별 카운트 쿼리 실행 → 데이터 없으면 ETL 마이그레이션 계획 수립. 없는 연도 "데이터 없음" UX 명시. "보유 전체 이력" 레이블 표기 |
| 2 | **수정사유 LLM이 verbatim 덮어씀** — 심사위원이 LLM 생성 텍스트를 공식 이력으로 오해하고 저장, Export에 LLM 텍스트 혼입. 사후 감사에서 기록 신뢰성 지적 | 데이터 정합성 | 높음 | 심각 | SideBySideItem LLM 버튼을 "초안 제안(편집 후 저장 필요)"으로 격하. Revision.reason verbatim 표시 우선. LLM 생성 텍스트는 로컬 임시 상태로만 유지, 자동 저장 경로 없음 |
| 3 | **diff 오탐으로 MODIFIED 과다 분류** — 문항 앞뒤 공백 1개·∙ 기호·개행 차이로 전 문항이 MODIFIED 표시. 심사위원이 "모두 수정된 것처럼 보인다"며 색상 강조를 신뢰하지 않음 | 사용성 | 중간 | 높음 | detectChanges 및 DiffText에 한글 정규화 레이어(공백 trim, ∙/· 통일, \r\n 정규화) 선행 적용. 샘플 50건 오탐률 <5% 검증 |
| 4 | **changes.js 인증 없이 연도별 diff 노출** — 비인증 사용자가 /api/changes/2026?area=XX로 전체 문항 변경 내역 조회 가능. 감사 지적 또는 데이터 유출 | 보안 | 높음 | 높음 | changes.js 라우터 최상단 requireAuth('viewer') 미들웨어 1줄 추가 (Day 0 즉시 실행) |
| 5 | **분야별 ZIP Export 타임아웃** — 전체 분야 13개를 한 요청으로 ZIP 생성 시 PDF 렌더링 시간 초과. 담당자가 ZIP 대신 수동 반복으로 회귀 | 실현가능성 | 중간 | 높음 | 비동기 ZIP 생성(큐 기반) + 진행률 표시. 단위 파일 생성 후 스트리밍 ZIP 방식 검토. 타임아웃 임계값(30초) 명시 |
| 6 | **Export 한글 깨짐·분야 누락** — NotoSansKR 번들 미확인 배포 또는 분야 파라미터 누락으로 특정 분야 문항이 Export에서 빠짐. 45~450개 검사실 파급 | 사용성 | 중간 | 심각 | CI 단계 폰트 번들 존재 검증. E2E Export 테스트(TS-B13) + 분야 누락 여부 자동 체크. 각 분야별 문항 수 Export 전후 카운트 비교 |
| 7 | **화면 A→B 자동 필터 연동 누락** — selectedItemObjects가 CompareView에 전달되지 않아 매번 수동 재선택 필요. 담당자가 "화면 A 선택이 의미 없다"고 판단 | 사용성 | 중간 | 중간 | FilterContext selectedItemObjects → CompareView props 전달. 화면 A 선택 항목 수 CompareView 상단 배지로 표시. TS-B05 E2E 테스트 |
| 8 | **1:1 비교 기준연도 혼란** — sortedItems[1]이 "직전 연도"인지 "직전 수정 시점"인지 사용자가 헷갈림. 비교 기준 명시 없으면 심사위원 오판 | 사용성 | 중간 | 중간 | ComparisonTable 헤더에 "N년 (이전)" vs "N년 (최신)" 명시. OQ-B02 정책 확정 후 레이블 고정 |

**상위 3 리스크 (v1 갭 수정 전 반드시 해결)**:

1. **과거 5년 데이터 부재** (#1) — Day 0 DB 카운트 쿼리, 없으면 ETL 선행
2. **수정사유 LLM verbatim 충돌** (#2) — LLM 초안 격하 + Revision.reason verbatim 표시 파이프라인 구축
3. **changes.js 인증 없음** (#4) — requireAuth 1줄, Day 0 즉시 적용

---

## 12. 미해결 질문 (Open Questions)

| # | 질문 | 오너 | 기한 |
|---|------|------|------|
| OQ-B01 | **과거 5년 데이터 마이그레이션 여부** — 2026년 이전 Item 데이터가 DB에 존재하는가? ETL로 2022~2025년 데이터를 마이그레이션한 이력이 있는가? 없으면 어느 연도부터 보유 가능한가? | 개발팀 | Day 0 DB 카운트 쿼리 실행 즉시 |
| OQ-B02 | **1:1 비교 기준 — 직전 연도 vs 직전 수정 시점** — ComparisonTable previous = sortedItems[1]은 "직전 연도 데이터"인가, "직전 수정이 일어난 시점의 스냅샷"인가? 사용자 기대는 "직전 연도"이나 구현이 이와 다를 가능성이 있다. | 개발팀 / P2 박진우 | TrackView 검증 전 |
| OQ-B03 | **분야별 Export ZIP vs 개별** — 전체 분야 ZIP 1개인가, 분야 선택 복수 체크 후 ZIP인가? P3 마스터 권한자는 전체가 필요하고, P1 담당자는 특정 분야만 필요한 경우도 있다. | P1 이수현 / P3 최규원 | GTM 온보딩 전 |
| OQ-B04 | **화면 B 수정사유 LLM 완전 제거 vs 초안 유지** — LLM 버튼을 "초안 제안(편집 후 저장 필요)"으로 격하할 때, 이미 LLM 텍스트를 수정사유로 사용해온 사용자에게 어떻게 안내할 것인가? 기존 Revision.reason이 없는 문항은 어떻게 처리하는가? | PM / P1 이수현 | P0 갭 수정 Sprint 전 |
| OQ-B05 | **changes.js requireAuth 레벨** — requireAuth('viewer')이면 충분한가, 아니면 requireAuth('editor')가 필요한가? 조회 전용 사용자도 연도별 diff를 볼 수 있어야 하는가? | PM / 마스터 권한자 | Day 0 requireAuth 추가 전 |
| OQ-B06 | **ComparisonTable 어느 필드까지 diff** — 질문·설명·배점·분류·분야특이설명·해당없음(na_available)·수정유형·수정사유 중 어디까지 1:1 ComparisonTable에 포함할 것인가? 모든 필드 포함 시 화면 과부하 위험. | P2 박진우 / P1 이수현 | ComparisonTable 필드 확장 구현 전 |
| OQ-B07 | **5년 이력 DELETED 항목 소스** — DELETED 항목이 changes.js (targetYear에 없는 prevYear 항목)에서 오는데, TrackView historyItems는 Item.find({item_number}) 결과다. DELETED 연도를 5년 타임라인에 포함하려면 별도 API 호출이 필요한가? | 개발팀 | TS-B06 구현 전 |

---

## 13. Stakeholder Map (Mendelow)

| 이해관계자 | 역할 | 권한 (H/M/L) | 관심 (H/M/L) | 전략 | 커뮤니케이션 |
|-----------|------|:-------------:|:--------------:|------|-------------|
| 마스터 권한자 (최규원 등) | 릴리즈 전 게이트·분야 일괄 최종전이 | H | H | **긴밀 협력** — 분야별 변경 요약 UX·PDF 레이아웃 공동 설계 | 격주 체크인, 중요 결정 사전 검토 |
| 문항관리부 담당자 (이수현 등) | 분야별 증빙 Export·verbatim 검증 | H | H | **긴밀 협력** — verbatim 파이프라인·ZIP Export UI 결정 공동 참여 | 스프린트 데모, 실사용 피드백 |
| 분야별 심사위원 (박진우 등) | 연도별 색상 비교·5년 이력 조회·수정 | M | H | **지속 정보 제공** — 화면 변경 사전 공지, DELETED 탐지 기능 교육 | 역할별 온보딩 세션, 변경사항 공문 |
| 개발팀 (LMF) | 갭 수정 구현·changes.js 인증·ZIP Export | M | H | **긴밀 협력** — P0 갭 우선순위 공동 결정, Day 0 requireAuth 즉시 적용 | PRD 공유, 주간 싱크 |
| TFT 위원단 (6개 기관) | §4 요구사항 원본 합의·검증 | M | H | **지속 정보 제공** — 갭 해소 진행상황 분기 보고 | TFT 워크숍 후속 회의 |
| 기관 임원 / 인증 책임자 | 예산·증빙 정책 결정 | H | M | **긴밀 관리** — 증빙 생성 시간 절감·감사 대응력 지표 전달 | 시즌 시작·종료 브리핑 |
| 외부 감사자 | 연도별 변경 내역 확인 요청 | L | M | **필요 시 정보 제공** — Export로 즉시 대응 (changes.js 인증 완료 후) | 요청 기반 |
| 조회 전용 사용자 (viewer) | 연도별 비교 열람 | L | L | **모니터링** — requireAuth 레벨 정책 확정 후 역할 부여 | 역할 정책 공지 |

---

## 14. Solution 범위

### v1 갭 수정 (현 개정 시즌 전 필수 — P0)

우선순위 순서:

1. **changes.js requireAuth 추가** (R-08, US-B09) — 1줄 미들웨어, Day 0 즉시 실행
2. **SideBySideItem verbatim 전환** (R-19, US-B05) — LLM 버튼 "초안 제안" 격하, Revision.reason verbatim 표시 우선
3. **DB 5년 데이터 실존 검증 + ETL 계획** (R-13) — Day 0 카운트 쿼리, 없는 연도 "데이터 없음" UX
4. **화면 A→B 자동 필터 연동** (R-17, US-B04) — FilterContext selectedItemObjects → CompareView props 전달

### v1.5 개선 (갭 수정 후 다음 스프린트 — P1)

- ComparisonTable 필드 확장 (배점·수정유형·수정사유 추가) (R-11, US-B02)
- 변경문항 유형별 필터 목록 클릭 (R-06, US-B01)
- 1:1 비교 PDF 좌우 레이아웃 (R-12, US-B07)
- 5년 타임라인 DELETED 강조 스타일 (R-15, US-B03)
- 데이터 없는 연도 "데이터 없음" UX 명시 (R-16, TS-B07)
- diff 오탐 방지 한글 정규화 레이어 (R-07, TS-B10/B11)

### v2 미래 (P2)

- 분야별 ZIP Export (R-25, US-B06)
- 분야별 변경 요약 대시보드 (US-B08)
- 5년 DELETED 항목 changes.js 소스 연동 (OQ-B07)
- ComparisonTable field_specific_description·na_available diff (R-05, TS-B12)
- LLM 초안 → 편집 → Revision.reason 저장 완결 UI (R-20)
- 분야 일괄 최종전이 (P3 마스터 권한자 요구)

---

## Attribution

Based on frameworks from [pm-skills](https://github.com/phuryn/pm-skills) by Pawel Huryn (MIT License):
- create-prd: 8-section PRD template
- beachhead-segment: Geoffrey Moore, *Crossing the Chasm*
- gtm-strategy: Product Compass methodology
- ideal-customer-profile: ICP from research data
- competitive-battlecard: Sales-ready competitive comparison
- growth-loops: Product-led and sales-led growth mechanisms
- pre-mortem: Gary Klein, prospective hindsight technique
- user-stories: 3C (Card, Conversation, Confirmation) + INVEST criteria (Ron Jeffries)
- job-stories: Alan Klement, *When Coffee and Kale Compete*
- test-scenarios: BDD-style (Given/When/Then) from user stories
- stakeholder-map: Mendelow's Power/Interest matrix

Domain context: KSLM/LMF 임상검사실 인증심사 문항관리, 1차 전산 TFT 워크숍(2026-06-09) 결과 기반.
pm-discovery, pm-strategy, pm-research 에이전트 분석 결과 종합 (2026-06-14).
