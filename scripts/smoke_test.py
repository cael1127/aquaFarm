#!/usr/bin/env python3
"""End-to-end smoke test for the AquaFarm IoT pipeline."""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

API = os.getenv("API_URL", "http://localhost:8000")
TOKEN = os.getenv("DEVICE_TOKEN", "dev-sensor-token")


def req(method: str, path: str, body: dict | None = None, headers: dict | None = None):
    data = None if body is None else json.dumps(body).encode()
    h = {"Content-Type": "application/json", **(headers or {})}
    request = urllib.request.Request(f"{API}{path}", data=data, headers=h, method=method)
    with urllib.request.urlopen(request, timeout=10) as resp:
        raw = resp.read().decode()
        return resp.status, json.loads(raw) if raw else {}


def main() -> int:
    print("1) health")
    status, health = req("GET", "/health")
    assert status == 200 and health.get("ok"), health
    print("   ok", health)

    print("2) authenticated ingest")
    payload = {
        "sensor_id": "smoke-sensor",
        "farm_id": "farm-alpha",
        "metric": "dissolved_oxygen",
        "value": 4.2,  # below threshold → should alert
        "unit": "mg/L",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    status, accepted = req(
        "POST",
        "/api/v1/ingest",
        body=payload,
        headers={"X-Device-Token": TOKEN},
    )
    assert status == 200 and accepted.get("accepted") == 1, accepted
    print("   accepted", accepted)

    print("3) wait for worker persistence")
    found = False
    for _ in range(20):
        time.sleep(0.5)
        _, latest = req("GET", "/api/v1/telemetry/latest?farm_id=farm-alpha&limit=100")
        if any(p.get("sensor_id") == "smoke-sensor" for p in latest):
            found = True
            break
    assert found, "smoke-sensor not found in latest telemetry"
    print("   persisted")

    print("4) stats")
    _, stats = req("GET", "/api/v1/telemetry/stats?farm_id=farm-alpha")
    assert stats.get("total_points_1h", 0) > 0, stats
    print("   ", stats)

    print("PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (AssertionError, urllib.error.URLError, Exception) as exc:
        print("FAIL:", exc)
        raise SystemExit(1)
