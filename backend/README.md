# AquaFarm IoT Backend

FastAPI services for decoupled telemetry ingest, TimescaleDB queries, and WebSocket fan-out.

## Run (via compose)

From repo root:

```bash
docker compose up --build api worker
```

## Endpoints

- `POST /api/v1/ingest` — enqueue one reading (`X-Device-Token` required)
- `POST /api/v1/ingest/batch` — enqueue up to 500 readings
- `GET /api/v1/telemetry/latest` — latest point per sensor/metric
- `GET /api/v1/telemetry/history` — time range query
- `GET /api/v1/telemetry/stats` — 1h farm stats
- `WS /ws/telemetry` — live telemetry + alerts

Hot-path ingest never writes Postgres directly — only Redis Streams.
