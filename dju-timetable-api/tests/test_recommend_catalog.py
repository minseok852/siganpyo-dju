"""회귀 테스트: 사용자가 직접 고른 과목이 조회 카탈로그에서 누락되는 문제.

실제 사용자 신고 (2026-07):
    "교육심리 (911021-01, 권양이) 시간표 생성시 온라인과목으로 잘못 나옵니다"

원인:
    프론트는 general_required / major / general_elective 세 카테고리만 조회해
    available_courses를 만든다. 교직·ROTC 과목(category='special')은 거기에
    절대 포함되지 않는다. 사용자가 그런 과목을 '꼭 듣고 싶은 과목'으로 넣으면
    프롬프트에는 시간까지 찍히지만 카탈로그에는 없는 상태가 되고,
    _enrich_courses가 조회에 실패해 schedule_raw와 credits가 빈 채로 남았다.

증상이 세 갈래로 번졌다:
    1. 시간이 없으니 온라인 과목으로 표시된다 (신고된 증상)
    2. validate_and_remove_conflicts가 '시간 미정이라 충돌 없음'으로 통과시켜
       그 시간대에 다른 과목이 겹쳐 배치된다 (신고되지 않았지만 더 심각)
    3. credits가 비어 총 학점이 실제보다 적게 잡힌다

아래 데이터는 course_teaching_professional.json의 실제 값 그대로다.
"""
from services.recommend_service import (
    build_lookup_catalog,
    _enrich_courses,
    parse_schedule_raw,
    validate_and_remove_conflicts,
)

# 신고된 과목 (실제 DB 값)
교육심리 = {
    "course_code": "911021", "section": "01", "course_name": "교육심리",
    "professor": "권양이", "credits": 2, "target_year": 2,
    "schedule_raw": "목13:30-15:30", "room": "인206 - 스마트강의실",
    "category": "special", "classification": "교직", "department": "교직",
}

# 목 13:30~15:30 과 겹치는 전공 과목
자료구조 = {
    "course_code": "125601", "section": "01", "course_name": "자료구조",
    "professor": "홍길동", "credits": 3, "target_year": 2,
    "schedule_raw": "목14:00-16:00", "department": "컴퓨터공학과",
}

# 교직 과목은 어느 버킷에도 들어오지 않는다 — 이게 버그의 출발점
AVAILABLE = {
    "general_required": [], "major_required": [자료구조], "major_elective": [],
    "general_elective": [], "double_major_required": [], "double_major_elective": [],
}

USER_INFO = {
    "grade": 2, "major": "컴퓨터공학과", "target_credits": 5,
    "preferences": {"must_take_courses": [교육심리]},
}

# AI는 프롬프트 지시에 따라 4개 필드만 돌려준다. 나머지는 서버가 채워야 한다.
AI_RESPONSE = [
    {"course_name": "교육심리", "course_code": "911021", "section": "01", "category": "교직"},
    {"course_name": "자료구조", "course_code": "125601", "section": "01", "category": "전공필수"},
]


def _enriched():
    catalog = build_lookup_catalog(AVAILABLE, USER_INFO)
    selected = _enrich_courses([dict(c) for c in AI_RESPONSE], catalog)
    return {c["course_code"]: c for c in selected}


class TestBuildLookupCatalog:
    def test_직접_고른_과목이_카탈로그에_들어간다(self):
        catalog = build_lookup_catalog(AVAILABLE, USER_INFO)
        keys = {
            f"{c['course_code']}-{c['section']}"
            for bucket in catalog.values() for c in bucket
        }
        assert "911021-01" in keys

    def test_직접_고른_과목이_없으면_원본을_그대로_돌려준다(self):
        """불필요한 복사를 만들지 않는다."""
        assert build_lookup_catalog(AVAILABLE, {"preferences": {}}) is AVAILABLE

    def test_이미_있는_과목은_중복_추가하지_않는다(self):
        user = {"preferences": {"must_take_courses": [자료구조]}}
        assert build_lookup_catalog(AVAILABLE, user) is AVAILABLE

    def test_프롬프트용_원본은_건드리지_않는다(self):
        """AI에게 보이는 과목 목록이 바뀌면 추천 동작 자체가 달라진다."""
        before = {k: list(v) for k, v in AVAILABLE.items()}
        build_lookup_catalog(AVAILABLE, USER_INFO)
        assert AVAILABLE == before


class TestEnrichRestoresRealData:
    def test_시간이_복원된다(self):
        """이게 깨지면 신고된 '온라인 과목으로 표시' 증상이 그대로 재현된다."""
        assert _enriched()["911021"]["schedule_raw"] == "목13:30-15:30"

    def test_온라인으로_취급되지_않는다(self):
        edu = _enriched()["911021"]
        assert parse_schedule_raw(edu["schedule_raw"]) == [
            {"day": "목", "start_min": 13 * 60 + 30, "end_min": 15 * 60 + 30}
        ]

    def test_학점이_복원된다(self):
        assert _enriched()["911021"]["credits"] == 2

    def test_교수명이_복원된다(self):
        assert _enriched()["911021"]["professor"] == "권양이"


class TestConflictBecomesVisible:
    def test_숨어있던_시간_충돌이_감지된다(self):
        """수정 전에는 교육심리에 시간이 없어 이 충돌이 조용히 통과했다."""
        selected = list(_enriched().values())
        validated, removed = validate_and_remove_conflicts(selected)
        assert len(removed) == 1
        assert {r["course_name"] for r in removed} == {"자료구조"}
        assert len(validated) == 1

    def test_총_학점이_정확하다(self):
        """credits가 비면 2학점이 통째로 누락된다."""
        selected = list(_enriched().values())
        assert sum(c["credits"] for c in selected) == 5
