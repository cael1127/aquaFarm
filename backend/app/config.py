from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://aquafarm:aquafarm@localhost:5433/aquafarm"
    redis_url: str = "redis://localhost:6379/0"
    device_token: str = "dev-sensor-token"
    cors_origin: str = "http://localhost:3001"
    ingest_stream: str = "telemetry:ingest"
    telemetry_channel: str = "telemetry:live"
    alert_channel: str = "telemetry:alerts"
    consumer_group: str = "telemetry-workers"
    consumer_name: str = "worker-1"


settings = Settings()
