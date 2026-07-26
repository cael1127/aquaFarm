"""Mock IoT fleet — posts ~RATE_PER_SEC telemetry points to the ingest API."""

from __future__ import annotations

import asyncio
import math
import os
import random
import time
from datetime import datetime, timezone

import httpx

INGEST_URL = os.getenv("INGEST_URL", "http://localhost:8000/api/v1/ingest")
DEVICE_TOKEN = os.getenv("DEVICE_TOKEN", "dev-sensor-token")
RATE = float(os.getenv("RATE_PER_SEC", "50"))
FARM_ID = os.getenv("FARM_ID", "farm-alpha")

SENSORS = [
    ("cage-01-do", "dissolved_oxygen", "mg/L", 7.5, 1.2),
    ("cage-01-ph", "ph", "pH", 7.4, 0.35),
    ("cage-01-temp", "temperature", "C", 14.0, 2.5),
    ("cage-01-turb", "turbidity", "NTU", 8.0, 4.0),
    ("cage-02-do", "dissolved_oxygen", "mg/L", 7.8, 1.0),
    ("cage-02-ph", "ph", "pH", 7.2, 0.4),
    ("cage-02-temp", "temperature", "C", 13.5, 2.0),
    ("cage-02-turb", "turbidity", "NTU", 6.5, 3.5),
    ("cage-03-do", "dissolved_oxygen", "mg/L", 6.9, 1.5),
    ("cage-03-temp", "temperature", "C", 15.0, 2.8),
]


def sample(metric: str, base: float, noise: float, t: float) -> float:
    wave = math.sin(t / 17.0 + hash(metric) % 7) * noise * 0.6
    # Occasional spikes to exercise the alert engine (~1%)
    spike = 0.0
    if random.random() < 0.01:
        spike = noise * random.choice([-2.2, 2.2])
    value = base + wave + random.uniform(-noise, noise) * 0.25 + spike
    # Keep physically plausible ranges while still allowing threshold breaches
    bounds = {
        "dissolved_oxygen": (2.0, 14.0),
        "ph": (5.5, 9.5),
        "temperature": (4.0, 28.0),
        "turbidity": (0.0, 40.0),
    }
    lo, hi = bounds.get(metric, (value - 1, value + 1))
    return round(min(hi, max(lo, value)), 3)


async def run() -> None:
    interval = 1.0 / max(RATE, 1.0)
    headers = {"X-Device-Token": DEVICE_TOKEN, "Content-Type": "application/json"}
    print(f"Simulator → {INGEST_URL} @ {RATE}/s farm={FARM_ID}", flush=True)

    async with httpx.AsyncClient(timeout=5.0) as client:
        # Wait for API readiness
        for _ in range(60):
            try:
                r = await client.get(INGEST_URL.replace("/api/v1/ingest", "/health"))
                if r.status_code == 200:
                    break
            except Exception:
                pass
            await asyncio.sleep(1)

        i = 0
        while True:
            started = time.perf_counter()
            sensor_id, metric, unit, base, noise = SENSORS[i % len(SENSORS)]
            t = time.time()
            body = {
                "sensor_id": sensor_id,
                "farm_id": FARM_ID,
                "metric": metric,
                "value": sample(metric, base, noise, t),
                "unit": unit,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "payload": {"simulator": True, "seq": i},
            }
            try:
                resp = await client.post(INGEST_URL, headers=headers, json=body)
                if resp.status_code >= 400:
                    print(f"ingest error {resp.status_code}: {resp.text[:200]}", flush=True)
            except Exception as exc:
                print(f"ingest failed: {exc}", flush=True)

            i += 1
            elapsed = time.perf_counter() - started
            await asyncio.sleep(max(0.0, interval - elapsed))


if __name__ == "__main__":
    asyncio.run(run())
