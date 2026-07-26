from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import redis.asyncio as redis

from app.config import settings
from app.schemas import TelemetryIn


_pool: redis.Redis | None = None


async def get_redis() -> redis.Redis:
    global _pool
    if _pool is None:
        _pool = redis.from_url(settings.redis_url, decode_responses=True)
    return _pool


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None


async def ensure_consumer_group() -> None:
    r = await get_redis()
    try:
        await r.xgroup_create(
            settings.ingest_stream,
            settings.consumer_group,
            id="0",
            mkstream=True,
        )
    except redis.ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


async def enqueue_telemetry(items: list[TelemetryIn]) -> str:
    r = await get_redis()
    pipe = r.pipeline()
    last_id = ""
    for item in items:
        ts = item.timestamp or datetime.now(timezone.utc)
        fields = {
            "sensor_id": item.sensor_id,
            "farm_id": item.farm_id,
            "metric": item.metric,
            "value": str(item.value),
            "unit": item.unit,
            "timestamp": ts.isoformat(),
            "payload": json.dumps(item.payload),
        }
        pipe.xadd(settings.ingest_stream, fields, maxlen=100_000, approximate=True)
    ids = await pipe.execute()
    if ids:
        last_id = str(ids[-1])
    return last_id


async def publish_live(event: dict[str, Any]) -> None:
    r = await get_redis()
    await r.publish(settings.telemetry_channel, json.dumps(event, default=str))


async def publish_alert(event: dict[str, Any]) -> None:
    r = await get_redis()
    await r.publish(settings.alert_channel, json.dumps(event, default=str))
