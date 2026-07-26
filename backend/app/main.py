from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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


@app.get("/health")
async def health() -> dict:
    r = await get_redis()
    pong = await r.ping()
    return {
        "ok": True,
        "redis": bool(pong),
        "stream": settings.ingest_stream,
        "channel": settings.telemetry_channel,
    }


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
