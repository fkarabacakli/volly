/**
 * Industrial API surface. Every function has the signature the real
 * endpoint will have; while `USE_INDUSTRIAL_MOCK` is on they resolve from
 * the deterministic generators in `./mock`. When the Warehouse / Devices /
 * Telemetry modules ship, replace each body with an `apiFetch` call — pages
 * and query keys stay untouched.
 */
import type {
  ActivityEvent,
  CameraAlert,
  CameraAlertQuery,
  ColdChainSummary,
  Device,
  Facility,
  FloorPlan,
  Rack,
  RackQuery,
  SensorSeries,
  SensorSeriesQuery,
  StockSummary,
  SystemStatus,
} from "./types";
import { buildActivities, buildCameraAlerts } from "./mock/events";
import { buildDevices, buildFloorPlan, isColdZone, listFacilities } from "./mock/layout";
import { HOUR_MS, MINUTE_MS, round } from "./mock/random";
import { METRIC_THRESHOLDS, sampleMetric, sampleSeries } from "./mock/telemetry";

export * from "./types";
export { DEFAULT_FACILITY_ID } from "./mock/layout";

/** Flip to false once the backend endpoints exist. */
export const USE_INDUSTRIAL_MOCK = true;

/** Small latency so loading states are exercised like a real network. */
const MOCK_LATENCY_MS = 120;

/** Events are re-anchored every 5 minutes so "3 min ago" stays plausible. */
const EVENT_ANCHOR_MS = 5 * MINUTE_MS;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

function anchor(now: number): number {
  return Math.floor(now / EVENT_ANCHOR_MS) * EVENT_ANCHOR_MS;
}

function layout(facilityId: string, now = Date.now()) {
  const plan = buildFloorPlan(facilityId, anchor(now));
  const devices = buildDevices(plan, now);
  return { plan, devices };
}

export function thresholdsFor(isCold: boolean) {
  return METRIC_THRESHOLDS[isCold ? "cold" : "ambient"];
}

// ── Facilities & layout ──────────────────────────────────────────────────

export async function getFacilities(): Promise<Facility[]> {
  return delay(listFacilities());
}

export type FacilityLayout = { plan: FloorPlan; devices: Device[] };

export async function getFacilityLayout(facilityId: string): Promise<FacilityLayout> {
  return delay(layout(facilityId));
}

export async function getSystemStatus(facilityId: string): Promise<SystemStatus> {
  const { devices } = layout(facilityId);
  const count = (kinds: Device["kind"][]) => {
    const xs = devices.filter((d) => kinds.includes(d.kind));
    return { online: xs.filter((d) => d.status !== "offline").length, total: xs.length };
  };
  return delay({
    iotDevices: count(["sensor", "gateway", "radar"]),
    cameras: count(["camera"]),
    gateways: count(["gateway"]),
    mqtt: "active",
  });
}

// ── Inventory ────────────────────────────────────────────────────────────

export async function getStockSummary(facilityId: string): Promise<StockSummary> {
  const { plan } = layout(facilityId);
  const sum = (xs: Rack[], f: (r: Rack) => number) => xs.reduce((a, r) => a + f(r), 0);
  const capacity = sum(plan.racks, (r) => r.capacity);
  const filled = sum(plan.racks, (r) => r.filled);
  const reserved = sum(plan.racks, (r) => r.reserved);
  return delay({
    occupancyPct: Math.round((filled / capacity) * 100),
    filled,
    reserved,
    empty: capacity - filled - reserved,
    zones: plan.zones.map((z) => {
      const racks = plan.racks.filter((r) => r.zoneId === z.id);
      return {
        zoneId: z.id,
        name: z.name,
        occupancyPct: Math.round((sum(racks, (r) => r.filled) / sum(racks, (r) => r.capacity)) * 100),
      };
    }),
  });
}

const HIGH_OCCUPANCY = 0.9;
const LOW_OCCUPANCY = 0.5;

export async function getRacks(facilityId: string, query: RackQuery = {}): Promise<Rack[]> {
  const { plan } = layout(facilityId);
  const term = query.search?.trim().toLocaleLowerCase("tr-TR");
  return delay(
    plan.racks.filter((r) => {
      if (query.zoneId && r.zoneId !== query.zoneId) return false;
      const occ = r.filled / r.capacity;
      if (query.occupancy === "high" && occ < HIGH_OCCUPANCY) return false;
      if (query.occupancy === "low" && occ >= LOW_OCCUPANCY) return false;
      if (term && !r.id.toLocaleLowerCase("tr-TR").includes(term)) return false;
      return true;
    }),
  );
}

// ── Sensors & telemetry ──────────────────────────────────────────────────

export async function getSensors(facilityId: string): Promise<Device[]> {
  const { devices } = layout(facilityId);
  return delay(devices.filter((d) => d.kind === "sensor"));
}

export async function getGateways(facilityId: string): Promise<Device[]> {
  const { devices } = layout(facilityId);
  return delay(devices.filter((d) => d.kind === "gateway"));
}

export async function getSensorSeries(query: SensorSeriesQuery): Promise<SensorSeries[]> {
  const { plan, devices } = layout(query.facilityId);
  return delay(
    query.sensorIds.map((sensorId) => {
      const sensor = devices.find((d) => d.id === sensorId);
      const isCold = isColdZone(plan, sensor?.zoneId ?? null);
      return {
        sensorId,
        metric: query.metric,
        points: sampleSeries(sensorId, query.metric, isCold, query.fromMs, query.toMs, query.intervalMin),
      };
    }),
  );
}

const COLD_CHAIN_WINDOW_MS = 24 * HOUR_MS;
const COLD_CHAIN_INTERVAL_MIN = 20;

export async function getColdChainSummary(facilityId: string): Promise<ColdChainSummary | null> {
  const now = Date.now();
  const { plan, devices } = layout(facilityId, now);
  const sensor = devices.find((d) => d.kind === "sensor" && isColdZone(plan, d.zoneId));
  if (!sensor) return delay(null);
  const at = (metric: "temperature" | "humidity", t: number) => sampleMetric(sensor.id, metric, true, t);
  const from = now - COLD_CHAIN_WINDOW_MS;
  const thresholds = thresholdsFor(true);
  return delay({
    sensorId: sensor.id,
    temperature: at("temperature", now),
    temperatureDelta: round(at("temperature", now) - at("temperature", now - HOUR_MS), 1),
    humidity: at("humidity", now),
    humidityDelta: round(at("humidity", now) - at("humidity", now - HOUR_MS), 1),
    temperatureSeries: sampleSeries(sensor.id, "temperature", true, from, now, COLD_CHAIN_INTERVAL_MIN),
    humiditySeries: sampleSeries(sensor.id, "humidity", true, from, now, COLD_CHAIN_INTERVAL_MIN),
    thresholds: { temperature: thresholds.temperature, humidity: thresholds.humidity },
  });
}

// ── Cameras & events ─────────────────────────────────────────────────────

export async function getCameras(facilityId: string): Promise<Device[]> {
  const { devices } = layout(facilityId);
  return delay(devices.filter((d) => d.kind === "camera"));
}

export async function getCameraAlerts(facilityId: string, query: CameraAlertQuery = {}): Promise<CameraAlert[]> {
  const now = Date.now();
  const { plan, devices } = layout(facilityId, now);
  const alerts = buildCameraAlerts(plan, devices, anchor(now)).filter(
    (a) => (!query.type || a.type === query.type) && (!query.severity || a.severity === query.severity),
  );
  return delay(query.limit ? alerts.slice(0, query.limit) : alerts);
}

export async function getActivities(facilityId: string, limit?: number): Promise<ActivityEvent[]> {
  const now = Date.now();
  const { plan, devices } = layout(facilityId, now);
  const events = buildActivities(plan, devices, anchor(now));
  return delay(limit ? events.slice(0, limit) : events);
}

/**
 * Synchronous layout for decorative previews (the sign-in hero). Always
 * mock-backed — it must render before auth, without a network call.
 */
export function previewLayout(facilityId = "ist-01"): FacilityLayout {
  return layout(facilityId);
}
