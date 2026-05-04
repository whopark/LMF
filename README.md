# 우수검사실 신임인증 심사점검표 리뷰

![CI](https://github.com/whopark/LMF/actions/workflows/ci.yml/badge.svg?branch=master)

**Laboratory Accreditation Checklist Review System**

대한임상병리학재단/임상병리사회의 연도별 우수검사실 신임인증 심사점검표를 데이터베이스화하고, 연도 간 변경 사항을 시각적으로 비교하며, LLM으로 변경 이유를 자동 생성하는 의원/검사실용 도구.

## 핵심 기능

| 기능 | 설명 |
|------|------|
| **필터링 대시보드** | 분류·연도·중분류·검색어로 문항 빠른 조회 |
| **인라인 편집** | 문항 상세에서 질문/설명/배점/유형 직접 수정 |
| **Track View** | 문항 번호로 연도별 변화 추적 (시간 흐름 파악) |
| **Compare View** | 두 연도 간 변경 사항 side-by-side 비교 |
| **LLM 수정사유 생성** | 변경된 문항의 수정 이유 자동 추정 (Claude claude-haiku-4-5) |
| **REST API** | 로컬 MongoDB 영구 저장 + API 제공 |

## 기술 스택

```
React 19 (Vite) → Express.js → MongoDB
                      ↓
              Anthropic Claude API
```

- **Frontend**: React 19, Vite, CSS Custom Properties
- **Backend**: Express.js, Mongoose
- **Database**: MongoDB (로컬)
- **AI**: Anthropic Claude claude-haiku-4-5 (수정사유 생성)

## 빠른 시작

### 사전 요구사항

- Node.js 18+
- MongoDB (로컬 실행)
- Anthropic API Key (선택, LLM 기능 사용 시)

### 설치

```bash
# 1. 저장소 클론
git clone https://github.com/whopark/LMF.git
cd LMF

# 2. Backend 의존성 설치
cd gui/backend
npm install
cp .env.example .env  # API_KEY, ANTHROPIC_API_KEY 설정

# 3. Frontend 의존성 설치
cd ../frontend
npm install

# 4. 데이터 임포트 (MongoDB 실행 상태에서)
cd ../backend
node import-data.js
```

### 실행

```bash
# Backend (port 5000)
cd gui/backend
npm run dev

# Frontend (port 5173, 별도 터미널)
cd gui/frontend
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## 데이터 모델

단일 컬렉션 `checklist_items`:

```javascript
{
  area: "07 종합검증",           // 대분류
  sub_category: "질관리",        // 중분류
  about_item: {
    item_number: "07.405.420",  // 문항 번호
    item_type: "Required",      // Core | Required | Basic
    score: 2,
    question: "...",
    description: "..."
  },
  metadata: {
    year: 2024,
    source: "pdf",
    created_at: "2024-01-01T00:00:00Z"
  }
}
```

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/filters` | 필터 옵션 조회 |
| GET | `/api/items` | 문항 목록 (쿼리 필터 지원) |
| GET | `/api/items/:number` | 특정 문항 연도별 이력 |
| PATCH | `/api/items/:id` | 문항 수정 (`x-api-key` 필요) |
| GET | `/api/changes` | 연도 간 변경 비교 |
| POST | `/api/llm/reason` | LLM 수정사유 생성 |

## 테스트

```bash
cd gui/backend
npm run test:run  # 14개 테스트
```

## 프로젝트 구조

```
LMF/
├── gui/
│   ├── backend/          # Express API 서버
│   │   ├── routes/       # API 라우터 (filters, items, changes)
│   │   ├── models/       # Mongoose 스키마
│   │   └── middleware/   # 인증 미들웨어
│   └── frontend/         # React SPA
│       ├── src/
│       │   ├── components/
│       │   ├── contexts/
│       │   └── styles/
│       └── dist/         # 빌드 산출물
├── pdf/                  # 데이터 파이프라인 (gitignored)
└── ARCHITECTURE.md       # 아키텍처 문서
```

## 라이선스

Private repository. 라이선스 미정.

---

🐙 Powered by [Autopus-ADK](https://github.com/anthropics/autopus-adk)
