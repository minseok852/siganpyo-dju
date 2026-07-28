"""진단 신호 — 사용자가 신고하지 않아도 문제를 드러내는 층.

교육심리 건이 이 파일이 존재하는 이유다. 그 추천은 모든 지표상 성공이었다:
success=True, 학점 정상, 경고 없음. 사용자가 직접 말해주기 전까지
서버는 아무 문제 없다고 기록하고 있었다.

👍/👎는 참여율이 낮아 대부분의 문제가 그냥 지나간다. 그래서 서버가
스스로 '들여다볼 이유'를 남기게 한다.
"""
from services.recommend_service import build_diagnostics, _enrich_courses


def _course(name, raw, code="100001", section="01", credits=3):
    return {
        "course_code": code, "section": section, "course_name": name,
        "schedule_raw": raw, "credits": credits,
    }


BASE_USER = {"grade": 2, "target_credits": 6, "preferences": {}}


class TestNoTimeSlot:
    """시간표에 배치할 수 없는 과목 — 화면엔 '온라인'으로 뜨고 충돌 검사도 빠져나간다."""

    def test_시간이_비면_잡힌다(self):
        """교육심리 유형: 카탈로그 조회 실패로 schedule_raw가 비었다."""
        d = build_diagnostics([_course("교육심리", "")], [], [], BASE_USER, 6)
        assert [c["course_name"] for c in d["no_time_slot"]] == ["교육심리"]
        assert d["flagged"] is True

    def test_파싱_안_되는_시간도_잡힌다(self):
        """토요일 유형: 값은 있는데 정규식이 '토'를 몰라 파싱에 실패한다."""
        d = build_diagnostics([_course("주말교양", "토13:00-16:00")], [], [], BASE_USER, 6)
        assert d["no_time_slot"][0]["schedule_raw"] == "토13:00-16:00"

    def test_원문을_남겨야_두_원인을_구분할_수_있다(self):
        d = build_diagnostics(
            [_course("교육심리", ""), _course("주말교양", "토13:00-16:00")],
            [], [], BASE_USER, 6,
        )
        raws = {c["course_name"]: c["schedule_raw"] for c in d["no_time_slot"]}
        assert raws == {"교육심리": "", "주말교양": "토13:00-16:00"}

    def test_정상_과목은_잡히지_않는다(self):
        d = build_diagnostics([_course("자료구조", "목14:00-16:00")], [], [], BASE_USER, 3)
        assert d["no_time_slot"] == []
        assert d["flagged"] is False


class TestUnmatched:
    """카탈로그에 없는 과목 — 진짜 환각을 탐지하는 유일한 신호."""

    def test_enrich가_미매칭을_보고한다(self):
        available = {"major_required": [_course("자료구조", "목14:00-16:00", code="125601")]}
        ghost = {"course_name": "존재하지않는과목", "course_code": "999999", "section": "01"}
        unmatched = []
        _enrich_courses([ghost], available, unmatched=unmatched)
        assert unmatched == [{
            "course_code": "999999", "section": "01",
            "course_name": "존재하지않는과목",
        }]

    def test_정상_과목은_보고되지_않는다(self):
        real = _course("자료구조", "목14:00-16:00", code="125601")
        unmatched = []
        _enrich_courses(
            [{"course_name": "자료구조", "course_code": "125601", "section": "01"}],
            {"major_required": [real]}, unmatched=unmatched,
        )
        assert unmatched == []

    def test_미매칭이_있으면_flagged(self):
        d = build_diagnostics(
            [_course("자료구조", "목14:00-16:00")], [],
            [{"course_code": "999999", "section": "01", "course_name": "유령"}],
            BASE_USER, 3,
        )
        assert d["flagged"] is True


class TestMustTakeMissing:
    def test_지정_과목이_빠지면_잡힌다(self):
        교육심리 = _course("교육심리", "목13:30-15:30", code="911021", credits=2)
        user = {**BASE_USER, "preferences": {"must_take_courses": [교육심리]}}
        d = build_diagnostics([_course("자료구조", "목14:00-16:00")], [], [], user, 3)
        assert [c["course_name"] for c in d["must_take_missing"]] == ["교육심리"]

    def test_포함되면_잡히지_않는다(self):
        교육심리 = _course("교육심리", "목13:30-15:30", code="911021", credits=2)
        user = {**BASE_USER, "preferences": {"must_take_courses": [교육심리]}}
        d = build_diagnostics([교육심리], [], [], user, 2)
        assert d["must_take_missing"] == []


class TestLockedRequiredMissing:
    def test_반드시_포함_과목_누락(self):
        d = build_diagnostics(
            [_course("자료구조", "목14:00-16:00")], [], [], BASE_USER, 3,
            locked_required_names={"운영체제"},
        )
        assert d["locked_required_missing"] == ["운영체제"]


class TestCreditsDelta:
    def test_1학점_차이는_허용_범위(self):
        d = build_diagnostics([_course("자료구조", "목14:00-16:00")], [], [], BASE_USER, 4)
        assert d["credits_delta"] == -1
        assert d["flagged"] is False

    def test_2학점_이상_어긋나면_flagged(self):
        d = build_diagnostics([_course("자료구조", "목14:00-16:00")], [], [], BASE_USER, 6)
        assert d["credits_delta"] == -3
        assert d["flagged"] is True


class TestRemovedConflicts:
    def test_충돌_제거가_기록된다(self):
        removed = [{"course_name": "자료구조", "conflict_with": "교육심리", "locked": False}]
        d = build_diagnostics([_course("교육심리", "목13:30-15:30")], removed, [], BASE_USER, 3)
        assert d["removed_conflicts"][0]["conflict_with"] == "교육심리"
        assert d["flagged"] is True


class TestCleanScheduleIsNotFlagged:
    def test_아무_문제_없으면_flagged_False(self):
        """오탐이 잦으면 신호로서 쓸모가 없어진다."""
        courses = [
            _course("자료구조", "월9:00-10:30", code="1", credits=3),
            _course("운영체제", "화13:00-14:30", code="2", credits=3),
        ]
        d = build_diagnostics(courses, [], [], BASE_USER, 6)
        assert d["flagged"] is False
        assert d["course_count"] == 2
        assert d["credits_delta"] == 0


class TestPostprocessIntegration:
    """_postprocess_candidate를 실제로 통과시켜 응답에 diagnostics가 실리는지 확인."""

    def _run(self, ai_courses, available, user_info):
        from services.recommend_service import _postprocess_candidate
        return _postprocess_candidate(
            {"selected_courses": ai_courses, "warnings": [], "summary": ""},
            available, set(), set(),
            user_info.get("target_credits"), user_info,
        )

    def test_응답에_diagnostics가_포함된다(self):
        available = {"major_required": [_course("자료구조", "목14:00-16:00", code="125601")]}
        user = {**BASE_USER, "target_credits": 3}   # 목표와 실제를 맞춰야 학점 신호가 안 걸린다
        cand = self._run(
            [{"course_name": "자료구조", "course_code": "125601", "section": "01"}],
            available, user,
        )
        assert "diagnostics" in cand
        assert cand["diagnostics"]["flagged"] is False

    def test_카탈로그에_없는_과목이_두_신호에_모두_걸린다(self):
        """교육심리 버그의 원형 — 조회 실패 → 시간 없음 → 온라인 표시 + 충돌 검사 우회.

        fix#1으로 이 경로는 대부분 막혔지만, 진짜 환각이 일어나면 여전히 여기로 온다.
        그때 신고를 기다리지 않고 잡아내는 게 이 진단의 목적이다.
        """
        available = {"major_required": [_course("자료구조", "목14:00-16:00", code="125601")]}
        cand = self._run(
            [{"course_name": "유령과목", "course_code": "999999", "section": "01"}],
            available, BASE_USER,
        )
        d = cand["diagnostics"]
        assert [c["course_name"] for c in d["unmatched"]] == ["유령과목"]
        assert [c["course_name"] for c in d["no_time_slot"]] == ["유령과목"]
        assert d["flagged"] is True
