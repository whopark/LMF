# SPEC-CLEANUP-001 · 수락 기준

## Must scenarios

### AC-1: 스트레이 파일/디렉토리 부재 (REQ-1)

```
Given 저장소 루트 e:/LMF_all
When `Get-ChildItem -Force | Where-Object { $_.PSIsContainer -and $_.Name -like 'gui*' -and $_.Name -ne 'gui' }` 를 실행한다
Then 결과는 비어 있다
And `Get-ChildItem -Force | Where-Object { $_.Name -eq 'nul' }` 도 비어 있다
```

### AC-2: 모든 CSS 파일 300줄 이하 (REQ-2)

```
Given gui/frontend/src/App.css와 styles/ 하위 모든 CSS 파일
When `wc -l` 을 실행한다
Then 각 파일의 라인 수는 300 이하이다
And App.css 자체는 30줄 이하이며 본문은 @import 문만 포함한다
```

### AC-3: vite build 성공 (REQ-3)

```
Given gui/frontend 디렉토리
When `npx vite build` 를 실행한다
Then exit code는 0이다
And dist/assets/index-*.css 가 생성된다
And stderr에 CSS 파싱 오류가 없다
```

### AC-4: 클래스 누락 없음 (REQ-3)

```
Given 원본 App.css의 모든 클래스 셀렉터 집합 S_orig
And 분할 후 styles/ 하위 모든 CSS의 셀렉터 집합 S_new
When S_orig - S_new 를 계산한다
Then 결과는 빈 집합이다
```

### AC-5: 환경 변수 로딩 (REQ-4)

```
Given gui/backend/.env 파일에 MONGO_URI=mongodb://test/db, LLM_MODEL=claude-test 가 정의되어 있다
When `node -e "require('dotenv').config(); console.log(process.env.MONGO_URI, process.env.LLM_MODEL)"` 를 실행한다
Then 출력은 "mongodb://test/db claude-test" 이다
```

### AC-6: LLM rate limit 동작 (REQ-5)

```
Given LLM_RATE_LIMIT_PER_MIN=2 로 서버가 기동되어 있다
When 같은 IP에서 `POST /api/llm/reason` 을 1초 내 3회 호출한다
Then 첫 두 응답은 200 또는 4xx (anthropic 응답) 이다
And 세 번째 응답의 status는 429 이다
And 응답 본문에 "Too many requests" 가 포함된다
```

### AC-7: JSON body 크기 제한 (REQ-6)

```
Given 백엔드 서버가 기동 중이다
When `POST /api/llm/reason` 에 33 KB 페이로드를 전송한다
Then 응답 status는 413 (Payload Too Large) 이다
```

### AC-8: import-data.js 단일 모델 정의 (REQ-7)

```
Given gui/backend 디렉토리
When `grep -rn "new mongoose.Schema" .` 를 source 파일에 실행한다 (node_modules 제외)
Then 결과는 정확히 1건이며 위치는 models/ChecklistItem.js 이다
```

### AC-9: import-data.js 환경 변수 사용 (REQ-7)

```
Given gui/backend/import-data.js
When 파일 내용을 읽는다
Then "process.env.MONGO_URI" 가 1회 이상 등장한다
And 하드코딩된 "mongodb://127.0.0.1:27017/lab_accreditation" 은 fallback 위치에만 등장한다
```

### AC-10: TDD enforce 완화 (REQ-8)

```
Given autopus.yaml
When YAML을 파싱한다
Then methodology.mode 는 "tdd" 이다
And methodology.enforce 는 false 이다
And methodology 블록에 "until first test suite is in place" 코멘트가 포함된다
```

### AC-11: SPEC 4개 파일 존재 (REQ-9)

```
Given .autopus/specs/SPEC-CLEANUP-001 디렉토리
When 디렉토리 내용을 나열한다
Then spec.md, plan.md, acceptance.md, research.md 4개 파일이 모두 존재한다
And 각 파일의 wc -l 결과는 300 이하다
```

## Should scenarios

### AC-12: 백엔드 모듈 무결성

```
Given dotenv, express-rate-limit 설치 완료 후
When `node -e "require('./routes/llm.js'); require('./routes/api.js')"` 를 실행한다
Then exit code는 0이다
And stderr는 비어 있다
```

### AC-13: 프론트엔드 빌드 산출물 크기

```
Given Phase 2 완료 후 vite build 결과물
When dist/assets/index-*.css 의 크기를 측정한다
Then gzipped 크기는 5 KB 이하이다 (legacy 포함 baseline ~4.4 KB)
```

## Nice scenarios

### AC-14: Lighthouse 회귀 미발생

```
Given vite preview 모드로 dist/ 를 서빙
When Lighthouse 데스크탑 감사를 실행한다
Then Performance 점수가 분할 전 baseline 대비 ±5점 이내이다
```
