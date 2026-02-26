# models/graduation_schemas.py
from pydantic import BaseModel
from typing import Optional


class AcquiredCredits(BaseModel):
    """성적표 상단 표 취득 행 입력"""
    gyopil: int = 0       # 교필
    gyoseon: int = 0      # 교선
    gichyo: int = 0       # 기초
    jeongi: int = 0       # 전기
    jeonpil: int = 0      # 전필
    jeonseon: int = 0     # 전선
    bokjeon: int = 0      # 복전


class AcquiredAreas(BaseModel):
    """성적표 하단 교양영역 취득 행 입력"""
    area_1: int = 0
    area_2: int = 0
    area_3: int = 0
    area_4: int = 0
    area_5: int = 0
    area_6: int = 0
    area_7: int = 0
    area_8: int = 0
    area_9: int = 0
    area_A: int = 0
    area_B: int = 0
    area_C: int = 0
    area_sil: int = 0       # 실용
    area_foreign: int = 0   # 외국어
    area_deep: int = 0      # 심화


class GraduationRequest(BaseModel):
    admission_year: int           # 입학년도 (예: 2022)
    major_type: str               # 단일전공 | 복수전공 | 부전공 | 소전공
    is_humanities: bool           # 인문사회·예술계열 여부 (6영역 추가 이수 조건)
    current_grade: int            # 현재 학년 (1~4)
    current_semester: int         # 현재 학기 (1~2)
    gpa_range: str                # "1.5미만" | "1.5이상~4.0미만" | "4.0이상"
    last_semester_target: Optional[int] = None  # 마지막 학기 목표 학점
    acquired: AcquiredCredits
    acquired_areas: AcquiredAreas


class AreaValidation(BaseModel):
    """교양영역별 검증 결과"""
    area: str
    required: int
    acquired: int
    is_satisfied: bool
    message: str


class ValidationResult(BaseModel):
    """전체 검증 결과"""
    # 학점 충족 여부
    total_satisfied: bool
    major_satisfied: bool
    gyopil_satisfied: bool
    gyoseon_satisfied: bool

    # 실제 수치
    total_required: int
    total_acquired: int
    major_required: int
    major_acquired: int
    gyopil_required: int
    gyopil_acquired: int
    gyoseon_required: int
    gyoseon_acquired: int

    # 교양영역별 검증
    area_validations: list[AreaValidation]
    area_all_satisfied: bool

    # 경고 메시지 목록
    warnings: list[str]


class GraduationResponse(BaseModel):
    success: bool
    validation: ValidationResult
    # 계획은 나중에 추가