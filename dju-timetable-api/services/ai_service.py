# services/ai_service.py
import os
import json
from anthropic import Anthropic

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# 시간표 유형 정의
SCHEDULE_TYPES = {
    "GODSAENG": {"emoji": "🦅", "name": "갓생러", "description": "알람 5개는 기본, 난 새벽을 달린다"},
    "SLEEPER": {"emoji": "🦥", "name": "늦잠러", "description": "알람 따위 필요없다. 난 11시에 일어난다"},
    "RUNNER": {"emoji": "🏃", "name": "마라토너", "description": "오늘도 캠퍼스 횡단 3회 완료"},
    "RELAXER": {"emoji": "🧘", "name": "여유러", "description": "공강엔 카페, 인생은 즐겨야지"},
    "EFFICIENT": {"emoji": "🎯", "name": "효율러", "description": "동선 최적화, 시간은 금이다"},
    "SURVIVOR": {"emoji": "😵", "name": "생존러", "description": "밥은 먹었니? 화장실은?"},
    "NIGHT_OWL": {"emoji": "🌙", "name": "야행성", "description": "해가 지면 나의 하루가 시작된다"},
    "BALANCER": {"emoji": "⚖️", "name": "밸런서", "description": "적당히, 무난하게, 그게 인생이지"},
}

def build_prompt(courses: list, user_info: dict) -> str:
    """시간표 분석 프롬프트 생성"""
    
    schedule_text = "\n".join([
        f"- {c['course_name']} ({c.get('classification') or c.get('category', '미분류')}) | "
        f"{c.get('professor', '미정')} | {c.get('schedule_raw', '시간 미정')} | "
        f"{c.get('room', '강의실 미정')} | {c['credits']}학점"
        for c in courses
    ])
    
    total_credits = sum(c.get('credits', 0) for c in courses)
    
    return f"""당신은 대진대학교 시간표 분석 전문가입니다. 유쾌하고 재미있게 분석해주세요!

## 학생 정보
- 학년: {user_info['grade']}학년
- 전공: {user_info['major']}
- 복수전공: {user_info.get('double_major') or '없음'}

## 현재 시간표 (총 {total_credits}학점, {len(courses)}과목)
{schedule_text}

## 대진대학교 캠퍼스 정보
- 공대 건물(가동,나동,다동)은 언덕 위에 있어서 오르막이 힘듦
- 공대 ↔ 인문학관/사회학관 연강은 빠른걸음 13분 이상, 사실상 불가능
- 공가/공나 ↔ 아래쪽 건물(인문학관, 사회학관, 대순관) 연강 매우 힘듦
- 학생회관: 식당, CU, 문방구, 동아리실, 휴게실 있음
- 중앙도서관 CU도 이용 가능
- 강의실 번호 규칙: 인302 = 인문학관 3층 302호, 공A 210 = 공대A동 2층 10호

## 분석해야 할 지표들

1. **🚀 우주공강 지표**: 같은 날 수업 사이에 3시간 이상 비는 시간이 있는가?
2. **🏃 강의실 마라톤 지표**: 공대↔인문/사회학관 연강이 있는가? (10분 내 이동 불가능)
3. **🍚 밥먹을 시간 지표**: 월~금 중 11시~14시 사이에 최소 1시간 빈틈이 있는가?
4. **📚 학점 밸런스 지표**: 학년에 적절한 학점인가? (1,2학년 18-21 권장, 3,4학년 15-18 권장)
5. **🎉 공강일 지표**: 수업이 하나도 없는 요일이 있는가?
6. **⏰ 기상시간 지표**: 9시 또는 그 이전 수업이 있는가?
7. **🎓 전공 체크**: 본인 전공/복수전공이 아닌 다른 학과 전공과목이 있는가?

## 시간표 유형 (하나만 선택)
- 🦅 갓생러: 9시 수업 많고, 공강 없고, 학점 꽉참 (20학점 이상)
- 🦥 늦잠러: 첫 수업이 11시 이후, 오후 수업 위주
- 🏃 마라토너: 공대↔인문 연강 있음, 건물 간 이동 많음
- 🧘 여유러: 공강 2일 이상 또는 우주공강 많음
- 🎯 효율러: 연강 잘 배치, 점심 확보, 동선 최적화
- 😵 생존러: 21학점 이상, 밥시간 부족, 하루 6시간+ 수업
- 🌙 야행성: 오후 3시 이후 수업 위주, 저녁 수업 있음
- ⚖️ 밸런서: 모든 지표가 적당함, 무난한 시간표

## 응답 형식 (반드시 JSON)
```json
{{
    "schedule_type": "SLEEPER",
    "total_score": 78,
    "indicators": [
        {{"name": "우주공강", "emoji": "🚀", "status": "good", "message": "우주공강 없음! 시간 알차게 쓰는 중"}},
        {{"name": "강의실 마라톤", "emoji": "🏃", "status": "warning", "message": "월요일 공대→인문 연강 주의!"}},
        {{"name": "밥먹을 시간", "emoji": "🍚", "status": "good", "message": "점심시간 확보됨"}},
        {{"name": "학점 밸런스", "emoji": "📚", "status": "good", "message": "18학점, 적절해요"}},
        {{"name": "공강일", "emoji": "🎉", "status": "good", "message": "금요일 공강! 주말이 길어졌다"}},
        {{"name": "기상시간", "emoji": "⏰", "status": "good", "message": "9시 수업 없음, 아침잠 보장"}},
        {{"name": "전공 체크", "emoji": "🎓", "status": "good", "message": "전공 과목 잘 담았어요"}}
    ],
    "advice": [
        "월요일 2-3교시 연강 동선 체크해보세요",
        "1,2학년이라면 학점 좀 더 채워도 좋아요",
        "공강날 중앙도서관에서 과제하면 딱이에요"
    ],
    "summary": "늦잠 러버를 위한 완벽한 시간표! 아침잠을 지키면서도 학점 관리 잘 하고 있어요. 다만 월요일 연강 동선만 주의하세요!"
}}
```

status는 "good", "warning", "bad" 중 하나입니다.
total_score는 0-100 사이 점수입니다.
반드시 위 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력하세요."""


async def evaluate_schedule(courses: list, user_info: dict) -> dict:
    """Claude API를 사용해 시간표 평가"""
    
    prompt = build_prompt(courses, user_info)
    
    try:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        # 응답에서 JSON 파싱
        response_text = message.content[0].text
        
        # JSON 부분만 추출 (```json ... ``` 형식일 경우 처리)
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]
        
        result = json.loads(response_text.strip())
        
        # schedule_type 정보 추가
        type_key = result.get("schedule_type", "BALANCER")
        type_info = SCHEDULE_TYPES.get(type_key, SCHEDULE_TYPES["BALANCER"])
        result["schedule_type"] = type_info
        
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
