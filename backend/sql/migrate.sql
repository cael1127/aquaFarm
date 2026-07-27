-- Applied on API/worker startup (idempotent).
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS telemetry (
    time        TIMESTAMPTZ       NOT NULL,
    sensor_id   TEXT              NOT NULL,
    farm_id     TEXT              NOT NULL,
    metric      TEXT              NOT NULL,
    value       DOUBLE PRECISION  NOT NULL,
    unit        TEXT              NOT NULL DEFAULT '',
    payload     JSONB             NOT NULL DEFAULT '{}'::jsonb
);

SELECT create_hypertable('telemetry', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS telemetry_sensor_time_idx
    ON telemetry (sensor_id, time DESC);

CREATE INDEX IF NOT EXISTS telemetry_farm_metric_time_idx
    ON telemetry (farm_id, metric, time DESC);

CREATE TABLE IF NOT EXISTS devices (
    sensor_id     TEXT PRIMARY KEY,
    farm_id       TEXT NOT NULL,
    metrics       TEXT[] NOT NULL DEFAULT '{}',
    last_seen     TIMESTAMPTZ,
    last_metric   TEXT,
    last_value    DOUBLE PRECISION,
    last_unit     TEXT NOT NULL DEFAULT '',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS devices_farm_idx ON devices (farm_id);

CREATE TABLE IF NOT EXISTS alerts (
    id            BIGSERIAL PRIMARY KEY,
    time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sensor_id     TEXT NOT NULL,
    farm_id       TEXT NOT NULL,
    metric        TEXT NOT NULL,
    value         DOUBLE PRECISION NOT NULL,
    threshold     DOUBLE PRECISION NOT NULL,
    severity      TEXT NOT NULL,
    message       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS alerts_time_idx ON alerts (time DESC);
CREATE INDEX IF NOT EXISTS alerts_farm_time_idx ON alerts (farm_id, time DESC);

-- Continuous aggregate: 1-minute rollups for charts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.continuous_aggregates
    WHERE view_name = 'telemetry_1m'
  ) THEN
    EXECUTE $cagg$
      CREATE MATERIALIZED VIEW telemetry_1m
      WITH (timescaledb.continuous) AS
      SELECT
          time_bucket(INTERVAL '1 minute', time) AS bucket,
          sensor_id,
          farm_id,
          metric,
          AVG(value) AS avg_value,
          MIN(value) AS min_value,
          MAX(value) AS max_value,
          COUNT(*)   AS samples
      FROM telemetry
      GROUP BY bucket, sensor_id, farm_id, metric
      WITH NO DATA
    $cagg$;
  END IF;
END $$;

SELECT add_continuous_aggregate_policy(
    'telemetry_1m',
    start_offset => INTERVAL '2 hours',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute',
    if_not_exists => TRUE
);

-- Keep raw telemetry for 7 days; rollups cover longer history later
SELECT add_retention_policy('telemetry', INTERVAL '7 days', if_not_exists => TRUE);

-- Prime the continuous aggregate (best-effort; empty windows are fine in CI)
DO $$
BEGIN
  CALL refresh_continuous_aggregate(
    'telemetry_1m',
    localtimestamp - INTERVAL '3 hours',
    localtimestamp
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'telemetry_1m refresh skipped: %', SQLERRM;
END $$;
