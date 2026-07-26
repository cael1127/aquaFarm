from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from app.config import settings
from app.rate_limit import enforce_ingest_rate
from app.redis_client import enqueue_telemetry
from app.schemas import IngestAccepted, TelemetryIn

router = APIRouter(prefix="/api/v1", tags=["ingest"])


def require_device_token(x_device_token: str = Header(...)) -> None:
    if x_device_token != settings.device_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device token")


@router.post("/ingest", response_model=IngestAccepted, dependencies=[Depends(require_device_token)])
async def ingest_one(request: Request, body: TelemetryIn) -> IngestAccepted:
    await enforce_ingest_rate(request, limit=300)
    stream_id = await enqueue_telemetry([body])
    return IngestAccepted(accepted=1, stream_id=stream_id)


@router.post("/ingest/batch", response_model=IngestAccepted, dependencies=[Depends(require_device_token)])
async def ingest_batch(request: Request, body: list[TelemetryIn]) -> IngestAccepted:
    await enforce_ingest_rate(request, limit=60)
    if not body:
        raise HTTPException(status_code=400, detail="Empty batch")
    if len(body) > 500:
        raise HTTPException(status_code=400, detail="Batch too large (max 500)")
    stream_id = await enqueue_telemetry(body)
    return IngestAccepted(accepted=len(body), stream_id=stream_id)
