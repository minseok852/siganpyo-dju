# 대진대학교 강의시간표 이미지 → JSON 변환 프롬프트

당신은 대학교 강의시간표 이미지를 JSON으로 변환하는 작업을 합니다.

## ⚠️ 필수 조건
**이미지에 있는 모든 과목을 빠짐없이 전부 변환해야 합니다. 일부만 하고 멈추지 마세요. 끝까지 완료하세요.**

## 입력
- 강의시간표 이미지 (표 형식)
- 단과대학명: [여기에 입력]
- 학과명: [여기에 입력]

## 출력 형식

```json
{
  "college": "단과대학명",
  "semester": "2026학년도 1학기",
  "updated_at": "2026-01-28",
  "departments": [
    {
      "department_id": "학과ID (영문대문자, 예: ENGLISH)",
      "department_name": "학과명",
      "courses": [
        {
          "course_code": "교과번호 6자리",
          "course_name": "교과목명 (***포함시 그대로 유지)",
          "classification": "이수구분 (전선, 전필 등)",
          "target_year": 학년(숫자),
          "credits": 학점(숫자),
          "hours": 강의시간(숫자),
          "lab_hours": 실습시간(숫자, 없으면 0),
          "sections": [
            {
              "section": "분반 2자리 (01, 02 등)",
              "professor": "담당교수",
              "schedule": {
                "raw": "강의시간 원본 (예: 월10:00-11:30, 수10:00-11:30)",
                "days": ["월", "수"],
                "times": [
                  {"day": "월", "start": "10:00", "end": "11:30"},
                  {"day": "수", "start": "10:00", "end": "11:30"}
                ]
              },
              "room": {
                "raw": "강의실 전체 (예: 인301 - 영문A/V강의실)",
                "building": "건물약칭 (예: 인)",
                "building_full": "건물전체명 (예: 인문학관)",
                "room_number": "호실 (예: 301)",
                "room_type": "강의실 유형 (예: 강의실, PC실습실, A/V강의실)"
              },
              "capacity": 0,
              "notes": "비고 내용 (없으면 빈 문자열)"
            }
          ]
        }
      ]
    }
  ]
}
```

## 중요 규칙

### 1. 모든 과목 필수
이미지의 모든 행을 빠짐없이 변환하세요. 중간에 멈추거나 "나머지는 같은 방식으로..." 하지 마세요.

### 2. 홀수/짝수 주의 ⚠️
비고에서 **"홀수", "짝수"**를 절대 **"졸수", "작수"**로 잘못 읽지 마세요. 이건 학년 구분에 중요한 정보입니다.

### 3. 같은 과목 다른 분반
같은 course_code면 sections 배열에 추가:
```json
"sections": [
  {"section": "01", "professor": "김철수", ...},
  {"section": "02", "professor": "김철수", ...}
]
```

### 4. schedule 구조
- raw: 원본 텍스트 그대로
- days: 요일만 배열로
- times: 각 시간을 객체로 분리

예시: "월10:00-11:30, 수13:30-15:00"
```json
"schedule": {
  "raw": "월10:00-11:30, 수13:30-15:00",
  "days": ["월", "수"],
  "times": [
    {"day": "월", "start": "10:00", "end": "11:30"},
    {"day": "수", "start": "13:30", "end": "15:00"}
  ]
}
```

### 5. room 구조
- raw: 원본 텍스트 전체
- building: 건물 약칭
- building_full: 건물 전체명 (아래 목록 참고)
- room_number: 호실 번호만
- room_type: 강의실, PC실습실, A/V강의실, 영어회화실 등

### 6. lab_hours
표에서 "실" 열에 있는 숫자. 없으면 0

### 7. 교수명
외국인 이름도 그대로 유지 (예: "HILL BRIAN D", "Mark Burman")

### 8. 비고(notes)
줄바꿈 없이 한 줄로, 띄어쓰기 최소화

### 9. 교수명 주의사항 ⚠️
- 한글 이름: 비슷한 글자 주의 (희/의/회, 현/연/원, 수/주/우 등)
- 외국인 이름: 대문자 유지, 띄어쓰기 원본 그대로
- 불확실하면 이미지 원본을 최대한 정확히 작성

### 10. 알파벳/한글 구별 주의 ⚠️
과목명에서 영문 알파벳과 한글을 정확히 구별하세요:
- "AI와영어교육" → AI는 영문 알파벳 (인공지능)
- "사회학개론" → 사는 한글
- A, I 등 알파벳이 포함된 과목명 주의 (AI, IT, PR 등은 영문)
- 문맥상 영어 약자인지 한글인지 판단할 것

---

## 건물 약칭 목록 (필수 적용)

| 약칭 | 건물명 |
|------|--------|
| 체 | 체육관 |
| 본 | 본관 |
| 교 | 교수회관 |
| 대 | 대학원관 |
| 국 | 국제학관 |
| 학 | 학생회관 |
| 대교 | 대진교육관 |
| 파 | 파워플랜트 |
| 상 | 상생관 |
| 사 | 사회과학관 |
| 인 | 인문학관 |
| 정보 | 정보전산원 |
| 중도 | 중앙도서관 |
| 산학 | 산학협동실습관 |
| 공단A,B | 이공대 다동 |
| 공나A,B | 이공대 나동 |
| 공가A,B | 이공대 가동 |
| 박 | 박물관 |
| 행복 | 행복기숙사 |
| 예 | 예술관 |
| 학군 | 학군단 |
| 생활 | 생활과학관 |
| 음 | 음악학관 |
| 미 | 미술학관 |

---

## 예시 출력

```json
{
  "college": "인문예술대학",
  "semester": "2026학년도 1학기",
  "updated_at": "2026-01-28",
  "departments": [
    {
      "department_id": "ENGLISH",
      "department_name": "영어영문학과",
      "courses": [
        {
          "course_code": "022500",
          "course_name": "기초영어회화",
          "classification": "전선",
          "target_year": 1,
          "credits": 3,
          "hours": 6,
          "lab_hours": 0,
          "sections": [
            {
              "section": "01",
              "professor": "HILL BRIAN D",
              "schedule": {
                "raw": "수11:30-13:00, 금11:30-13:00",
                "days": ["수", "금"],
                "times": [
                  {"day": "수", "start": "11:30", "end": "13:00"},
                  {"day": "금", "start": "11:30", "end": "13:00"}
                ]
              },
              "room": {
                "raw": "인202 - 영어회화실-1",
                "building": "인",
                "building_full": "인문학관",
                "room_number": "202",
                "room_type": "영어회화실"
              },
              "capacity": 0,
              "notes": "영문과1학년우선신청,정정기간제한해제"
            }
          ]
        },
        {
          "course_code": "024012",
          "course_name": "***영문학개론",
          "classification": "전선",
          "target_year": 1,
          "credits": 3,
          "hours": 6,
          "lab_hours": 0,
          "sections": [
            {
              "section": "01",
              "professor": "변효정",
              "schedule": {
                "raw": "화14:00-15:30, 목14:00-15:30",
                "days": ["화", "목"],
                "times": [
                  {"day": "화", "start": "14:00", "end": "15:30"},
                  {"day": "목", "start": "14:00", "end": "15:30"}
                ]
              },
              "room": {
                "raw": "인301 - 영문A/V강의실",
                "building": "인",
                "building_full": "인문학관",
                "room_number": "301",
                "room_type": "A/V강의실"
              },
              "capacity": 0,
              "notes": "영문과1학년(홀수),자율전공학부만가능"
            }
          ]
        },
        {
          "course_code": "025023",
          "course_name": "스크린영어",
          "classification": "전선",
          "target_year": 1,
          "credits": 3,
          "hours": 6,
          "lab_hours": 0,
          "sections": [
            {
              "section": "01",
              "professor": "백승봉",
              "schedule": {
                "raw": "월13:30-15:00, 수15:30-17:00",
                "days": ["월", "수"],
                "times": [
                  {"day": "월", "start": "13:30", "end": "15:00"},
                  {"day": "수", "start": "15:30", "end": "17:00"}
                ]
              },
              "room": {
                "raw": "인201 - 스마트강의실",
                "building": "인",
                "building_full": "인문학관",
                "room_number": "201",
                "room_type": "스마트강의실"
              },
              "capacity": 0,
              "notes": "영문과1학년만신청가능"
            },
            {
              "section": "02",
              "professor": "백승봉",
              "schedule": {
                "raw": "월15:30-17:00, 수13:30-15:00",
                "days": ["월", "수"],
                "times": [
                  {"day": "월", "start": "15:30", "end": "17:00"},
                  {"day": "수", "start": "13:30", "end": "15:00"}
                ]
              },
              "room": {
                "raw": "인201 - 스마트강의실",
                "building": "인",
                "building_full": "인문학관",
                "room_number": "201",
                "room_type": "스마트강의실"
              },
              "capacity": 0,
              "notes": "영문과2-4학년만가능,셋째날10시부터전체"
            }
          ]
        }
      ]
    }
  ]
}
```

---

## ⚠️ 최종 확인사항
1. 이미지의 **모든 과목**을 변환했나요?
2. **홀수/짝수**를 정확히 읽었나요?
3. 같은 과목의 **다른 분반**은 sections 배열에 넣었나요?
4. **건물 약칭**을 올바른 건물명으로 매칭했나요?

모든 조건을 만족하면 JSON을 출력하세요.
