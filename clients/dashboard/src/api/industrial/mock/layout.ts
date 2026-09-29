import type {
  Device,
  DeviceKind,
  Dock,
  Facility,
  FloorPlan,
  Point,
  Rack,
  Rect,
  WallSegment,
  Zone,
} from "../types";
import { createRng, hashString, HOUR_MS, MINUTE_MS, round } from "./random";
import { sampleMetric } from "./telemetry";

// ─────────────────────────────────────────────────────────────────────────
// Facility specs — two sites with different shapes so the facility switch
// visibly changes the map. Everything else (racks, devices) is generated.
// ─────────────────────────────────────────────────────────────────────────

type ZoneSpec = Rect & { id: string; name: string; isCold?: boolean; targetOccupancy: number };

type FacilitySpec = Facility & {
  widthM: number;
  depthM: number;
  zones: ZoneSpec[];
  office: Rect;
  dockCount: number;
  dockFromXM: number;
  cameraCount: number;
};

const SPECS: FacilitySpec[] = [
  {
    id: "ist-01",
    name: "İstanbul Ana Depo",
    city: "İstanbul",
    capabilities: ["smartWarehouse", "logistics", "coldChain"],
    widthM: 120,
    depthM: 80,
    zones: [
      { id: "A", name: "A Bölgesi", xM: 6, yM: 6, widthM: 38, depthM: 30, targetOccupancy: 0.92 },
      { id: "B", name: "B Bölgesi", xM: 50, yM: 6, widthM: 34, depthM: 30, targetOccupancy: 0.76 },
      { id: "C", name: "C Bölgesi", xM: 26, yM: 44, widthM: 58, depthM: 24, targetOccupancy: 0.61 },
      { id: "D", name: "D Bölgesi · Soğuk Oda", xM: 92, yM: 6, widthM: 24, depthM: 34, isCold: true, targetOccupancy: 0.48 },
    ],
    office: { xM: 0, yM: 60, widthM: 20, depthM: 20 },
    dockCount: 8,
    dockFromXM: 34,
    cameraCount: 12,
  },
  {
    id: "ank-01",
    name: "Ankara Soğuk Hava Deposu",
    city: "Ankara",
    capabilities: ["coldChain", "logistics"],
    widthM: 84,
    depthM: 60,
    zones: [
      { id: "A", name: "A Bölgesi", xM: 5, yM: 5, widthM: 34, depthM: 26, targetOccupancy: 0.83 },
      { id: "B", name: "B Bölgesi · Soğuk Oda", xM: 45, yM: 5, widthM: 34, depthM: 26, isCold: true, targetOccupancy: 0.71 },
      { id: "C", name: "C Bölgesi · Donuk", xM: 22, yM: 36, widthM: 40, depthM: 14, isCold: true, targetOccupancy: 0.55 },
    ],
    office: { xM: 0, yM: 44, widthM: 16, depthM: 16 },
    dockCount: 5,
    dockFromXM: 24,
    cameraCount: 8,
  },
];

export const DEFAULT_FACILITY_ID = SPECS[0].id;

export function listFacilities(): Facility[] {
  return SPECS.map(({ id, name, city, capabilities }) => ({ id, name, city, capabilities }));
}

function specFor(facilityId: string): FacilitySpec {
  return SPECS.find((s) => s.id === facilityId) ?? SPECS[0];
}

// ─────────────────────────────────────────────────────────────────────────
// Geometry
// ─────────────────────────────────────────────────────────────────────────

const RACK_DEPTH_M = 2.4;
const AISLE_M = 3.2;
const BAY_WIDTH_M = 4.6;
const BAY_GAP_M = 0.4;
const ZONE_PADDING_M = 1.5;
const RACK_CAPACITY = 24;
const COLD_WALL_OFFSET_M = 1.2;
const COLD_DOOR_M = 4;

function rectWalls(r: Rect, doorOnBottom?: { atXM: number; widthM: number }): WallSegment[] {
  const x2 = r.xM + r.widthM;
  const y2 = r.yM + r.depthM;
  const walls: WallSegment[] = [
    { from: { xM: r.xM, yM: r.yM }, to: { xM: x2, yM: r.yM } },
    { from: { xM: x2, yM: r.yM }, to: { xM: x2, yM: y2 } },
    { from: { xM: r.xM, yM: r.yM }, to: { xM: r.xM, yM: y2 } },
  ];
  if (doorOnBottom) {
    walls.push({ from: { xM: r.xM, yM: y2 }, to: { xM: doorOnBottom.atXM, yM: y2 } });
    walls.push({ from: { xM: doorOnBottom.atXM + doorOnBottom.widthM, yM: y2 }, to: { xM: x2, yM: y2 } });
  } else {
    walls.push({ from: { xM: r.xM, yM: y2 }, to: { xM: x2, yM: y2 } });
  }
  return walls;
}

function buildRacks(spec: FacilitySpec, anchorMs: number): Rack[] {
  const racks: Rack[] = [];
  for (const zone of spec.zones) {
    const rng = createRng(hashString(`${spec.id}:${zone.id}:racks`));
    const usableW = zone.widthM - ZONE_PADDING_M * 2;
    const bays = Math.max(1, Math.floor((usableW + BAY_GAP_M) / (BAY_WIDTH_M + BAY_GAP_M)));
    const rows = Math.max(1, Math.floor((zone.depthM - ZONE_PADDING_M * 2 + AISLE_M) / (RACK_DEPTH_M + AISLE_M)));
    for (let row = 0; row < rows; row++) {
      for (let bay = 0; bay < bays; bay++) {
        const jitter = (rng() - 0.5) * 0.36;
        const occupancy = Math.min(1, Math.max(0, zone.targetOccupancy + jitter));
        const filled = Math.round(RACK_CAPACITY * occupancy);
        const reserved = Math.min(RACK_CAPACITY - filled, Math.round(rng() * 3));
        racks.push({
          id: `${zone.id}${row + 1}-${String(bay + 1).padStart(2, "0")}`,
          zoneId: zone.id,
          xM: zone.xM + ZONE_PADDING_M + bay * (BAY_WIDTH_M + BAY_GAP_M),
          yM: zone.yM + ZONE_PADDING_M + row * (RACK_DEPTH_M + AISLE_M),
          widthM: BAY_WIDTH_M,
          depthM: RACK_DEPTH_M,
          capacity: RACK_CAPACITY,
          filled,
          reserved,
          lastMovementAt: new Date(anchorMs - Math.floor(rng() * 36) * HOUR_MS - Math.floor(rng() * 60) * MINUTE_MS).toISOString(),
        });
      }
    }
  }
  return racks;
}

export function buildFloorPlan(facilityId: string, anchorMs: number): FloorPlan {
  const spec = specFor(facilityId);
  const outer: Rect = { xM: 0, yM: 0, widthM: spec.widthM, depthM: spec.depthM };
  // The office sits in the bottom-left corner and shares the outer wall, so
  // it only needs its top edge and a right edge with a door gap.
  const o = spec.office;
  const officeRight = o.xM + o.widthM;
  const walls: WallSegment[] = [
    ...rectWalls(outer),
    { from: { xM: o.xM, yM: o.yM }, to: { xM: officeRight, yM: o.yM } },
    { from: { xM: officeRight, yM: o.yM }, to: { xM: officeRight, yM: o.yM + 4 } },
    { from: { xM: officeRight, yM: o.yM + 7 }, to: { xM: officeRight, yM: o.yM + o.depthM } },
  ];
  for (const z of spec.zones.filter((z) => z.isCold)) {
    const room: Rect = {
      xM: z.xM - COLD_WALL_OFFSET_M,
      yM: z.yM - COLD_WALL_OFFSET_M,
      widthM: z.widthM + COLD_WALL_OFFSET_M * 2,
      depthM: z.depthM + COLD_WALL_OFFSET_M * 2,
    };
    walls.push(...rectWalls(room, { atXM: room.xM + room.widthM / 2 - COLD_DOOR_M / 2, widthM: COLD_DOOR_M }));
  }

  const zones: Zone[] = spec.zones.map((z) => ({
    id: z.id,
    name: z.name,
    xM: z.xM,
    yM: z.yM,
    widthM: z.widthM,
    depthM: z.depthM,
    isCold: Boolean(z.isCold),
  }));

  const dockPitch = (spec.widthM - spec.dockFromXM - 4) / spec.dockCount;
  const docks: Dock[] = Array.from({ length: spec.dockCount }, (_, i) => ({
    id: `K${i + 1}`,
    position: { xM: spec.dockFromXM + dockPitch * (i + 0.5), yM: spec.depthM },
    widthM: Math.min(4, dockPitch * 0.7),
    occupied: createRng(hashString(`${spec.id}:dock:${i}`))() < 0.55,
  }));

  return { facilityId: spec.id, widthM: spec.widthM, depthM: spec.depthM, walls, zones, racks: buildRacks(spec, anchorMs), docks };
}

// ─────────────────────────────────────────────────────────────────────────
// Devices
// ─────────────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function center(r: Rect): Point {
  return { xM: r.xM + r.widthM / 2, yM: r.yM + r.depthM / 2 };
}

/** Walk a rectangular loop inside the zone aisles — positions move with time. */
function patrol(zone: Rect, t: number, speedMps: number, phase: number): Point {
  const inset = 1;
  const w = zone.widthM - inset * 2;
  const d = zone.depthM - inset * 2;
  const perimeter = 2 * (w + d);
  let s = ((t / 1000) * speedMps + phase * perimeter) % perimeter;
  if (s < w) return { xM: zone.xM + inset + s, yM: zone.yM + zone.depthM + 1.6 };
  s -= w;
  if (s < d) return { xM: zone.xM + zone.widthM + 1.4, yM: zone.yM + zone.depthM - inset - s };
  s -= d;
  if (s < w) return { xM: zone.xM + zone.widthM - inset - s, yM: zone.yM - 1.4 };
  s -= w;
  return { xM: zone.xM - 1.4, yM: zone.yM + inset + s };
}

function nearestRack(racks: Rack[], p: Point): string | undefined {
  let best: Rack | undefined;
  let bestD = Infinity;
  for (const r of racks) {
    const c = center(r);
    const d = (c.xM - p.xM) ** 2 + (c.yM - p.yM) ** 2;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best?.id;
}

export function buildDevices(plan: FloorPlan, nowMs: number): Device[] {
  const spec = specFor(plan.facilityId);
  const devices: Device[] = [];
  const seen = new Date(nowMs - 4_000).toISOString();
  const rng = createRng(hashString(`${spec.id}:devices`));

  const add = (kind: DeviceKind, d: Omit<Device, "kind" | "status" | "lastSeenAt"> & Partial<Pick<Device, "status">>) =>
    devices.push({ kind, status: "online", lastSeenAt: seen, ...d });

  // Gateways — one IoT, one edge-video.
  add("gateway", { id: `${spec.id}-gw-1`, name: "Master-1 IoT Gateway", zoneId: null, position: { xM: spec.office.xM + spec.office.widthM + 3, yM: spec.office.yM - 3 } });
  add("gateway", { id: `${spec.id}-gw-2`, name: "Master-2 Edge Video Gateway", zoneId: null, position: { xM: spec.widthM - 12, yM: spec.depthM - 14 } });

  // Cameras — spread around zone corners, looking inward.
  const corners: { p: (z: Rect) => Point; heading: number }[] = [
    { p: (z) => ({ xM: z.xM - 1, yM: z.yM - 1 }), heading: 45 },
    { p: (z) => ({ xM: z.xM + z.widthM + 1, yM: z.yM + z.depthM + 1 }), heading: 225 },
    { p: (z) => ({ xM: z.xM + z.widthM + 1, yM: z.yM - 1 }), heading: 135 },
    { p: (z) => ({ xM: z.xM - 1, yM: z.yM + z.depthM + 1 }), heading: 315 },
  ];
  for (let i = 0; i < spec.cameraCount; i++) {
    const zone = spec.zones[i % spec.zones.length];
    const corner = corners[Math.floor(i / spec.zones.length) % corners.length];
    add("camera", {
      id: `${spec.id}-cam-${pad(i + 1)}`,
      name: `Kamera ${pad(i + 1)}`,
      zoneId: zone.id,
      position: corner.p(zone),
      headingDeg: corner.heading,
      fovDeg: 62,
      rangeM: Math.min(zone.widthM, zone.depthM) * 0.7,
      aiEnabled: i % 5 !== 4,
    });
  }

  // Sensors — two per zone (temperature + humidity, + CO₂ in ambient zones).
  let sensorNo = 0;
  for (const zone of spec.zones) {
    for (let k = 0; k < 2; k++) {
      sensorNo++;
      const id = `${spec.id}-th-${pad(sensorNo)}`;
      const metrics: Device["metrics"] = zone.isCold ? ["temperature", "humidity"] : ["temperature", "humidity", "co2"];
      const position = { xM: zone.xM + zone.widthM * (k === 0 ? 0.25 : 0.75), yM: zone.yM + zone.depthM * (k === 0 ? 0.3 : 0.7) };
      const latest = Object.fromEntries(metrics.map((m) => [m, sampleMetric(id, m, Boolean(zone.isCold), nowMs)]));
      add("sensor", {
        id,
        name: `${zone.isCold ? "Soğuk Oda" : "Ortam"} ${zone.id}${k + 1}`,
        zoneId: zone.id,
        position,
        gatewayId: `${spec.id}-gw-1`,
        metrics,
        latest,
        // One ambient sensor in the second facility is offline, so the status UI has something to show.
        status: spec.id === "ank-01" && sensorNo === 2 ? "offline" : "online",
      });
    }
  }

  // Radar at the dock apron.
  add("radar", { id: `${spec.id}-radar-1`, name: "Radar R-01", zoneId: null, position: { xM: spec.dockFromXM + 12, yM: spec.depthM - 6 } });

  // Forklifts + personnel move along zone aisles.
  const movers: { kind: DeviceKind; count: number; label: string; speed: number }[] = [
    { kind: "forklift", count: 3, label: "Forklift F-", speed: 1.4 },
    { kind: "personnel", count: 4, label: "Personel P-", speed: 0.7 },
  ];
  for (const m of movers) {
    for (let i = 0; i < m.count; i++) {
      const zone = spec.zones[(i + (m.kind === "personnel" ? 1 : 0)) % spec.zones.length];
      const position = patrol(zone, nowMs, m.speed, rng());
      add(m.kind, {
        id: `${spec.id}-${m.kind}-${pad(i + 1)}`,
        name: `${m.label}${pad(i + 1)}`,
        zoneId: zone.id,
        position: { xM: round(position.xM, 2), yM: round(position.yM, 2) },
        locationCode: nearestRack(plan.racks, position),
      });
    }
  }

  return devices;
}

export function isColdZone(plan: FloorPlan, zoneId: string | null): boolean {
  return plan.zones.find((z) => z.id === zoneId)?.isCold ?? false;
}
