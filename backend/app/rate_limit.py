"""Lightweight sliding-window rate limiter backed by Redis."""

from __future__ import annotations

import time

from fastapi import HTTPException, Request, status

from app.redis_client import get_redis


async def enforce_ingest_rate(request: Request, limit: int = 200, window_sec: int = 1) -> None:
    """Allow ~limit ingest requests per window_sec per client IP."""
    r = await get_redis()
    ip = request.client.host if request.client else "unknown"
    bucket = int(time.time() // window_sec)
    key = f"ratelimit:ingest:{ip}:{bucket}"
    count = await r.incr(key)
    if count == 1:
        await r.expire(key, window_sec + 1)
    if count > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Ingest rate limit exceeded ({limit}/{window_sec}s)",
        )
