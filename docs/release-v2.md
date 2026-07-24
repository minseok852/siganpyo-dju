# 대진대 시간표 — Release Notes v2.0

> 이 문서는 2026년 6월 업데이트 기준으로 추가·변경된 모든 기능과 작동 원리를 정리한 릴리즈 노트입니다.

---

## 목차

1. [보안 개선](#1-보안-개선)
2. [성능 개선](#2-성능-개선)
3. [코드 리팩토링](#3-코드-리팩토링)
4. [시간표 색상 테마](#4-시간표-색상-테마)
5. [AI 관찰성 시스템](#5-ai-관찰성-시스템)
6. [통합 관리자 페이지](#6-통합-관리자-페이지)
7. [백엔드 신규 엔드포인트](#7-백엔드-신규-엔드포인트)

---

## 1. 보안 개선

### 관리자 비밀번호 서버 이전

**Before**
- `VITE_ADMIN_PASSWORD` 환경변수를 프론트엔드 번들에 포함시켜 클라이언트 비교
- 브라우저 개발자 도구 → JS 소스에서 누구나 비밀번호 확인 가능

**After**
- `ADMIN_PASSWORD`는 백엔드 `.env`에만 존재
- 프론트엔드는 `/api/admin/verify`로 POST 요청 → 서버가 비교 후 성공/실패 반환

```mermaid
sequenceDiagram
    participant U as 관리자 브라우저
    participant F as Frontend (React)
    participant B as Backend (FastAPI)

    U->>F: 비밀번호 입력 후 로그인 버튼
    F->>B: POST /api/admin/verify { password }
    B->>B: os.getenv("ADMIN_PASSWORD") 와 비교
    alt 비밀번호 일치
        B-->>F: 200 { success: true }
        F->>F: sessionStorage.setItem('admin_auth', 'true')
        F-->>U: 관리자 대시보드 진입
    else 비밀번호 불일치
        B-->>F: 401 Unauthorized
        F-->>U: "비밀번호가 올바르지 않습니다" 에러 표시
    end
```

### Firestore O(n) 스캔 → O(1) 직접 조회 수정

피드백 관리 기능에서 댓글 추가/수정/삭제 시 전체 피드백을 다운로드한 뒤 ID로 찾는 방식을 직접 문서 참조로 수정했습니다.

```mermaid
sequenceDiagram
    participant F as Frontend
    participant FS as Firestore

    Note over F,FS: Before (O(n) 스캔)
    F->>FS: getDocs(query(feedbacksRef)) — 전체 다운로드
    FS-->>F: 피드백 전체 목록
    F->>F: .find(fb => fb.id === targetId) — 클라이언트 필터

    Note over F,FS: After (O(1) 직접 조회)
    F->>FS: getDoc(doc(db, 'feedbacks', targetId))
    FS-->>F: 해당 문서 1건만 반환
```

---

## 2. 성능 개선

### filterAvailableCourses 병렬 처리

추천 페이지에서 수강 가능한 과목을 필터링할 때 Firestore 쿼리가 최대 7개 순차 실행되던 문제를 `Promise.all`로 병렬화했습니다.

```mermaid
sequenceDiagram
    participant R as RecommendPage
    participant FS as Firestore

    Note over R,FS: Before (순차 실행 — 최대 ~700ms)
    R->>FS: 전공필수 쿼리 await
    FS-->>R: 결과 1
    R->>FS: 전공선택 쿼리 await
    FS-->>R: 결과 2
    R->>FS: 교양필수 쿼리 await
    FS-->>R: 결과 3
    Note right of R: ... 7번 반복

    Note over R,FS: After (병렬 실행 — ~100ms)
    par 동시 실행
        R->>FS: 전공필수 쿼리
        R->>FS: 전공선택 쿼리
        R->>FS: 교양필수 쿼리
        R->>FS: 교양선택 쿼리
        R->>FS: 복전필수 쿼리
        R->>FS: 복전선택 쿼리
        R->>FS: 영역별 쿼리
    end
    FS-->>R: 모든 결과 동시 반환 (Promise.all)
```

---

## 3. 코드 리팩토링

### parseScheduleToTimes 중복 제거

`"화10:00-11:30, 목10:00-11:30"` 형식의 시간표 문자열을 파싱하는 함수가 7곳에 복사되어 있던 것을 `src/utils/timeUtils.js` 단일 파일로 통합했습니다.

| 파일 | Before | After |
|---|---|---|
| `RecommendPage.jsx` | 47줄 로컬 함수 | import |
| `useSchedule.js` | 40줄 로컬 함수 | import |
| `CourseBlock.jsx` | `timeToMinutes` 로컬 함수 | import |
| 그 외 4곳 | 각자 구현 | import |

```mermaid
graph LR
    TU[timeUtils.js\nparseScheduleToTimes\ntimeToMinutes]
    TU --> RP[RecommendPage.jsx]
    TU --> US[useSchedule.js]
    TU --> CB[CourseBlock.jsx]
    TU --> AI[AIPage.jsx]
```

---

## 4. 시간표 색상 테마

사용자가 시간표 블록의 색상 테마를 선택할 수 있는 기능을 추가했습니다.

### 제공 테마 (5종)

| 테마명 | 특징 |
|---|---|
| 파스텔 (기본) | 연하고 부드러운 색상 |
| 비비드 | 선명하고 강렬한 색상 |
| 쿨톤 | 파랑·보라 계열 |
| 웜톤 | 주황·노랑 계열 |
| 모노톤 | 흑백 그레이 계열 |

### 동작 흐름

```mermaid
sequenceDiagram
    participant U as 사용자
    participant HP as HomePage
    participant US as useSchedule hook
    participant LS as localStorage

    U->>HP: 팔레트 아이콘 클릭
    HP->>HP: ThemePicker 드롭다운 표시
    U->>HP: 원하는 테마 선택 (예: 비비드)
    HP->>US: setScheduleTheme(activeId, 'vivid')
    US->>LS: schedules 배열에 theme: 'vivid' 저장
    US->>US: activePalette = THEMES['vivid'].colors
    US->>US: getCourseColor() 팔레트로 색상 재계산
    HP-->>U: 시간표 블록 색상 즉시 변경
```

### 구현 방식 — Tailwind 정적 클래스

Tailwind CSS는 빌드 시점에 사용되는 클래스만 번들에 포함합니다. 동적 문자열 조합(`bg-${color}-500`)은 번들에서 제외됩니다. 따라서 `constants.js`에 모든 클래스를 **리터럴 문자열**로 명시했습니다.

```js
// constants.js — 클래스를 리터럴로 명시 (동적 조합 불가)
pastel: {
  colors: [
    { bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-800' },
    { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
    // ...
  ]
}
```

---

## 5. AI 관찰성 시스템

AI 호출 결과를 추적하고 사용자 피드백을 수집하는 관찰성(Observability) 시스템을 추가했습니다.

### 전체 아키텍처

```mermaid
graph TD
    U[사용자] -->|AI 호출| FE[Frontend]
    FE -->|평가/추천 요청| BE[FastAPI Backend]
    BE -->|Gemini API 호출| GM[Google Gemini]
    GM -->|응답| BE

    BE -->|성공 응답| FE
    FE -->|logAiSession| FS[(Firestore\nai_logs)]

    FE -->|👍/👎 표시| U
    U -->|피드백 선택| FE
    FE -->|updateAiFeedback| FS
    FE -->|👎 시 알림| BE
    BE -->|Discord 메시지| DC[Discord 채널]

    BE -->|AI 실패 시 자동 알림| DC
```

### AI 세션 로깅 흐름

```mermaid
sequenceDiagram
    participant U as 사용자
    participant FE as Frontend
    participant BE as FastAPI
    participant FS as Firestore (ai_logs)

    U->>FE: AI 평가 / 추천 요청
    FE->>BE: POST /api/evaluate 또는 /api/recommend
    BE-->>FE: AI 결과 응답

    FE->>FS: logAiSession('evaluate', params, result)
    Note right of FS: 저장 필드:\ntype, grade, major,\nsuccess, score,\ncreated_at

    FS-->>FE: logId 반환
    FE-->>U: 결과 화면 표시 + 👍/👎 버튼
```

### 사용자 피드백 (👍/👎) 흐름

```mermaid
sequenceDiagram
    participant U as 사용자
    participant FE as Frontend
    participant FS as Firestore
    participant BE as FastAPI
    participant DC as Discord

    alt 👍 좋아요
        U->>FE: 좋아요 클릭
        FE->>FS: updateAiFeedback(logId, 'up', '')
        FS-->>FE: 업데이트 완료
        FE-->>U: "감사해요! 더 좋은 AI를 만들겠습니다" 표시
    else 👎 별로예요
        U->>FE: 별로예요 클릭
        FE-->>U: 코멘트 입력창 표시
        U->>FE: 코멘트 입력 후 전송
        FE->>FS: updateAiFeedback(logId, 'down', comment)
        FE->>BE: POST /api/ai/feedback-notify (fire & forget)
        BE->>DC: "👎 AI 결과 불만족 피드백\n로그ID: ...\n코멘트: ..."
        FE-->>U: "소중한 피드백 감사해요" 표시
    end
```

### AI 실패 자동 알림 흐름

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as FastAPI
    participant GM as Gemini API
    participant DC as Discord

    FE->>BE: POST /api/evaluate
    BE->>GM: Gemini API 호출
    GM-->>BE: 오류 응답 또는 JSON 파싱 실패

    BE->>BE: result.success == False 확인
    BE->>DC: "🚨 AI 평가 실패\n오류: ...\n학년/전공/과목수 정보"
    BE-->>FE: 500 에러 반환
    FE-->>U: 에러 메시지 표시
```

### Gemini JSON 파싱 재시도 로직 (recommend_service)

```mermaid
flowchart TD
    A[Gemini 호출\ntemperature=0.3] --> B{JSON 파싱 성공?}
    B -->|성공| C[결과 반환]
    B -->|실패 JSONDecodeError| D[경고 로그 출력]
    D --> E[재시도\ntemperature=0.1]
    E --> F{JSON 파싱 성공?}
    F -->|성공| C
    F -->|실패| G[success: False\n에러 반환 + Discord 알림]
```

---

## 6. 통합 관리자 페이지

기존에 `/feedback/admin`, `/updates/admin` 두 곳으로 분산되어 있던 관리자 기능을 `/admin` 단일 페이지로 통합했습니다.

### 탭 구성

| 탭 | 내용 |
|---|---|
| 서버 상태 | FastAPI 헬스체크, 응답시간, AI 실제 동작 테스트, 최근 실패 목록 |
| AI 로그 | 세션 통계, 성공률, 👍/👎 집계, 학과·학년별 사용 패턴 |
| 과목 데이터 | Firestore courses 컬렉션 카테고리별 문서 수 |
| 피드백 | 기존 피드백 관리 (상태변경·댓글·삭제) |
| 업데이트 | 기존 업데이트 공지 관리 |

### 서버 상태 탭 — 헬스체크 흐름

```mermaid
sequenceDiagram
    participant A as AdminPage (HealthTab)
    participant BE as FastAPI
    participant GM as Gemini API

    loop 30초마다 자동 실행
        A->>BE: GET /health (timeout 6s)
        alt 정상 응답 (< 1000ms)
            BE-->>A: { status: 'healthy', api_key_configured: true }
            A->>A: 초록불 표시
        else 느린 응답 (1000~2000ms)
            BE-->>A: 응답
            A->>A: 노란불 표시
        else 타임아웃 또는 연결 거부
            A->>A: 빨간불 표시
        end
    end

    Note over A: 관리자가 "AI 테스트" 버튼 클릭 시
    A->>BE: GET /api/health/ai-ping
    BE->>GM: generate_content("Say 'ok'") — 실제 API 호출
    GM-->>BE: 응답
    BE-->>A: { success: true, latency_ms: 823 }
    A->>A: 테스트 결과 표시
```

### AI 로그 탭 — 사용 패턴 집계

```mermaid
flowchart TD
    A[Firestore ai_logs\n최근 50건 조회] --> B[클라이언트 메모리에서 집계]
    B --> C[학년별 카운트\n1~4학년 각각]
    B --> D[학과별 카운트\n상위 5개 추출]
    C --> E[학년별 막대 카드 표시]
    D --> F[학과별 진행 바 표시]
```

### 과목 데이터 탭 — getCountFromServer

```mermaid
sequenceDiagram
    participant A as AdminPage (DataTab)
    participant FS as Firestore

    A->>FS: getCountFromServer(courses 전체)
    A->>FS: getCountFromServer(category == 'major')
    A->>FS: getCountFromServer(category == 'general_required')
    A->>FS: getCountFromServer(category == 'general_elective')
    A->>FS: getCountFromServer(category == 'convergence')
    Note over A,FS: Promise.all — 5개 동시 실행

    FS-->>A: 각각 count 숫자만 반환\n(문서 내용 다운로드 없음)
    A-->>U: 카테고리별 과목 수 표시
```

### 인증 방식 변경

```mermaid
flowchart LR
    subgraph Before
        direction TB
        P1[/feedback/admin\nlocalStorage: feedback_admin_auth]
        P2[/updates/admin\nlocalStorage: update_admin_auth]
    end

    subgraph After
        direction TB
        P3[/admin\nsessionStorage: admin_auth\n탭 닫으면 자동 로그아웃]
    end
```

---

## 7. 백엔드 신규 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|---|---|---|
| `/api/admin/verify` | POST | 관리자 비밀번호 서버 검증 |
| `/api/ai/feedback-notify` | POST | 👎 피드백 Discord 알림 |
| `/api/health/ai-ping` | GET | Gemini 실제 응답 테스트 |

### /api/health/ai-ping 흐름

```mermaid
sequenceDiagram
    participant A as AdminPage
    participant BE as FastAPI
    participant GM as Gemini

    A->>BE: GET /api/health/ai-ping
    BE->>BE: GEMINI_API_KEY 환경변수 확인
    alt API 키 없음
        BE-->>A: { success: false, error: "GEMINI_API_KEY 미설정" }
    else API 키 있음
        BE->>GM: run_in_executor(\n  model.generate_content("Say 'ok'")\n)
        Note right of BE: asyncio.run_in_executor 사용\n(동기 SDK를 async로 래핑)
        alt Gemini 정상 응답
            GM-->>BE: 텍스트 응답
            BE-->>A: { success: true, latency_ms: 823 }
        else Gemini 오류
            GM-->>BE: 예외 발생
            BE-->>A: { success: false, error: "...", latency_ms: 1200 }
        end
    end
```

---

## 변경 파일 목록

### 신규 생성
- `src/pages/AdminPage.jsx` — 통합 관리자 페이지
- `src/components/AiFeedback.jsx` — 👍/👎 피드백 컴포넌트
- `src/services/aiLogService.js` — AI 세션 로깅 서비스
- `src/utils/timeUtils.js` — 시간표 파싱 유틸 (parseScheduleToTimes, timeToMinutes)

### 수정
- `dju-timetable-api/main.py` — 신규 엔드포인트 3개, Discord 헬퍼
- `dju-timetable-api/services/recommend_service.py` — JSON 파싱 재시도 로직
- `src/App.jsx` — `/admin` 라우트 추가, React Router v7 플래그
- `src/pages/AIPage.jsx` — AI 로깅 + AiFeedback 연동
- `src/pages/RecommendPage.jsx` — AI 로깅 + AiFeedback 연동, filterAvailableCourses 병렬화, 훅 기반 저장
- `src/pages/FeedbackAdminPage.jsx` — 서버 인증으로 전환
- `src/pages/UpdateAdminPage.jsx` — 서버 인증으로 전환
- `src/services/feedbackService.js` — verifyAdminPassword API 방식, getDoc 직접 조회
- `src/hooks/useSchedule.js` — 테마 시스템, parseScheduleToTimes import
- `src/data/constants.js` — THEMES 5종 추가

---

*Generated: 2026-06-28*
