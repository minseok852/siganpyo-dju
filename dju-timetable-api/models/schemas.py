# models/schemas.py
from pydantic import BaseModel
from typing import Optional

class TimeSlot(BaseModel):
    day: str
    start: str
    end: str

class Course(BaseModel):
    course_code: str
    section: str
    course_name: str
    professor: Optional[str] = None
    credits: int
    target_year: Optional[int] = 0  # 대상학년 추가!
    schedule_raw: Optional[str] = None
    times: Optional[list[TimeSlot]] = None
    room: Optional[str] = None
    category: Optional[str] = None
    classification: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None
    notes: Optional[str] = None  # 비고란

class UserInfo(BaseModel):
    grade: int
    major: str
    double_major: Optional[str] = None

class EvaluateRequest(BaseModel):
    courses: list[Course]
    user_info: UserInfo

class IndicatorResult(BaseModel):
    name: str
    emoji: str
    status: str
    message: str

class ScheduleType(BaseModel):
    emoji: str
    name: str
    description: str

class EvaluateResponse(BaseModel):
    success: bool
    schedule_type: ScheduleType
    total_score: int
    indicators: list[IndicatorResult]
    advice: list[str]
    summary: str


# ===== 추천 관련 스키마 =====

class Preferences(BaseModel):
    empty_days: Optional[list[str]] = []
    no_morning: Optional[bool] = False
    consecutive: Optional[str] = "상관없음"
    preferred_time: Optional[str] = "상관없음"
    preferred_areas: Optional[list[str]] = []
    skip_general: Optional[bool] = False  # 교양 안 듣기
    must_take_courses: Optional[list[Course]] = []  # 꼭 듣고 싶은 과목
    selected_major_courses: Optional[list[Course]] = []  # 직접 선택한 전공과목 (2학년+)
    major_selection_mode: Optional[str] = "auto"  # "manual" (직접선택) | "auto" (상관없음)
    avoid_courses: Optional[str] = None

class RecommendUserInfo(BaseModel):
    grade: int
    major: str
    double_major: Optional[str] = None
    target_credits: int
    completed_general_required: Optional[list[str]] = []
    completed_major_required: Optional[list[str]] = []
    preferences: Optional[Preferences] = None

class RecommendRequest(BaseModel):
    user_info: RecommendUserInfo
    available_courses: dict[str, list[Course]]

class SelectedCourse(BaseModel):
    course_name: str
    course_code: str
    section: str
    professor: Optional[str] = None
    schedule_raw: Optional[str] = None
    credits: int
    category: str
    reason: str

class RecommendResponse(BaseModel):
    success: bool
    selected_courses: list[SelectedCourse]
    total_credits: int
    empty_days: list[str]
    warnings: list[str]
    summary: str