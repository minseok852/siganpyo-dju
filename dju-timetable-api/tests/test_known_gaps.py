"""아직 고치지 않은 결함을 '기대되는 동작'으로 기록해둔 곳.

전부 xfail(strict=True)이다. 즉 지금은 실패하는 게 정상이고,
누군가 고치면 XPASS가 되어 테스트가 **실패로 알려준다**.
그때 이 파일에서 해당 테스트를 꺼내 정식 테스트로 옮기면 된다.

이렇게 두는 이유: 발견해놓고 안 고친 문제는 잊힌다. 주석은 검색해야 보이지만
테스트는 실행할 때마다 목록에 뜬다.
"""
import pytest

from services.recommend_service import _enrich_courses, parse_schedule_raw


# ──────────────────────────────────────────────
# 1. 토요일 수업이 파싱되지 않는다
# ──────────────────────────────────────────────
# parse_schedule_raw의 정규식이 (월|화|수|목|금)만 받는다.
# 그런데 실제 과목 데이터에 토요일 수업이 24개 있다:
#   토09:30-12:30 (8), 토13:00-16:00 (8), 토16:00-18:50 (4),
#   토13:00-17:00 (2), 토17:00-20:30 (2)
# 파싱에 실패하면 시간 블록이 비어 '온라인 과목'으로 취급된다 → 교육심리와 같은 증상.
#
# 같은 정규식이 프론트에도 3벌 복붙돼 있다 (timeUtils.js:141, CourseSearch.jsx:128,
# RecommendPage.jsx:204). 고칠 때 네 군데를 같이 봐야 한다.
#
# 다만 이건 제품 결정이 먼저다: 시간표 그리드가 토요일 칸을 그릴 것인가?
# (timeUtils.js:179에는 '토': 5 매핑이 이미 있다)

@pytest.mark.xfail(strict=True, reason="parse_schedule_raw 정규식에 '토'가 빠져 있음")
def test_토요일_수업도_파싱되어야_한다():
    assert parse_schedule_raw("토13:00-16:00") == [
        {"day": "토", "start_min": 13 * 60, "end_min": 16 * 60}
    ]


# ──────────────────────────────────────────────
# 2. 교시 표기가 쉼표 분리에 먼저 잘린다
# ──────────────────────────────────────────────
# parse_schedule_raw는 쉼표로 먼저 자른 뒤 각 조각을 정규식에 건다.
# 그래서 "월1,2,3"은 ["월1", "2", "3"]이 되고, "2"와 "3"은 어느 패턴에도
# 걸리지 않아 버려진다. 결과적으로 1~3교시(9~12시)가 1교시(9~10시)로 줄어든다.
#
# 현재 과목 데이터 3,108건 중 교시 표기를 쓰는 건 0건이라 실사용 영향은 없다.
# 다만 코드가 지원하는 척하고 있어서, 나중에 교시 표기 데이터가 들어오면
# 시간 충돌 검사가 조용히 틀린다.

@pytest.mark.xfail(strict=True, reason="쉼표 분리가 교시 표기보다 먼저 일어남")
def test_교시_표기가_연속_교시로_파싱되어야_한다():
    # 1교시 = 9시 시작, 3교시 종료 = 12시
    assert parse_schedule_raw("월1,2,3") == [
        {"day": "월", "start_min": 9 * 60, "end_min": 12 * 60}
    ]


# ──────────────────────────────────────────────
# 3. 카탈로그에 없는 과목이 드롭되지 않는다 (fix #2 예정)
# ──────────────────────────────────────────────
# _enrich_courses는 course_code로 찾고, 실패하면 과목명으로 찾고,
# 그것도 실패하면 아무것도 하지 않고 통과시킨다.
# AI가 지어낸 과목이 그대로 시간표에 남는다는 뜻이다. 게다가 schedule_raw가
# 비어 있으니 충돌 검사도 통과한다 — 환각 과목일수록 검증을 빠져나간다.
#
# fix #2에서 '매칭 실패 시 드롭 + warning'으로 바꿀 예정.

_AVAILABLE = {
    "major_required": [{
        "course_code": "125601", "section": "01", "course_name": "자료구조",
        "professor": "홍길동", "credits": 3, "schedule_raw": "목14:00-16:00",
    }],
}


@pytest.mark.xfail(strict=True, reason="fix#2 미구현: 매칭 실패한 과목을 드롭하지 않는다")
def test_카탈로그에_없는_과목은_드롭되어야_한다():
    ghost = {
        "course_name": "존재하지않는과목", "course_code": "999999",
        "section": "01", "category": "전공선택",
    }
    assert _enrich_courses([ghost], _AVAILABLE) == []


@pytest.mark.xfail(strict=True, reason="fix#2 미구현: 드롭된 과목이 조용히 사라진다")
def test_드롭된_과목은_학점이_0으로_남지_않아야_한다():
    """지금은 credits 없이 통과해서 총 학점이 조용히 어긋난다."""
    ghost = {
        "course_name": "존재하지않는과목", "course_code": "999999",
        "section": "01", "category": "전공선택",
    }
    out = _enrich_courses([ghost], _AVAILABLE)
    assert all(c.get("credits") for c in out)
