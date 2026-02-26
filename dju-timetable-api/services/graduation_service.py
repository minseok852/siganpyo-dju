# services/graduation_service.py

# ============================================================
# 졸업 요건 기준 데이터 (하드코딩)
# 표 출처: 대진대학교 졸업요건 기준표
#
# major_type 매핑:
#   "단일전공" → single
#   "복수전공" → double
#   "부전공"   → minor
#   "소전공"   → micro
# ============================================================

REQUIREMENTS = {
    # 2018~2019학번
    range(2018, 2020): {
        "gyopil_min": 6,
        "gyoseon_min": 30,
        "total_min": 130,
        "major": {
            "복수전공": {"major_min": 42},
            "단일전공": {"major_min": 42},   # 전선 기준학점 + 21학점 이상 추가
            "부전공":   {"major_min": 42},
            "소전공":   {"major_min": 42},
        },
        # 교양영역: 1~5영역 각 1과목 이상
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1
        },
        "area_humanities_extra": None,   # 6영역 추가 없음
    },
    # 2020학번
    range(2020, 2021): {
        "gyopil_min": 11,
        "gyoseon_min": 25,
        "total_min": 130,
        "major": {
            "복수전공": {"major_min": 36},
            "단일전공": {"major_min": 42},   # 전선 기준학점 + 21학점 이상 추가
            "부전공":   {"major_min": 36},
            "소전공":   {"major_min": 36},
        },
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1
        },
        # 인문사회·예술계열만 6영역 추가
        "area_humanities_extra": {"area_6": 1},
    },
    # 2021~2024학번
    range(2021, 2025): {
        "gyopil_min": 12,
        "gyoseon_min": 24,
        "total_min": 126,
        "major": {
            "복수전공": {"major_min": 36},
            "단일전공": {"major_min": 42},   # 전선 기준학점 + 21학점 이상 추가
            "부전공":   {"major_min": 36},
            "소전공":   {"major_min": 36},
        },
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1
        },
        # 인문사회·예술계열만 6영역 추가
        "area_humanities_extra": {"area_6": 1},
    },
    # 2025학번 이상
    range(2025, 2100): {
        "gyopil_min": 11,
        "gyoseon_min": 21,
        "total_min": 126,
        "major": {
            "복수전공": {"major_min": 36},
            "단일전공": {"major_min": 51},   # 전선 기준학점 + 30학점 이상 추가
            "부전공":   {"major_min": 36},
            "소전공":   {"major_min": 36},
        },
        # 2025학번부터는 계열 무관하게 1~6영역 모두 필수
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1, "area_6": 1
        },
        "area_humanities_extra": None,
    },
}


# ============================================================
# private 헬퍼 함수들
# ============================================================

def _get_requirement(admission_year: int) -> dict | None:
    """학번에 맞는 졸업 요건 반환"""
    for year_range, req in REQUIREMENTS.items():
        if admission_year in year_range:
            return req
    return None


def _calc_total_acquired(acquired: dict) -> int:
    """총 취득학점 계산 - 성적표 상단 표 전체 합산"""
    return sum(acquired.values())


def _calc_major_acquired(acquired: dict) -> int:
    """전공 취득학점 계산 - 전기 + 전필 + 전선"""
    return acquired["jeongi"] + acquired["jeonpil"] + acquired["jeonseon"]


def _check_area_requirements(
    acquired_areas: dict,
    area_required: dict,
    area_humanities_extra: dict | None,
    is_humanities: bool
) -> tuple[list[dict], bool]:
    """
    교양영역 이수 여부 검증
    Returns: (영역별 검증 결과 리스트, 전체 충족 여부)
    """
    results = []
    all_satisfied = True

    # 기본 영역 검증
    for area_key, required in area_required.items():
        acquired = acquired_areas.get(area_key, 0)
        satisfied = acquired >= required

        if not satisfied:
            all_satisfied = False

        results.append({
            "area": area_key.replace("area_", "") + "영역",
            "required": required,
            "acquired": acquired,
            "is_satisfied": satisfied,
            "message": "충족" if satisfied else f"{required}과목 이상 필요 (현재 {acquired}과목)"
        })

    # 인문사회·예술계열 추가 영역 검증 (해당하는 경우만)
    if is_humanities and area_humanities_extra:
        for area_key, required in area_humanities_extra.items():
            acquired = acquired_areas.get(area_key, 0)
            satisfied = acquired >= required

            if not satisfied:
                all_satisfied = False

            results.append({
                "area": area_key.replace("area_", "") + "영역 (계열 추가)",
                "required": required,
                "acquired": acquired,
                "is_satisfied": satisfied,
                "message": "충족" if satisfied else f"인문사회·예술계열 필수 - {required}과목 이상 필요 (현재 {acquired}과목)"
            })

    return results, all_satisfied


# ============================================================
# 메인 검증 함수 (public)
# ============================================================

def validate(request_data: dict) -> dict:
    """
    졸업 요건 검증 메인 함수
    계획 생성 전 단계 - 현재 이수 현황이 요건을 충족하는지 검사
    """
    admission_year = request_data["admission_year"]
    major_type = request_data["major_type"]
    is_humanities = request_data["is_humanities"]
    acquired = request_data["acquired"]
    acquired_areas = request_data["acquired_areas"]

    # 1. 학번 요건 조회
    req = _get_requirement(admission_year)
    if not req:
        return {
            "success": False,
            "error": f"{admission_year}학번은 지원 범위(2018~)가 아닙니다."
        }

    major_req = req["major"].get(major_type)
    if not major_req:
        return {
            "success": False,
            "error": f"전공유형 '{major_type}'을 찾을 수 없습니다."
        }

    # 2. 학점 계산
    total_acquired = _calc_total_acquired(acquired)
    major_acquired = _calc_major_acquired(acquired)

    total_required = req["total_min"]
    major_required = major_req["major_min"]
    gyopil_required = req["gyopil_min"]
    gyoseon_required = req["gyoseon_min"]

    # 3. 학점 충족 여부
    total_satisfied = total_acquired >= total_required
    major_satisfied = major_acquired >= major_required
    gyopil_satisfied = acquired["gyopil"] >= gyopil_required
    gyoseon_satisfied = acquired["gyoseon"] >= gyoseon_required

    # 4. 교양영역 검증
    area_validations, area_all_satisfied = _check_area_requirements(
        acquired_areas,
        req["area_required"],
        req.get("area_humanities_extra"),
        is_humanities
    )

    # 5. 경고 메시지 생성
    warnings = []
    if not total_satisfied:
        warnings.append(f"졸업 총학점 미충족 ({total_acquired}/{total_required}학점)")
    if not major_satisfied:
        warnings.append(f"전공학점 미충족 ({major_acquired}/{major_required}학점)")
    if not gyopil_satisfied:
        warnings.append(f"교필 미충족 ({acquired['gyopil']}/{gyopil_required}학점)")
    if not gyoseon_satisfied:
        warnings.append(f"교선 미충족 ({acquired['gyoseon']}/{gyoseon_required}학점)")
    if not area_all_satisfied:
        warnings.append("미충족 교양영역이 있습니다. 영역별 결과를 확인하세요.")

    return {
        "success": True,
        "validation": {
            "total_satisfied": total_satisfied,
            "major_satisfied": major_satisfied,
            "gyopil_satisfied": gyopil_satisfied,
            "gyoseon_satisfied": gyoseon_satisfied,

            "total_required": total_required,
            "total_acquired": total_acquired,
            "major_required": major_required,
            "major_acquired": major_acquired,
            "gyopil_required": gyopil_required,
            "gyopil_acquired": acquired["gyopil"],
            "gyoseon_required": gyoseon_required,
            "gyoseon_acquired": acquired["gyoseon"],

            "area_validations": area_validations,
            "area_all_satisfied": area_all_satisfied,

            "warnings": warnings
        }
    }