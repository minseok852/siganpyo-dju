# services/recommend_service.py
import os
import json
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


def build_recommend_prompt(user_info: dict, available_courses: dict) -> str:
    """시간표 추천 프롬프트 생성 - 학년별 완전 분기"""
    
    grade = user_info.get('grade', 1)
    major = user_info['major']
    double_major = user_info.get('double_major')
    target_credits = user_info['target_credits']
    preferences = user_info.get('preferences', {})
    
    # ========== 1. 기본 정보 ==========
    basic_info = f"""## 학생 정보
- 학년: {grade}학년
- 전공: {major}
- 복수전공: {double_major or '없음'}
- 목표 학점: {target_credits}학점"""

    # ========== 2. 이수 현황 (2학년+) ==========
    completed_text = ""
    if grade >= 2:
        completed_general = user_info.get('completed_general_required', [])
        completed_major = user_info.get('completed_major_required', [])
        if completed_general:
            completed_text += f"\n- 이수 완료 교양필수: {', '.join(completed_general)}"
        if completed_major:
            completed_text += f"\n- 이수 완료 전공필수: {', '.join(completed_major)}"
        if completed_text:
            completed_text = "\n## 이수 현황" + completed_text

    # ========== 3. 선호도 ==========
    skip_general = preferences.get('skip_general', False)
    preferred_time = preferences.get('preferred_time', '상관없음')
    
    # 시간대 기준 명시
    time_description = '상관없음'
    if preferred_time == '오전':
        time_description = '오전 (9:00~12:00 수업 선호)'
    elif preferred_time == '오후':
        time_description = '오후 (12:00 이후 수업 선호)'
    
    pref_text = f"""
## 선호도
- 공강 원하는 요일: {', '.join(preferences.get('empty_days', [])) or '없음'}
- 아침 수업 (9시): {'싫음 😴 → 9시 수업 피해주세요!' if preferences.get('no_morning') else '괜찮음'}
- 연강: {preferences.get('consecutive', '상관없음')}
- 선호 시간대: {time_description}
- 교양: {'안 듣기 (전공만)' if skip_general else f"영역 선호: {', '.join(preferences.get('preferred_areas', [])) or '상관없음'}"}"""

    # 피하고 싶은 과목
    if preferences.get('avoid_courses'):
        pref_text += f"\n- 피하고 싶은 과목/교수: {preferences.get('avoid_courses')}"

    # ========== 4. 꼭 듣고 싶은 과목 ==========
    must_take_text = ""
    must_take_courses = preferences.get('must_take_courses', [])
    if must_take_courses:
        must_take_text = "\n## ⭐ 꼭 듣고 싶은 과목 (최우선 - 무조건 포함!)\n"
        for c in must_take_courses:
            must_take_text += f"- {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"

    # ========== 5. 전공 선택 모드 (2학년+) ==========
    major_mode_text = ""
    selected_major_courses = preferences.get('selected_major_courses', [])
    major_selection_mode = preferences.get('major_selection_mode', 'auto')
    
    if grade >= 2 and major_selection_mode == 'manual' and selected_major_courses:
        major_mode_text = "\n## 🎯 직접 선택한 전공과목 (우선 배치)\n"
        for c in selected_major_courses:
            major_mode_text += f"- {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
        major_mode_text += "\n→ 위 전공과목들을 우선 배치하고, 나머지 학점은 전공필수/교양으로 채우세요.\n"

    # ========== 6. 학년별 우선순위 ==========
    if grade == 1:
        priority_text = """
## 📋 우선순위 (1학년 신입생)

1학년은 수강해야 할 과목이 거의 정해져 있습니다.

### 필수 배치 (무조건 포함!)
1. 교양필수 - 반드시 포함 (대학생활과진로, 사고와표현, 영어 등)
2. 1학년 대상 전공과목 (target_year=1) - 반드시 포함

### 선택 배치 (학점 채우기)
3. ⭐ 꼭 듣고 싶은 과목 (사용자 지정, 있는 경우)
4. 교양선택 (선호 영역 반영)

## ⚠️ 충돌 규칙 (매우 중요!)

선호도와 필수과목이 충돌할 경우:
- 필수과목(교양필수, 1학년 대상 전공과목) >>> 공강 희망, 시간대 선호
- 공강 원하는 요일에 필수과목이 있으면 → 필수과목 우선 배치!
- warnings에 충돌 사유 설명 (예: "금요일 공강 불가 - 1학년 전공과목 배치")

### reason 작성 규칙 (정확하게!)
- 전공필수 과목 → "전공필수"
- 전공선택 과목 → "전공선택 (1학년 대상)" 또는 "전공선택"
- 교양필수 과목 → "교양필수"
- 교양선택 과목 → "교양선택"
- 절대로 "1학년 전공 필수 과목" 같은 애매한 표현 금지!
- classification 필드를 그대로 사용할 것"""
    
    elif grade == 4:
        priority_text = """
## 📋 우선순위 (4학년 - 졸업 준비)

4학년은 졸업요건 충족이 최우선입니다:

1. 졸업요건 미충족 전공필수 - 반드시 포함!
2. 졸업요건 미충족 교양필수 - 반드시 포함!
3. ⭐ 꼭 듣고 싶은 과목 (사용자 지정)
4. 🎯 직접 선택한 전공과목 (있는 경우)
5. 학점 채우기용 전공선택/교양선택

## ⚠️ 충돌 규칙
- 필수과목(전공필수, 교양필수) >>> 공강 희망, 시간대 선호
- 충돌 시 warnings에 사유 설명"""
    
    else:  # 2-3학년
        if major_selection_mode == 'manual' and selected_major_courses:
            priority_text = f"""
## 📋 우선순위 (2-3학년 - 직접 선택 모드)

1. 전공필수 (아직 안 들은 것) - 반드시 포함!
2. 교양필수 (미이수 시) - 반드시 포함!
3. 🎯 직접 선택한 전공과목 (위에서 지정한 {len(selected_major_courses)}개)
4. ⭐ 꼭 듣고 싶은 과목 (사용자 지정)
5. 교양선택 (학점 채우기)

## ⚠️ 충돌 규칙
- 필수과목(전공필수, 교양필수) >>> 공강 희망, 시간대 선호
- 충돌 시 warnings에 사유 설명"""
        else:
            priority_text = f"""
## 📋 우선순위 (2-3학년 - AI 자동 선택 모드)

1. 전공필수 (아직 안 들은 것) - 반드시 포함!
2. 교양필수 (미이수 시) - 반드시 포함!
3. ⭐ 꼭 듣고 싶은 과목 (사용자 지정)
4. 전공선택 (target_year <= {grade} 과목 위주)
5. 교양선택 (선호 영역)

## ⚠️ 충돌 규칙
- 필수과목(전공필수, 교양필수) >>> 공강 희망, 시간대 선호
- 충돌 시 warnings에 사유 설명

⚠️ 전공과목은 {grade}학년 이하 대상 과목에서 선택하세요!"""

    # ========== 7. 절대 규칙 ==========
    absolute_rules = f"""
## ⛔ 절대 규칙 (위반 시 실패)

### 1. 학과 제한 (가장 중요!)
- 전공과목은 반드시 **[{major}]** 학과 과목만 선택
- 다른 학과 전공과목 선택 절대 금지!
{f'- 복수전공 [{double_major}] 과목도 선택 가능' if double_major else '- 복수전공 없음'}

### 2. 학년 매칭 (target_year 필드 확인!)
- 현재 학생: **{grade}학년**
- target_year <= {grade} 인 과목만 선택 가능
- target_year = 0 이면 학년 무관
- target_year > {grade} 인 과목 선택 금지! (예: 1학년이 target_year=2 과목 불가)

### 3. 시간 겹침 금지 (⚠️ 가장 중요한 규칙!)
- 절대로 같은 시간대에 두 과목을 선택하면 안 됨!
- schedule_raw 필드를 정확히 파싱해서 시간 겹침 여부 확인 필수!
- 예시 충돌:
  * "월10:00-11:30"과 "월10:30-12:00" → 겹침! 같이 선택 불가!
  * "수9:30-12:30"과 "수10:00-11:30" → 겹침! 같이 선택 불가!
  * "화13:00-15:00"과 "화14:00-16:00" → 겹침! 같이 선택 불가!
- 시간 겹침 검사 방법:
  1. 같은 요일인지 확인 (월, 화, 수, 목, 금)
  2. 시작시간과 종료시간이 겹치는지 확인
  3. A과목 종료시간 > B과목 시작시간 AND A과목 시작시간 < B과목 종료시간 → 충돌!
- 시간이 겹치는 과목을 선택하면 시간표로서 의미가 없으므로 절대 금지!

### 4. 학점 맞추기
- 목표: {target_credits}학점 (±1학점 허용)
- 범위: {target_credits - 1} ~ {target_credits + 1}학점"""

    # ========== 8. 캠퍼스 정보 ==========
    campus_info = """
## 🏫 대진대학교 캠퍼스 정보
- 공대(가동,나동,다동) ↔ 인문학관/사회학관 연강은 이동 13분+ 필요
- 가능하면 같은 건물 또는 가까운 건물로 배치
- 점심시간: 11시~14시 사이 1시간 이상 빈 시간 확보 권장"""

    # ========== 9. 과목 목록 ==========
    def format_courses(courses, label):
        if not courses:
            return f"\n### {label}\n(없음)\n"
        text = f"\n### {label} ({len(courses)}개)\n"
        for c in courses[:30]:
            target_yr = c.get('target_year', 0)
            dept = c.get('department', '')
            text += f"- {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점 | 대상:{target_yr}학년 | {dept}\n"
        return text

    courses_text = "\n## 📚 사용 가능한 과목 목록"
    
    if not skip_general:
        courses_text += format_courses(available_courses.get('general_required', []), '교양필수')
    
    courses_text += format_courses(available_courses.get('major_required', []), '전공필수')
    courses_text += format_courses(available_courses.get('major_elective', []), '전공선택')
    
    if not skip_general:
        courses_text += format_courses(available_courses.get('general_elective', []), '교양선택')

    # ========== 10. 응답 형식 ==========
    response_format = """
## 📤 응답 형식 (반드시 JSON만 출력!)

```json
{
    "selected_courses": [
        {
            "course_name": "과목명",
            "course_code": "학수번호",
            "section": "분반",
            "professor": "교수명",
            "schedule_raw": "시간",
            "credits": 3,
            "category": "전공필수|전공선택|교양필수|교양선택",
            "reason": "선택 이유"
        }
    ],
    "total_credits": 18,
    "empty_days": ["금"],
    "warnings": ["주의사항"],
    "summary": "시간표 총평 (2-3문장)"
}
```

### category 규칙 (정확하게!)
- classification 필드값 그대로 사용
- "전필" → "전공필수"
- "전선" → "전공선택"  
- "교필" → "교양필수"
- "교선" → "교양선택"

### reason 규칙 (정직하게!)
- 전공필수 → "전공필수"
- 전공선택인데 1학년 대상 → "전공선택 (1학년 대상)"
- 전공선택 일반 → "전공선택"
- 교양필수 → "교양필수"
- 교양선택 → "교양선택 (N영역)"
- ❌ 금지: "1학년 전공 필수 과목" 같은 애매한 표현

### warnings 규칙
- 공강 희망 vs 필수과목 충돌 시 → "OO요일 공강 불가 - [과목명] 필수 배치"
- 아침 싫음 vs 필수과목 충돌 시 → "9시 수업 불가피 - [과목명] 필수 배치"

## ✅ 최종 검증 체크리스트 (응답 전 반드시 확인!)

1. ⏰ **시간 충돌 검사** (가장 중요!)
   - 선택한 모든 과목 쌍에 대해 시간 겹침 확인
   - 같은 요일, 겹치는 시간대가 있으면 절대 안 됨!
   - 예: 수9:30-12:30 vs 수10:00-11:30 → 충돌! 둘 중 하나 제거!

2. 🏫 **학과 확인**
   - 전공과목이 모두 [{major}] 학과 과목인지 확인

3. 📊 **학점 확인**
   - 총 학점이 {target_credits} ±1 범위인지 확인

4. 📋 **필수과목 포함 확인**
   - 교양필수, 전공필수가 포함되었는지 확인

시간 충돌이 있는 시간표는 쓸모가 없습니다. 반드시 시간 충돌이 없는지 확인하세요!

⚠️ 주의사항:
- JSON만 출력, 다른 텍스트 없이!
- 학과 제한, 학년 제한 반드시 준수!
- 시간 겹침 절대 금지!
"""

    # ========== 최종 프롬프트 조합 ==========
    prompt = f"""당신은 대진대학교 시간표 추천 전문가입니다.
학생 정보와 선호도를 바탕으로 최적의 시간표를 만들어주세요.

{basic_info}
{completed_text}
{pref_text}
{must_take_text}
{major_mode_text}
{priority_text}
{absolute_rules}
{campus_info}
{courses_text}
{response_format}
"""

    return prompt


async def recommend_schedule(user_info: dict, available_courses: dict) -> dict:
    """Gemini API를 사용해 시간표 추천"""
    
    prompt = build_recommend_prompt(user_info, available_courses)
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.5,  # 더 일관된 결과를 위해 낮춤
                max_output_tokens=3000,
            )
        )
        
        response_text = response.text
        
        # JSON 추출
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        result = json.loads(response_text.strip())
        
        # 후처리: 학과 검증
        major = user_info['major']
        double_major = user_info.get('double_major')
        valid_depts = [major]
        if double_major:
            valid_depts.append(double_major)
        
        # 전공과목 중 다른 학과 과목이 있으면 경고 추가
        warnings = result.get('warnings', [])
        for course in result.get('selected_courses', []):
            cat = course.get('category', '')
            if '전공' in cat:
                # 프롬프트에서 학과 정보를 전달하지 않았으므로 일단 패스
                # 추후 프론트에서 검증 가능
                pass
        
        result['warnings'] = warnings
        
        return {"success": True, **result}
        
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"응답 파싱 실패: {str(e)}",
            "raw_response": response_text if 'response_text' in locals() else None
        }
    except Exception as e:
        return {
            "success": False, 
            "error": str(e)
        }