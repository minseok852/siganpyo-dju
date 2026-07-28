# services/recommend_service.py
import os
import json
import asyncio
from collections import defaultdict

from services import gemini

MAX_OUTPUT_TOKENS = gemini.MAX_OUTPUT_TOKENS

def build_recommend_prompt(user_info: dict, available_courses: dict) -> str:
    """시간표 추천 프롬프트 생성 - 학년별 완전 분기 + 복수전공 지원"""
    
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
        completed_dm_required = user_info.get('completed_double_major_required', [])
        completed_dm_elective = user_info.get('completed_double_major_elective', [])
        
        if completed_general:
            completed_text += f"\n- 이수 완료 교양필수: {', '.join(completed_general)}"
        if completed_major:
            completed_text += f"\n- 이수 완료 전공필수 ({major}): {', '.join(completed_major)}"
        if double_major and completed_dm_required:
            completed_text += f"\n- 이수 완료 복전 전필 ({double_major}): {', '.join(completed_dm_required)}"
        if double_major and completed_dm_elective:
            completed_text += f"\n- 이수 완료 복전 전선 ({double_major}): {', '.join(completed_dm_elective)}"
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

    # 이수 완료 교양 영역
    completed_areas = preferences.get('completed_areas', [])
    if completed_areas:
        pref_text += f"\n- 이수 완료 교양 영역 (제외): {', '.join(completed_areas)}"
    
    # 이수 완료 전공선택
    completed_major_elective = preferences.get('completed_major_elective', [])
    if completed_major_elective:
        pref_text += f"\n- 이수 완료 전공선택 (제외): {', '.join(completed_major_elective)}"

    # 이수 완료 복전 전선
    completed_dm_elective_pref = preferences.get('completed_double_major_elective', [])
    if completed_dm_elective_pref:
        pref_text += f"\n- 이수 완료 복전 전선 (제외): {', '.join(completed_dm_elective_pref)}"

    # 피하고 싶은 과목 (문자열 배열 또는 단일 문자열)
    avoid_courses = preferences.get('avoid_courses', [])
    if avoid_courses:
        if isinstance(avoid_courses, list) and len(avoid_courses) > 0:
            # 문자열 배열인 경우
            if isinstance(avoid_courses[0], str):
                pref_text += f"\n- 🚫 듣기 싫은 과목: {', '.join(avoid_courses)}"
            # 객체 배열인 경우 (이전 버전 호환)
            elif isinstance(avoid_courses[0], dict):
                avoid_text = ", ".join([c.get('course_name', '') for c in avoid_courses])
                pref_text += f"\n- 🚫 듣기 싫은 과목: {avoid_text}"
        elif isinstance(avoid_courses, str) and avoid_courses.strip():
            pref_text += f"\n- 🚫 피하고 싶은 과목/교수: {avoid_courses}"

    # ========== 4. 꼭 듣고 싶은 과목 ==========
    must_take_text = ""
    must_take_courses = preferences.get('must_take_courses', [])
    if must_take_courses:
        must_take_text = "\n## ⭐ 꼭 듣고 싶은 과목 (최우선 - 무조건 포함!)\n"
        for c in must_take_courses:
            must_take_text += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"

    # ========== 5. 전공 선택 모드 (2학년+) ==========
    major_mode_text = ""
    selected_major_courses = preferences.get('selected_major_courses', [])
    selected_dm_courses = preferences.get('selected_double_major_courses', [])
    major_selection_mode = preferences.get('major_selection_mode', 'auto')
    
    # 학점 배분 (복수전공)
    credit_allocation = preferences.get('credit_allocation')
    credit_alloc_text = ""
    if double_major and credit_allocation:
        major_credits = credit_allocation.get('major', 0)
        dm_credits = credit_allocation.get('double_major', 0)
        gen_credits = credit_allocation.get('general', 0)
        credit_alloc_text = f"""
## 📊 학점 배분 & 과목 선택 절차 (반드시 이 순서대로!)

학생이 지정한 학점 배분:
- 🔵 주전공({major}) 잔여: {major_credits}학점
- 🟢 복전({double_major}) 잔여: {dm_credits}학점
- 🟡 교양 잔여: {gen_credits}학점

### 📝 아래 절차를 순서대로 따라가며 과목을 선택하세요:

**[Step 1] 주전공 전필 배치** ({major})
- 아직 안 들은 주전공 전필을 선택 → 🔵 주전공 잔여에서 학점 차감
- 예: 전필 3학점 선택 → 주전공 잔여: {major_credits} - 3 = {major_credits - 3}학점

**[Step 2] 복전 전필 배치** ({double_major})
- 아직 안 들은 복전 전필을 선택 → 🟢 복전 잔여에서 학점 차감
- 예: 복전필 3학점 선택 → 복전 잔여: {dm_credits} - 3 = {dm_credits - 3}학점

**[Step 3] 교양필수 배치**
- 아직 안 들은 교양필수를 선택 → 🟡 교양 잔여에서 학점 차감

**[Step 4] 꼭 듣고 싶은 과목 / 직접 선택 과목 배치**
- 사용자가 지정한 과목 배치 → 해당 영역 잔여에서 차감

**[Step 5] 남은 주전공 학점 채우기**
- 🔵 주전공 잔여가 0보다 크면 → 주전공 전선 추가 → 차감
- 🔵 잔여가 0이 되면 주전공 끝!

**[Step 6] 남은 복전 학점 채우기**
- 🟢 복전 잔여가 0보다 크면 → 복전 전선 추가 → 차감
- 🟢 잔여가 0이 되면 복전 끝!

**[Step 7] 남은 교양 학점 채우기**
- 🟡 교양 잔여가 0보다 크면 → 교양선택 추가 → 차감
- 🟡 잔여가 0이 되면 교양 끝!

**[완료 조건]** 🔵=0, 🟢=0, 🟡=0 → 모든 잔여가 0이면 시간표 완성!

⚠️ 각 영역 ±1학점까지 허용하지만, 가능한 정확히 맞추세요.
⚠️ 시간 겹침은 매 과목 추가 시 확인하세요!"""

    if grade >= 2 and major_selection_mode == 'manual':
        if selected_major_courses or selected_dm_courses:
            major_mode_text = "\n## 🎯 직접 선택한 전공과목 (우선 배치)\n"
            if selected_major_courses:
                major_mode_text += f"\n### 주전공 ({major}) 직접 선택:\n"
                for c in selected_major_courses:
                    major_mode_text += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
            if selected_dm_courses:
                major_mode_text += f"\n### 복수전공 ({double_major}) 직접 선택:\n"
                for c in selected_dm_courses:
                    major_mode_text += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
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

- classification 필드를 그대로 사용할 것"""
    
    elif grade == 4:
        if double_major:
            alloc_info_4 = ""
            if credit_allocation:
                mc = credit_allocation.get('major', 0)
                dc = credit_allocation.get('double_major', 0)
                gc = credit_allocation.get('general', 0)
                alloc_info_4 = f"""
⚡ 학생 지정 학점: 🔵주전공 {mc}학점 / 🟢복전 {dc}학점 / 🟡교양 {gc}학점
→ 위 Step 1~7 절차에 따라 각 영역 잔여를 0으로 만드세요!"""

            priority_text = f"""
## 📋 우선순위 (4학년 - 졸업 준비 + 복수전공)

4학년은 졸업요건 충족이 최우선입니다:
{alloc_info_4}

1. 졸업요건 미충족 주전공 전필 ({major}) - 반드시 포함! → 🔵에서 차감
2. 졸업요건 미충족 복전 전필 ({double_major}) - 반드시 포함! → 🟢에서 차감
3. 졸업요건 미충족 교양필수 - 반드시 포함! → 🟡에서 차감
4. ⭐ 꼭 듣고 싶은 과목 (사용자 지정) → 해당 영역에서 차감
5. 🎯 직접 선택한 전공과목 (있는 경우) → 해당 영역에서 차감
6. 주전공 전선 ({major}) → 🔵 잔여가 남으면 채우기
7. 복전 전선 ({double_major}) → 🟢 잔여가 남으면 채우기
8. 학점 채우기용 교양선택 → 🟡 잔여가 남으면 채우기

## ⚠️ 충돌 규칙
- 필수과목(주전공 전필, 복전 전필, 교양필수) >>> 공강 희망, 시간대 선호
- 충돌 시 warnings에 사유 설명"""
        else:
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
        if double_major:
            # 학점 배분 정보 추출
            alloc_info = ""
            if credit_allocation:
                mc = credit_allocation.get('major', 0)
                dc = credit_allocation.get('double_major', 0)
                gc = credit_allocation.get('general', 0)
                alloc_info = f"""
⚡ 학생 지정 학점: 🔵주전공 {mc}학점 / 🟢복전 {dc}학점 / 🟡교양 {gc}학점
→ 위 Step 1~7 절차에 따라 각 영역 잔여를 0으로 만드세요!"""

            # 복수전공 있는 경우
            if major_selection_mode == 'manual' and (selected_major_courses or selected_dm_courses):
                total_selected = len(selected_major_courses) + len(selected_dm_courses)
                priority_text = f"""
## 📋 우선순위 (2-3학년 - 복수전공 + 직접 선택 모드)

⚠️ 복수전공({double_major}) 학생! 위 Step 1~7 절차를 따르세요!
{alloc_info}

1. 주전공 전필 ({major}, 아직 안 들은 것) → 🔵에서 차감
2. 복전 전필 ({double_major}, 아직 안 들은 것) → 🟢에서 차감
3. 교양필수 (미이수 시) → 🟡에서 차감
4. 🎯 직접 선택한 전공과목 ({total_selected}개) → 주전공은 🔵, 복전은 🟢에서 차감
5. ⭐ 꼭 듣고 싶은 과목 (사용자 지정) → 해당 영역에서 차감
6. 주전공 전선 ({major}) → 🔵 잔여가 남으면 채우기
7. 복전 전선 ({double_major}) → 🟢 잔여가 남으면 채우기
8. 교양선택 → 🟡 잔여가 남으면 채우기

## ⚠️ 충돌 규칙
- 필수과목(주전공 전필, 복전 전필, 교양필수) >>> 공강 희망, 시간대 선호
- 충돌 시 warnings에 사유 설명"""
            else:
                priority_text = f"""
## 📋 우선순위 (2-3학년 - 복수전공 + AI 자동 선택 모드)

⚠️ 복수전공({double_major}) 학생! 위 Step 1~7 절차를 따르세요!
{alloc_info}

1. 주전공 전필 ({major}, 아직 안 들은 것) → 🔵에서 차감
2. 복전 전필 ({double_major}, 아직 안 들은 것) → 🟢에서 차감
3. 교양필수 (미이수 시) → 🟡에서 차감
4. ⭐ 꼭 듣고 싶은 과목 (사용자 지정) → 해당 영역에서 차감
5. 주전공 전선 ({major}, target_year <= {grade}) → 🔵 잔여가 남으면 채우기
6. 복전 전선 ({double_major}, target_year <= {grade}) → 🟢 잔여가 남으면 채우기
7. 교양선택 (선호 영역) → 🟡 잔여가 남으면 채우기

## ⚠️ 충돌 규칙
- 필수과목(주전공 전필, 복전 전필, 교양필수) >>> 공강 희망, 시간대 선호
- 충돌 시 warnings에 사유 설명

⚠️ 전공과목은 {grade}학년 이하 대상 과목에서 선택하세요!"""
        else:
            # 복수전공 없는 경우 (기존과 동일)
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
    if double_major:
        # 학점 배분 규칙 텍스트
        credit_rule = ""
        if credit_allocation:
            mc = credit_allocation.get('major', 0)
            dc = credit_allocation.get('double_major', 0)
            gc = credit_allocation.get('general', 0)
            credit_rule = f"""
### 5. 학점 배분 준수 (복수전공 핵심 규칙!)
⚠️ 학생이 직접 지정한 학점 배분을 반드시 지켜야 합니다!
- 주전공({major}) 과목 합산: **{mc}학점** (±1 허용)
- 복수전공({double_major}) 과목 합산: **{dc}학점** (±1 허용)
- 교양 과목 합산: **{gc}학점** (±1 허용)
→ 주전공만 가득 채우고 복전을 빼먹으면 실패입니다!
→ 복전 학점이 0이 아닌 이상, 반드시 복전 과목을 포함하세요!"""

        absolute_rules = f"""
## ⛔ 절대 규칙 (위반 시 실패)

### 🔴 복수전공 학생입니다! (가장 중요한 전제)
이 학생은 주전공 [{major}] + 복수전공 [{double_major}] 학생입니다.
시간표에 **반드시 두 학과의 과목을 모두 포함**해야 합니다!
- 주전공({major}) 과목만 넣고 복전({double_major}) 과목을 빼먹으면 ❌ 실패!
- 복전({double_major}) 과목만 넣고 주전공({major}) 과목을 빼먹으면 ❌ 실패!

### 1. 학과 제한 (복수전공)
- 전공 과목은 **[{major}]** 또는 **[{double_major}]** 학과 과목만 선택 가능
- 이 두 학과 외 다른 학과 전공과목 선택 절대 금지!
- 주전공 과목의 category: "전공필수" 또는 "전공선택"
- 복전 과목의 category: "복전필수" 또는 "복전선택"
- 주전공과 복전 과목을 명확히 구분해서 표기하세요!

### 2. 학년 매칭 (target_year 필드 확인!)
- 현재 학생: **{grade}학년**
- target_year <= {grade} 인 과목만 선택 가능
- target_year = 0 이면 학년 무관
- target_year > {grade} 인 과목 선택 금지!

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
- 범위: {target_credits - 1} ~ {target_credits + 1}학점
{credit_rule}"""

    else:
        # 단일전공 (기존과 동일)
        absolute_rules = f"""
## ⛔ 절대 규칙 (위반 시 실패)

### 1. 학과 제한 (가장 중요!)
- 주전공 과목은 반드시 **[{major}]** 학과 과목만 선택
- 다른 학과 전공과목 선택 절대 금지!
- 복수전공 없음

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

    # ========== 9. 과목 목록 (course_code, section 포함!) ==========
    def format_courses(courses, label):
        if not courses:
            return f"\n### {label}\n(없음)\n"
        text = f"\n### {label} ({len(courses)}개)\n"
        for c in courses[:30]:
            target_yr = c.get('target_year', 0)
            dept = c.get('department', '')
            course_code = c.get('course_code', '')
            section = c.get('section', '01')
            # ✅ course_code-section을 명확히 표시
            text += f"- [{course_code}-{section}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점 | 대상:{target_yr}학년 | {dept}\n"
        return text

    courses_text = "\n## 📚 사용 가능한 과목 목록"
    courses_text += "\n⚠️ 반드시 [course_code-section] 형식을 그대로 응답에 포함하세요!"
    
    if not skip_general:
        courses_text += format_courses(available_courses.get('general_required', []), '교양필수')
    
    courses_text += format_courses(available_courses.get('major_required', []), f'주전공 전필 ({major})')
    courses_text += format_courses(available_courses.get('major_elective', []), f'주전공 전선 ({major})')
    
    # 복수전공 과목 목록 추가
    if double_major:
        courses_text += format_courses(available_courses.get('double_major_required', []), f'복전 전필 ({double_major})')
        courses_text += format_courses(available_courses.get('double_major_elective', []), f'복전 전선 ({double_major})')
    
    if not skip_general:
        courses_text += format_courses(available_courses.get('general_elective', []), '교양선택')

    # ========== 10. 응답 형식 ==========
    # 복수전공 category 규칙
    category_rule = """### category 규칙 (정확하게!)
- classification 필드값 그대로 사용
- "전필" → "전공필수"
- "전선" → "전공선택"  
- "교필" → "교양필수"
- "교선" → "교양선택" """
    
    if double_major:
        category_rule += f"""
- 복수전공({double_major}) 전필 → "복전필수"
- 복수전공({double_major}) 전선 → "복전선택"
"""

    response_format = f"""
## 📤 응답 형식 (반드시 JSON만 출력!)

```json
{{
    "selected_courses": [
        {{
            "course_name": "과목명",
            "course_code": "학수번호 (위 목록의 [학수번호-분반]에서 학수번호 부분)",
            "section": "분반 (위 목록의 [학수번호-분반]에서 분반 부분)",
            "category": "전공필수|전공선택|교양필수|교양선택{"|복전필수|복전선택" if double_major else ""}"
        }}
    ],
    "warnings": ["주의사항"],
    "summary": "시간표 총평 (2-3문장)"
}}
```

### ⚠️ 위 4개 필드만 출력하세요
- professor, schedule_raw, credits, total_credits, empty_days는 **출력하지 마세요**.
  서버가 위 과목 목록에서 직접 채웁니다. 적어봐야 무시됩니다.
- 과목당 선택 이유도 적지 마세요. 전체 총평(summary) 한 번이면 충분합니다.

### ⚠️ course_code, section 규칙 (매우 중요!)
- 위 과목 목록에서 [course_code-section] 형식으로 제공됨
- 예: [001022-07] → course_code: "001022", section: "07"
- 예: [125601-01] → course_code: "125601", section: "01"
- **반드시 목록에 있는 값을 그대로 사용!** 임의로 만들지 마세요!

{category_rule}

### warnings 규칙
- 공강 희망 vs 필수과목 충돌 시 → "OO요일 공강 불가 - [과목명] 필수 배치"
- 아침 싫음 vs 필수과목 충돌 시 → "9시 수업 불가피 - [과목명] 필수 배치"

## ✅ 최종 검증 체크리스트 (응답 전 반드시 확인!)

1. ⏰ **시간 충돌 검사** (가장 중요!)
   - 선택한 모든 과목 쌍에 대해 시간 겹침 확인
   - 같은 요일, 겹치는 시간대가 있으면 절대 안 됨!
   - 예: 수9:30-12:30 vs 수10:00-11:30 → 충돌! 둘 중 하나 제거!

2. 🏫 **학과 확인**
   - 주전공 과목이 모두 [{major}] 학과 과목인지 확인
{f"   - 복전 과목이 모두 [{double_major}] 학과 과목인지 확인" if double_major else ""}

3. 📊 **학점 확인**
   - 총 학점이 {target_credits} ±1 범위인지 확인
{f"   - 주전공 학점, 복전 학점, 교양 학점이 학생 지정 배분에 맞는지 확인" if double_major and credit_allocation else ""}

4. 📋 **필수과목 포함 확인**
   - 교양필수, 주전공 전필이 포함되었는지 확인
{f"   - 복전 전필이 포함되었는지 확인" if double_major else ""}

5. 🔢 **course_code, section 확인**
   - 모든 과목의 course_code와 section이 목록에 있는 값인지 확인
   - 임의로 생성한 코드 사용 금지!
{f'''
6. 🔵🟢 **복수전공 과목 포함 확인** (복수전공 학생 필수!)
   - selected_courses에 [{major}] 과목과 [{double_major}] 과목이 **모두** 포함되어 있는지 확인!
   - [{major}] 과목만 있고 [{double_major}] 과목이 0개이면 → ❌ 실패! 다시 선택!
   - category가 "복전필수" 또는 "복전선택"인 과목이 최소 1개 이상 있어야 함!
''' if double_major else ""}
시간 충돌이 있는 시간표는 쓸모가 없습니다. 반드시 시간 충돌이 없는지 확인하세요!

⚠️ 주의사항:
- JSON만 출력, 다른 텍스트 없이!
- 학과 제한, 학년 제한 반드시 준수!
- 시간 겹침 절대 금지!
- course_code, section은 목록에서 그대로 복사!
{f"- 복수전공 학생이므로 주전공 + 복전 과목 모두 반드시 포함!" if double_major else ""}
"""

    # ========== 최종 프롬프트 조합 ==========
    dm_intro = ""
    if double_major:
        dm_intro = f"""
🔴🔴🔴 중요: 이 학생은 복수전공 학생입니다! 🔴🔴🔴
주전공: {major} / 복수전공: {double_major}
→ 시간표에 반드시 두 학과의 과목을 모두 포함해야 합니다!
→ 주전공 과목만 넣고 복전 과목을 빼먹으면 실패입니다!
"""

    prompt = f"""당신은 대진대학교 시간표 추천 전문가입니다.
학생 정보와 선호도를 바탕으로 최적의 시간표를 만들어주세요.
{dm_intro}
{basic_info}
{completed_text}
{credit_alloc_text}
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


def _extract_json(text: str) -> dict:
    """Gemini 응답에서 JSON 추출 (하위 호환용 별칭)"""
    return gemini.extract_json(text)


# ============================================================
# ✅ 복수전공 분할 호출 방식
# ============================================================

def _format_courses_simple(courses, label):
    """과목 목록 포맷 (분할 호출용)"""
    if not courses:
        return f"\n### {label}\n(없음)\n"
    text = f"\n### {label} ({len(courses)}개)\n"
    for c in courses[:40]:
        course_code = c.get('course_code', '')
        section = c.get('section', '01')
        text += f"- [{course_code}-{section}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
    return text


def _format_locked_courses(locked: list) -> str:
    """이미 확정된 과목을 텍스트로 표시"""
    if not locked:
        return "(없음)"
    text = ""
    for c in locked:
        text += f"- {c['course_name']} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
    return text


def _build_common_rules(user_info: dict) -> str:
    """공통 규칙 (시간 충돌, 학년 제한 등)"""
    grade = user_info.get('grade', 1)
    preferences = user_info.get('preferences', {})
    
    empty_days = preferences.get('empty_days', [])
    no_morning = preferences.get('no_morning', False)
    preferred_time = preferences.get('preferred_time', '상관없음')
    
    rules = f"""
## ⛔ 절대 규칙
1. 학년 제한: {grade}학년 → target_year <= {grade} 또는 target_year = 0 인 과목만 선택
2. 시간 겹침 금지: 이미 확정된 과목과 같은 시간대 선택 절대 불가!
   - A 종료시간 > B 시작시간 AND A 시작시간 < B 종료시간 → 충돌!
3. course_code, section은 목록에서 그대로 복사!

## 선호도
- 공강 원하는 요일: {', '.join(empty_days) or '없음'}
- 아침 수업 (9시): {'싫음 → 9시 수업 피해주세요' if no_morning else '괜찮음'}
- 선호 시간대: {preferred_time}"""
    return rules


def _build_phase_response_format(category_type: str) -> str:
    """각 단계의 응답 형식"""
    return f"""
## 📤 응답 형식 (JSON만 출력!)
```json
{{
    "selected_courses": [
        {{
            "course_name": "과목명",
            "course_code": "학수번호",
            "section": "분반",
            "professor": "교수명",
            "schedule_raw": "시간",
            "credits": 3,
            "category": "{category_type}",
            "reason": "선택 이유"
        }}
    ],
    "remaining_credits": 0,
    "warnings": ["주의사항"]
}}
```
⚠️ JSON만 출력! 다른 텍스트 없이!
⚠️ course_code, section은 목록에서 그대로 복사!
"""


async def _call_gemini(prompt: str) -> dict:
    """Gemini API 단일 호출 + JSON 파싱 (split 경로용)"""
    return await gemini.generate_json(prompt, temperature=0.2)


def _enrich_courses(selected_courses: list, available_courses: dict) -> list:
    """course_code 검증 및 추가 정보 보완"""
    all_courses_map = {}
    for category_courses in available_courses.values():
        for c in category_courses:
            key = f"{c.get('course_code', '')}-{c.get('section', '01')}"
            all_courses_map[key] = c
    
    for course in selected_courses:
        course_code = course.get('course_code', '')
        section = course.get('section', '01')
        key = f"{course_code}-{section}"
        
        if key in all_courses_map:
            matched = all_courses_map[key]
            # 모델은 course_code/section/course_name/category만 반환한다.
            # 나머지는 원본 과목 목록에서 채운다 (출력 토큰 절약 + 값 왜곡 방지).
            for field in ('professor', 'schedule_raw', 'credits',
                          'department', 'college', 'room', 'course_name'):
                if not course.get(field):
                    course[field] = matched.get(field, '' if field != 'credits' else 0)
        else:
            # course_code가 틀렸을 때의 폴백: 과목명으로 원본을 찾아 통째로 채운다
            course_name = course.get('course_name', '')
            for cat_courses in available_courses.values():
                for c in cat_courses:
                    if c.get('course_name') == course_name:
                        course['course_code'] = c.get('course_code', '')
                        course['section'] = c.get('section', '01')
                        for field in ('professor', 'schedule_raw', 'credits',
                                      'department', 'college', 'room'):
                            course[field] = c.get(field, '' if field != 'credits' else 0)
                        break
                else:
                    continue
                break
    
    return selected_courses


async def recommend_schedule_split(user_info: dict, available_courses: dict) -> dict:
    """복수전공 분할 호출 방식 - 영역별로 나눠서 API 호출"""
    
    grade = user_info.get('grade', 1)
    major = user_info['major']
    double_major = user_info.get('double_major')
    target_credits = user_info['target_credits']
    preferences = user_info.get('preferences', {})
    credit_allocation = preferences.get('credit_allocation', {})
    
    major_credits = credit_allocation.get('major', 0)
    dm_credits = credit_allocation.get('double_major', 0)
    gen_credits = credit_allocation.get('general', 0)
    
    skip_general = preferences.get('skip_general', False)
    
    # 이수 완료 과목
    completed_general = user_info.get('completed_general_required', [])
    completed_major = user_info.get('completed_major_required', [])
    completed_dm_required = user_info.get('completed_double_major_required', [])
    
    # 꼭 듣고 싶은 과목
    must_take_courses = preferences.get('must_take_courses', [])
    must_take_text = ""
    if must_take_courses:
        must_take_text = "\n## ⭐ 꼭 듣고 싶은 과목 (이 중 해당 영역 과목은 반드시 포함!)\n"
        for c in must_take_courses:
            must_take_text += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
    
    # 직접 선택한 과목
    selected_major_courses = preferences.get('selected_major_courses', [])
    selected_dm_courses = preferences.get('selected_double_major_courses', [])
    major_selection_mode = preferences.get('major_selection_mode', 'auto')
    
    # 피하고 싶은 과목
    avoid_courses = preferences.get('avoid_courses', [])
    avoid_text = ""
    if avoid_courses:
        if isinstance(avoid_courses, list) and len(avoid_courses) > 0:
            if isinstance(avoid_courses[0], str):
                avoid_text = f"\n🚫 피할 과목: {', '.join(avoid_courses)}"
            elif isinstance(avoid_courses[0], dict):
                avoid_text = f"\n🚫 피할 과목: {', '.join([c.get('course_name', '') for c in avoid_courses])}"
    
    common_rules = _build_common_rules(user_info)
    
    all_locked = []  # 전체 확정 과목 누적
    all_warnings = []
    
    try:
        # ============================================================
        # 🔵 1단계: 주전공 과목 선택
        # ============================================================
        print(f"[SPLIT] major_credits={major_credits}, dm_credits={dm_credits}, gen_credits={gen_credits}")
        
        if major_credits > 0:
            major_req = available_courses.get('major_required', [])
            major_elec = available_courses.get('major_elective', [])
            
            # 직접 선택 과목 (주전공)
            manual_major_text = ""
            if major_selection_mode == 'manual' and selected_major_courses:
                manual_major_text = "\n## 🎯 직접 선택한 주전공 과목 (우선 배치!)\n"
                for c in selected_major_courses:
                    manual_major_text += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
                manual_major_text += "→ 위 과목을 먼저 배치하고 나머지 학점을 전필/전선으로 채우세요.\n"
            
            completed_major_text = ""
            if completed_major:
                completed_major_text = f"\n이수 완료 전공필수 (제외): {', '.join(completed_major)}"
            
            prompt_major = f"""당신은 대진대학교 시간표 추천 전문가입니다.
이 학생의 **주전공({major})** 과목을 선택해주세요.

## 학생 정보
- 학년: {grade}학년
- 주전공: {major}
- 이번에 주전공으로 채울 학점: **{major_credits}학점** (±1 허용){completed_major_text}
{avoid_text}
{manual_major_text}
{must_take_text}
{common_rules}

## 📚 사용 가능한 주전공 과목
{_format_courses_simple(major_req, f'주전공 전필 ({major})')}
{_format_courses_simple(major_elec, f'주전공 전선 ({major})')}

## 📋 선택 우선순위
1. 아직 안 들은 전공필수 → 반드시 포함!
2. 🎯 직접 선택한 과목 (있으면)
3. ⭐ 꼭 듣고 싶은 과목 중 주전공 과목
4. 전공선택 (target_year <= {grade})

## 목표
- 정확히 **{major_credits}학점** 채우기 (±1 허용)
- category는 "전공필수" 또는 "전공선택"으로 표기

{_build_phase_response_format("전공필수|전공선택")}"""
            
            result_major = await _call_gemini(prompt_major)
            major_selected = result_major.get('selected_courses', [])
            major_selected = _enrich_courses(major_selected, available_courses)
            all_locked.extend(major_selected)
            all_warnings.extend(result_major.get('warnings', []))
            print(f"[SPLIT] 🔵 1단계 완료: {len(major_selected)}개 과목, {sum(c.get('credits',0) for c in major_selected)}학점")
        
        # ============================================================
        # 🟢 2단계: 복전 과목 선택 (이미 확정된 시간 전달!)
        # ============================================================
        if dm_credits > 0 and double_major:
            dm_req = available_courses.get('double_major_required', [])
            dm_elec = available_courses.get('double_major_elective', [])
            print(f"[SPLIT] 🟢 2단계 시작: dm_req={len(dm_req)}개, dm_elec={len(dm_elec)}개, 확정시간={len(all_locked)}개")
            
            # 직접 선택 과목 (복전)
            manual_dm_text = ""
            if major_selection_mode == 'manual' and selected_dm_courses:
                manual_dm_text = "\n## 🎯 직접 선택한 복전 과목 (우선 배치!)\n"
                for c in selected_dm_courses:
                    manual_dm_text += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간미정')} | {c['credits']}학점\n"
                manual_dm_text += "→ 위 과목을 먼저 배치하고 나머지 학점을 전필/전선으로 채우세요.\n"
            
            completed_dm_text = ""
            if completed_dm_required:
                completed_dm_text = f"\n이수 완료 복전 전필 (제외): {', '.join(completed_dm_required)}"
            
            prompt_dm = f"""당신은 대진대학교 시간표 추천 전문가입니다.
이 학생의 **복수전공({double_major})** 과목을 선택해주세요.

## 학생 정보
- 학년: {grade}학년
- 복수전공: {double_major}
- 이번에 복전으로 채울 학점: **{dm_credits}학점** (±1 허용){completed_dm_text}
{avoid_text}
{manual_dm_text}
{must_take_text}

## ⚠️ 이미 확정된 시간표 (이 시간대는 사용 불가!)
{_format_locked_courses(all_locked)}
→ 위 과목들의 시간과 겹치는 과목은 절대 선택하지 마세요!

{common_rules}

## 📚 사용 가능한 복전 과목
{_format_courses_simple(dm_req, f'복전 전필 ({double_major})')}
{_format_courses_simple(dm_elec, f'복전 전선 ({double_major})')}

## 📋 선택 우선순위
1. 아직 안 들은 복전 전필 → 반드시 포함!
2. 🎯 직접 선택한 과목 (있으면)
3. ⭐ 꼭 듣고 싶은 과목 중 복전 과목
4. 복전 전선 (target_year <= {grade})

## 목표
- 정확히 **{dm_credits}학점** 채우기 (±1 허용)
- category는 "복전필수" 또는 "복전선택"으로 표기

{_build_phase_response_format("복전필수|복전선택")}"""

            result_dm = await _call_gemini(prompt_dm)
            dm_selected = result_dm.get('selected_courses', [])
            dm_selected = _enrich_courses(dm_selected, available_courses)
            all_locked.extend(dm_selected)
            all_warnings.extend(result_dm.get('warnings', []))
            print(f"[SPLIT] 🟢 2단계 완료: {len(dm_selected)}개 과목, {sum(c.get('credits',0) for c in dm_selected)}학점")
        else:
            print(f"[SPLIT] 🟢 2단계 스킵: dm_credits={dm_credits}, double_major={double_major}")
        
        # ============================================================
        # 🟡 3단계: 교양 과목 선택
        # ============================================================
        print(f"[SPLIT] 🟡 3단계 진입: gen_credits={gen_credits}, skip_general={skip_general}")
        if gen_credits > 0 and not skip_general:
            gen_req = available_courses.get('general_required', [])
            gen_elec = available_courses.get('general_elective', [])
            
            completed_gen_text = ""
            if completed_general:
                completed_gen_text = f"\n이수 완료 교양필수 (제외): {', '.join(completed_general)}"
            
            # 교양 영역 선호
            preferred_areas = preferences.get('preferred_areas', [])
            completed_areas = preferences.get('completed_areas', [])
            area_pref_text = ""
            if preferred_areas:
                area_pref_text += f"\n- 선호 영역: {', '.join(preferred_areas)}"
            if completed_areas:
                area_pref_text += f"\n- 이수 완료 영역 (제외): {', '.join(completed_areas)}"
            
            prompt_gen = f"""당신은 대진대학교 시간표 추천 전문가입니다.
이 학생의 **교양** 과목을 선택해주세요.

## 학생 정보
- 학년: {grade}학년
- 이번에 교양으로 채울 학점: **{gen_credits}학점** (±1 허용){completed_gen_text}{area_pref_text}
{avoid_text}
{must_take_text}

## ⚠️ 이미 확정된 시간표 (이 시간대는 사용 불가!)
{_format_locked_courses(all_locked)}
→ 위 과목들의 시간과 겹치는 과목은 절대 선택하지 마세요!

{common_rules}

## 📚 사용 가능한 교양 과목
{_format_courses_simple(gen_req, '교양필수')}
{_format_courses_simple(gen_elec, '교양선택')}

## 📋 선택 우선순위
1. 아직 안 들은 교양필수 → 반드시 포함!
2. ⭐ 꼭 듣고 싶은 과목 중 교양 과목
3. 교양선택 (선호 영역 반영)

## 목표
- 정확히 **{gen_credits}학점** 채우기 (±1 허용)
- category는 "교양필수" 또는 "교양선택"으로 표기

{_build_phase_response_format("교양필수|교양선택")}"""

            result_gen = await _call_gemini(prompt_gen)
            gen_selected = result_gen.get('selected_courses', [])
            gen_selected = _enrich_courses(gen_selected, available_courses)
            all_locked.extend(gen_selected)
            all_warnings.extend(result_gen.get('warnings', []))
            print(f"[SPLIT] 🟡 3단계 완료: {len(gen_selected)}개 과목, {sum(c.get('credits',0) for c in gen_selected)}학점")
        
        # ============================================================
        # 🏁 최종 합산 + 후처리
        # ============================================================
        print(f"[SPLIT] 🏁 최종 합산: 전체 {len(all_locked)}개 과목")
        for c in all_locked:
            print(f"  - {c.get('course_name')} | {c.get('category')} | {c.get('credits')}학점")
        validated_courses, removed_courses = validate_and_remove_conflicts(all_locked)
        
        if removed_courses:
            for removed in removed_courses:
                all_warnings.append(f"시간 충돌로 제거됨: {removed['course_name']} ({removed['conflict_with']}과 겹침)")
        
        total_credits = sum(c.get('credits', 0) for c in validated_courses)
        empty_days = calculate_empty_days(validated_courses)
        
        # 요약 생성
        major_count = sum(1 for c in validated_courses if c.get('category', '') in ['전공필수', '전공선택'])
        dm_count = sum(1 for c in validated_courses if c.get('category', '') in ['복전필수', '복전선택'])
        gen_count = sum(1 for c in validated_courses if c.get('category', '') in ['교양필수', '교양선택'])
        
        summary = f"주전공({major}) {major_count}과목, 복전({double_major}) {dm_count}과목, 교양 {gen_count}과목으로 총 {total_credits}학점 시간표입니다."
        if empty_days:
            summary += f" {', '.join(empty_days)}요일이 공강입니다."
        
        return {
            "success": True,
            "selected_courses": validated_courses,
            "total_credits": total_credits,
            "empty_days": empty_days,
            "warnings": all_warnings,
            "summary": summary
        }
        
    except json.JSONDecodeError as e:
        return {
            "success": False,
            "error": f"응답 파싱 실패: {str(e)}",
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"분할 호출 중 오류: {str(e)}"
        }


def parse_schedule_raw(schedule_raw: str) -> list:
    """schedule_raw를 파싱해서 시간 블록 리스트 반환"""
    if not schedule_raw:
        return []
    
    times = []
    
    # 쉼표로 먼저 분리
    segments = [s.strip() for s in schedule_raw.split(',')]
    
    for segment in segments:
        # 공백으로 추가 분리
        parts = [p.strip() for p in segment.split() if p.strip()]
        
        for part in parts:
            # "화10:00-11:30" 형식
            import re
            time_match = re.match(r'^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$', part)
            if time_match:
                day, start_h, start_m, end_h, end_m = time_match.groups()
                times.append({
                    'day': day,
                    'start_min': int(start_h) * 60 + int(start_m),
                    'end_min': int(end_h) * 60 + int(end_m),
                })
                continue
            
            # "월1,2,3" 형식 (교시)
            period_match = re.match(r'^(월|화|수|목|금)([\d,]+)$', part)
            if period_match:
                day, periods_str = period_match.groups()
                periods = [int(p) for p in periods_str.split(',') if p.isdigit()]
                if periods:
                    min_period = min(periods)
                    max_period = max(periods)
                    # 1교시 = 9시 시작
                    times.append({
                        'day': day,
                        'start_min': (8 + min_period) * 60,
                        'end_min': (8 + max_period + 1) * 60,
                    })
    
    return times


def is_time_overlap(t1: dict, t2: dict) -> bool:
    """두 시간 블록이 겹치는지 확인"""
    if t1['day'] != t2['day']:
        return False
    return t1['start_min'] < t2['end_min'] and t1['end_min'] > t2['start_min']


def course_key(c: dict) -> str:
    """과목 고유 키 (course_code-section)"""
    return f"{c.get('course_code', '')}-{c.get('section', '01')}"


def validate_and_remove_conflicts(courses: list, locked_keys: set = None) -> tuple:
    """
    시간 충돌 검사 및 충돌 과목 제거
    locked_keys에 포함된 과목(⭐꼭 넣기 필수 + 꼭 듣고 싶은 과목)은 절대 제거하지 않는다.
    → 충돌 시 비(非)locked 과목을 대신 제거하고, locked끼리 겹치면 뒤 과목만 제거 + 강한 경고.
    Returns: (검증된 과목 리스트, 제거된 과목 리스트)
    """
    locked_keys = locked_keys or set()

    # locked 과목을 앞으로 정렬 → 비locked 과목이 locked에 양보하게 됨
    ordered = sorted(courses, key=lambda c: 0 if course_key(c) in locked_keys else 1)

    validated = []
    removed = []

    for course in ordered:
        course_times = parse_schedule_raw(course.get('schedule_raw', ''))

        # 온라인/시간미정 과목은 충돌 없음
        if not course_times:
            validated.append(course)
            continue

        # 기존 검증된 과목들과 충돌 검사
        has_conflict = False
        conflict_with = None

        for existing in validated:
            existing_times = parse_schedule_raw(existing.get('schedule_raw', ''))

            for ct in course_times:
                for et in existing_times:
                    if is_time_overlap(ct, et):
                        has_conflict = True
                        conflict_with = existing.get('course_name', '알 수 없음')
                        break
                if has_conflict:
                    break
            if has_conflict:
                break

        if has_conflict:
            is_locked = course_key(course) in locked_keys
            removed.append({
                'course_name': course.get('course_name', ''),
                'conflict_with': conflict_with,
                'locked': is_locked,  # locked끼리 충돌인 경우 True
            })
        else:
            validated.append(course)

    return validated, removed


def calculate_empty_days(courses: list) -> list:
    """공강일 계산"""
    days = ['월', '화', '수', '목', '금']
    occupied = set()

    for course in courses:
        times = parse_schedule_raw(course.get('schedule_raw', ''))
        for t in times:
            occupied.add(t['day'])

    return [d for d in days if d not in occupied]


# ============================================================
# ✅ 다중 후보 추천 (A/B/C) - 선호 점수 기반 정렬
# ============================================================

async def _gemini_generate(prompt: str, temperature: float = 0.3, max_tokens: int = None) -> dict:
    """후보 생성용 Gemini 호출 (모델/타임아웃/재시도는 services.gemini가 담당)"""
    return await gemini.generate_json(prompt, temperature=temperature, max_tokens=max_tokens)


def _conflicts_with_any(course: dict, others: list) -> bool:
    """course가 others 중 어느 것과라도 시간이 겹치는지"""
    ct = parse_schedule_raw(course.get('schedule_raw', ''))
    if not ct:
        return False
    for o in others:
        for a in ct:
            for b in parse_schedule_raw(o.get('schedule_raw', '')):
                if is_time_overlap(a, b):
                    return True
    return False


def _guess_category(c: dict) -> str:
    """classification → category 추정"""
    cls = (c.get('classification') or '').strip()
    mapping = {'전필': '전공필수', '전선': '전공선택', '교필': '교양필수', '교선': '교양선택'}
    return mapping.get(cls, c.get('category') or '전공필수')


def _ensure_locked_required(selected: list, available_courses: dict, locked_required_names: set) -> list:
    """⭐반드시 포함 필수과목이 누락됐으면 충돌 없는 분반을 결정적으로 채워 넣음"""
    if not locked_required_names:
        return selected

    present = {c.get('course_name') for c in selected}
    for name in locked_required_names:
        if name in present:
            continue

        sections = []
        for cat_courses in available_courses.values():
            for c in cat_courses:
                if c.get('course_name') == name:
                    sections.append(c)
        if not sections:
            continue  # 목록에 없음 → 어쩔 수 없음 (경고는 아래 validate에서 처리 불가하므로 스킵)

        # 충돌 안 나는 분반 우선, 없으면 첫 분반(경고는 validate에서)
        chosen = next((c for c in sections if not _conflicts_with_any(c, selected)), sections[0])
        inj = dict(chosen)
        inj.setdefault('reason', '반드시 포함 (사용자 지정 필수)')
        if not inj.get('category'):
            inj['category'] = _guess_category(chosen)
        selected.append(inj)
        present.add(name)

    return selected


def _consecutive_stats(courses: list) -> tuple:
    """(같은 요일 인접 쌍 수, 그 중 연강(간격<=30분) 쌍 수)"""
    by_day = defaultdict(list)
    for c in courses:
        for t in parse_schedule_raw(c.get('schedule_raw', '')):
            by_day[t['day']].append(t)

    adj = 0
    cons = 0
    for slots in by_day.values():
        slots.sort(key=lambda s: s['start_min'])
        for i in range(len(slots) - 1):
            adj += 1
            gap = slots[i + 1]['start_min'] - slots[i]['end_min']
            if 0 <= gap <= 30:
                cons += 1
    return adj, cons


def score_schedule(courses: list, user_info: dict, removed_count: int = 0, target_credits: int = None) -> tuple:
    """
    사용자가 실제로 설정한 선호만 채점 → 부합도(0~100) + 하드 감점.
    가중치: 공강30 / 아침회피25 / 시간대20 / 연강15 / 교양영역10
    감점: 충돌제거 -20/개, 목표학점 오차 -8/학점(±1 면제)
    Returns: (score, breakdown)
    """
    prefs = user_info.get('preferences', {}) or {}
    weights = {}
    got = {}

    # 공강 (30)
    empty_req = prefs.get('empty_days', []) or []
    if empty_req:
        actual = set(calculate_empty_days(courses))
        satisfied = sum(1 for d in empty_req if d in actual)
        weights['empty_days'] = 30
        got['empty_days'] = 30 * satisfied / len(empty_req)

    # 아침 9시 회피 (25)
    if prefs.get('no_morning'):
        weights['no_morning'] = 25
        morning_hits = 0
        for c in courses:
            if any(t['start_min'] <= 9 * 60 for t in parse_schedule_raw(c.get('schedule_raw', ''))):
                morning_hits += 1
        got['no_morning'] = 25 * max(0.0, 1 - morning_hits / max(1, len(courses)))

    # 선호 시간대 (20)
    ptime = prefs.get('preferred_time', '상관없음')
    if ptime in ('오전', '오후'):
        weights['preferred_time'] = 20
        match = 0
        total = 0
        for c in courses:
            for t in parse_schedule_raw(c.get('schedule_raw', '')):
                total += 1
                if ptime == '오전' and t['start_min'] < 12 * 60:
                    match += 1
                elif ptime == '오후' and t['start_min'] >= 12 * 60:
                    match += 1
        got['preferred_time'] = 20 * (match / total) if total else 20

    # 연강 (15)
    consec = prefs.get('consecutive', '상관없음')
    if consec in ('좋음', '싫음'):
        weights['consecutive'] = 15
        adj, cons = _consecutive_stats(courses)
        if adj == 0:
            got['consecutive'] = 15
        else:
            ratio = cons / adj
            got['consecutive'] = 15 * (ratio if consec == '좋음' else (1 - ratio))

    # 선호 교양 영역 (10)
    pareas = prefs.get('preferred_areas', []) or []
    if pareas and not prefs.get('skip_general'):
        weights['preferred_areas'] = 10
        has_ge = any(c.get('category') == '교양선택' for c in courses)
        got['preferred_areas'] = 10 if has_ge else 0

    base = 100.0 * (sum(got.values()) / sum(weights.values())) if weights else 100.0

    # 하드 감점
    penalty = 20 * removed_count
    if target_credits is not None:
        diff = abs(sum(c.get('credits', 0) for c in courses) - target_credits)
        if diff > 1:
            penalty += 8 * (diff - 1)

    score = max(0, min(100, round(base - penalty)))
    return score, {
        "weights": weights,
        "got": {k: round(v, 1) for k, v in got.items()},
        "penalty": penalty,
    }


def _postprocess_candidate(result: dict, available_courses: dict, locked_required_names: set,
                           must_take_keys: set, target_credits: int, user_info: dict) -> dict:
    """LLM 원시 결과 → 검증/보완/채점된 후보 1개"""
    selected = result.get('selected_courses', []) or []
    selected = _enrich_courses(selected, available_courses)
    selected = _ensure_locked_required(selected, available_courses, locked_required_names)

    # locked 키 = 꼭 듣고 싶은 과목 + locked_required에 해당하는 선택 과목
    locked_keys = set(must_take_keys)
    for c in selected:
        if c.get('course_name') in locked_required_names:
            locked_keys.add(course_key(c))

    validated, removed = validate_and_remove_conflicts(selected, locked_keys=locked_keys)

    warnings = list(result.get('warnings', []) or [])
    for r in removed:
        if r.get('locked'):
            warnings.append(f"⚠️ 필수/고정 과목 시간 충돌: {r['course_name']} ({r['conflict_with']}과 겹침) — 직접 조정이 필요해요")
        else:
            warnings.append(f"시간 충돌로 제거됨: {r['course_name']} ({r['conflict_with']}과 겹침)")

    total_credits = sum(c.get('credits', 0) for c in validated)
    empty_days = calculate_empty_days(validated)
    score, breakdown = score_schedule(validated, user_info, removed_count=len(removed), target_credits=target_credits)

    return {
        "selected_courses": validated,
        "total_credits": total_credits,
        "empty_days": empty_days,
        "warnings": warnings,
        "summary": result.get('summary', ''),
        "score": score,
        "_breakdown": breakdown,
    }


async def _generate_candidate(prompt, user_info, available_courses, locked_required_names,
                              must_take_keys, target_credits, temperature,
                              errors: list = None) -> dict:
    """후보 1개 생성 (실패 시 None). errors에 실패 원인을 모아준다."""
    if errors is None:
        errors = []
    try:
        result = await _gemini_generate(prompt, temperature=temperature)
    except Exception as e:
        msg = f"생성 실패 (temp={temperature}): {type(e).__name__}: {e}"
        print(f"[MULTI] {msg}")
        errors.append(msg)
        return None
    try:
        return _postprocess_candidate(result, available_courses, locked_required_names,
                                      must_take_keys, target_credits, user_info)
    except Exception as e:
        msg = f"후처리 실패 (temp={temperature}): {type(e).__name__}: {e}"
        print(f"[MULTI] {msg}")
        errors.append(msg)
        return None


def _build_locked_note(locked_required_names: set, must_take: list) -> str:
    if not locked_required_names and not must_take:
        return ""
    txt = "\n## ⭐ 반드시 포함해야 하는 과목 (절대 제외 금지!)\n"
    for n in locked_required_names:
        txt += f"- {n} (무조건 시간표에 포함, 다른 과목과 시간이 겹치지 않게 배치)\n"
    for c in must_take:
        txt += f"- [{c.get('course_code', '')}-{c.get('section', '01')}] {c.get('course_name', '')} (사용자 지정 필수)\n"
    return txt


# ===== 후보별 방향 지시문 =====
# 후보들이 서로의 결과를 기다리지 않도록, 각 후보가 노릴 방향을 미리 정해준다.
# (이래야 전부 병렬로 생성할 수 있다)

# 후보 B가 추가로 노려볼 공강 요일 (선호도가 높은 순)
_EXTRA_EMPTY_DAY_PRIORITY = ['금', '월', '목', '화', '수']

# 지시문 공통 꼬리말 - 방향은 어디까지나 선호일 뿐 하드 제약을 깨지 않도록
_VARIANT_TAIL = "필수과목·⭐반드시 포함 과목·목표 학점·시간 충돌 금지는 그대로 지켜주세요.\n"


def _blocked_empty_days(available_courses: dict) -> set:
    """비울 수 없는 요일.

    모든 분반이 같은 요일에만 열리는 필수과목이 있으면 그 요일은 절대 못 비운다.
    (예: 전공필수 '성인간호학1'이 월요일 분반뿐이면 월요일 공강은 불가능)
    이걸 모르고 목표 요일을 잡으면 후보 B가 달성 불가능한 지시를 받아
    결국 A와 비슷한 시간표만 내놓게 된다.
    """
    days = ['월', '화', '수', '목', '금']
    by_course = defaultdict(set)
    for key in ('general_required', 'major_required', 'double_major_required'):
        for c in available_courses.get(key, []) or []:
            raw = c.get('schedule_raw', '') or ''
            found = {d for d in days if d in raw}
            if found:
                by_course[c.get('course_name', '')] |= found
    return {next(iter(ds)) for ds in by_course.values() if len(ds) == 1}


def _pick_extra_empty_day(prefs: dict, available_courses: dict):
    """후보 B가 노릴 추가 공강 요일 (없으면 None)"""
    requested = set(prefs.get('empty_days', []) or [])
    blocked = _blocked_empty_days(available_courses)
    return next((d for d in _EXTRA_EMPTY_DAY_PRIORITY
                 if d not in requested and d not in blocked), None)


def _variant_note_day_off(prefs: dict, extra_day: str) -> str:
    """후보 B: 공강 축 - 요청한 공강은 유지하고 하루 더 비우는 방향"""
    requested = prefs.get('empty_days', []) or []
    keep = ""
    if requested:
        joined = ', '.join(requested)
        keep = (f"- 학생이 직접 요청한 공강({joined})은 **반드시 그대로 유지**하세요. "
                f"이걸 깨면서까지 {extra_day}요일을 비우면 안 됩니다.\n")
    return (f"\n## 🔀 이 후보의 방향: {extra_day}요일 공강 만들기\n"
            f"이 후보는 **{extra_day}요일 수업이 0개**인 시간표를 목표로 합니다.\n"
            f"{keep}"
            f"- {extra_day}요일 과목은 다른 요일 분반으로 바꾸거나 다른 과목으로 대체하세요.\n"
            f"- 나머지 요일에 수업이 몰리거나 연강이 생겨도 괜찮습니다.\n"
            f"- {extra_day}요일에만 열리는 필수과목이 있다면 그때만 예외로 포함하세요.\n"
            + _VARIANT_TAIL)


def _variant_note_mix(prefs: dict) -> str:
    """후보 C: 구성 축 - 과목/분반 조합을 다르게 (num_candidates=3일 때만 사용)"""
    if prefs.get('skip_general'):
        body = "전공선택 과목의 조합과 분반(교수)을 다르게 골라주세요."
    elif prefs.get('preferred_areas'):
        areas = ', '.join(prefs['preferred_areas'])
        body = f"선호 영역({areas}) 안에서 다른 과목·분반 조합으로 골라주세요."
    else:
        body = "교양선택을 한 영역에 몰지 말고 서로 다른 영역으로 분산해서 골라주세요."
    return ("\n## 🔀 이 후보의 방향: 다른 과목 구성\n"
            f"{body}\n" + _VARIANT_TAIL)


def _variant_note_max_off(prefs: dict) -> str:
    """공강을 더 만들 여지가 없을 때 쓰는 대안 지시문"""
    return ("\n## 🔀 이 후보의 방향: 쉬는 날 최대화\n"
            "수업을 최대한 적은 요일에 몰아서 공강을 하나라도 더 확보해주세요.\n"
            + _VARIANT_TAIL)


def _build_variants(user_info: dict, available_courses: dict, num_candidates: int) -> list:
    """후보별 (temperature, 방향 지시문) 목록.

    A는 지시문 없이 순수 최적을 노리고, B/C는 A와 다른 축을 각각 담당한다.
    어떤 후보도 다른 후보의 결과에 의존하지 않으므로 전부 병렬 생성이 가능하다.

    B는 원래 '공강 하루 더'를 노리지만, 필수과목 때문에 비울 수 있는 요일이
    하나도 없으면 달성 불가능한 지시가 되어 A와 비슷한 결과만 나온다.
    그런 경우엔 과목 구성 축으로 방향을 바꾼다.
    """
    prefs = user_info.get('preferences', {}) or {}
    extra_day = _pick_extra_empty_day(prefs, available_courses)

    if extra_day:
        b_note, c_note = _variant_note_day_off(prefs, extra_day), _variant_note_mix(prefs)
    else:
        b_note, c_note = _variant_note_mix(prefs), _variant_note_max_off(prefs)

    variants = [
        (0.25, ""),        # A: 선호 최적
        (0.55, b_note),    # B: 공강 축 (불가능하면 과목 구성 축)
        (0.85, c_note),    # C: 남은 축
    ]
    return variants[:max(1, num_candidates)]


def _jaccard(a: frozenset, b: frozenset) -> float:
    if not a and not b:
        return 1.0
    union = len(a | b)
    return len(a & b) / union if union else 0.0


def _diff_label(best: dict, other: dict) -> str:
    """A(best) 대비 이 후보의 차이를 짧게 요약"""
    parts = []
    extra_empty = set(other.get('empty_days', [])) - set(best.get('empty_days', []))
    if extra_empty:
        parts.append(f"{'·'.join(sorted(extra_empty))} 공강")

    best_keys = frozenset(course_key(x) for x in best['selected_courses'])
    diff_names = [x.get('course_name') for x in other['selected_courses']
                  if course_key(x) not in best_keys]
    if diff_names:
        parts.append(f"{diff_names[0]} 등 과목 구성 다름")

    if not parts:
        parts.append("대안 시간표")
    return ' · '.join(parts[:2])


def _rank_and_label(candidates: list) -> list:
    """중복 제거 → 점수순 정렬 → 라벨링"""
    unique = []
    for c in candidates:
        sig = frozenset(course_key(x) for x in c['selected_courses'])
        if any(_jaccard(sig, frozenset(course_key(x) for x in u['selected_courses'])) >= 0.85
               for u in unique):
            continue
        unique.append(c)

    unique.sort(key=lambda c: c['score'], reverse=True)

    for i, c in enumerate(unique):
        c['theme_label'] = '가장 잘 맞아요' if i == 0 else _diff_label(unique[0], c)
        c.pop('_breakdown', None)
    return unique


async def recommend_schedules_multi(user_info: dict, available_courses: dict, num_candidates: int = 2) -> dict:
    """
    시간표 후보 여러 개(A/B)를 생성해 선호 점수로 정렬해 반환.
    A = 선호 최적, B = 공강을 하루 더 확보한 대안.

    후보들은 서로의 결과에 의존하지 않으므로 전부 병렬로 생성한다.
    (예전에는 A를 끝까지 기다린 뒤 그 결과를 B/C 프롬프트에 넣느라
     LLM 호출 2번치 시간이 걸렸다)
    """
    double_major = user_info.get('double_major')
    credit_allocation = (user_info.get('preferences', {}) or {}).get('credit_allocation')

    # 복수전공 + 학점배분 → split 경로 (현재는 후보 1개)
    if double_major and credit_allocation:
        return await _recommend_multi_split(user_info, available_courses)

    prefs = user_info.get('preferences', {}) or {}
    locked_required_names = set(prefs.get('locked_required', []) or [])
    must_take = prefs.get('must_take_courses', []) or []
    must_take_keys = {course_key(c) for c in must_take}
    target_credits = user_info.get('target_credits')

    base_prompt = build_recommend_prompt(user_info, available_courses)
    locked_note = _build_locked_note(locked_required_names, must_take)

    errors: list = []
    variants = _build_variants(user_info, available_courses, num_candidates)

    # 모든 후보를 동시에 생성 (걸리는 시간 = 가장 느린 후보 1개)
    results = await asyncio.gather(*[
        _generate_candidate(
            base_prompt + locked_note + note, user_info, available_courses,
            locked_required_names, must_take_keys, target_credits,
            temperature=temp, errors=errors,
        )
        for temp, note in variants
    ], return_exceptions=True)

    # gather는 순서를 보존하므로 A가 항상 맨 앞 → 중복 제거 시 A가 우선 살아남는다
    candidates = [r for r in results if isinstance(r, dict)]
    if not candidates:
        detail = " | ".join(errors[:3]) or "알 수 없는 원인"
        return {"success": False, "error": f"시간표 생성에 실패했습니다. ({detail})"}

    # 학생이 직접 요청한 공강을 못 지킨 후보는 버린다.
    # 후보 B는 공강을 '하나 더' 얹으라는 것이지 요청한 공강과 맞바꾸라는 게 아니다.
    # (지킨 후보가 하나도 없으면 어쩔 수 없이 그대로 둔다)
    requested_days = set(prefs.get('empty_days', []) or [])
    if requested_days:
        kept = [c for c in candidates if requested_days <= set(c.get('empty_days', []) or [])]
        if kept:
            dropped = len(candidates) - len(kept)
            if dropped:
                print(f"[MULTI] 요청 공강({', '.join(sorted(requested_days))}) 미충족 후보 {dropped}개 제외")
            candidates = kept

    ranked = _rank_and_label(candidates)
    return {"success": True, "schedules": ranked[:num_candidates]}


async def _recommend_multi_split(user_info: dict, available_courses: dict) -> dict:
    """복수전공(학점배분) 경로 - 기존 split 결과를 후보 배열 형식으로 감쌈"""
    res = await recommend_schedule_split(user_info, available_courses)
    if not res.get('success'):
        return res

    target_credits = user_info.get('target_credits')
    selected = res.get('selected_courses', [])
    score, _ = score_schedule(selected, user_info, removed_count=0, target_credits=target_credits)

    cand = {
        "selected_courses": selected,
        "total_credits": res.get('total_credits', 0),
        "empty_days": res.get('empty_days', []),
        "warnings": res.get('warnings', []),
        "summary": res.get('summary', ''),
        "score": score,
        "theme_label": '가장 잘 맞아요',
    }
    return {"success": True, "schedules": [cand]}