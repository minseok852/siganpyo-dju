# services/result_cache.py
"""같은 요청이 반복될 때 AI를 다시 호출하지 않기 위한 캐시.

해결하려는 문제:
  사용자가 20~30초를 못 기다리고 이탈했다가 다시 시도한다. 그런데
  1) 이탈해도 서버는 이미 시작한 생성을 끝까지 돌린다 (토큰은 그대로 나감)
  2) 다시 보낸 요청은 같은 입력인데도 처음부터 새로 생성한다
  결과적으로 한 사람이 한 번 쓸 결과에 AI 호출이 2~3배로 나간다.

두 가지로 막는다:
  - 합치기(coalescing): 같은 입력이 이미 생성 중이면 그 결과를 같이 받는다
  - 캐시: 최근에 만든 결과가 있으면 AI 호출 없이 그대로 돌려준다

메모리에만 저장하며 인스턴스 1대 기준이다. 재시작하면 비워진다.
"""
import asyncio
import hashlib
import json
import os
import time
from collections import OrderedDict

# 같은 입력을 이 시간 안에 다시 보내면 재생성하지 않는다
TTL = int(os.getenv("RESULT_CACHE_TTL", "300"))       # 5분
MAX_ENTRIES = int(os.getenv("RESULT_CACHE_MAX", "200"))

# 이미 생성 중인 요청을 기다릴 최대 시간 (원 요청이 죽었을 때 무한 대기 방지)
COALESCE_TIMEOUT = int(os.getenv("RESULT_CACHE_WAIT", "120"))

_results: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
_inflight: "dict[str, asyncio.Future]" = {}
_lock = asyncio.Lock()

_stats = {"hit": 0, "coalesced": 0, "miss": 0}


def make_key(*parts) -> str:
    """요청 내용으로 캐시 키 생성 (키 순서가 달라도 같은 키가 나오도록 정렬)"""
    blob = json.dumps(parts, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _prune(now: float) -> None:
    """만료 항목 제거 + 최대 개수 유지 (호출자가 락을 잡고 있어야 함)"""
    for k in [k for k, (ts, _) in _results.items() if now - ts > TTL]:
        _results.pop(k, None)
    while len(_results) > MAX_ENTRIES:
        _results.popitem(last=False)   # 가장 오래된 것부터


async def get_or_create(key: str, factory, force: bool = False):
    """캐시/합치기를 적용해 결과를 반환한다.

    factory: 실제 AI 생성을 수행하는 async 함수 (인자 없음)
    force:   True면 캐시를 무시하고 새로 생성한다 (사용자가 '다시 만들기'를 누른 경우)
    반환:    (결과, 'hit' | 'coalesced' | 'miss')
    """
    now = time.time()

    async with _lock:
        if not force:
            cached = _results.get(key)
            if cached and now - cached[0] <= TTL:
                _results.move_to_end(key)
                _stats["hit"] += 1
                return cached[1], "hit"

            waiting = _inflight.get(key)
            if waiting is not None:
                _stats["coalesced"] += 1
                fut = waiting
            else:
                fut = None
        else:
            fut = None

        if fut is None:
            owner_future = asyncio.get_running_loop().create_future()
            # force일 때는 다른 요청이 이 결과를 기다리지 않게 등록하지 않는다
            if not force:
                _inflight[key] = owner_future
            _stats["miss"] += 1
        else:
            owner_future = None

    # 이미 생성 중이면 그 결과를 같이 받는다
    if owner_future is None:
        try:
            return await asyncio.wait_for(asyncio.shield(fut), COALESCE_TIMEOUT), "coalesced"
        except (asyncio.TimeoutError, asyncio.CancelledError, RuntimeError):
            # 먼저 시작된 요청을 기다릴 수 없는 경우(지연/취소/다른 이벤트 루프).
            # 합치기는 어디까지나 최적화이므로, 실패하면 에러를 내지 말고 직접 생성한다.
            result = await factory()
            async with _lock:
                if isinstance(result, dict) and result.get("success"):
                    _results[key] = (time.time(), result)
                    _prune(time.time())
            return result, "miss"

    # 내가 생성 담당
    try:
        result = await factory()
    except BaseException as e:
        async with _lock:
            _inflight.pop(key, None)
        if not owner_future.done():
            owner_future.set_exception(e)
        # 기다리는 쪽이 없으면 예외가 회수되지 않았다는 경고가 뜨므로 미리 소비해둔다
        owner_future.exception() if owner_future.done() else None
        raise

    async with _lock:
        _inflight.pop(key, None)
        if isinstance(result, dict) and result.get("success"):
            _results[key] = (time.time(), result)
            _prune(time.time())

    if not owner_future.done():
        owner_future.set_result(result)
    return result, "miss"


def stats() -> dict:
    total = sum(_stats.values())
    saved = _stats["hit"] + _stats["coalesced"]
    return {
        **_stats,
        "cached_results": len(_results),
        "in_flight": len(_inflight),
        "saved_ratio": round(saved / total, 3) if total else 0.0,
    }


def clear() -> None:
    _results.clear()
    _inflight.clear()
    for k in _stats:
        _stats[k] = 0
