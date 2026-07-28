"""시간 충돌 검사 — AI가 겹치는 과목을 골랐을 때 마지막으로 걸러내는 층.

AI에게 '겹치지 마라'고 프롬프트로 아무리 강조해도 지켜진다는 보장이 없으므로,
실제로 시간표를 성립시키는 건 프롬프트가 아니라 이 함수다.
"""
from services.recommend_service import course_key, validate_and_remove_conflicts


def _course(code, name, raw, section="01"):
    return {
        "course_code": code, "section": section,
        "course_name": name, "schedule_raw": raw, "credits": 3,
    }


class TestValidateAndRemoveConflicts:
    def test_겹치지_않으면_전부_유지(self):
        courses = [
            _course("A", "자료구조", "월9:00-10:30"),
            _course("B", "운영체제", "화13:00-14:30"),
        ]
        validated, removed = validate_and_remove_conflicts(courses)
        assert len(validated) == 2
        assert removed == []

    def test_겹치면_뒤에_오는_과목을_제거(self):
        courses = [
            _course("A", "자료구조", "월9:00-11:00"),
            _course("B", "운영체제", "월10:00-12:00"),
        ]
        validated, removed = validate_and_remove_conflicts(courses)
        assert [c["course_name"] for c in validated] == ["자료구조"]
        assert removed[0]["course_name"] == "운영체제"
        assert removed[0]["conflict_with"] == "자료구조"

    def test_온라인_과목은_충돌하지_않는다(self):
        courses = [
            _course("A", "자료구조", "월9:00-11:00"),
            _course("B", "사이버강의", ""),
            _course("C", "원격교양", "온라인"),
        ]
        validated, removed = validate_and_remove_conflicts(courses)
        assert len(validated) == 3
        assert removed == []

    def test_locked_과목은_충돌해도_살아남는다(self):
        """사용자가 '꼭 듣고 싶다'고 지정한 과목이 AI가 고른 과목에 밀리면 안 된다."""
        must_take = _course("B", "교육심리", "목13:30-15:30")
        courses = [
            _course("A", "자료구조", "목14:00-16:00"),   # AI가 고른 과목
            must_take,                                    # 사용자 지정
        ]
        validated, removed = validate_and_remove_conflicts(
            courses, locked_keys={course_key(must_take)}
        )
        assert [c["course_name"] for c in validated] == ["교육심리"]
        assert removed[0]["course_name"] == "자료구조"
        # 사용자 지정 과목이 밀린 게 아니므로 강한 경고 대상은 아니다
        assert removed[0]["locked"] is False

    def test_locked_끼리_충돌하면_locked로_표시한다(self):
        """둘 다 사용자 지정인데 겹치면 서버가 대신 정해줄 수 없다 → 사용자에게 알려야 한다."""
        a = _course("A", "교육심리", "목13:30-15:30")
        b = _course("B", "교육사회", "목14:00-16:00")
        validated, removed = validate_and_remove_conflicts(
            [a, b], locked_keys={course_key(a), course_key(b)}
        )
        assert len(validated) == 1
        assert removed[0]["locked"] is True
