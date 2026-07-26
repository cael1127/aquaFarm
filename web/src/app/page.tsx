"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type TelemetryPoint = {
  time: string;
  sensor_id: string;
  farm_id: string;
  metric: string;
  value: number;
  unit: string;
};

type AlertEvent = {
  time: string;
  sensor_id: string;
  metric: string;
  value: number;
  severity: string;
  message: string;
};

type Device = {
  sensor_id: string;
  farm_id: string;
  metrics: string[];
  last_seen: string | null;
  last_metric: string | null;
  last_value: number | null;
  last_unit: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export default function DashboardPage() {
  const [connected, setConnected] = useState(false);
  const [points, setPoints] = useState<TelemetryPoint[]>([]);
  const [latest, setLatest] = useState<TelemetryPoint[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState({ total: 0, sensors: 0, lastSeen: "—" });
  const [metricFocus, setMetricFocus] = useState("dissolved_oxygen");
  const [throughput, setThroughput] = useState(0);
  const seen = useRef(0);
  const windowRef = useRef<number[]>([]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`${WS}/ws/telemetry`);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 1500);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type: string;
            data: TelemetryPoint | AlertEvent;
          };
          if (msg.type === "telemetry") {
            const p = msg.data as TelemetryPoint;
            const now = Date.now();
            seen.current += 1;
            windowRef.current.push(now);
            windowRef.current = windowRef.current.filter((t) => now - t < 5000);
            setThroughput(Math.round(windowRef.current.length / 5));
            setPoints((prev) => {
              const next = [...prev, p];
              return next.length > 240 ? next.slice(-240) : next;
            });
            setLatest((prev) => {
              const key = `${p.sensor_id}:${p.metric}`;
              const idx = prev.findIndex((x) => `${x.sensor_id}:${x.metric}` === key);
              if (idx === -1) return [...prev, p];
              const copy = [...prev];
              copy[idx] = p;
              return copy;
            });
          } else if (msg.type === "alert") {
            const a = msg.data as AlertEvent;
            setAlerts((prev) => [a, ...prev].slice(0, 40));
          }
        } catch {
          /* ignore */
        }
      };
    };

    connect();

    const bootstrap = () => {
      void fetch(`${API}/api/v1/telemetry/latest?farm_id=farm-alpha&limit=50`)
        .then((r) => r.json())
        .then((d: TelemetryPoint[]) => setLatest(Array.isArray(d) ? d : []))
        .catch(() => undefined);
      void fetch(`${API}/api/v1/telemetry/stats?farm_id=farm-alpha`)
        .then((r) => r.json())
        .then((d) =>
          setStats({
            total: d.total_points_1h ?? 0,
            sensors: d.active_sensors_1h ?? 0,
            lastSeen: d.last_seen ? new Date(d.last_seen).toLocaleTimeString() : "—",
          })
        )
        .catch(() => undefined);
      void fetch(`${API}/api/v1/devices?farm_id=farm-alpha`)
        .then((r) => r.json())
        .then((d: Device[]) => setDevices(Array.isArray(d) ? d : []))
        .catch(() => undefined);
      void fetch(`${API}/api/v1/alerts?farm_id=farm-alpha&limit=40`)
        .then((r) => r.json())
        .then((d: AlertEvent[]) => {
          if (Array.isArray(d) && d.length) {
            setAlerts(
              d.map((a) => ({
                time: a.time,
                sensor_id: a.sensor_id,
                metric: a.metric,
                value: a.value,
                severity: a.severity,
                message: a.message,
              }))
            );
          }
        })
        .catch(() => undefined);
    };

    bootstrap();
    const poll = setInterval(bootstrap, 4000);

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      clearInterval(poll);
      ws?.close();
    };
  }, []);

  const chartData = useMemo(() => {
    return points
      .filter((p) => p.metric === metricFocus)
      .slice(-80)
      .map((p) => ({
        t: new Date(p.time).toLocaleTimeString(),
        value: p.value,
        sensor: p.sensor_id,
      }));
  }, [points, metricFocus]);

  const latestFeed = useMemo(() => [...points].slice(-20).reverse(), [points]);

  const sensorCards = useMemo(() => {
    const preferred = ["dissolved_oxygen", "ph", "temperature", "turbidity"];
    return preferred
      .map((metric) => {
        const row = latest.find((p) => p.metric === metric);
        return row
          ? { metric, value: row.value, unit: row.unit, sensor: row.sensor_id, time: row.time }
          : null;
      })
      .filter(Boolean) as Array<{
      metric: string;
      value: number;
      unit: string;
      sensor: string;
      time: string;
    }>;
  }, [latest]);

  return (
    <div className="shell">
      <header className="hero">
        <p className="brand">AquaFarm</p>
        <h1>Live IoT operations console</h1>
        <p>
          Decoupled ingest through Redis Streams into TimescaleDB, with WebSocket fan-out for cage
          water-quality telemetry and threshold alerts.
        </p>
      </header>

      <section className="stats">
        <div className="stat">
          <span>Stream</span>
          <strong>
            <i className={connected ? "dot on" : "dot off"} />
            {connected ? "live" : "reconnecting"}
          </strong>
        </div>
        <div className="stat">
          <span>Ingest throughput</span>
          <strong>{throughput}/s</strong>
        </div>
        <div className="stat">
          <span>Points / hour</span>
          <strong>{stats.total.toLocaleString()}</strong>
        </div>
        <div className="stat">
          <span>Active sensors</span>
          <strong>{stats.sensors}</strong>
        </div>
      </section>

      <section className="sensor-grid">
        {sensorCards.map((c) => (
          <button
            key={c.metric}
            type="button"
            className={`sensor-card ${metricFocus === c.metric ? "active" : ""}`}
            onClick={() => setMetricFocus(c.metric)}
          >
            <span className="label">{c.metric.replaceAll("_", " ")}</span>
            <strong>
              {c.value}
              <small>{c.unit}</small>
            </strong>
            <em>{c.sensor}</em>
          </button>
        ))}
      </section>

      <section className="grid">
        <div className="panel">
          <header>
            <h2>Metric trend</h2>
            <span>focus · {metricFocus}</span>
          </header>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={340}>
              <LineChart data={chartData}>
                <CartesianGrid stroke="#c9d6d1" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={42} domain={["auto", "auto"]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#0b6e6a"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <header>
            <h2>Live feed</h2>
            <span>last seen {stats.lastSeen}</span>
          </header>
          <ul className="feed">
            {latestFeed.map((p, i) => (
              <li key={`${p.time}-${p.sensor_id}-${i}`}>
                <span className="metric">{p.metric}</span>
                <span>
                  {p.sensor_id}
                  <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                    {new Date(p.time).toLocaleTimeString()}
                  </div>
                </span>
                <span className="value">
                  {p.value}
                  {p.unit}
                </span>
              </li>
            ))}
            {latestFeed.length === 0 ? (
              <li>
                <span className="metric">—</span>
                <span>Waiting for simulator traffic…</span>
                <span className="value"> </span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="panel">
        <header>
          <h2>Device registry</h2>
          <span>{devices.length} sensors</span>
        </header>
        <ul className="feed device-feed">
          {devices.map((d) => (
            <li key={d.sensor_id}>
              <span className="metric">{d.last_metric ?? "—"}</span>
              <span>
                {d.sensor_id}
                <div style={{ color: "var(--muted)", fontSize: "0.78rem" }}>
                  {d.metrics.join(", ") || "no metrics yet"}
                  {d.last_seen ? ` · ${new Date(d.last_seen).toLocaleTimeString()}` : ""}
                </div>
              </span>
              <span className="value">
                {d.last_value ?? "—"}
                {d.last_unit}
              </span>
            </li>
          ))}
          {devices.length === 0 ? (
            <li>
              <span className="metric">—</span>
              <span>Devices appear after the worker processes ingest.</span>
              <span className="value"> </span>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <header>
          <h2>Alert engine</h2>
          <span>{alerts.length} recent</span>
        </header>
        <div className="alerts">
          {alerts.length === 0 ? (
            <div style={{ color: "var(--muted)", padding: 8 }}>No threshold breaches yet.</div>
          ) : (
            alerts.map((a, i) => (
              <div key={`${a.time}-${i}`} className={`alert ${a.severity}`}>
                <strong>{a.severity.toUpperCase()}</strong> · {a.message} · {a.sensor_id}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
