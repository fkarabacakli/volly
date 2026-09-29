/**
 * Industrial platform contracts — the shapes the dashboard expects from the
 * (future) Warehouse / Devices / Telemetry modules. Hand-written like every
 * other `src/api/*` DTO. Until the backend lands, `mock/` produces these
 * exact shapes, so swapping to `apiFetch` is a per-function change only.
 *
 * Geometry is in metres on a top-down plan with the origin at the
 * top-left corner, x → right, y → down (SVG convention).
 */

export type Facility = {
  id: string;
  name: string;
  city: string;
  /** Tags rendered under the facility name, e.g. "coldChain". */
  capabilities: FacilityCapability[];
};

export type FacilityCapability = "smartWarehouse" | "logistics" | "coldChain";

export type Point = { xM: number; yM: number };

export type Rect = { xM: number; yM: number; widthM: number; depthM: number };

export type WallSegment = { from: Point; to: Point };

export type Rack = Rect & {
  /** Human rack code, e.g. "A3-12" (zone, row, bay). */
  id: string;
  zoneId: string;
  capacity: number;
  filled: number;
  reserved: number;
  lastMovementAt: string;
};

export type Zone = Rect & {
  id: string;
  name: string;
  /** Cold-room zones get the cold-chain treatment (blue tint, temp badge). */
  isCold: boolean;
};

export type Dock = { id: string; position: Point; widthM: number; occupied: boolean };

export type FloorPlan = {
  facilityId: string;
  widthM: number;
  depthM: number;
  walls: WallSegment[];
  zones: Zone[];
  racks: Rack[];
  docks: Dock[];
};

export type DeviceKind = "camera" | "sensor" | "gateway" | "radar" | "forklift" | "personnel";

export type DeviceStatus = "online" | "warning" | "offline";

export type Device = {
  id: string;
  kind: DeviceKind;
  name: string;
  zoneId: string | null;
  position: Point;
  status: DeviceStatus;
  lastSeenAt: string;
  /** Cameras: view direction in degrees (0 = +x, clockwise) + cone. */
  headingDeg?: number;
  fovDeg?: number;
  rangeM?: number;
  /** Sensors: which gateway they report through. */
  gatewayId?: string;
  /** Sensors: the metrics this device measures. */
  metrics?: SensorMetric[];
  /** Latest readings keyed by metric (sensors only). */
  latest?: Partial<Record<SensorMetric, number>>;
  /** Cameras: whether the AI analysis pipeline is running on this feed. */
  aiEnabled?: boolean;
  /** Forklifts / personnel: the rack code they are at. */
  locationCode?: string;
};

export type SensorMetric = "temperature" | "humidity" | "co2";

export type MetricThreshold = { min?: number; max?: number };

/** [epoch-ms, value] — ECharts-friendly tuple. */
export type SeriesPoint = [number, number];

export type SensorSeries = {
  sensorId: string;
  metric: SensorMetric;
  points: SeriesPoint[];
};

export type SensorSeriesQuery = {
  facilityId: string;
  sensorIds: string[];
  metric: SensorMetric;
  fromMs: number;
  toMs: number;
  intervalMin: number;
};

export type ColdChainSummary = {
  sensorId: string;
  temperature: number;
  /** Change vs. one hour ago. */
  temperatureDelta: number;
  humidity: number;
  humidityDelta: number;
  temperatureSeries: SeriesPoint[];
  humiditySeries: SeriesPoint[];
  thresholds: Record<"temperature" | "humidity", MetricThreshold>;
};

export type StockSummary = {
  occupancyPct: number;
  filled: number;
  empty: number;
  reserved: number;
  zones: { zoneId: string; name: string; occupancyPct: number }[];
};

export type RackQuery = {
  zoneId?: string;
  /** "high" ≥ 90 %, "low" < 50 %. */
  occupancy?: "high" | "low";
  search?: string;
};

export type CameraAlertType =
  | "packageDamage"
  | "misplacement"
  | "irregularStacking"
  | "unauthorizedAccess";

export type AlertSeverity = "high" | "medium" | "low";

export type CameraAlertStatus = "open" | "acknowledged" | "resolved";

export type CameraAlert = {
  id: string;
  type: CameraAlertType;
  severity: AlertSeverity;
  status: CameraAlertStatus;
  cameraId: string;
  cameraName: string;
  zoneId: string;
  zoneName: string;
  detectedAt: string;
  /** Model confidence, 0–1. */
  confidence: number;
};

export type CameraAlertQuery = {
  type?: CameraAlertType;
  severity?: AlertSeverity;
  limit?: number;
};

export type ActivityType =
  | "personnelDetected"
  | "forkliftMoving"
  | "temperatureNormal"
  | "temperatureHigh"
  | "cameraAnalysisDone"
  | "packageDamageDetected"
  | "dockAssigned";

export type ActivityEvent = {
  id: string;
  type: ActivityType;
  /** Interpolation params for the `activity.<type>` message. */
  params: Record<string, string | number>;
  at: string;
  /** Alerts render in the destructive tone. */
  isAlert: boolean;
};

export type SystemStatus = {
  iotDevices: { online: number; total: number };
  cameras: { online: number; total: number };
  gateways: { online: number; total: number };
  mqtt: "active" | "degraded" | "down";
};
