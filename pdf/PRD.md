# PRD: 우수검사실 종합검증 분석 시스템

**문서 버전**: 1.0  
**작성일**: 2026년 5월 2일  
**작성자**: Hermes Agent (AI Assistant)  
**프로젝트 기간**: 2026년 5월 1일 ~ 5월 2일 (2일간 집중 개발)

---

## 1. 프로젝트 개요

### 프로젝트명
**우수검사실 종합검증 분석 대시보드 (Lab Accreditation Intelligence Platform)**

### 배경
대한진단검사의학회에서 발행하는 **우수검사실 신임인증 심사점검표(종합검증)** PDF 보고서(2020~2026년, 총 7개 파일)를 분석하여:

- 구조를 파악하고
- 체계적인 NoSQL DB 스키마를 설계하며
- 연도별 변화 추이, 취약 문항, 개선 필요 영역을 자동으로 분석하는 **지능형 분석 플랫폼**을 구축

특히 **07.405.420** (종합검증보고서 전문의 직접 작성) 항목이 지속적으로 취약하다는 점을 발견하고, 이를 개선하기 위한 SOP와 대시보드를 제공.

---

## 2. 프로젝트 목표

### Business Objectives
- 인증 심사 실패율 감소 및 품질 관리 체계 강화
- 연도별 변화 추적 및 트렌드 분석 자동화
- 인증 준비 업무 효율화 (수작업 → 자동 분석)

### User Objectives
- 검사실 품질관리팀: 취약 영역 빠른 파악
- 책임 전문의: 개선 우선순위 명확화
- 인증 준비 담당자: 과거 데이터와의 비교 및 SOP 기반 대응

### Technical Objectives
- PDF → 구조화된 데이터 변환 파이프라인 구축
- MongoDB 기반 NoSQL 스키마 설계
- Interactive Web Dashboard 제공 (Streamlit + HTML)
- Excel 다운로드, SOP 자동 생성 기능 구현

---

## 3. 주요 기능 요구사항

### Core Features
1. **PDF 구조 분석 & 파싱 엔진** (v4 Parser)
   - `pymupdf4llm` 기반 고품질 Markdown 변환
   - 문항코드(`07.xxx.xxx`), 섹션, 카테고리(Core/Required/Basic), 점수, 결과(`예`/`아니오`), 비고 자동 추출
   - 4차에 걸친 파서 개선 (section detection, score extraction, remarks)

2. **MongoDB 데이터 모델**
   - `verification_reports` 컬렉션
   - `checklist_items` 배열 구조
   - 연도별, 섹션별, 문항별 빠른 조회를 위한 복합 인덱스

3. **Interactive Web Dashboard** (Streamlit + HTML 버전 제공)
   - **Overview**: 요약 + 차트
   - **문항 검색**: `07.405.*`, `07.300.420` 등 패턴 검색 + 상세 분석
   - **연도 비교**:任意 두 연도 비교 (수정전/수정후 + 상세 분석)
   - **트렌드 분석**: 연도별 실패율, weakest sections, top failing items
   - **전체 7개 연도 비교표**: 한 번에 모든 연도 데이터 비교 + Excel Export
   - **SOP & 보고서**: 07.405.420 전용 SOP 자동 생성 및 다운로드

4. **Excel Export**
   - 모든 분석 결과 Excel 다운로드 기능
   - "전체 7개 연도 비교표" 전용 Excel 보고서

5. **문서화**
   - 상세 SOP (`SOP_07.405.420_..._v1.0.docx`)
   - 프로젝트 PRD (본 문서)
   - 분석 보고서 (`종합검증_분석_보고서.md`)

---

## 4. 데이터 모델 (MongoDB Schema)

```json
{
  "year": 2026,
  "document_type": "우수검사실_신임인증_종합검증",
  "checklist_items": [
    {
      "item_code": "07.405.420",
      "section": "질관리: 검사전후단계",
      "category": "Required (R)",
      "description": "...",
      "max_points": 2,
      "awarded_points": 0,
      "result": "아니오",
      "remarks": "전문의 직접 작성 미흡",
      "explanation": "..."
    }
  ],
  "overall_score": null,
  "final_result": null
}
```

**주요 인덱스**:
- `{ year: 1 }`
- `{ "checklist_items.item_code": 1 }`
- `{ "checklist_items.section": 1 }`
- `{ "checklist_items.category": 1 }`
- Text Index on `full_markdown` and description

---

## 5. 기술 스택

- **PDF Parsing**: `pymupdf4llm` + Custom v4 Parser
- **Database**: MongoDB
- **Backend**: Python 3 + PyMongo
- **Frontend/Dashboard**: Streamlit + Custom HTML/CSS/JS Dashboard
- **Visualization**: Plotly, Pandas
- **Document Generation**: python-docx, Markdown

---

## 6. 현재 구현 상태 (2026.05.02 기준)

- [x] 7개 PDF 완전 파싱 (v4 Parser)
- [x] MongoDB 스키마 설계 및 데이터 Import 완료
- [x] Streamlit 실시간 대시보드 (`dashboard_streamlit.py`)
- [x] 순수 HTML 버전 Web Dashboard (`web_dashboard/index.html`)
- [x] Excel Export 기능
- [x] 07.405.420 전용 SOP (Markdown + Word)
- [x] 상세 분석 보고서 (`종합검증_분석_보고서.md`)
- [x] PRD 문서 (본 문서)

---

## 7. 향후 개선 계획 (Roadmap)

### Phase 2 (단기)
- OCR 강화 (marker-pdf 도입)
- 자동 점수 계산 로직 추가
- 사용자 인증 및 역할 기반 접근 제어

### Phase 3 (중기)
- AI 기반 개선 추천 엔진 (GPT-style)
- Historical Trend Prediction
- 자동 SOP 업데이트 기능

### Phase 4 (장기)
- 전체 인증 프로세스 디지털 트윈 구축
- Multi-hospital benchmarking 기능

---

**본 PRD는 프로젝트 진행 과정에서 함께 만들어진 living document입니다.**

필요 시 언제든지 업데이트하여 더 정교한 버전으로 발전시킬 수 있습니다.

---

**작성 완료**  
**파일 저장 위치**: `/mnt/d/LMF_all/pdf/PRD.md`

이 PRD를 기반으로 프로젝트를 체계적으로 관리하거나, 추가 개발 시 참고 자료로 활용할 수 있습니다.

추가로 원하는 내용(예: User Story, Non-functional Requirements, Timeline 등)을 더 보강해 드릴까요?
