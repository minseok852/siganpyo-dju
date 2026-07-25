# Handoff: 메인 시간표 화면 리디자인

## Overview
대진대 시간표 웹앱(dju-timetable, React) 메인 화면의 반응형·비주얼 개선. 모바일 레이아웃 붕괴, 이모지/아이콘 혼용, 여백·타이포 계층, 작은 UX 버그를 정리했다.

## About the Design Files
`Timetable Redesign.dc.html`은 **디자인 레퍼런스**로 HTML/인라인 스타일로 만든 목업이다. 프로덕션 코드로 그대로 복붙하지 말 것. 기존 리포(`minseok852/siganpyo-dju`, `dju-timetable/` — React + Tailwind)의 컴포넌트 구조(`src/pages/HomePage.jsx`, `src/components/schedule/ScheduleGrid.jsx`, `src/components/schedule/CourseBlock.jsx`, `src/index.css`, `src/data/constants.js`)와 기존 패턴(Tailwind 유틸리티 클래스, lucide-react 아이콘)을 그대로 사용해 이 디자인을 재현할 것.

## Fidelity
**High-fidelity.** 색상 hex, 타이포 크기/굵기, 간격, border-radius가 최종값. 아래 명세대로 픽셀 단위로 재현한다.

## Screens / Views

### 1. 헤더 (전역, 데스크톱 + 모바일)
- 데스크톱: 높이 60px, 배경 `#FFFFFF`, 하단 보더 `1px solid #EBEEF3`, 좌우 패딩 28px. 좌측 로고(북 아이콘, `#2F6FEB`) + "대진대 시간표"(17px/800/`#1E2530`). 우측 nav 6개 항목(피드백/업데이트/FAQ/AI평가/졸업계산기/인기), 각 라인아이콘(16px, `#9AA3B2`) + 라벨(13px/600/`#5B6472`), gap 28px.
- 모바일(390px 기준): 높이 52px, 좌우 패딩 16px. 로고만 축소(19px 아이콘/15px 텍스트). nav는 두 방식 중 택1(Tweaks로 비교 가능):
  - `icon_row`: 헤더 아래 가로 스크롤 아이콘열(30×30 `#F1F4FA` 배경 원형 버튼 + 9.5px 라벨)
  - `hamburger`: 우측 햄버거 버튼 → 드롭다운 메뉴(각 항목 아이콘+라벨, 세로 리스트)
- 모든 텍스트에 `white-space: nowrap` + 컨테이너에 `flex-shrink:0`/`min-width` 적용해 줄바꿈·겹침 방지 (기존 버그 수정 포인트).

### 2. 탭바 (시간표 선택)
- 활성 탭: 배경 `#FFFFFF`, 텍스트 `#2F6FEB`/700, 학점 배지 `#EAF1FE` 배경/`#2F6FEB` 텍스트
- 비활성 탭: 배경 투명, 텍스트 `#8892A4`, 배지 `#EEF1F6`/`#9AA3B2`
- 새 시간표 추가(+) 버튼 우측 끝
- **버그 수정**: 새 시간표 기본 이름은 항상 다음 번호로 순차 생성(기존: "시간표 3" 중복 발생)

### 3. 통계·액션 바
- 좌측: 학점/과목 수 큰 숫자(26px/800, 데스크톱 · 21px/800 모바일) + 라벨(12.5px/`#8892A4`), "금요일 공강" 같은 하이라이트(`#1FA97A`)
- 우측: Primary 버튼 "과목 추가"(`#2F6FEB` 배경), Secondary 버튼 "AI로 만들기"(`#1E2530` 배경), 아이콘 버튼(공유/전송/초기화 — 초기화만 red `#E5484D`/`#FEF4F4`)
- 모바일: 버튼 2개는 `flex:1`로 각각 채워 라벨이 절대 잘리지 않게(기존 버그: 텍스트 잘림), 아이콘 버튼은 36×36 고정

### 4. 시간표 그리드
- 요일 헤더(월~금) + 시간축(9~15시), 셀 높이 30px(데스크톱)/22px(모바일)
- 과목 블록: `border-radius:8px`, `border:1.5px solid`, 배경/보더/텍스트 컬러 페어 예: 코랄(`#FFDEE1`/`#FF9BA3`/`#C23A46`), 퍼플(`#EBE0FB`/`#B78FF2`/`#6C3FC4`), 블루(`#DCE8FF`/`#7CA6FF`/`#2D5FCC`), 그린(`#DFF5E6`/`#7DD6A0`/`#1F8A54`), 옐로우(`#FFF1C4`/`#EACB5C`/`#9C7A0E`)
- 과목명(12.5px/700) / 교수·강의실(10.5px/opacity .75) / 시간(9.5px/opacity .55)
- 하단 "온라인 과목" 행: 좌측 컬러 바(4px, `#E77FC0`) + 과목명(핑크 `#B23E85`) + "온라인" 배지(`#FDE1F1`/`#B23E85`) + 삭제 버튼. **버그 수정**: 삭제 버튼을 26×26px로 키워 모바일 터치 타깃 확보(기존: 너무 작음)

## Interactions & Behavior
- 탭 클릭 → 해당 시간표로 전환(활성 스타일 토글)
- 모바일 햄버거 클릭 → 드롭다운 토글
- 과목 블록 클릭 → 상세/편집 (기존 동작 유지)
- 반응형: 데스크톱 1240px / 모바일 390px 기준 설계, 그 사이 구간은 기존 브레이크포인트에 맞춰 유동 처리

## State Management
- 활성 탭 id
- 모바일 메뉴 열림/닫힘 상태
- (신규) 시간표 생성 시 이름 자동 증가 로직 — 기존 이름 목록에서 다음 사용 가능한 번호를 계산

## Design Tokens
- **Primary blue**: `#2F6FEB` / **hover 시** 살짝 어둡게 (~`#2559C4`)
- **Ink**: `#1E2530` (제목), `#3A4150`, `#5B6472`, `#8892A4`, `#9AA3B2`, `#B0B7C3` (톤 다운 순)
- **Surface**: 배경 `#EEF1F6`/`#F6F8FB`, 카드 `#FFFFFF`, 서브 `#F9FAFC`/`#FBFCFE`
- **Border**: `#EBEEF3`, `#EEF1F5`, `#E4E8F0`, `#F3F5F8`
- **Semantic**: 성공/공강 `#1FA97A`, 위험/초기화 `#E5484D`+`#FEF4F4`+`#FBD8D8`
- **Course palette**: 코랄/퍼플/블루/그린/옐로우 (hex는 위 그리드 섹션 참조), 온라인 과목 핑크 `#E77FC0`/`#B23E85`/`#FDE1F1`
- **Radius**: 카드 14px, 버튼 9px, 배지 6~20px(pill)
- **Spacing**: 데스크톱 컨테이너 패딩 24~28px, 카드 내부 패딩 16~20px, 모바일은 약 30~40% 축소
- **Typography**: 시스템 폰트(-apple-system 등), 굵기 600~800 위주로 계층 구분, 본문 11~13px / 통계 숫자 21~26px

## Assets
- 아이콘: 커스텀 라인 아이콘(SVG, stroke 기반, 1.6~1.7px stroke-width) — 파일 내 `ICON` 객체에 인라인 정의됨. 프로덕션에서는 lucide-react 동급 아이콘(book-open, mail, file-text, help-circle, sparkles, flame 등)으로 대체 가능
- 이모지는 선택적 표시 옵션으로만 유지(Tweaks의 `showEmoji`), 기본은 아이콘 사용

## Files
- `Timetable Redesign.dc.html` — 데스크톱/모바일 목업 전체 (HTML, 참고용, 그대로 배포 금지)
- 기존 코드 참고 위치: `dju-timetable/src/pages/HomePage.jsx`, `src/components/schedule/ScheduleGrid.jsx`, `src/components/schedule/CourseBlock.jsx`, `src/data/constants.js`, `src/index.css`
