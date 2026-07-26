from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.schemas import TelemetryOut

router = APIRouter(prefix="/api/v1", tags=["telemetry"])


@router.get("/telemetry/latest", response_model=list[TelemetryOut])
async def latest_telemetry(
    farm_id: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
) -> list[TelemetryOut]:
    clauses = ["TRUE"]
    params: dict = {"limit": limit}
    if farm_id:
        clauses.append("farm_id = :farm_id")
        params["farm_id"] = farm_id

    sql = text(
        f"""
        SELECT DISTINCT ON (sensor_id, metric)
            time, sensor_id, farm_id, metric, value, unit, payload
        FROM telemetry
        WHERE {" AND ".join(clauses)}
        ORDER BY sensor_id, metric, time DESC
        LIMIT :limit
        """
    )
    result = await session.execute(sql, params)
    rows = result.mappings().all()
    return [TelemetryOut(**row) for row in rows]


@router.get("/telemetry/history", response_model=list[TelemetryOut])
async def history(
    sensor_id: str,
    metric: str,
    minutes: int = Query(30, ge=1, le=1440),
    session: AsyncSession = Depends(get_session),
) -> list[TelemetryOut]:
    since = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    sql = text(
        """
        SELECT time, sensor_id, farm_id, metric, value, unit, payload
        FROM telemetry
        WHERE sensor_id = :sensor_id
          AND metric = :metric
          AND time >= :since
        ORDER BY time ASC
        LIMIT 5000
        """
    )
    result = await session.execute(
        sql, {"sensor_id": sensor_id, "metric": metric, "since": since}
    )
    return [TelemetryOut(**row) for row in result.mappings().all()]


@router.get("/telemetry/stats")
async def stats(
    farm_id: str = "farm-alpha",
    session: AsyncSession = Depends(get_session),
) -> dict:
    sql = text(
        """
        SELECT
            COUNT(*)::bigint AS total_points,
            COUNT(DISTINCT sensor_id)::bigint AS sensors,
            MAX(time) AS last_seen
        FROM telemetry
        WHERE farm_id = :farm_id
          AND time > NOW() - INTERVAL '1 hour'
        """
    )
    row = (await session.execute(sql, {"farm_id": farm_id})).mappings().one()
    return {
        "farm_id": farm_id,
        "total_points_1h": int(row["total_points"] or 0),
        "active_sensors_1h": int(row["sensors"] or 0),
        "last_seen": row["last_seen"],
    }
