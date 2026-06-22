# services/modify_service.py
import os
import re
import json
import google.generativeai as genai

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))


# ──────────────────────────────────────────────
# 시간 유틸 (recommend_service와 동일 로직 인라인)
# ──────────────────────────────────────────────

def _parse_schedule_raw(schedule_raw: str) -> list:
    if not schedule_raw:
        return []
    times = []
    for segment in [s.strip() for s in schedule_raw.split(',')]:
        for part in [p.strip() for p in segment.split() if p.strip()]:
            m = re.match(r'^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$', part)
            if m:
                day, sh, sm, eh, em = m.groups()
                times.append({'day': day, 'start_min': int(sh)*60+int(sm), 'end_min': int(eh)*60+int(em)})
                continue
            m2 = re.match(r'^(월|화|수|목|금)([\d,]+)$', part)
            if m2:
                day, ps = m2.groups()
                periods = [int(p) for p in ps.split(',') if p.isdigit()]
                if periods:
                    times.append({'day': day, 'start_min': (8+min(periods))*60, 'end_min': (8+max(periods)+1)*60})
    return times


def _is_overlap(t1, t2) -> bool:
    return t1['day'] == t2['day'] and t1['start_min'] < t2['end_min'] and t1['end_min'] > t2['start_min']


def _validate_and_remove_conflicts(courses: list) -> tuple:
    validated, removed = [], []
    for course in courses:
        ctimes = _parse_schedule_raw(course.get('schedule_raw', ''))
        if not ctimes:
            validated.append(course)
            continue
        conflict_with = next(
            (ex.get('course_name') for ex in validated
             for ct in ctimes for et in _parse_schedule_raw(ex.get('schedule_raw', ''))
             if _is_overlap(ct, et)),
            None
        )
        if conflict_with:
            removed.append({'course_name': course.get('course_name', ''), 'conflict_with': conflict_with})
        else:
            validated.append(course)
    return validated, removed


def _calculate_empty_days(courses: list) -> list:
    occupied = {t['day'] for c in courses for t in _parse_schedule_raw(c.get('schedule_raw', ''))}
    return [d for d in ['월', '화', '수', '목', '금'] if d not in occupied]


# ──────────────────────────────────────────────
# 과목 목록 → 프롬프트 텍스트
# ──────────────────────────────────────────────

def _fmt_course(c: dict) -> str:
    return (f"[{c.get('course_code','?')}-{c.get('section','?')}] "
            f"{c.get('course_name','?')} | {c.get('professor','미정')} | "
            f"{c.get('schedule_raw','시간미정')} | {c.get('credits','?')}학점 | {c.get('category','?')}")


def _fmt_available(available: dict) -> str:
    labels = {
        'general_required': '교양필수', 'major_required': '전공필수',
        'major_elective': '전공선택', 'general_elective': '교양선택',
        'double_major_required': '복전필수', 'double_major_elective': '복전선택',
    }
    lines = []
    for key, label in labels.items():
        courses = available.get(key, [])
        if courses:
            lines.append(f"\n### {label} ({len(courses)}개)")
            for c in courses[:50]:
                lines.append(_fmt_course(c))
    return '\n'.join(lines)


# ──────────────────────────────────────────────
# 수정 타입별 세부 지침
# ──────────────────────────────────────────────

def _type_guidance(modify_type: str, modify_params: dict, current_courses: list, double_major: str) -> str:
    if modify_type == 'EMPTY_DAY':
        day = modify_params.get('day', '월')
        day_courses = [c for c in current_courses if day in (c.get('schedule_raw') or '')]
        mandatory = [c for c in day_courses if '필수' in (c.get('category') or '')]
        lines = [
            f"- {day}요일 과목({', '.join(c.get('course_name','') for c in day_courses) or '없음'})을 제거하거나 다른 요일로 대체해줘",
            "- 완전한 공강이 안 되면 warnings에 이유 쓰고 최대한 줄인 결과 반환",
        ]
        if mandatory:
            lines.append(f"- ⚠️ {day}요일에 필수 과목 있음: {', '.join(c.get('course_name','') for c in mandatory)} → 유의")
        return '\n'.join(lines)

    if modify_type == 'REMOVE_COURSE':
        name = modify_params.get('course_to_remove', '')
        return (f"- '{name}' 과목을 제거하고 같은 카테고리·비슷한 학점 과목으로 대체해줘\n"
                "- 대체 과목 없으면 그냥 제거하고 warnings에 이유 설명")

    if modify_type == 'NO_EARLY_MORNING':
        early = [c for c in current_courses if '9:30' in (c.get('schedule_raw') or '')]
        return (f"- 9:30 시작 수업: {', '.join(c.get('course_name','') for c in early) or '없음'}\n"
                "- 10:00 이후 시작 수업으로 대체해줘\n"
                "- 대체 과목 없으면 warnings에 이유 쓰고 기존 시간표 그대로 반환")

    if modify_type == 'ADD_MAJOR':
        dm = f"/복전" if double_major else ""
        return (f"- 교양 과목 일부를 전공{dm} 과목으로 교체해줘\n"
                "- 학점 초과 주의, 시간 충돌 절대 안 됨")

    if modify_type == 'REDUCE_GENERAL':
        gen = [c for c in current_courses if '교양' in (c.get('category') or '')]
        dm = f"/복전" if double_major else ""
        return (f"- 현재 교양: {', '.join(c.get('course_name','') for c in gen) or '없음'}\n"
                f"- 교양필수는 유지, 교양선택 위주로 줄이고 빠진 학점은 전공{dm}으로 채워줘")

    if modify_type == 'REDUCE_CREDITS':
        return "- 전공필수는 유지, 선택/교양 중 덜 중요한 것부터 제거해줘"

    if modify_type == 'INCREASE_CREDITS':
        return "- 현재 시간표에 충돌 없는 과목을 추가해줘"

    return ""


# ──────────────────────────────────────────────
# 프롬프트 빌드
# ──────────────────────────────────────────────

def _build_prompt(current_courses: list, modify_type: str, modify_params: dict,
                  available_courses: dict, user_info: dict) -> str:
    major = user_info.get('major', '알 수 없음')
    double_major = user_info.get('double_major')
    grade = user_info.get('grade', 1)
    credit_allocation = user_info.get('credit_allocation')
    current_credits = sum(c.get('credits', 0) for c in current_courses)

    request_map = {
        'EMPTY_DAY':       f"{modify_params.get('day','월')}요일 공강으로 수정해줘",
        'REMOVE_COURSE':   f"'{modify_params.get('course_to_remove','')}' 과목을 제거하고 대체해줘",
        'NO_EARLY_MORNING': "9시 30분 시작 수업을 없애줘 (10:00 이후로 대체)",
        'ADD_MAJOR':       "전공 과목을 더 넣어줘",
        'REDUCE_GENERAL':  "교양 과목을 줄여줘",
        'REDUCE_CREDITS':  "총 학점을 줄여줘",
        'INCREASE_CREDITS': "총 학점을 늘려줘",
    }
    request_desc = request_map.get(modify_type, modify_type)

    credit_alloc_text = ""
    if double_major and credit_allocation:
        credit_alloc_text = f"""
## 학점 배분 (복수전공)
- 주전공({major}): {credit_allocation.get('major', 0)}학점
- 복전({double_major}): {credit_allocation.get('double_major', 0)}학점
- 교양: {credit_allocation.get('general', 0)}학점"""

    dm_principles = ""
    if double_major:
        dm_principles = f"""- 수정 후에도 복전({double_major}) 과목 반드시 포함
- 주전공/복전 학점 배분 최대한 유지
- 주전공 과목은 {major} 과목만, 복전 과목은 {double_major} 과목만"""

    return f"""당신은 대진대학교 시간표 수정 전문가입니다.

## 학생 정보
- 학년: {grade}학년
- 전공: {major}
- 복수전공: {double_major or '없음'}
- 현재 시간표 총 학점: {current_credits}학점
{credit_alloc_text}

## 현재 시간표 ({len(current_courses)}개 과목)
{chr(10).join(_fmt_course(c) for c in current_courses)}

## 수정 요청
{request_desc}

## 수정 타입별 세부 지침
{_type_guidance(modify_type, modify_params, current_courses, double_major)}

## 핵심 원칙
- 강제로 바꾸지 말고 최대한 맞춰줘
- 불가능한 상황이면 억지로 하지 말고 warnings에 이유 설명하고 최선의 결과를 줘
- 전공필수/복전필수 같은 중요한 과목은 함부로 빼지 마
- 현재 시간표에서 최소한만 변경해줘
- 총 학점은 최대한 유지해줘 (REDUCE_CREDITS/INCREASE_CREDITS 요청 제외)
- 시간 겹침은 절대 안 됨
- 대진대 수업은 9시 30분부터 시작함
{dm_principles}

## 사용 가능한 과목 목록
{_fmt_available(available_courses)}

## 응답 형식 (JSON만, 다른 텍스트 없이)
{{
  "selected_courses": [
    {{
      "course_code": "과목코드",
      "section": "분반",
      "course_name": "과목명",
      "professor": "교수명",
      "schedule_raw": "화10:00-11:30",
      "credits": 3,
      "category": "전공선택"
    }}
  ],
  "warnings": [],
  "summary": "수정 내용 한 줄 요약"
}}"""


# ──────────────────────────────────────────────
# 과목 정보 보완 (available_courses의 원본 데이터로 채움)
# ──────────────────────────────────────────────

def _enrich(selected: list, available: dict) -> list:
    index = {}
    for courses in available.values():
        for c in courses:
            key = f"{c.get('course_code','')}-{c.get('section','01')}"
            index[key] = c
    for course in selected:
        key = f"{course.get('course_code','')}-{course.get('section','01')}"
        src = index.get(key, {})
        for field in ('department', 'college', 'room', 'times', 'classification', 'notes'):
            if not course.get(field):
                course[field] = src.get(field)
    return selected


# ──────────────────────────────────────────────
# 메인 함수
# ──────────────────────────────────────────────

async def modify_schedule(current_courses: list, modify_type: str, modify_params: dict,
                          available_courses: dict, user_info: dict) -> dict:
    try:
        prompt = _build_prompt(current_courses, modify_type, modify_params, available_courses, user_info)

        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.2,
                max_output_tokens=3000,
            )
        )

        text = response.text
        if '```json' in text:
            text = text.split('```json')[1].split('```')[0]
        elif '```' in text:
            text = text.split('```')[1].split('```')[0]

        result = json.loads(text.strip())
        selected = result.get('selected_courses', [])
        warnings = result.get('warnings', [])
        summary = result.get('summary', '시간표가 수정되었습니다.')

        selected = _enrich(selected, available_courses)
        validated, removed = _validate_and_remove_conflicts(selected)
        for r in removed:
            warnings.append(f"시간 충돌로 제거됨: {r['course_name']} ({r['conflict_with']}과 겹침)")

        return {
            'success': True,
            'selected_courses': validated,
            'total_credits': sum(c.get('credits', 0) for c in validated),
            'empty_days': _calculate_empty_days(validated),
            'warnings': warnings,
            'summary': summary,
        }

    except json.JSONDecodeError as e:
        return {'success': False, 'error': f'응답 파싱 실패: {str(e)}'}
    except Exception as e:
        return {'success': False, 'error': f'수정 중 오류: {str(e)}'}
