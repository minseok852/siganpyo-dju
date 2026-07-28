# services/gemini.py
"""Gemini 호출 공통 모듈 (google-genai SDK).

이전에는 세 서비스가 각자 모델을 만들고 설정을 복사해 썼다. 그 탓에
max_output_tokens 같은 값이 5곳에 흩어져 한 곳만 고치면 나머지가 남는 문제가 있었다.
호출 규칙(모델/토큰/타임아웃/재시도/JSON 파싱)을 여기 한 곳에 모은다.

구 SDK(google-generativeai)는 지원이 종료돼 google-genai로 이전했다.
바뀐 점:
  - 모델 인스턴스 대신 Client 하나를 재사용한다
  - 네이티브 async(client.aio)를 쓴다. 예전에는 async 함수 안에서 동기 호출을 해
    20~30초 동안 이벤트 루프 전체가 멈췄다 (다른 사용자 요청까지 대기)
  - finish_reason이 정수가 아니라 문자열 enum이다
  - 타임아웃 단위가 초가 아니라 밀리초다
"""
import asyncio
import json
import os
import random

from google import genai
from google.genai import types

# 모델·동작은 전부 환경변수로 바꿀 수 있게 한다.
# 재배포 없이 값만 바꿔 실사용 A/B를 볼 수 있도록.
MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

# gemini-flash-latest는 thinking 모델이라 내부 추론 토큰이 이 예산을 같이 쓴다.
# 실측상 추론에만 3,800~7,600 토큰이 오가서 8192로는 응답이 중간에 잘렸다.
MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "32768"))

# 타임아웃이 없으면 응답이 안 올 때 요청이 무한정 매달린다. 실측 응답은 20~35초.
TIMEOUT_SEC = int(os.getenv("GEMINI_TIMEOUT", "90"))

# thinking 강도. 미설정이면 모델 기본값(현재 상태).
#   'low'  → 시간 절반이지만 어려운 학과에서 시간 충돌이 늘어난다 (실측)
#   'high' → 기본값보다 느리고 이득 없음
# 실사용 데이터를 보고 조정하기 위해 환경변수로 뺐다.
THINKING_LEVEL = os.getenv("GEMINI_THINKING_LEVEL") or None

# 재시도: 총 시도 횟수(=재시도 1회), 백오프 기준 초
MAX_ATTEMPTS = 2
BACKOFF_BASE = 1.5

_client: "genai.Client | None" = None


def client() -> genai.Client:
    """Client 싱글턴 (요청마다 만들면 커넥션이 낭비된다)"""
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    return _client


def json_config(temperature: float, max_tokens: int = None) -> types.GenerateContentConfig:
    """JSON 응답용 설정 (마크다운 코드블록 없이 순수 JSON을 받는다)"""
    cfg = dict(
        temperature=temperature,
        max_output_tokens=max_tokens or MAX_OUTPUT_TOKENS,
        response_mime_type="application/json",
        http_options=types.HttpOptions(timeout=TIMEOUT_SEC * 1000),  # 밀리초
    )
    if THINKING_LEVEL:
        cfg["thinking_config"] = types.ThinkingConfig(thinking_level=THINKING_LEVEL)
    return types.GenerateContentConfig(**cfg)


def response_text(response) -> str:
    """응답 텍스트 추출 + 실패 원인을 알아볼 수 있는 형태로 변환.

    그냥 response.text를 쓰면 잘린 응답이 JSONDecodeError로만 보여서
    원인(토큰 한도/세이프티/빈 응답)을 알 수 없다.
    """
    candidates = getattr(response, "candidates", None) or []
    reason = getattr(candidates[0], "finish_reason", None) if candidates else None
    label = getattr(reason, "name", None) or str(reason or "UNKNOWN")

    try:
        text = response.text
    except Exception as e:
        raise RuntimeError(f"응답 텍스트를 읽을 수 없음 ({label}): {type(e).__name__}: {e}")

    if reason == types.FinishReason.MAX_TOKENS:
        raise RuntimeError(f"응답이 토큰 한도에서 잘림 (MAX_TOKENS, {len(text or '')}자 수신)")
    if not text or not text.strip():
        raise RuntimeError(f"빈 응답 ({label})")
    return text


def extract_json(text: str) -> dict:
    """JSON 파싱. JSON 모드를 쓰지만 옛 응답 형식(코드블록)도 받아준다."""
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0]
    elif "```" in text:
        text = text.split("```")[1].split("```")[0]
    return json.loads(text.strip())


def is_transient(exc: Exception) -> bool:
    """재시도할 가치가 있는 일시적 오류인가.

    429(할당량)/5xx(서버)/타임아웃만 해당. 프롬프트 문제나 파싱 실패는
    다시 보내도 같은 결과라 재시도하지 않는다 (그냥 비용만 두 배).
    """
    text = str(exc).lower()

    # 같은 429라도 '결제 한도 소진'은 재시도해도 절대 안 풀린다.
    if any(k in text for k in ("spending cap", "spend cap", "billing",
                               "exceeded its monthly", "suspended",
                               "api key not valid", "permission denied")):
        return False

    name = type(exc).__name__
    if name in ("ResourceExhausted", "ServiceUnavailable", "InternalServerError",
                "DeadlineExceeded", "TooManyRequests", "GatewayTimeout", "Aborted",
                "ServerError", "APIError"):
        return True
    return any(k in text for k in ("429", "503", "500", "quota", "rate limit",
                                   "timeout", "deadline", "unavailable"))


async def generate_json(prompt: str, temperature: float = 0.3, max_tokens: int = None) -> dict:
    """Gemini 호출 + JSON 파싱. 일시적 오류만 지수 백오프로 1회 재시도한다.

    백오프 없이 즉시 재시도하면 429일 때 오히려 할당량을 더 빨리 태운다.
    """
    last_exc = None
    for attempt in range(MAX_ATTEMPTS):
        try:
            resp = await client().aio.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=json_config(temperature, max_tokens),
            )
            return extract_json(response_text(resp))
        except Exception as e:
            last_exc = e
            if attempt == MAX_ATTEMPTS - 1 or not is_transient(e):
                raise
            # 지수 백오프 + 지터 (동시 요청이 같은 순간에 몰려 재시도하는 걸 방지)
            delay = BACKOFF_BASE * (2 ** attempt) + random.uniform(0, 0.5)
            print(f"[RETRY] 일시적 오류로 {delay:.1f}초 후 재시도 "
                  f"({attempt + 1}/{MAX_ATTEMPTS - 1}): {type(e).__name__}: {str(e)[:80]}")
            await asyncio.sleep(delay)

    raise last_exc


async def ping() -> str:
    """AI가 실제로 응답하는지 확인 (관리자용). 최소 비용으로 호출한다."""
    resp = await client().aio.models.generate_content(
        model=MODEL,
        contents="Say 'ok'",
        config=types.GenerateContentConfig(
            max_output_tokens=2048,
            http_options=types.HttpOptions(timeout=30_000),
        ),
    )
    return (resp.text or "").strip()
