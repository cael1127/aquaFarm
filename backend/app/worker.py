from __future__ import annotations

import asyncio
import json
import logging
import os
import socket
from datetime import datetime, timezone

from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal
from app.migrate import run_migrations
from app.redis_client import (
    ensure_consumer_group,
    get_redis,
    publish_alert,
    publish_live,
)
from app.schemas import ALERT_RULES

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("aquafarm.worker")

CONSUMER_NAME = os.getenv(
    "CONSUMER_NAME",
    f"{settings.consumer_name}-{socket.gethostname()}-{os.getpid()}",
)


async def wait_for_db(retries: int = 40, delay: float = 1.0) -> None:
    for attempt in range(1, retries + 1):
        try:
            async with SessionLocal() as session:
                await session.execute(text("SELECT 1"))
            log.info("Database ready")
            return
        except Exception as exc:
            log.warning("DB not ready (%d/%d): %s", attempt, retries, exc)
            await asyncio.sleep(delay)
    raise RuntimeError("Database never became ready")


async def process_batch(entries: list[tuple[str, dict[str, str]]]) -> list[str]:
    events: list[dict] = []
    now = datetime.now(timezone.utc)

    for msg_id, fields in entries:
        ts_raw = fields.get("timestamp")
        try:
            ts = datetime.fromisoformat(ts_raw) if ts_raw else now
        except ValueError:
            ts = now

        enq_raw = fields.get("enqueued_at")
        try:
            enqueued_at = datetime.fromisoformat(enq_raw) if enq_raw else now
        except ValueError:
            enqueued_at = now
        if enqueued_at.tzinfo is None:
            enqueued_at = enqueued_at.replace(tzinfo=timezone.utc)

        try:
            payload = json.loads(fields.get("payload") or "{}")
        except json.JSONDecodeError:
            payload = {}

        lag_ms = max(0, int((now - enqueued_at).total_seconds() * 1000))

        events.append(
            {
                "msg_id": msg_id,
                "time": ts,
                "sensor_id": fields["sensor_id"],
                "farm_id": fields["farm_id"],
                "metric": fields["metric"],
                "value": float(fields["value"]),
                "unit": fields.get("unit") or "",
                "payload": payload,
                "lag_ms": lag_ms,
            }
        )

    async with SessionLocal() as session:
        await session.execute(
            text(
                """
                INSERT INTO telemetry (time, sensor_id, farm_id, metric, value, unit, payload)
                VALUES (:time, :sensor_id, :farm_id, :metric, :value, :unit, CAST(:payload AS jsonb))
                """
            ),
            [
                {
                    "time": e["time"],
                    "sensor_id": e["sensor_id"],
                    "farm_id": e["farm_id"],
                    "metric": e["metric"],
                    "value": e["value"],
                    "unit": e["unit"],
                    "payload": json.dumps(e["payload"]),
                }
                for e in events
            ],
        )

        for e in events:
            await session.execute(
                text(
                    """
                    INSERT INTO devices (
                        sensor_id, farm_id, metrics, last_seen, last_metric, last_value, last_unit
                    ) VALUES (
                        :sensor_id, :farm_id, ARRAY[:metric]::text[], :time, :metric, :value, :unit
                    )
                    ON CONFLICT (sensor_id) DO UPDATE SET
                        farm_id = EXCLUDED.farm_id,
                        last_seen = EXCLUDED.last_seen,
                        last_metric = EXCLUDED.last_metric,
                        last_value = EXCLUDED.last_value,
                        last_unit = EXCLUDED.last_unit,
                        metrics = (
                            SELECT ARRAY(
                                SELECT DISTINCT unnest(
                                    devices.metrics || EXCLUDED.metrics
                                )
                            )
                        )
                    """
                ),
                {
                    "sensor_id": e["sensor_id"],
                    "farm_id": e["farm_id"],
                    "metric": e["metric"],
                    "time": e["time"],
                    "value": e["value"],
                    "unit": e["unit"],
                },
            )

        await session.commit()

    acked: list[str] = []
    r = await get_redis()
    for e in events:
        await publish_live(
            {
                "time": e["time"].isoformat(),
                "sensor_id": e["sensor_id"],
                "farm_id": e["farm_id"],
                "metric": e["metric"],
                "value": e["value"],
                "unit": e["unit"],
                "lag_ms": e["lag_ms"],
            }
        )
        try:
            await r.lpush("telemetry:lag_ms", str(e["lag_ms"]))
            await r.ltrim("telemetry:lag_ms", 0, 99)
        except Exception:
            pass

        rule = ALERT_RULES.get(e["metric"])
        if rule:
            lo, hi, unit = rule
            value = e["value"]
            if value < lo or value > hi:
                severity = "critical" if value < lo * 0.85 or value > hi * 1.15 else "warning"
                alert = {
                    "time": e["time"].isoformat(),
                    "sensor_id": e["sensor_id"],
                    "farm_id": e["farm_id"],
                    "metric": e["metric"],
                    "value": value,
                    "threshold": lo if value < lo else hi,
                    "severity": severity,
                    "message": f"{e['metric']}={value}{unit} outside [{lo}, {hi}]",
                }
                async with SessionLocal() as session:
                    await session.execute(
                        text(
                            """
                            INSERT INTO alerts (
                                time, sensor_id, farm_id, metric, value, threshold, severity, message
                            ) VALUES (
                                :time, :sensor_id, :farm_id, :metric, :value, :threshold, :severity, :message
                            )
                            """
                        ),
                        {
                            "time": e["time"],
                            "sensor_id": e["sensor_id"],
                            "farm_id": e["farm_id"],
                            "metric": e["metric"],
                            "value": value,
                            "threshold": alert["threshold"],
                            "severity": severity,
                            "message": alert["message"],
                        },
                    )
                    await session.commit()
                await publish_alert(alert)

        acked.append(e["msg_id"])

    return acked


async def reclaim_pending(r, min_idle_ms: int = 30_000, count: int = 50) -> int:
    try:
        _next_id, claimed, _deleted = await r.xautoclaim(
            name=settings.ingest_stream,
            groupname=settings.consumer_group,
            consumername=CONSUMER_NAME,
            min_idle_time=min_idle_ms,
            start_id="0-0",
            count=count,
        )
    except Exception:
        log.exception("XAUTOCLAIM failed")
        return 0

    if not claimed:
        return 0

    log.info("Reclaimed %d pending message(s)", len(claimed))
    try:
        acked = await process_batch(claimed)
        if acked:
            await r.xack(settings.ingest_stream, settings.consumer_group, *acked)
    except Exception:
        log.exception("Reclaim batch failed (%d messages)", len(claimed))
        for msg_id, fields in claimed:
            try:
                await process_batch([(msg_id, fields)])
                await r.xack(settings.ingest_stream, settings.consumer_group, msg_id)
            except Exception:
                log.exception("Poison reclaimed message %s", msg_id)
    return len(claimed)


async def run_worker() -> None:
    await wait_for_db()
    await run_migrations()
    await ensure_consumer_group()
    r = await get_redis()
    log.info(
        "Worker listening stream=%s group=%s consumer=%s",
        settings.ingest_stream,
        settings.consumer_group,
        CONSUMER_NAME,
    )

    idle_ticks = 0
    while True:
        messages = await r.xreadgroup(
            groupname=settings.consumer_group,
            consumername=CONSUMER_NAME,
            streams={settings.ingest_stream: ">"},
            count=100,
            block=2000,
        )
        if not messages:
            idle_ticks += 1
            if idle_ticks % 5 == 0:
                await reclaim_pending(r)
            continue

        idle_ticks = 0
        for _stream, entries in messages:
            try:
                acked = await process_batch(entries)
                if acked:
                    await r.xack(settings.ingest_stream, settings.consumer_group, *acked)
            except Exception:
                log.exception("Batch failed (%d messages)", len(entries))
                for msg_id, fields in entries:
                    try:
                        await process_batch([(msg_id, fields)])
                        await r.xack(settings.ingest_stream, settings.consumer_group, msg_id)
                    except Exception:
                        log.exception("Poison message %s", msg_id)


def main() -> None:
    asyncio.run(run_worker())


if __name__ == "__main__":
    main()
