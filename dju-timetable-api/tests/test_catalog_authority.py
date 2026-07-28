"""fix#3: 표시 값은 서버 카탈로그가 정답이고, 모델이 출력한 값은 버린다.

왜 필요한가:
    프롬프트에 "professor, schedule_raw, credits는 출력하지 마세요"라고 적어도
    그건 강제가 아니다. 게다가 두 경로는 아예 모델에게 그 필드를 요구한다:
      - 복수전공 분할 호출 (_build_phase_response_format)
      - 시간표 수정 (modify_service._build_prompt)

    예전에는 `if not course.get(field)` 조건부로만 채워서, 모델이 값을 적어
    보내면 그게 그대로 살아남았다. 시간이 한 글자 틀리면 충돌 검사가 같이
    틀리고, 실제로는 겹치는 시간표가 '문제 없음'으로 사용자에게 나간다.
"""
from services.modify_service import _enrich
from services.recommend_service import (
    apply_catalog_fields,
    _enrich_courses,
    parse_schedule_raw,
)

원본 = {
    "course_code": "125601", "section": "01", "course_name": "자료구조",
    "professor": "홍길동", "credits": 3, "schedule_raw": "목14:00-16:00",
    "department": "컴퓨터공학과", "college": "공과대학", "room": "가101",
}

AVAILABLE = {"major_required": [원본]}


class TestApplyCatalogFields:
    def test_모델이_지어낸_시간을_원본으로_되돌린다(self):
        course = {"course_code": "125601", "section": "01",
                  "schedule_raw": "월09:00-10:00"}   # 모델이 틀리게 적음
        apply_catalog_fields(course, 원본)
        assert course["schedule_raw"] == "목14:00-16:00"

    def test_모델이_지어낸_학점을_원본으로_되돌린다(self):
        course = {"credits": 99}
        apply_catalog_fields(course, 원본)
        assert course["credits"] == 3

    def test_모델이_지어낸_교수명을_원본으로_되돌린다(self):
        course = {"professor": "없는교수"}
        apply_catalog_fields(course, 원본)
        assert course["professor"] == "홍길동"

    def test_카탈로그에_없는_값은_비운다(self):
        """원본에 없는 값을 모델이 지어낸 것이므로 남겨두지 않는다."""
        course = {"room": "AI가지어낸강의실"}
        apply_catalog_fields(course, {"course_name": "교양", "credits": 2})
        assert course["room"] == ""

    def test_credits가_없으면_0_times가_없으면_빈_리스트(self):
        """None이 그대로 나가면 프론트에서 렌더링이 깨진다."""
        course = {}
        apply_catalog_fields(course, {"course_name": "교양"})
        assert course["credits"] == 0
        assert course["times"] == []

    def test_category는_덮어쓰지_않는다(self):
        """category는 모델이 분류한 결과다 (복전필수/전공선택 구분 등)."""
        course = {"category": "전공필수"}
        apply_catalog_fields(course, 원본)
        assert course["category"] == "전공필수"


class TestEnrichCoursesOverwrites:
    def test_추천_경로에서_모델_값이_이기지_않는다(self):
        ai_output = [{
            "course_name": "자료구조", "course_code": "125601", "section": "01",
            "category": "전공필수",
            "schedule_raw": "월09:00-10:00",   # 지어낸 시간
            "credits": 99,                      # 지어낸 학점
        }]
        result = _enrich_courses(ai_output, AVAILABLE)[0]
        assert result["schedule_raw"] == "목14:00-16:00"
        assert result["credits"] == 3

    def test_잘못된_시간이_충돌_검사를_속이지_못한다(self):
        """모델이 시간을 틀리게 적으면 충돌 검사도 그 값을 보고 판단한다."""
        ai_output = [{
            "course_name": "자료구조", "course_code": "125601", "section": "01",
            "schedule_raw": "월09:00-10:00",
        }]
        result = _enrich_courses(ai_output, AVAILABLE)[0]
        assert parse_schedule_raw(result["schedule_raw"]) == [
            {"day": "목", "start_min": 14 * 60, "end_min": 16 * 60}
        ]


class TestModifyEnrichOverwrites:
    """시간표 수정 경로 — 여기가 가장 크게 노출돼 있었다.

    _enrich가 schedule_raw/credits/professor를 아예 채우지 않아서
    모델이 타이핑한 값이 그대로 사용자 시간표가 됐다.
    """

    def test_수정_경로에서도_원본이_이긴다(self):
        ai_output = [{
            "course_code": "125601", "section": "01", "course_name": "자료구조",
            "schedule_raw": "화10:00-11:00",   # 지어낸 시간
            "credits": 1,                       # 지어낸 학점
            "professor": "없는교수",
        }]
        result = _enrich(ai_output, AVAILABLE)[0]
        assert result["schedule_raw"] == "목14:00-16:00"
        assert result["credits"] == 3
        assert result["professor"] == "홍길동"

    def test_현재_시간표의_교직_과목도_원본으로_복원된다(self):
        """교직 과목은 available_courses에 없다 → current_courses에서 찾아야 한다."""
        교육심리 = {
            "course_code": "911021", "section": "01", "course_name": "교육심리",
            "professor": "권양이", "credits": 2, "schedule_raw": "목13:30-15:30",
        }
        ai_output = [{
            "course_code": "911021", "section": "01", "course_name": "교육심리",
            "schedule_raw": "",       # 모델이 시간을 빠뜨림
            "credits": 0,
        }]
        result = _enrich(ai_output, AVAILABLE, current_courses=[교육심리])[0]
        assert result["schedule_raw"] == "목13:30-15:30"
        assert result["credits"] == 2

    def test_못_찾은_과목은_비우지_않는다(self):
        """빈 값으로 덮으면 과목명까지 사라져 화면이 깨진다. 드롭은 fix#2 소관."""
        ghost = {
            "course_code": "999999", "section": "01",
            "course_name": "존재하지않는과목", "credits": 3,
        }
        result = _enrich([dict(ghost)], AVAILABLE)[0]
        assert result["course_name"] == "존재하지않는과목"
