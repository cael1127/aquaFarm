# AquaFarm Architecture

```
Sensor Simulator / Devices
        │  POST /api/v1/ingest  (+ X-Device-Token, rate-limited)
        ▼
   FastAPI API  ──XADD──▶  Redis Stream (telemetry:ingest)
                                │
                                ▼  XREADGROUP
                           Worker Service
                      ┌─────────┴──────────┐
                      ▼                    ▼
               TimescaleDB            Redis Pub/Sub
          telemetry hypertable      telemetry:live
          devices registry          telemetry:alerts
          alerts table                     │
          telemetry_1m CAGG                ▼
                                    FastAPI WS hub
                                           │
                                           ▼
                                    Next.js dashboard
                                    (+ Expo mobile client)
```

## Why this shape

| Layer | Choice | Reason |
|-------|--------|--------|
| Ingest | Redis Streams | Absorb bursts; never block HTTP on DB locks |
| Storage | TimescaleDB | Time-series indexes, CAGGs, retention policies |
| Fan-out | Redis Pub/Sub + WS | Sub-second UI updates without polling the DB |
| Mobile | Expo client | Field workflows; reads query API for live DO/temp |
| Web | Next.js ops console | Fleet view, charts, alert history |

## Key endpoints

- `POST /api/v1/ingest` — enqueue telemetry
- `GET /api/v1/telemetry/latest|history|stats|aggregate`
- `GET /api/v1/devices` — sensor registry
- `GET /api/v1/alerts` — persisted threshold breaches
- `WS /ws/telemetry` — live telemetry + alerts
