# services/recommend_service.py
import os
import json
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

def build_recommend_prompt(user_info: dict, available_courses: dict) -> str:
    """시간표 추천 프롬프트 생성"""
    
    # 이수 현황 텍스트
    completed_text = ""
    if user_info.get('grade', 1) >= 2:
        completed_general = user_info.get('completed_general_required', [])
        completed_major = user_info.get('completed_major_required', [])
        if completed_general:
            completed_text += f"- 이수한 교양필수: {', '.join(completed_general)}\n"
        if completed_major:
            completed_text += f"- 이수한 전공필수: {', '.join(completed_major)}\n"
    
    # 선호도 텍스트
    preferences = user_info.get('preferences', {})
    
    # 교양 옵션
    skip_general = preferences.get('skip_general', False)
    general_option_text = "교양 안 듣기 (전공만)" if skip_general else f"듣고 싶은 교양 영역: {', '.join(preferences.get('preferred_areas', [])) or '상관없음'}"
    
    pref_text = f"""
- 공강 원하는 요일: {', '.join(preferences.get('empty_days', [])) or '없음'}
- 아침 수업 (9시): {'싫음' if preferences.get('no_morning') else '괜찮음'}
- 연강 선호: {preferences.get('consecutive', '상관없음')}
- 선호 시간대: {preferences.get('preferred_time', '상관없음')}
- 교양 옵션: {general_option_text}
"""
    
    # 꼭 듣고 싶은 과목 (우선순위 1)
    must_take_text = ""
    must_take_courses = preferences.get('must_take_courses', [])
    if must_take_courses:
        must_take_text = "\n## ⭐ 꼭 듣고 싶은 과목 (최우선 배치)\n"
        for c in must_take_courses:
            must_take_text += f"- {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
        must_take_text += "\n※ 위 과목들은 반드시 시간표에 포함해주세요!\n"

    # 추가 요청
    additional = ""
    if preferences.get('avoid_courses'):
        additional += f"- 피하고 싶은 과목/교수: {preferences.get('avoid_courses')}\n"

    # 과목 목록 텍스트
    def format_courses(courses, label):
        if not courses:
            return f"\n### {label}\n없음\n"
        text = f"\n### {label} ({len(courses)}개)\n"
        for c in courses[:30]:
            notes = f" [비고: {c.get('notes')}]" if c.get('notes') else ""
            text += f"- {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점{notes}\n"
        return text

    # 교양 안 듣기면 교양 과목 제외
    courses_text = ""
    if not skip_general:
        courses_text += format_courses(available_courses.get('general_required', []), '교양필수')
    courses_text += format_courses(available_courses.get('major_required', []), '전공필수')
    courses_text += format_courses(available_courses.get('major_elective', []), '전공선택')
    if not skip_general:
        courses_text += format_courses(available_courses.get('general_elective', []), '교양선택')

    # 우선순위 설명
    if skip_general:
        priority_text = """
## 우선순위 (교양 제외)
1. ⭐ 꼭 듣고 싶은 과목 (사용자가 직접 선택한 과목 - 무조건 포함)
2. 전공필수 (비고란 → 학년 우선 확인)
3. 전공선택
※ 교양 과목은 제외하고 전공만으로 학점을 채워주세요."""
    else:
        priority_text = """
## 우선순위
1. ⭐ 꼭 듣고 싶은 과목 (사용자가 직접 선택한 과목 - 무조건 포함)
2. 교양필수 (비고란 → 학과 우선 확인)
3. 전공필수 (비고란 → 학년 우선 확인)
4. 전공선택
5. 교양선택 (선호 영역 반영)"""

    return f"""당신은 대진대학교 시간표 추천 전문가입니다.
학생의 정보와 선호도를 바탕으로 최적의 시간표를 만들어주세요.

## 학생 정보
- 학년: {user_info['grade']}학년
- 전공: {user_info['major']}
- 복수전공: {user_info.get('double_major') or '없음'}
- 목표 학점: {user_info['target_credits']}학점
{completed_text}

## 선호도
{pref_text}
{additional}
{must_take_text}
{priority_text}

## 대진대학교 시간표 규칙
1. **비고란 확인**: 
   - "OO학과 우선" → 해당 학과 학생에게 우선 배정
   - "O학년 우선" → 해당 학년 학생에게 우선 배정
   - 학생에게 맞는 분반 선택할 것
2. **시간 겹침 금지**: 같은 시간에 두 과목 불가
3. **연강 주의**: 
   - 공대 ↔ 인문학관/사회학관 연강은 이동시간 13분+ 필요
   - 가능하면 같은 건물 또는 가까운 건물로 배치
4. **점심시간**: 11시~14시 사이 1시간 이상 빈 시간 확보 권장

## 사용 가능한 과목 목록
{courses_text}

## 응답 형식 (반드시 JSON만 출력)
{{
    "selected_courses": [
        {{
            "course_name": "과목명",
            "course_code": "학수번호",
            "section": "분반",
            "professor": "교수명",
            "schedule_raw": "시간",
            "credits": 3,
            "category": "카테고리",
            "reason": "선택 이유 (한 줄)"
        }}
    ],
    "total_credits": 18,
    "empty_days": ["금"],
    "warnings": [
        "월요일 2-3교시 연강 동선 주의"
    ],
    "summary": "시간표 총평 (2-3문장)"
}}

주의사항:
- ⭐ 꼭 듣고 싶은 과목은 반드시 포함
- 목표 학점에 맞게 과목 선택 (±1학점 허용)
- 시간이 겹치는 과목 절대 선택 금지
- 학생의 선호도 최대한 반영
- 비고란의 학과/학년 우선 정보 반드시 확인
- JSON만 출력, 다른 텍스트 없이"""


async def recommend_schedule(user_info: dict, available_courses: dict) -> dict:
    """Gemini API를 사용해 시간표 추천"""
    
    prompt = build_recommend_prompt(user_info, available_courses)
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
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