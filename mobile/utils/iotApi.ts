/**
 * AquaFarm IoT API client for the Expo mobile app.
 * Points at the FastAPI backend (not Supabase) for live water-quality data.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export type TelemetryPoint = {
  time: string;
  sensor_id: string;
  farm_id: string;
  metric: string;
  value: number;
  unit: string;
  payload?: Record<string, unknown>;
};

export type FarmStats = {
  farm_id: string;
  total_points_1h: number;
  active_sensors_1h: number;
  last_seen: string | null;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export function getLatestTelemetry(farmId?: string, limit = 50): Promise<TelemetryPoint[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (farmId) q.set("farm_id", farmId);
  return getJson(`/api/v1/telemetry/latest?${q.toString()}`);
}

export function getTelemetryHistory(
  sensorId: string,
  metric: string,
  minutes = 30
): Promise<TelemetryPoint[]> {
  const q = new URLSearchParams({
    sensor_id: sensorId,
    metric,
    minutes: String(minutes),
  });
  return getJson(`/api/v1/telemetry/history?${q.toString()}`);
}

export function getFarmStats(farmId = "farm-alpha"): Promise<FarmStats> {
  return getJson(`/api/v1/telemetry/stats?farm_id=${encodeURIComponent(farmId)}`);
}

export function getWsUrl(): string {
  const base = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8000";
  return `${base}/ws/telemetry`;
}
