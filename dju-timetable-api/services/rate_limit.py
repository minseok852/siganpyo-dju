# services/rate_limit.py
"""IP 기준 요청 제한 + AI 호출 일일 상한.

외부 의존성 없이 메모리에만 기록한다. 인스턴스 1대 기준이며 재시작하면 초기화된다.
(여러 인스턴스로 늘릴 계획이 생기면 Redis 같은 공유 저장소로 옮겨야 한다)

Gemini를 호출하는 엔드포인트는 인증이 없어서 스크립트로 반복 호출하면
그대로 API 비용이 나간다. 실사용자는 절대 걸리지 않을 선에서 막는다.
"""
import os
import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

# ── 엔드포인트별 IP 제한: (최대 횟수, 기간(초)) ────────────────────────────
# 추천 1회 = Gemini 2회 호출이라 가장 빡빡하게 잡는다.
LIMITS = {
    "recommend":    [(5, 60), (40, 3600)],     # 분당 5회, 시간당 40회
    "modify":       [(10, 60), (60, 3600)],
    "evaluate":     [(10, 60), (60, 3600)],
    "ai_ping":      [(5, 60), (20, 3600)],     # 관리자 수동 버튼
    "admin_verify": [(5, 300)],                # 비밀번호 브루트포스 방지
    "notify":       [(10, 60), (60, 3600)],    # 디스코드 웹훅 스팸 방지
}

# ── AI 호출 전체 일일 상한 (폭주 시 마지막 안전핀) ─────────────────────────
DAILY_AI_LIMIT = int(os.getenv("DAILY_AI_LIMIT", "500"))

_hits: dict = defaultdict(deque)   # (bucket, ip) -> 요청 시각들
_daily: deque = deque()            # AI 호출 시각들 (24시간 창)
_lock = Lock()


def client_ip(request: Request) -> str:
    """실제 클라이언트 IP.

    프록시(Render/Railway/Vercel) 뒤에 있으면 request.client.host는 프록시 IP라
    모든 사용자가 한 버킷을 공유해버린다. X-Forwarded-For의 첫 IP를 쓴다.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else "unknown"


def _prune(dq: deque, now: float, window: float) -> None:
    while dq and now - dq[0] > window:
        dq.popleft()


def check(request: Request, bucket: str) -> None:
    """제한 초과 시 429를 던진다. 통과하면 호출을 기록한다."""
    rules = LIMITS.get(bucket)
    if not rules:
        return

    ip = client_ip(request)
    now = time.time()
    key = (bucket, ip)

    with _lock:
        dq = _hits[key]
        _prune(dq, now, max(w for _, w in rules))

        for limit, window in rules:
            in_window = [t for t in dq if now - t <= window]
            if len(in_window) < limit:
                continue

            # 이 규칙의 시간창 안에서, 몇 번째 기록이 빠져나가야 다시 허용되는지.
            # dq[0]을 쓰면 가장 긴 시간창 기준이라 규칙이 여러 개일 때 값이 틀린다.
            if limit <= 0:
                retry_after = int(window)
            else:
                oldest_blocking = in_window[len(in_window) - limit]
                retry_after = max(1, int(window - (now - oldest_blocking)) + 1)

            raise HTTPException(
                status_code=429,
                detail=f"요청이 너무 잦습니다. {retry_after}초 후 다시 시도해주세요.",
                headers={"Retry-After": str(retry_after)},
            )
        dq.append(now)


def check_daily_ai() -> None:
    """AI 호출 일일 상한. 초과하면 503."""
    now = time.time()
    with _lock:
        _prune(_daily, now, 86400)
        if len(_daily) >= DAILY_AI_LIMIT:
            raise HTTPException(
                status_code=503,
                detail="오늘 AI 사용량이 한도에 도달했습니다. 내일 다시 시도해주세요.",
            )
        _daily.append(now)


def daily_ai_count() -> int:
    """오늘(최근 24시간) AI 호출 횟수 — 상태 확인용"""
    with _lock:
        _prune(_daily, time.time(), 86400)
        return len(_daily)


def stats() -> dict:
    with _lock:
        return {
            "daily_ai_calls": len(_daily),
            "daily_ai_limit": DAILY_AI_LIMIT,
            "tracked_ips": len({ip for _, ip in _hits}),
        }
