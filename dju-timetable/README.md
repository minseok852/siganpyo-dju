# 🎓 대진대 시간표 도우미

에브리타임 업데이트가 늦어서 시간표 짜기 힘들었죠?  
AI가 도와주는 스마트한 대진대 시간표 만들기!

## ✨ 주요 기능

- 📚 **과목 검색 & 시간표 만들기** - 전체 학과 과목 검색, 시간 겹침 자동 체크
- 📷 **이미지 저장** - 내 시간표를 이미지로 저장
- 🤖 **AI 시간표 평가** - 내 시간표 밸런스 분석
- 🎯 **AI 시간표 추천** - 조건에 맞는 시간표 자동 생성
- 🔥 **인기 시간표** - 다른 학생들이 많이 담은 시간표 보기

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일에 Firebase 설정 입력

# 3. 개발 서버 실행
npm run dev
```

## 🔧 기술 스택

- **Frontend**: React + Vite + Tailwind CSS
- **Database**: Firebase Firestore
- **AI**: Claude API / Gemini API
- **배포**: Vercel

## 📁 프로젝트 구조

```
src/
├── components/
│   ├── schedule/     # 시간표 관련 컴포넌트
│   └── ai/           # AI 기능 컴포넌트
├── pages/            # 페이지 컴포넌트
├── hooks/            # 커스텀 훅
├── utils/            # 유틸리티 함수
├── services/         # Firebase, AI API
└── data/             # 상수, 설정
```

## 📊 데이터

`firebase_courses.json` - 2026학년도 1학기 전체 과목 데이터 (1,318개)

- 교양필수: 117개
- 교양선택: 278개  
- 전공: 852개
- 융합전공: 54개
- 특수(ROTC/교직): 17개

## 🔥 Firebase 설정

1. [Firebase Console](https://console.firebase.google.com)에서 프로젝트 생성
2. Firestore Database 활성화
3. 웹 앱 추가 후 설정 값 복사
4. `.env` 파일에 붙여넣기
5. `firebase_courses.json` 데이터 업로드

## 📝 개발 일정

- [x] Day 1: 프로젝트 셋업 + 데이터 준비
- [ ] Day 2: 시간표 UI 핵심
- [ ] Day 3: 과목 검색 + 저장
- [ ] Day 4: AI 기능
- [ ] Day 5: 마무리 + 배포

## 👨‍💻 만든 사람

대진대학교 컴퓨터공학과

---

⭐ 도움이 되었다면 Star 부탁드립니다!
