# services/ai_service.py
import os
import json
import re
import math
import google.generativeai as genai

# Gemini API 설정
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# 시간표 유형 정의
SCHEDULE_TYPES = {
    "SURVIVOR": {"emoji": "😵", "name": "생존러", "description": "빡센 시간표... 밥은 먹고 다니세요!"},
    "RUNNER": {"emoji": "🏃", "name": "마라토너", "description": "오늘도 캠퍼스 횡단 완료!"},
    "GODSAENG": {"emoji": "🦅", "name": "갓생러", "description": "아침부터 열공! 부지런한 당신"},
    "SLEEPER": {"emoji": "🦥", "name": "늦잠러", "description": "알람 따위 필요없다"},
    "CHILL": {"emoji": "🐢", "name": "느긋러", "description": "점심 먹고 여유롭게 등교~"},
    "RELAXER": {"emoji": "🧘", "name": "여유러", "description": "공강엔 카페, 인생은 즐겨야지"},
    "EFFICIENT": {"emoji": "🎯", "name": "효율러", "description": "동선 최적화, 시간은 금이다"},
    "BALANCER": {"emoji": "⚖️", "name": "밸런서", "description": "균형 잡힌 완벽한 시간표!"},
}

# 대진대 교양필수 (2026학번 기준)
GENERAL_REQUIRED_1 = ['대순사상과상생윤리', '대학생활과진로', '사고와표현', '영어읽기와토론', 'AI시대의컴퓨팅사고']
GENERAL_REQUIRED_2 = ['LCT']

# 건물 좌표 (위도, 경도) - 대진대 실제 좌표
BUILDING_COORDS = {
    '체': (37.8675, 127.1568),
    '본': (37.869370, 127.158281),
    '교': (37.869787, 127.157584),
    '대': (37.870245, 127.156737),
    '국': (37.870708, 127.156103),
    '학': (37.871227, 127.155202),
    '대교': (37.870540, 127.158479),
    '사': (37.871146, 127.157251),
    '인': (37.871831, 127.156454),
    '정보': (37.872971, 127.155573),
    '중도': (37.873558, 127.154920),
    '산학': (37.873926, 127.154397),
    '공가': (37.874557, 127.155078),
    '공가A': (37.874557, 127.155078),
    '공가B': (37.874557, 127.155078),
    '공나': (37.874189, 127.155585),
    '공나A': (37.874189, 127.155585),
    '공나B': (37.874189, 127.155585),
    '공다': (37.873922, 127.156022),
    '공다A': (37.873922, 127.156022),
    '공다B': (37.873922, 127.156022),
    '공단': (37.873922, 127.156022),
    '공단A': (37.873922, 127.156022),
    '공단B': (37.873922, 127.156022),
    '학군': (37.875183, 127.159170),
    '예': (37.875247, 127.159838),
    '생활': (37.876338, 127.158016),
    '음': (37.876570, 127.157218),
    '미': (37.876900, 127.156812),
}

# 건물 고도 레벨 (높을수록 언덕 위)
BUILDING_ALTITUDE = {
    # 레벨 1: 예체능 (맨 위, 우회 필요)
    '미': 1, '음': 1, '생활': 1, '예': 1,
    # 레벨 2: 공대 구역 (언덕 위)
    '공가': 2, '공가A': 2, '공가B': 2,
    '공나': 2, '공나A': 2, '공나B': 2,
    '공다': 2, '공다A': 2, '공다B': 2,
    '공단': 2, '공단A': 2, '공단B': 2,
    '중도': 2, '산학': 2,
    # 레벨 3: 메인 캠퍼스
    '학': 3, '인': 3, '사': 3, '정보': 3,
    '국': 3, '대': 3, '본': 3, '교': 3, '대교': 3,
    '학군': 3,
    # 레벨 4: 체육관 (맨 아래)
    '체': 4,
}

# 마라톤 기준 거리 (미터) - 보정 후 기준
MARATHON_DISTANCE_THRESHOLD = 350


def calculate_distance(coord1: tuple, coord2: tuple) -> float:
    """두 좌표 간 직선 거리 계산 (미터 단위, Haversine 공식)"""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    
    R = 6371000  # 지구 반지름 (미터)
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_actual_distance(building1: str, building2: str) -> float:
    """고도와 우회를 반영한 실제 이동 거리 계산"""
    if building1 not in BUILDING_COORDS or building2 not in BUILDING_COORDS:
        return 0
    
    # 직선 거리
    straight_distance = calculate_distance(
        BUILDING_COORDS[building1], 
        BUILDING_COORDS[building2]
    )
    
    # 고도 차이 보정
    alt1 = BUILDING_ALTITUDE.get(building1, 3)
    alt2 = BUILDING_ALTITUDE.get(building2, 3)
    altitude_diff = abs(alt1 - alt2)
    
    # 고도 차이에 따른 보정 계수
    if altitude_diff == 0:
        altitude_multiplier = 1.0
    elif altitude_diff == 1:
        altitude_multiplier = 1.3  # 1단계 차이: 30% 증가
    elif altitude_diff == 2:
        altitude_multiplier = 1.6  # 2단계 차이: 60% 증가
    else:
        altitude_multiplier = 2.0  # 3단계 차이: 100% 증가
    
    # 예체능(레벨1) 관련 이동 시 우회 보정
    detour_multiplier = 1.0
    if alt1 == 1 or alt2 == 1:
        # 예체능 건물은 우회 필요
        if alt1 != alt2:  # 다른 구역으로 이동 시
            detour_multiplier = 1.2
    
    # 체육관(레벨4) 관련 이동 시 추가 보정
    if alt1 == 4 or alt2 == 4:
        if altitude_diff >= 2:
            altitude_multiplier += 0.2  # 체육관은 더 힘듦
    
    actual_distance = straight_distance * altitude_multiplier * detour_multiplier
    
    return actual_distance


def get_building_code(room: str) -> str:
    """강의실에서 건물 코드 추출"""
    if not room:
        return None
    
    room_parts = room.strip().split()
    if not room_parts:
        return None
    
    building_code = room_parts[0]
    
    # 정확한 매칭
    if building_code in BUILDING_COORDS:
        return building_code
    
    # 부분 매칭 (공가A101 같은 형식)
    for key in BUILDING_COORDS:
        if building_code.startswith(key):
            return key
    
    return None


def is_marathon_distance(room1: str, room2: str) -> tuple:
    """두 강의실 간 거리가 마라톤인지 판정 (고도 보정 포함)"""
    building1 = get_building_code(room1)
    building2 = get_building_code(room2)
    
    if not building1 or not building2:
        return False, 0
    
    # 고도 보정된 실제 이동 거리
    actual_distance = calculate_actual_distance(building1, building2)
    
    return actual_distance >= MARATHON_DISTANCE_THRESHOLD, actual_distance


def parse_schedule_raw(schedule_raw: str) -> list:
    """schedule_raw를 파싱해서 시간 블록 리스트 반환"""
    if not schedule_raw:
        return []
    
    times = []
    segments = [s.strip() for s in schedule_raw.split(',')]
    
    for segment in segments:
        parts = [p.strip() for p in segment.split() if p.strip()]
        
        for part in parts:
            # "화10:00-11:30" 형식
            time_match = re.match(r'^(월|화|수|목|금)(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$', part)
            if time_match:
                day, start_h, start_m, end_h, end_m = time_match.groups()
                times.append({
                    'day': day,
                    'start_hour': int(start_h),
                    'start_min': int(start_m),
                    'end_hour': int(end_h),
                    'end_min': int(end_m),
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
                    times.append({
                        'day': day,
                        'start_hour': 8 + min_period,
                        'start_min': 0,
                        'end_hour': 8 + max_period + 1,
                        'end_min': 0,
                    })
    
    return times


def analyze_schedule(courses: list, user_info: dict) -> dict:
    """시간표 분석 - 백엔드에서 모든 지표 계산"""
    
    days = ['월', '화', '수', '목', '금']
    total_credits = sum(c.get('credits', 0) for c in courses)
    course_names = [c.get('course_name', '') for c in courses]
    
    # 요일별 수업 정보 수집
    daily_schedule = {day: [] for day in days}
    
    for course in courses:
        times = parse_schedule_raw(course.get('schedule_raw', ''))
        room = course.get('room', '')
        
        for t in times:
            daily_schedule[t['day']].append({
                'course_name': course.get('course_name', ''),
                'start_hour': t['start_hour'],
                'start_min': t['start_min'],
                'end_hour': t['end_hour'],
                'end_min': t['end_min'],
                'room': room,
            })
    
    # 요일별 정렬
    for day in days:
        daily_schedule[day].sort(key=lambda x: (x['start_hour'], x['start_min']))
    
    # ========== 지표 계산 ==========
    
    # 1. 공강일
    empty_days = [day for day in days if len(daily_schedule[day]) == 0]
    
    # 2. 9시 수업 있는 날 수
    nine_am_days = 0
    for day in days:
        for c in daily_schedule[day]:
            if c['start_hour'] <= 9:
                nine_am_days += 1
                break
    
    # 3. 10시 수업 있는 날 수 (9시 제외)
    ten_am_days = 0
    for day in days:
        has_nine = any(c['start_hour'] <= 9 for c in daily_schedule[day])
        if not has_nine:
            for c in daily_schedule[day]:
                if c['start_hour'] == 10:
                    ten_am_days += 1
                    break
    
    # 4. 첫 수업 12시 이후인 날 수
    afternoon_start_days = 0
    for day in days:
        if daily_schedule[day]:
            first_class = daily_schedule[day][0]
            if first_class['start_hour'] >= 12:
                afternoon_start_days += 1
    
    # 5. 우주공강 (3시간 이상 빈 시간) 횟수
    space_gap_count = 0
    space_gap_details = []
    for day in days:
        classes = daily_schedule[day]
        for i in range(len(classes) - 1):
            current_end = classes[i]['end_hour'] + classes[i]['end_min'] / 60
            next_start = classes[i+1]['start_hour'] + classes[i+1]['start_min'] / 60
            gap = next_start - current_end
            if gap >= 3:
                space_gap_count += 1
                space_gap_details.append(f"{day}요일 {int(current_end)}시~{int(next_start)}시")
    
    # 6. 하루 최대 수업 시간
    max_daily_hours = 0
    busiest_day = ''
    for day in days:
        if daily_schedule[day]:
            first = daily_schedule[day][0]
            last = daily_schedule[day][-1]
            start = first['start_hour'] + first['start_min'] / 60
            end = last['end_hour'] + last['end_min'] / 60
            hours = end - start
            if hours > max_daily_hours:
                max_daily_hours = hours
                busiest_day = day
    
    # 7. 점심시간 없는 날 수 (11시~14시 사이 1시간 빈틈 없음)
    no_lunch_days = 0
    no_lunch_day_list = []
    for day in days:
        classes = daily_schedule[day]
        if not classes:
            continue
        
        # 11시~14시 사이 빈 시간 체크
        has_lunch = False
        
        # 첫 수업 전 점심 가능
        if classes[0]['start_hour'] >= 12:
            has_lunch = True
        
        # 마지막 수업 후 점심 가능
        if classes[-1]['end_hour'] <= 13:
            has_lunch = True
        
        # 수업 사이 점심 가능
        for i in range(len(classes) - 1):
            current_end = classes[i]['end_hour']
            next_start = classes[i+1]['start_hour']
            # 11~14시 사이에 1시간 이상 빈틈
            if current_end <= 13 and next_start >= 12 and (next_start - current_end) >= 1:
                has_lunch = True
                break
        
        if not has_lunch:
            no_lunch_days += 1
            no_lunch_day_list.append(day)
    
    # 8. 건물 간 거리 기반 마라톤 체크
    building_marathon = False
    marathon_details = []
    for day in days:
        classes = daily_schedule[day]
        for i in range(len(classes) - 1):
            current = classes[i]
            next_c = classes[i+1]
            
            current_end = current['end_hour'] + current['end_min'] / 60
            next_start = next_c['start_hour'] + next_c['start_min'] / 60
            gap_minutes = (next_start - current_end) * 60
            
            # 15분 이내 연강일 때 거리 체크
            if gap_minutes <= 15:
                is_marathon, distance = is_marathon_distance(current['room'], next_c['room'])
                
                if is_marathon:
                    building_marathon = True
                    marathon_details.append(f"{day}요일 {current['course_name']}({current['room']})→{next_c['course_name']}({next_c['room']}) [{int(distance)}m]")
    
    # 9. 하루 최대 마라톤 이동 횟수
    max_building_moves = 0
    for day in days:
        classes = daily_schedule[day]
        moves = 0
        for i in range(len(classes) - 1):
            is_marathon, _ = is_marathon_distance(classes[i]['room'], classes[i+1]['room'])
            if is_marathon:
                moves += 1
        max_building_moves = max(max_building_moves, moves)
    
    # 10. 교양필수 체크
    included_gr1 = [g for g in GENERAL_REQUIRED_1 if any(g in cn for cn in course_names)]
    included_gr2 = [g for g in GENERAL_REQUIRED_2 if any(g in cn for cn in course_names)]
    missing_gr1 = [g for g in GENERAL_REQUIRED_1 if g not in included_gr1]
    
    # 13. 본인 학과 전공 체크 (NEW!)
    user_major = user_info.get('major', '')
    user_department = user_info.get('department', user_major)  # department 없으면 major 사용
    
    # 전공 과목 분류
    major_courses = []  # 본인 학과 전공
    other_major_courses = []  # 타과 전공
    general_courses = []  # 교양
    
    for c in courses:
        category = c.get('category', '')
        classification = c.get('classification', '')
        course_dept = c.get('department', '')
        
        # 전공 과목인지 확인 (전선, 전필, 전공선택, 전공필수, 전공기초 등)
        is_major = (
            category == 'major' or
            category == 'convergence' or
            '전공' in classification or
            classification in ['전선', '전필', '전공선택', '전공필수', '전공기초']
        )
        
        if is_major:
            # 본인 학과 전공인지 타과 전공인지
            if course_dept and user_department:
                # 학과명이 일치하거나 포함되면 본인 학과
                if user_department in course_dept or course_dept in user_department:
                    major_courses.append(c.get('course_name', ''))
                else:
                    other_major_courses.append({
                        'name': c.get('course_name', ''),
                        'dept': course_dept
                    })
            else:
                # department 정보 없으면 전공으로 추정
                major_courses.append(c.get('course_name', ''))
        else:
            general_courses.append(c.get('course_name', ''))
    
    # 11. 연강 잘 배치 여부 (공대↔언덕아래 연강 없으면 good)
    good_consecutive = True
    for day in days:
        classes = daily_schedule[day]
        for i in range(len(classes) - 1):
            current_end = classes[i]['end_hour'] + classes[i]['end_min'] / 60
            next_start = classes[i+1]['start_hour'] + classes[i+1]['start_min'] / 60
            gap = (next_start - current_end) * 60
            
            if gap <= 15:  # 연강
                # 좌표 기반 거리 체크
                is_marathon, _ = is_marathon_distance(classes[i]['room'], classes[i+1]['room'])
                if is_marathon:
                    good_consecutive = False
                    break
    
    # 12. 점심 확보된 날 수
    lunch_ok_days = 5 - no_lunch_days
    
    # 전공 밸런스 판정
    my_major_count = len(major_courses)
    other_major_count = len(other_major_courses)
    total_major_count = my_major_count + other_major_count
    
    # 본인 학과 전공 비율
    major_balance_status = 'good'
    if total_major_count == 0:
        major_balance_status = 'warning'  # 전공 없음
    elif my_major_count == 0 and other_major_count > 0:
        major_balance_status = 'bad'  # 타과 전공만 있음
    elif my_major_count < 2 and user_info.get('grade', 1) >= 2:
        major_balance_status = 'warning'  # 2학년 이상인데 본인 학과 전공 2개 미만
    
    return {
        'total_credits': total_credits,
        'course_count': len(courses),
        'empty_days': empty_days,
        'empty_day_count': len(empty_days),
        'nine_am_days': nine_am_days,
        'ten_am_days': ten_am_days,
        'afternoon_start_days': afternoon_start_days,
        'space_gap_count': space_gap_count,
        'space_gap_details': space_gap_details,
        'max_daily_hours': max_daily_hours,
        'busiest_day': busiest_day,
        'no_lunch_days': no_lunch_days,
        'no_lunch_day_list': no_lunch_day_list,
        'lunch_ok_days': lunch_ok_days,
        'building_marathon': building_marathon,
        'marathon_details': marathon_details,
        'max_building_moves': max_building_moves,
        'good_consecutive': good_consecutive,
        'included_gr1': included_gr1,
        'included_gr2': included_gr2,
        'missing_gr1': missing_gr1,
        'has_lct': len(included_gr2) > 0,
        # 전공 관련 추가
        'my_major_courses': major_courses,
        'my_major_count': my_major_count,
        'other_major_courses': other_major_courses,
        'other_major_count': other_major_count,
        'total_major_count': total_major_count,
        'general_count': len(general_courses),
        'major_balance_status': major_balance_status,
        'user_major': user_major,
    }


def determine_schedule_type(analysis: dict) -> str:
    """분석 결과로 시간표 유형 결정 (우선순위 기반)"""
    
    # 1순위: 생존러 (극한)
    if (analysis['total_credits'] >= 20 or 
        analysis['max_daily_hours'] >= 6 or 
        analysis['no_lunch_days'] >= 2):
        return 'SURVIVOR'
    
    # 2순위: 마라토너 (동선 힘듦)
    if analysis['building_marathon'] or analysis['max_building_moves'] >= 3:
        return 'RUNNER'
    
    # 3순위: 갓생러 (아침형)
    if analysis['nine_am_days'] >= 2 and analysis['total_credits'] >= 18:
        return 'GODSAENG'
    
    # 4순위: 늦잠러 (아침 없음)
    if analysis['nine_am_days'] == 0 and analysis['ten_am_days'] <= 1:
        return 'SLEEPER'
    
    # 5순위: 느긋러 (오후 시작)
    if analysis['afternoon_start_days'] >= 3:
        return 'CHILL'
    
    # 6순위: 여유러 (공강 있음)
    if analysis['empty_day_count'] >= 1:
        return 'RELAXER'
    
    # 7순위: 효율러 (최적화)
    if (analysis['good_consecutive'] and 
        analysis['lunch_ok_days'] >= 4 and 
        analysis['space_gap_count'] == 0):
        return 'EFFICIENT'
    
    # 8순위: 밸런서 (균형)
    # 기본 조건 충족 시 밸런서
    if (15 <= analysis['total_credits'] <= 21 and
        analysis['lunch_ok_days'] >= 3 and
        analysis['space_gap_count'] == 0):
        return 'BALANCER'
    
    # 그 외에도 밸런서
    return 'BALANCER'


def calculate_score(analysis: dict, schedule_type: str) -> int:
    """점수 계산"""
    score = 70  # 기본 점수
    
    # 가점
    if analysis['empty_day_count'] >= 1:
        score += 5
    if analysis['empty_day_count'] >= 2:
        score += 3
    if analysis['space_gap_count'] == 0:
        score += 5
    if analysis['lunch_ok_days'] >= 4:
        score += 5
    if analysis['nine_am_days'] == 0:
        score += 3
    if analysis['good_consecutive']:
        score += 3
    if 15 <= analysis['total_credits'] <= 21:
        score += 4
    
    # 전공 밸런스 가점/감점
    if analysis['my_major_count'] >= 2:
        score += 3  # 본인 학과 전공 2개 이상이면 가점
    
    # 감점
    if analysis['building_marathon']:
        score -= 8
    if analysis['space_gap_count'] >= 1:
        score -= 5 * analysis['space_gap_count']
    if analysis['no_lunch_days'] >= 1:
        score -= 4 * analysis['no_lunch_days']
    if analysis['max_daily_hours'] >= 6:
        score -= 5
    if analysis['total_credits'] < 12 or analysis['total_credits'] > 22:
        score -= 5
    
    # 전공 밸런스 감점
    if analysis['major_balance_status'] == 'bad':
        score -= 5  # 타과 전공만 있으면 감점
    elif analysis['major_balance_status'] == 'warning' and analysis['my_major_count'] == 0:
        score -= 3  # 전공 없으면 약간 감점
    
    # 범위 제한
    return max(0, min(100, score))


def build_indicator_prompts(analysis: dict) -> str:
    """지표별 프롬프트 생성 (AI가 메시지만 작성하도록)"""
    
    indicators_info = f"""
## 📊 분석 결과 (백엔드 계산 완료)

### 지표별 상태
1. **우주공강** 🚀
   - 상태: {"bad" if analysis['space_gap_count'] >= 2 else "warning" if analysis['space_gap_count'] == 1 else "good"}
   - 데이터: {analysis['space_gap_count']}회 ({', '.join(analysis['space_gap_details']) if analysis['space_gap_details'] else '없음'})

2. **강의실 마라톤** 🏃
   - 상태: {"bad" if analysis['building_marathon'] else "good"}
   - 데이터: {', '.join(analysis['marathon_details']) if analysis['marathon_details'] else '동선 무난함'}

3. **밥먹을 시간** 🍚
   - 상태: {"bad" if analysis['no_lunch_days'] >= 2 else "warning" if analysis['no_lunch_days'] == 1 else "good"}
   - 데이터: 점심 확보 {analysis['lunch_ok_days']}일, 점심 없는 날: {', '.join(analysis['no_lunch_day_list']) if analysis['no_lunch_day_list'] else '없음'}

4. **학점 밸런스** 📚
   - 상태: {"good" if 15 <= analysis['total_credits'] <= 21 else "warning" if 12 <= analysis['total_credits'] <= 22 else "bad"}
   - 데이터: {analysis['total_credits']}학점, {analysis['course_count']}과목

5. **공강일** 🎉
   - 상태: {"good" if analysis['empty_day_count'] >= 1 else "warning"}
   - 데이터: {', '.join(analysis['empty_days']) + '요일 공강' if analysis['empty_days'] else '공강 없음'}

6. **기상시간** ⏰
   - 상태: {"good" if analysis['nine_am_days'] == 0 else "warning" if analysis['nine_am_days'] <= 2 else "bad"}
   - 데이터: 9시 수업 주 {analysis['nine_am_days']}일

7. **교양필수** 🎓
   - 상태: {"good" if not analysis['missing_gr1'] else "warning"}
   - 포함: {', '.join(analysis['included_gr1']) if analysis['included_gr1'] else '없음'}
   - 미포함: {', '.join(analysis['missing_gr1']) if analysis['missing_gr1'] else '없음'}
   - LCT: {'포함 ✅' if analysis['has_lct'] else '미포함'}

8. **전공 밸런스** 🎯
   - 상태: {analysis['major_balance_status']}
   - 본인 학과({analysis['user_major']}) 전공: {analysis['my_major_count']}과목 ({', '.join(analysis['my_major_courses']) if analysis['my_major_courses'] else '없음'})
   - 타과 전공: {analysis['other_major_count']}과목 ({', '.join([c['name'] + '(' + c['dept'] + ')' for c in analysis['other_major_courses']]) if analysis['other_major_courses'] else '없음'})
   - 교양: {analysis['general_count']}과목
"""
    return indicators_info


def build_prompt(courses: list, user_info: dict, analysis: dict, schedule_type: str, score: int) -> str:
    """AI 프롬프트 생성 - 메시지만 작성하도록"""
    
    grade = user_info['grade']
    major = user_info['major']
    type_info = SCHEDULE_TYPES[schedule_type]
    
    schedule_text = "\n".join([
        f"- {c['course_name']} | {c.get('professor', '미정')} | {c.get('schedule_raw', '시간 미정')} | {c['credits']}학점"
        for c in courses
    ])
    
    indicators_info = build_indicator_prompts(analysis)
    
    # 학년별 조언 가이드
    grade_advice_guide = ""
    if grade == 1:
        grade_advice_guide = """
### 1학년 조언 포인트:
- 교양필수 체크 (LCT는 2학년!)
- 18학점 권장, 적응이 먼저
- 건물 위치 익히기
- 마일리지 점수 많이 획득해서 장학금 받아보기
- 학교 외 다양한 경험해보기!"""
    elif grade == 2:
        grade_advice_guide = """
### 2학년 조언 포인트:
- LCT 들었는지 체크!
- 전공 본격 시작
- 교양선택 영역 체크
- 복수전공 고민"""
    elif grade == 3:
        grade_advice_guide = """
### 3학년 조언 포인트:
- 전공심화 잘 듣고 있는지
- 졸업요건 중간점검
- 자격증/인턴 준비
- 취업 고민 시작"""
    elif grade == 4:
        grade_advice_guide = """
### 4학년 조언 포인트:
- 졸업 학점 확인!
- 취준 시간 확보
- 남은 필수 마무리
- 편하게 마무리해도 OK"""

    return f"""당신은 대진대학교 시간표 분석 전문가입니다.
아래 분석 결과를 바탕으로 **재미있고 친근한 메시지**를 작성해주세요!

## 👤 학생 정보
- 학년: **{grade}학년**
- 전공: {major}

## 📅 시간표 ({analysis['total_credits']}학점, {analysis['course_count']}과목)
{schedule_text}

{indicators_info}

## 🏷️ 결정된 유형 (변경 금지!)
- 유형: **{schedule_type}**
- 이름: {type_info['name']} {type_info['emoji']}
- 점수: **{score}점**

{grade_advice_guide}

## ✍️ 작성해야 할 것

### 1. indicators 메시지 (8개)
각 지표에 대해 **상태(status)와 데이터를 반영**한 재미있는 메시지 작성
- good: 칭찬/긍정적 메시지
- warning: 주의/팁 메시지  
- bad: 걱정/개선 필요 메시지

### 2. advice (2~4개)
- **{grade}학년 맞춤** 조언 필수!
- 위 분석 데이터를 구체적으로 언급 (요일, 과목명 등)
- 교양필수 빠진 거 있으면 언급
- 전공 밸런스 언급 (본인 학과 전공 부족하면 경고)

### 3. summary (2~3문장)
- {grade}학년 언급하며 시작
- {type_info['name']} 유형 특징 반영
- 긍정적으로 마무리

## 📤 응답 형식 (JSON만!)

```json
{{
    "indicators": [
        {{"name": "우주공강", "emoji": "🚀", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "강의실 마라톤", "emoji": "🏃", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "밥먹을 시간", "emoji": "🍚", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "학점 밸런스", "emoji": "📚", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "공강일", "emoji": "🎉", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "기상시간", "emoji": "⏰", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "교양필수", "emoji": "🎓", "status": "good/warning/bad", "message": "재미있는 메시지"}},
        {{"name": "전공 밸런스", "emoji": "🎯", "status": "good/warning/bad", "message": "재미있는 메시지"}}
    ],
    "advice": [
        "구체적인 조언 1",
        "구체적인 조언 2",
        "구체적인 조언 3"
    ],
    "summary": "{grade}학년 {type_info['name']} 시간표에 대한 총평..."
}}
```

⚠️ schedule_type, total_score는 이미 결정됨. 응답에 포함하지 마세요!
⚠️ 위에 제공된 status를 그대로 사용하세요!
⚠️ JSON만 출력, 다른 텍스트 없이!
"""


async def evaluate_schedule(courses: list, user_info: dict) -> dict:
    """시간표 평가 - 하이브리드 방식"""
    
    # 1. 백엔드에서 분석
    analysis = analyze_schedule(courses, user_info)
    
    # 2. 유형 결정
    schedule_type = determine_schedule_type(analysis)
    
    # 3. 점수 계산
    score = calculate_score(analysis, schedule_type)
    
    # 4. AI에게 메시지 생성 요청
    prompt = build_prompt(courses, user_info, analysis, schedule_type, score)
    
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.9,  # 다양한 표현 유도
                max_output_tokens=1500,
            )
        )
        
        response_text = response.text
        
        # JSON 추출
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        result = json.loads(response_text.strip())
        
        # 백엔드에서 결정한 값 추가
        result['schedule_type'] = SCHEDULE_TYPES[schedule_type]
        result['total_score'] = score
        
        return {"success": True, **result}
        
    except json.JSONDecodeError as e:
        # AI 실패 시 기본 메시지 반환
        return {
            "success": True,
            "schedule_type": SCHEDULE_TYPES[schedule_type],
            "total_score": score,
            "indicators": [
                {"name": "우주공강", "emoji": "🚀", "status": "good" if analysis['space_gap_count'] == 0 else "warning", "message": "분석 완료"},
                {"name": "강의실 마라톤", "emoji": "🏃", "status": "good" if not analysis['building_marathon'] else "bad", "message": "분석 완료"},
                {"name": "밥먹을 시간", "emoji": "🍚", "status": "good" if analysis['no_lunch_days'] == 0 else "warning", "message": "분석 완료"},
                {"name": "학점 밸런스", "emoji": "📚", "status": "good" if 15 <= analysis['total_credits'] <= 21 else "warning", "message": f"{analysis['total_credits']}학점"},
                {"name": "공강일", "emoji": "🎉", "status": "good" if analysis['empty_days'] else "warning", "message": f"{', '.join(analysis['empty_days'])}요일 공강" if analysis['empty_days'] else "공강 없음"},
                {"name": "기상시간", "emoji": "⏰", "status": "good" if analysis['nine_am_days'] == 0 else "warning", "message": f"9시 수업 {analysis['nine_am_days']}일"},
                {"name": "교양필수", "emoji": "🎓", "status": "good" if not analysis['missing_gr1'] else "warning", "message": "체크 완료"},
                {"name": "전공 밸런스", "emoji": "🎯", "status": analysis['major_balance_status'], "message": f"본인 학과 전공 {analysis['my_major_count']}과목, 타과 전공 {analysis['other_major_count']}과목"},
            ],
            "advice": ["시간표 분석이 완료되었습니다."],
            "summary": f"{SCHEDULE_TYPES[schedule_type]['name']} 유형의 시간표입니다. 총 {analysis['total_credits']}학점, {analysis['course_count']}과목으로 구성되어 있습니다."
        }
    except Exception as e:
        return {
            "success": False, 
            "error": str(e)
        }