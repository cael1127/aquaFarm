-- Bootstrap for fresh Docker volumes. Runtime also applies sql/migrate.sql.
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
