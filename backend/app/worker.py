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

    for msg_id, fields in entries:
        ts_raw = fields.get("timestamp")
        try:
            ts = datetime.fromisoformat(ts_raw) if ts_raw else datetime.now(timezone.utc)
        except ValueError:
            ts = datetime.now(timezone.utc)

        try:
            payload = json.loads(fields.get("payload") or "{}")
        except json.JSONDecodeError:
            payload = {}

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
    for e in events:
        await publish_live(
            {
                "time": e["time"].isoformat(),
                "sensor_id": e["sensor_id"],
                "farm_id": e["farm_id"],
                "metric": e["metric"],
                "value": e["value"],
                "unit": e["unit"],
            }
        )

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

    while True:
        messages = await r.xreadgroup(
            groupname=settings.consumer_group,
            consumername=CONSUMER_NAME,
            streams={settings.ingest_stream: ">"},
            count=100,
            block=2000,
        )
        if not messages:
            continue

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
