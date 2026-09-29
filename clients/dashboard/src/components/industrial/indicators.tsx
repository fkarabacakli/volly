import { useTranslation } from "react-i18next";
import { Boxes, Layers, PackageX, ShieldAlert, type LucideIcon } from "lucide-react";
import type { AlertSeverity, CameraAlertStatus, CameraAlertType, DeviceStatus } from "@/api/industrial";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONE } from "@/components/industrial/device-meta";
import { cn } from "@/lib/cn";
import { formatPercent } from "@/lib/format";

export function StatusDot({ status, pulse = false }: { status: DeviceStatus; pulse?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-2 shrink-0 rounded-full", pulse && status === "online" && "pulse-dot")}
      style={{ backgroundColor: STATUS_TONE[status], color: STATUS_TONE[status] }}
    />
  );
}

/** "● Canlı" pill for live cards. */
export function LiveBadge() {
  const { t } = useTranslation();
  return (
    <Badge variant="success" className="gap-1.5">
      <span aria-hidden className="pulse-dot inline-flex size-1.5 rounded-full bg-current" />
      {t("states.live")}
    </Badge>
  );
}

/** Zones under this are flagged as under-utilised (amber bar). */
const LOW_UTILISATION_PCT = 50;

export function ZoneBar({ name, pct }: { name: string; pct: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr_2.75rem] items-center gap-3">
      <span className="truncate text-[12.5px] font-medium">{name}</span>
      <div
        role="meter"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2 overflow-hidden rounded-full bg-[var(--color-muted)]"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-[var(--duration-slow)]",
            pct < LOW_UTILISATION_PCT ? "bg-[var(--color-warning)]" : "bg-[var(--color-primary)]",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-right text-[12px] tabular-nums text-[var(--color-muted-foreground)]">{formatPercent(pct)}</span>
    </div>
  );
}

const ALERT_ICON: Record<CameraAlertType, LucideIcon> = {
  packageDamage: PackageX,
  misplacement: Boxes,
  irregularStacking: Layers,
  unauthorizedAccess: ShieldAlert,
};

/**
 * Stand-in for the camera snapshot until the video gateway exposes frames:
 * a dark "feed" tile with scanlines and the event glyph.
 */
export function AlertThumb({ type, className }: { type: CameraAlertType; className?: string }) {
  const Icon = ALERT_ICON[type];
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid h-11 w-14 shrink-0 place-items-center overflow-hidden rounded-lg",
        "bg-[linear-gradient(135deg,var(--neutral-700),var(--neutral-900))]",
        className,
      )}
    >
      <span className="absolute inset-0 bg-[repeating-linear-gradient(0deg,oklch(1_0_0_/_0.05)_0_1px,transparent_1px_3px)]" />
      <span className="absolute inset-1.5 rounded border border-[oklch(from_var(--color-destructive)_l_c_h_/_0.7)]" />
      <Icon className="relative size-5 text-[oklch(0.97_0_0)]" />
    </span>
  );
}

const SEVERITY_VARIANT: Record<AlertSeverity, "danger" | "warning" | "info"> = {
  high: "danger",
  medium: "warning",
  low: "info",
};

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const { t } = useTranslation();
  return <Badge variant={SEVERITY_VARIANT[severity]}>{t(`severity.${severity}`)}</Badge>;
}

const STATUS_VARIANT: Record<CameraAlertStatus, "danger" | "warning" | "outline"> = {
  open: "danger",
  acknowledged: "warning",
  resolved: "outline",
};

export function AlertStatusBadge({ status }: { status: CameraAlertStatus }) {
  const { t } = useTranslation();
  return <Badge variant={STATUS_VARIANT[status]}>{t(`alertStatus.${status}`)}</Badge>;
}

/** Hand-rolled loading / empty / error line for card bodies. */
export function CardState({ kind, message }: { kind: "loading" | "empty" | "error"; message?: string }) {
  const { t } = useTranslation();
  const text = message ?? t(`states.${kind}`);
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "py-6 text-center text-[12.5px]",
        kind === "error" ? "text-[var(--color-destructive)]" : "text-[var(--color-muted-foreground)]",
      )}
    >
      {text}
    </p>
  );
}
