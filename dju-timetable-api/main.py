# main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

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


# 개발용 실행
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)