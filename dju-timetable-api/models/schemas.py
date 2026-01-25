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
    schedule_raw: Optional[str] = None
    times: Optional[list[TimeSlot]] = None
    room: Optional[str] = None
    category: Optional[str] = None
    classification: Optional[str] = None
    college: Optional[str] = None
    department: Optional[str] = None

class UserInfo(BaseModel):
    grade: int  # 학년 1-4
    major: str  # 본전공
    double_major: Optional[str] = None  # 복수전공

class EvaluateRequest(BaseModel):
    courses: list[Course]
    user_info: UserInfo

class IndicatorResult(BaseModel):
    name: str
    emoji: str
    status: str  # good, warning, bad
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
