"""schedule_raw 파싱 — 검증층 전체가 이 함수 위에 서 있다.

여기가 조용히 실패하면 시간 충돌 검사도, 공강 계산도 같이 틀린다.
빈 결과를 돌려주면 그 과목은 '시간 미정 = 온라인'으로 취급되어
충돌 검사를 그냥 통과해버리기 때문에, 잘못 파싱된 과목일수록 검증을 빠져나간다.
"""
import pytest

from services.recommend_service import (
    calculate_empty_days,
    is_time_overlap,
    parse_schedule_raw,
)


def _block(day, start, end):
    return {"day": day, "start_min": start, "end_min": end}


class TestParseScheduleRaw:
    @pytest.mark.parametrize("raw, expected", [
        ("목13:30-15:30", [_block("목", 13 * 60 + 30, 15 * 60 + 30)]),
        ("월9:00-10:30", [_block("월", 9 * 60, 10 * 60 + 30)]),
        # 한 자리 시간과 두 자리 시간을 모두 받아야 한다 (데이터에 둘 다 있다)
        ("수09:30-12:30", [_block("수", 9 * 60 + 30, 12 * 60 + 30)]),
    ])
    def test_단일_시간블록(self, raw, expected):
        assert parse_schedule_raw(raw) == expected

    def test_쉼표로_이어진_여러_요일(self):
        assert parse_schedule_raw("화10:00-11:30, 목13:00-14:00") == [
            _block("화", 10 * 60, 11 * 60 + 30),
            _block("목", 13 * 60, 14 * 60),
        ]

    def test_뒤에_붙은_설명은_무시한다(self):
        """실제 데이터에 '수09:00-17:00 (분반별 상이)' 같은 표기가 있다.

        시간 토큰만 골라내고 나머지는 버린다. 설명 때문에 시간이 통째로
        날아가면 그 과목은 온라인으로 취급되어 충돌 검사를 빠져나간다.
        """
        assert parse_schedule_raw("수09:00-17:00 (분반별 상이)") == [
            _block("수", 9 * 60, 17 * 60)
        ]
        assert parse_schedule_raw("금09:00-21:00, 월09:00-15:00 (분반별 상이)") == [
            _block("금", 9 * 60, 21 * 60),
            _block("월", 9 * 60, 15 * 60),
        ]

    @pytest.mark.parametrize("raw", ["", None, "온라인", "원격수업", "격주수업"])
    def test_시간이_없으면_빈_리스트(self, raw):
        """온라인 과목은 시간 블록이 없다 → 충돌 검사에서 제외되는 게 맞다."""
        assert parse_schedule_raw(raw) == []


class TestIsTimeOverlap:
    def test_같은_요일_겹치면_충돌(self):
        assert is_time_overlap(_block("월", 600, 690), _block("월", 630, 720))

    def test_요일이_다르면_충돌_아님(self):
        assert not is_time_overlap(_block("월", 600, 690), _block("화", 600, 690))

    def test_끝시간과_시작시간이_맞닿으면_충돌_아님(self):
        """10:00~11:30 다음에 11:30~13:00 은 연강이지 충돌이 아니다."""
        assert not is_time_overlap(_block("월", 600, 690), _block("월", 690, 780))

    def test_한쪽이_다른쪽을_완전히_포함하면_충돌(self):
        assert is_time_overlap(_block("수", 570, 750), _block("수", 600, 690))


class TestCalculateEmptyDays:
    def test_수업이_없는_요일만_돌려준다(self):
        courses = [{"schedule_raw": "월9:00-10:00"}, {"schedule_raw": "수13:00-15:00"}]
        assert calculate_empty_days(courses) == ["화", "목", "금"]

    def test_과목이_없으면_전부_공강(self):
        assert calculate_empty_days([]) == ["월", "화", "수", "목", "금"]

    def test_온라인_과목은_요일을_차지하지_않는다(self):
        assert calculate_empty_days([{"schedule_raw": "온라인"}]) == [
            "월", "화", "수", "목", "금",
        ]
