# services/graduation_service.py

# ============================================================
# 졸업 요건 기준 데이터 (하드코딩)
# 표 출처: 대진대학교 졸업요건 기준표
#
# 단일전공 필요학점은 _calc_major_required() 함수에서 자동 계산
#   2018~2024: 복수전공 기준 + 21학점
#   2025~    : 복수전공 기준 + 30학점
# ============================================================

REQUIREMENTS = {
    # 2018~2019학번
    range(2018, 2020): {
        "gyopil_min": 6,
        "gyoseon_min": 30,
        "gyoseon_max": 46,
        "total_min": 130,
        "major": {
            "주전공":   {"major_min": 42},
            "복수전공": {"major_min": 42},
        },
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1
        },
        "area_humanities_extra": None,
    },
    # 2020학번
    range(2020, 2021): {
        "gyopil_min": 11,
        "gyoseon_min": 25,
        "gyoseon_max": 46,
        "total_min": 130,
        "major": {
            "주전공":   {"major_min": 42},
            "복수전공": {"major_min": 36},
        },
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1
        },
        "area_humanities_extra": {"area_6": 1},
    },
    # 2021~2024학번
    range(2021, 2025): {
        "gyopil_min": 12,
        "gyoseon_min": 24,
        "gyoseon_max": 46,
        "total_min": 126,
        "major": {
            "주전공":   {"major_min": 42},
            "복수전공": {"major_min": 36},
        },
        "area_required": {
            "area_1": 1, "area_2": 1, "area_3": 1,
            "area_4": 1, "area_5": 1
        },
        "area_humanities_extra": {"area_6": 1},
    },
    # 2025학번 이상
    range(2025, 2100): {
        "gyopil_min": 11,
        "gyoseon_min": 21,
        "gyoseon_max": 42,
        "total_min": 126,
        "major": {
            "주전공":   {"major_min": 42},
            "복수전공": {"major_min": 36},
        },
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


def _calc_major_acquired(acquired: dict, major_type: str) -> int:
    """
    전공 취득학점 계산
    - 주전공: 전기 + 전필 + 전선
    - 복수전공: 전기 + 전필 + 전선 + 복전
    """
    base = acquired["jeongi"] + acquired["jeonpil"] + acquired["jeonseon"]
    if major_type == "복수전공":
        base += acquired["bokjeon"]
    return base


def _calc_major_required(base_major_min: int, major_type: str, admission_year: int) -> int:
    """
    전공 필요학점 계산
    - 주전공: 주전공 기준학점 + 추가학점 (2016~2024: +21, 2025~: +30)
    - 복수전공: base_major_min 그대로
    """
    if major_type == "주전공":
        extra = 30 if admission_year >= 2025 else 21
        return base_major_min + extra
    return base_major_min


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

    # 2. 전공 기준값 결정
    major_req = req["major"].get(major_type)
    if not major_req:
        return {
            "success": False,
            "error": f"전공유형 '{major_type}'을 찾을 수 없습니다. (주전공 또는 복수전공만 지원)"
        }
    base_major_min = major_req["major_min"]

    # 3. 학점 계산
    total_acquired = request_data["total_acquired"]  # 성적표 졸업학점 칸 직접 입력값 (일선 포함)
    major_acquired = _calc_major_acquired(acquired, major_type)
    major_required = _calc_major_required(base_major_min, major_type, admission_year)

    total_required = req["total_min"]
    gyopil_required = req["gyopil_min"]
    gyoseon_required = req["gyoseon_min"]
    gyoseon_max = req["gyoseon_max"]

    # 4. 학점 충족 여부
    total_satisfied = total_acquired >= total_required
    major_satisfied = major_acquired >= major_required
    gyopil_satisfied = acquired["gyopil"] >= gyopil_required
    gyoseon_satisfied = acquired["gyoseon"] >= gyoseon_required
    gyoseon_over = acquired["gyoseon"] > gyoseon_max

    # 5. 교양영역 검증
    area_validations, area_all_satisfied = _check_area_requirements(
        acquired_areas,
        req["area_required"],
        req.get("area_humanities_extra"),
        is_humanities
    )

    # 6. 경고 메시지 생성
    warnings = []
    if not total_satisfied:
        warnings.append(f"졸업 총학점 미충족 ({total_acquired}/{total_required}학점)")
    if not major_satisfied:
        warnings.append(f"전공학점 미충족 ({major_acquired}/{major_required}학점)")
    if not gyopil_satisfied:
        warnings.append(f"교필 미충족 ({acquired['gyopil']}/{gyopil_required}학점)")
    if not gyoseon_satisfied:
        warnings.append(f"교선 미충족 ({acquired['gyoseon']}/{gyoseon_required}학점)")
    if gyoseon_over:
        warnings.append(f"교선 초과 이수 ({acquired['gyoseon']}/{gyoseon_max}학점 이내) - 초과분은 졸업학점에 미반영될 수 있습니다.")
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
            "gyoseon_max": gyoseon_max,
            "gyoseon_over": gyoseon_over,

            "area_validations": area_validations,
            "area_all_satisfied": area_all_satisfied,

            "warnings": warnings
        }
    }


# ============================================================
# 계획 생성 함수 (public)
# ============================================================

def _calc_remaining_semesters(current_grade: int, current_semester: int) -> int:
    """남은 학기 수 계산 (현재 학기 포함)"""
    total_semesters = 8  # 4년제
    elapsed = (current_grade - 1) * 2 + (current_semester - 1)
    return total_semesters - elapsed


def _generate_semester_list(current_grade: int, current_semester: int, count: int) -> list[dict]:
    """현재 학기부터 count개의 학기 리스트 생성"""
    semesters = []
    grade = current_grade
    semester = current_semester

    for _ in range(count):
        semesters.append({"grade": grade, "semester": semester})
        if semester == 1:
            semester = 2
        else:
            semester = 1
            grade += 1

    return semesters


def plan(request_data: dict, validation_result: dict) -> dict:
    """
    학기별 계획 생성 메인 함수
    validate() 결과를 받아서 남은 학점을 학기별로 배분
    수강신청 학점 범위(gpa_range) 반영하여 상한선 초과 시 경고 추가
    """
    current_grade = request_data["current_grade"]
    current_semester = request_data["current_semester"]
    last_semester_target = request_data.get("last_semester_target")
    admission_year = request_data["admission_year"]
    gpa_range = request_data["gpa_range"]

    # 2. 남은 총학점 계산
    v = validation_result["validation"]
    remaining = v["total_required"] - v["total_acquired"]

    if remaining <= 0:
        return {
            "success": True,
            "message": "이미 졸업 총학점을 충족했습니다!",
            "semester_plan": []
        }

    # 3. 남은 학기 수 계산
    remaining_semesters = _calc_remaining_semesters(current_grade, current_semester)

    if remaining_semesters <= 0:
        return {
            "success": False,
            "error": "남은 학기가 없습니다."
        }

    # 4. 남은 학기가 1개면 마지막 학기 = 전부
    if remaining_semesters == 1:
        limit = _get_credit_limit(admission_year, gpa_range, True)
        warnings = []
        if remaining > limit["max"]:
            warnings.append(
                f"{current_grade}학년 {current_semester}학기: 남은 학점({remaining}학점)이 "
                f"수강신청 상한({limit['max']}학점)을 초과합니다. "
                f"초과학기를 다녀야 합니다."
            )
        return {
            "success": True,
            "remaining_credits": remaining,
            "remaining_semesters": 1,
            "semester_plan": [{
                "grade": current_grade,
                "semester": current_semester,
                "recommended_credits": remaining,
                "credit_limit": limit
            }],
            "warnings": warnings
        }

    # 5. 학기 리스트 생성
    semester_list = _generate_semester_list(current_grade, current_semester, remaining_semesters)

    # 6. 앞에서부터 18학점으로 채우고 마지막 학기에 남은 학점 배정
    MAX_NORMAL = 18
    MIN_LAST = 5

    # 앞 학기들에 18학점씩 채움
    credits_list = []
    left = remaining
    for i in range(remaining_semesters - 1):
        if left <= MIN_LAST:
            break  # 마지막 학기에 최소학점 남기고 더 이상 앞에 배분 안 함
        take = min(MAX_NORMAL, left - MIN_LAST)
        credits_list.append(take)
        left -= take

    # 마지막 학기 = 남은 학점
    last_credits = left

    # 마지막 학기가 5학점 미만이면 앞 학기에서 1학점씩 줄여서 확보
    if last_credits < MIN_LAST:
        for i in range(len(credits_list) - 1, -1, -1):
            need = MIN_LAST - last_credits
            give = min(credits_list[i], need)
            credits_list[i] -= give
            last_credits += give
            if last_credits >= MIN_LAST:
                break

    credits_list.append(last_credits)

    # 실제 사용할 학기 리스트 (0학점 학기 제거 후 마지막 학기 포함)
    actual_semesters = len(credits_list)
    semester_list = _generate_semester_list(current_grade, current_semester, remaining_semesters)
    # 앞에서 actual_semesters - 1개 + 마지막 학기(4-2)
    used_semesters = semester_list[:actual_semesters - 1] + [semester_list[-1]]

    warnings = []
    semester_plan = []

    for i, sem in enumerate(used_semesters):
        is_last = (i == len(used_semesters) - 1)
        credits = credits_list[i]

        # 7. 수강신청 학점 상한선 체크
        # 현재 학기만 gpa_range 적용, 미래 학기는 일반 범위로 가정
        is_current = (i == 0)
        effective_gpa = gpa_range if is_current else "1.5이상~4.0미만"
        limit = _get_credit_limit(admission_year, effective_gpa, is_last)

        if credits > limit["max"]:
            if is_last:
                warnings.append(
                    f"{sem['grade']}학년 {sem['semester']}학기: 남은 학점({credits}학점)이 "
                    f"수강신청 상한({limit['max']}학점)을 초과합니다. "
                    f"초과학기를 다녀야 합니다."
                )
            else:
                warnings.append(
                    f"{sem['grade']}학년 {sem['semester']}학기: 권장학점({credits}학점)이 "
                    f"수강신청 상한({limit['max']}학점)을 초과합니다. "
                    f"계절학기를 이용해보시는 건 어떨까요?"
                )
        if credits < limit["min"] and not is_last:
            warnings.append(
                f"{sem['grade']}학년 {sem['semester']}학기: 초과 이수로 남은 학점이 적습니다. "
                f"학점 포기제 또는 재수강을 활용해서 학점을 바꿀 수 있는 좋은 기회예요!"
            )

        semester_plan.append({
            "grade": sem["grade"],
            "semester": sem["semester"],
            "recommended_credits": credits,
            "credit_limit": limit,  # 해당 학기 수강 가능 범위 같이 전달
        })

    return {
        "success": True,
        "remaining_credits": remaining,
        "remaining_semesters": remaining_semesters,
        "semester_plan": semester_plan,
        "warnings": warnings
    }

# ============================================================
# 수강신청 학점 범위 데이터
# 표 출처: 대진대학교 수강신청 학점 범위표
# ============================================================

CREDIT_LIMITS = {
    range(2018, 2025): {
        "normal":    {"min": 12, "max": 19},
        "high_gpa":  {"min": 12, "max": 22},  # 직전학기 4.0 이상
        "low_gpa":   {"min": 12, "max": 15},  # 직전학기 1.5 미만
        "last_sem":  {"min": 5,  "max": 19},  # 8학기 최소 5학점
    },
    range(2025, 2100): {
        "normal":    {"min": 12, "max": 18},
        "high_gpa":  {"min": 12, "max": 21},
        "low_gpa":   {"min": 12, "max": 15},
        "last_sem":  {"min": 5,  "max": 18},
    },
}


def _get_credit_limit(admission_year: int, gpa_range: str, is_last_semester: bool) -> dict:
    """
    학번과 학점 범위에 따른 수강 가능 학점 상한/하한 반환
    """
    limits = None
    for year_range, limit in CREDIT_LIMITS.items():
        if admission_year in year_range:
            limits = limit
            break

    if not limits:
        # 범위 밖이면 기본값
        return {"min": 12, "max": 19}

    if is_last_semester:
        return limits["last_sem"]
    elif gpa_range == "4.0이상":
        return limits["high_gpa"]
    elif gpa_range == "1.5미만":
        return limits["low_gpa"]
    else:
        return limits["normal"]