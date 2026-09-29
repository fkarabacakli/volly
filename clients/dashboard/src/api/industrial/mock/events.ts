import type {
  ActivityEvent,
  ActivityType,
  AlertSeverity,
  CameraAlert,
  CameraAlertStatus,
  CameraAlertType,
  Device,
  FloorPlan,
} from "../types";
import { createRng, hashString, MINUTE_MS, round } from "./random";

const ALERT_TYPES: CameraAlertType[] = [
  "packageDamage",
  "misplacement",
  "irregularStacking",
  "packageDamage",
  "misplacement",
  "unauthorizedAccess",
];

const SEVERITY_BY_TYPE: Record<CameraAlertType, AlertSeverity> = {
  packageDamage: "high",
  unauthorizedAccess: "high",
  misplacement: "medium",
  irregularStacking: "low",
};

const ALERT_COUNT = 36;
/** Alerts are ~40 minutes apart on average, the newest a few minutes ago. */
const ALERT_SPACING_MIN = 40;

export function buildCameraAlerts(plan: FloorPlan, devices: Device[], anchorMs: number): CameraAlert[] {
  const cameras = devices.filter((d) => d.kind === "camera");
  const rng = createRng(hashString(`${plan.facilityId}:alerts`));
  const alerts: CameraAlert[] = [];
  let offsetMin = 6;
  for (let i = 0; i < ALERT_COUNT; i++) {
    const type = ALERT_TYPES[Math.floor(rng() * ALERT_TYPES.length)];
    const camera = cameras[Math.floor(rng() * cameras.length)];
    const zone = plan.zones.find((z) => z.id === camera.zoneId) ?? plan.zones[0];
    const status: CameraAlertStatus = i < 3 ? "open" : i < 7 ? "acknowledged" : "resolved";
    alerts.push({
      id: `${plan.facilityId}-al-${String(i + 1).padStart(3, "0")}`,
      type,
      severity: SEVERITY_BY_TYPE[type],
      status,
      cameraId: camera.id,
      cameraName: camera.name,
      zoneId: zone.id,
      zoneName: zone.name,
      detectedAt: new Date(anchorMs - offsetMin * MINUTE_MS).toISOString(),
      confidence: round(0.72 + rng() * 0.27, 2),
    });
    offsetMin += Math.round(ALERT_SPACING_MIN * (0.4 + rng() * 1.2));
  }
  return alerts;
}

const ACTIVITY_CYCLE: ActivityType[] = [
  "personnelDetected",
  "forkliftMoving",
  "temperatureNormal",
  "cameraAnalysisDone",
  "packageDamageDetected",
  "dockAssigned",
  "forkliftMoving",
  "temperatureHigh",
];

const ACTIVITY_COUNT = 24;

export function buildActivities(plan: FloorPlan, devices: Device[], anchorMs: number): ActivityEvent[] {
  const rng = createRng(hashString(`${plan.facilityId}:activity`));
  const pick = <T,>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  const cameras = devices.filter((d) => d.kind === "camera");
  const forklifts = devices.filter((d) => d.kind === "forklift");
  const coldSensor = devices.find((d) => d.kind === "sensor" && plan.zones.find((z) => z.id === d.zoneId)?.isCold);
  const events: ActivityEvent[] = [];
  let offsetMin = 2;
  for (let i = 0; i < ACTIVITY_COUNT; i++) {
    const type = ACTIVITY_CYCLE[i % ACTIVITY_CYCLE.length];
    const rack = pick(plan.racks);
    const params = ((): Record<string, string | number> => {
      switch (type) {
        case "personnelDetected":
          return { location: rack.id };
        case "forkliftMoving":
          return { forklift: pick(forklifts)?.name ?? "Forklift", location: rack.id };
        case "temperatureNormal":
          return { value: coldSensor?.latest?.temperature ?? 4.2 };
        case "temperatureHigh":
          return { value: round(8.4 + rng() * 1.5, 1), zone: plan.zones.find((z) => z.isCold)?.name ?? "" };
        case "cameraAnalysisDone":
          return { camera: pick(cameras).name };
        case "packageDamageDetected": {
          const cam = pick(cameras);
          return { camera: cam.name, zone: plan.zones.find((z) => z.id === cam.zoneId)?.name ?? "" };
        }
        case "dockAssigned":
          return { dock: pick(plan.docks).id, plate: `34 ${String.fromCharCode(65 + Math.floor(rng() * 26))}${String.fromCharCode(65 + Math.floor(rng() * 26))} ${100 + Math.floor(rng() * 899)}` };
      }
    })();
    events.push({
      id: `${plan.facilityId}-ev-${i + 1}`,
      type,
      params,
      at: new Date(anchorMs - offsetMin * MINUTE_MS).toISOString(),
      isAlert: type === "packageDamageDetected" || type === "temperatureHigh",
    });
    offsetMin += 3 + Math.floor(rng() * 9);
  }
  return events;
}
