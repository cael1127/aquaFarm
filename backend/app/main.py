from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal
from app.migrate import run_migrations
from app.redis_client import close_redis, ensure_consumer_group, get_redis
from app.routes.fleet import router as fleet_router
from app.routes.ingest import router as ingest_router
from app.routes.telemetry import router as telemetry_router
from app.ws_hub import hub


async def _relay_pubsub() -> None:
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(settings.telemetry_channel, settings.alert_channel)
    try:
        async for message in pubsub.listen():
            if message is None or message.get("type") != "message":
                continue
            channel = message.get("channel")
            data = message.get("data")
            try:
                payload = json.loads(data)
            except Exception:
                payload = {"raw": data}
            event_type = "alert" if channel == settings.alert_channel else "telemetry"
            await hub.broadcast({"type": event_type, "data": payload})
    except asyncio.CancelledError:
        await pubsub.unsubscribe(settings.telemetry_channel, settings.alert_channel)
        await pubsub.aclose()
        raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations()
    await ensure_consumer_group()
    relay_task = asyncio.create_task(_relay_pubsub())
    app.state.relay_task = relay_task
    try:
        yield
    finally:
        relay_task.cancel()
        try:
            await relay_task
        except asyncio.CancelledError:
            pass
        await close_redis()


app = FastAPI(
    title="AquaFarm IoT API",
    version="1.0.0",
    description="Event-driven telemetry ingest, query, and realtime fan-out",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin, "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(telemetry_router)
app.include_router(fleet_router)


@app.get("/health", response_model=None)
async def health():
    redis_ok = False
    db_ok = False
    stream_length = 0
    pending = 0
    consumers = 0
    lag_samples: list[float] = []

    try:
        r = await get_redis()
        redis_ok = bool(await r.ping())
        stream_length = int(await r.xlen(settings.ingest_stream))
        try:
            raw_lags = await r.lrange("telemetry:lag_ms", 0, 99)
            lag_samples = [float(x) for x in raw_lags]
        except Exception:
            lag_samples = []
        try:
            groups = await r.xinfo_groups(settings.ingest_stream)
            for group in groups:
                if group.get("name") == settings.consumer_group:
                    pending = int(group.get("pending") or 0)
                    consumers = int(group.get("consumers") or 0)
                    break
        except Exception:
            pass
    except Exception:
        redis_ok = False

    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
            db_ok = True
    except Exception:
        db_ok = False

    lag_avg_ms = round(sum(lag_samples) / len(lag_samples), 1) if lag_samples else None
    lag_p95_ms = None
    if lag_samples:
        ordered = sorted(lag_samples)
        lag_p95_ms = round(ordered[min(len(ordered) - 1, int(len(ordered) * 0.95))], 1)

    body = {
        "ok": redis_ok and db_ok,
        "redis": redis_ok,
        "database": db_ok,
        "stream": settings.ingest_stream,
        "channel": settings.telemetry_channel,
        "stream_length": stream_length,
        "pending": pending,
        "consumers": consumers,
        "lag_avg_ms": lag_avg_ms,
        "lag_p95_ms": lag_p95_ms,
        "lag_samples": len(lag_samples),
    }
    if not body["ok"]:
        return JSONResponse(status_code=503, content=body)
    return body


@app.websocket("/ws/telemetry")
async def ws_telemetry(ws: WebSocket) -> None:
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await hub.disconnect(ws)
    except Exception:
        await hub.disconnect(ws)
