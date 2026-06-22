# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional, Any
import os
import httpx

# 환경변수 로드
load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    print("⚠️ WARNING: GEMINI_API_KEY가 설정되지 않았습니다!")
from models.schemas import EvaluateRequest, RecommendRequest
from services.ai_service import evaluate_schedule
from services.recommend_service import recommend_schedule

app = FastAPI(
    title="대진대 시간표 AI API",
    description="시간표 분석, 평가 및 추천 API",
    version="1.0.0"
)

# CORS 설정 (프론트엔드 연동용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 개발서버
        "http://localhost:3000",
        "https://siganpyo-dju.vercel.app" #배포된 도메인
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """헬스체크"""
    return {"status": "ok", "message": "대진대 시간표 AI API"}


@app.get("/health")
async def health_check():
    """상태 확인"""
    api_key_exists = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "healthy",
        "api_key_configured": api_key_exists
    }


@app.post("/api/evaluate")
async def evaluate_schedule_endpoint(request: EvaluateRequest):
    """
    시간표 평가 API
    """
    
    if not request.courses:
        raise HTTPException(status_code=400, detail="과목이 없습니다")
    
    if len(request.courses) > 15:
        raise HTTPException(status_code=400, detail="과목이 너무 많습니다 (최대 15개)")
    
    courses_data = [course.model_dump() for course in request.courses]
    user_info_data = request.user_info.model_dump()
    
    result = await evaluate_schedule(courses_data, user_info_data)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500, 
            detail=result.get("error", "AI 평가 중 오류가 발생했습니다")
        )
    
    return result


@app.post("/api/recommend")
async def recommend_schedule_endpoint(request: RecommendRequest):
    """
    시간표 추천 API
    """
    
    if not request.available_courses:
        raise HTTPException(status_code=400, detail="사용 가능한 과목이 없습니다")
    
    user_info_data = request.user_info.model_dump()
    available_courses_data = {
        k: [c.model_dump() for c in v] 
        for k, v in request.available_courses.items()
    }
    
    result = await recommend_schedule(user_info_data, available_courses_data)
    
    if not result.get("success"):
        raise HTTPException(
            status_code=500, 
            detail=result.get("error", "AI 추천 중 오류가 발생했습니다")
        )
    
    return result

from models.graduation_schemas import GraduationRequest
from services.graduation_service import validate, plan
from services.modify_service import modify_schedule as _modify_schedule


class ModifyRequest(BaseModel):
    current_courses: list[dict[str, Any]]
    modify_type: str
    modify_params: dict[str, Any]
    available_courses: dict[str, list[dict[str, Any]]]
    user_info: dict[str, Any]


@app.post("/api/recommend/modify")
async def modify_schedule_endpoint(request: ModifyRequest):
    """시간표 수정 API"""
    if not request.current_courses:
        raise HTTPException(status_code=400, detail="현재 시간표가 없습니다")

    result = await _modify_schedule(
        current_courses=request.current_courses,
        modify_type=request.modify_type,
        modify_params=request.modify_params,
        available_courses=request.available_courses,
        user_info=request.user_info,
    )

    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "수정 중 오류가 발생했습니다"))

    return result

@app.post("/api/graduation/validate")
async def graduation_validate(request: GraduationRequest):
    result = validate(request.model_dump())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

@app.post("/api/graduation/plan")
async def graduation_plan(request: GraduationRequest):
    v = validate(request.model_dump())
    if not v.get("success"):
        raise HTTPException(status_code=400, detail=v.get("error"))
    result = plan(request.model_dump(), v)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result

# ===== 관리자 인증 =====

class AdminVerifyRequest(BaseModel):
    password: str

@app.post("/api/admin/verify")
async def verify_admin(request: AdminVerifyRequest):
    """관리자 비밀번호 검증 (서버에서만 비밀번호 보유)"""
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_password:
        raise HTTPException(status_code=500, detail="서버 설정 오류")
    if request.password != admin_password:
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다")
    return {"success": True}


class FeedbackNotifyRequest(BaseModel):
    category: str
    content: str
    courseName: Optional[str] = None

@app.post("/api/feedback/notify")
async def notify_feedback(request: FeedbackNotifyRequest):
    """피드백 제출 시 디스코드로 알림 전송"""
    webhook_url = os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        raise HTTPException(status_code=500, detail="Discord webhook이 설정되지 않았습니다")

    category_emoji = "🔤" if request.category == "오타 제보" else "💡"
    lines = [
        f"## {category_emoji} 새 피드백이 도착했어요!",
        f"**카테고리:** {request.category}",
    ]
    if request.courseName:
        lines.append(f"**과목:** {request.courseName}")
    lines.append(f"**내용:**\n{request.content}")

    payload = {"content": "\n".join(lines)}

    async with httpx.AsyncClient() as client:
        resp = await client.post(webhook_url, json=payload)
        if resp.status_code not in (200, 204):
            raise HTTPException(status_code=502, detail="Discord 알림 전송 실패")

    return {"success": True}


# 개발용 실행
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)