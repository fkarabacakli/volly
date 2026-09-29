import { Cctv, Forklift, Radar, Router, Thermometer, UserRound, type LucideIcon } from "lucide-react";
import type { DeviceKind, DeviceStatus } from "@/api/industrial";

/** Icon + tone per device kind — shared by the map, lists and legends. */
export const DEVICE_KIND_META: Record<DeviceKind, { icon: LucideIcon; tone: string }> = {
  camera: { icon: Cctv, tone: "var(--color-foreground)" },
  sensor: { icon: Thermometer, tone: "var(--color-info)" },
  gateway: { icon: Router, tone: "var(--color-primary)" },
  radar: { icon: Radar, tone: "var(--color-primary)" },
  forklift: { icon: Forklift, tone: "var(--color-warning)" },
  personnel: { icon: UserRound, tone: "var(--color-primary)" },
};

export const DEVICE_KINDS: DeviceKind[] = ["camera", "sensor", "gateway", "radar", "forklift", "personnel"];

export const STATUS_TONE: Record<DeviceStatus, string> = {
  online: "var(--color-success)",
  warning: "var(--color-warning)",
  offline: "var(--color-destructive)",
};
