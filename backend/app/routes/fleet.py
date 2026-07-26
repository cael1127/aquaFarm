from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session

router = APIRouter(prefix="/api/v1", tags=["fleet"])


class DeviceOut(BaseModel):
    sensor_id: str
    farm_id: str
    metrics: list[str]
    last_seen: datetime | None
    last_metric: str | None
    last_value: float | None
    last_unit: str


class AlertRow(BaseModel):
    id: int
    time: datetime
    sensor_id: str
    farm_id: str
    metric: str
    value: float
    threshold: float
    severity: str
    message: str


class AggregatePoint(BaseModel):
    bucket: datetime
    sensor_id: str
    farm_id: str
    metric: str
    avg_value: float
    min_value: float
    max_value: float
    samples: int


@router.get("/devices", response_model=list[DeviceOut])
async def list_devices(
    farm_id: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[DeviceOut]:
    clauses = ["TRUE"]
    params: dict = {}
    if farm_id:
        clauses.append("farm_id = :farm_id")
        params["farm_id"] = farm_id
    sql = text(
        f"""
        SELECT sensor_id, farm_id, metrics, last_seen, last_metric, last_value, last_unit
        FROM devices
        WHERE {" AND ".join(clauses)}
        ORDER BY last_seen DESC NULLS LAST, sensor_id
        """
    )
    rows = (await session.execute(sql, params)).mappings().all()
    return [
        DeviceOut(
            sensor_id=r["sensor_id"],
            farm_id=r["farm_id"],
            metrics=list(r["metrics"] or []),
            last_seen=r["last_seen"],
            last_metric=r["last_metric"],
            last_value=r["last_value"],
            last_unit=r["last_unit"] or "",
        )
        for r in rows
    ]


@router.get("/alerts", response_model=list[AlertRow])
async def list_alerts(
    farm_id: str | None = "farm-alpha",
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[AlertRow]:
    if farm_id:
        sql = text(
            """
            SELECT id, time, sensor_id, farm_id, metric, value, threshold, severity, message
            FROM alerts
            WHERE farm_id = :farm_id
            ORDER BY time DESC
            LIMIT :limit
            """
        )
        params = {"farm_id": farm_id, "limit": limit}
    else:
        sql = text(
            """
            SELECT id, time, sensor_id, farm_id, metric, value, threshold, severity, message
            FROM alerts
            ORDER BY time DESC
            LIMIT :limit
            """
        )
        params = {"limit": limit}
    rows = (await session.execute(sql, params)).mappings().all()
    return [AlertRow(**row) for row in rows]


@router.get("/telemetry/aggregate", response_model=list[AggregatePoint])
async def telemetry_aggregate(
    metric: str,
    farm_id: str = "farm-alpha",
    minutes: int = Query(60, ge=5, le=1440),
    session: AsyncSession = Depends(get_session),
) -> list[AggregatePoint]:
    """Prefer continuous aggregate when present; fall back to raw bucket query."""
    cagg = text(
        """
        SELECT bucket, sensor_id, farm_id, metric,
               avg_value, min_value, max_value, samples::int AS samples
        FROM telemetry_1m
        WHERE farm_id = :farm_id
          AND metric = :metric
          AND bucket > NOW() - make_interval(mins => :minutes)
        ORDER BY bucket ASC
        LIMIT 2000
        """
    )
    try:
        rows = (
            await session.execute(
                cagg, {"farm_id": farm_id, "metric": metric, "minutes": minutes}
            )
        ).mappings().all()
        if rows:
            return [AggregatePoint(**row) for row in rows]
    except Exception:
        pass

    fallback = text(
        """
        SELECT
            time_bucket(INTERVAL '1 minute', time) AS bucket,
            sensor_id,
            farm_id,
            metric,
            AVG(value) AS avg_value,
            MIN(value) AS min_value,
            MAX(value) AS max_value,
            COUNT(*)::int AS samples
        FROM telemetry
        WHERE farm_id = :farm_id
          AND metric = :metric
          AND time > NOW() - make_interval(mins => :minutes)
        GROUP BY bucket, sensor_id, farm_id, metric
        ORDER BY bucket ASC
        LIMIT 2000
        """
    )
    rows = (
        await session.execute(
            fallback, {"farm_id": farm_id, "metric": metric, "minutes": minutes}
        )
    ).mappings().all()
    return [AggregatePoint(**row) for row in rows]
