from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TelemetryIn(BaseModel):
    sensor_id: str = Field(min_length=1, max_length=128)
    farm_id: str = Field(min_length=1, max_length=128)
    metric: str = Field(min_length=1, max_length=64)
    value: float
    unit: str = ""
    timestamp: datetime | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class TelemetryOut(BaseModel):
    time: datetime
    sensor_id: str
    farm_id: str
    metric: str
    value: float
    unit: str
    payload: dict[str, Any] = Field(default_factory=dict)


class IngestAccepted(BaseModel):
    accepted: int
    stream_id: str | None = None


class AlertOut(BaseModel):
    sensor_id: str
    farm_id: str
    metric: str
    value: float
    threshold: float
    severity: str
    message: str
    time: datetime


# Simple threshold rules for the alert engine demo
ALERT_RULES: dict[str, tuple[float, float, str]] = {
    # metric: (min, max, unit)
    "dissolved_oxygen": (5.0, 12.0, "mg/L"),
    "ph": (6.5, 8.5, "pH"),
    "temperature": (8.0, 22.0, "C"),
    "turbidity": (0.0, 25.0, "NTU"),
}
