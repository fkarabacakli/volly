import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  getSensorSeries,
  thresholdsFor,
  type CameraAlert,
  type Device,
  type FloorPlan,
  type SensorMetric,
} from "@/api/industrial";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DEVICE_KIND_META } from "@/components/industrial/device-meta";
import { AlertThumb, StatusDot } from "@/components/industrial/indicators";
import { ToneIcon } from "@/components/industrial/panel";
import { formatDecimal, formatRelative, formatTime } from "@/lib/format";

const HISTORY_WINDOW_MS = 6 * 60 * 60 * 1000;
const HISTORY_INTERVAL_MIN = 5;
const RECENT_ALERTS = 3;

/** Right-hand panel on Live Monitoring for the selected map device. */
export function DeviceDetailPanel({
  device,
  plan,
  devices,
  alerts,
  onClose,
}: {
  device: Device;
  plan: FloorPlan;
  devices: Device[];
  alerts: CameraAlert[];
  onClose: () => void;
}) {
  const { t } = useTranslation(["monitoring", "common", "map"]);
  const zone = plan.zones.find((z) => z.id === device.zoneId);
  const gateway = device.gatewayId ? devices.find((d) => d.id === device.gatewayId) : undefined;
  const cameraAlerts = alerts.filter((a) => a.cameraId === device.id).slice(0, RECENT_ALERTS);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <ToneIcon icon={DEVICE_KIND_META[device.kind].icon} className="size-10" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{device.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--color-muted-foreground)]">
            <StatusDot status={device.status} pulse />
            {t(`common:status.${device.status}`)} · {t(`common:deviceKind.${device.kind}`)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("clearSelection")}
          className="grid size-8 place-items-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
        >
          <X className="size-4" />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-xl bg-[var(--color-muted)] p-3 text-[12.5px]">
        <Field label={t("zone")} value={zone?.name ?? t("noZone")} />
        <Field label={t("lastSeen")} value={formatRelative(device.lastSeenAt)} />
        {device.locationCode && <Field label={t("location")} value={device.locationCode} />}
        {gateway && <Field label={t("gateway")} value={gateway.name} />}
        {device.kind === "camera" && (
          <Field label={t("aiAnalysis")} value={device.aiEnabled ? t("map:aiActive") : t("map:aiPaused")} />
        )}
      </dl>

      {device.kind === "sensor" && <SensorReadings device={device} isCold={zone?.isCold ?? false} facilityId={plan.facilityId} />}

      {device.kind === "camera" && (
        <section>
          <h3 className="mb-2 text-[12.5px] font-semibold">{t("recentAlerts")}</h3>
          {cameraAlerts.length === 0 ? (
            <p className="text-[12px] text-[var(--color-muted-foreground)]">{t("common:states.empty")}</p>
          ) : (
            <ul className="space-y-2">
              {cameraAlerts.map((a) => (
                <li key={a.id} className="flex items-center gap-3">
                  <AlertThumb type={a.type} className="h-9 w-12" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{t(`common:alertType.${a.type}`)}</span>
                  <time dateTime={a.detectedAt} className="text-[11.5px] tabular-nums text-[var(--color-muted-foreground)]">
                    {formatTime(a.detectedAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}

function SensorReadings({ device, isCold, facilityId }: { device: Device; isCold: boolean; facilityId: string }) {
  const { t } = useTranslation(["monitoring", "common"]);
  const metrics = device.metrics ?? [];
  const primary: SensorMetric = metrics[0] ?? "temperature";
  // Round to the interval so the key (and the chart) only moves when a new point exists.
  const toMs = Math.floor(Date.now() / (HISTORY_INTERVAL_MIN * 60_000)) * HISTORY_INTERVAL_MIN * 60_000;
  const { data } = useQuery({
    queryKey: ["industrial", "series", { facilityId, sensorIds: [device.id], metric: primary, range: "6h", toMs }],
    queryFn: () =>
      getSensorSeries({
        facilityId,
        sensorIds: [device.id],
        metric: primary,
        fromMs: toMs - HISTORY_WINDOW_MS,
        toMs,
        intervalMin: HISTORY_INTERVAL_MIN,
      }),
  });
  const series = useMemo(
    () => (data ?? []).map((s) => ({ name: t(`common:metric.${s.metric}`), points: s.points })),
    [data, t],
  );

  return (
    <section>
      <h3 className="mb-2 text-[12.5px] font-semibold">{t("latest")}</h3>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m} className="rounded-xl border border-[var(--color-border)] p-2.5">
            <p className="text-[11px] text-[var(--color-muted-foreground)]">{t(`common:metric.${m}`)}</p>
            <p className="font-display text-[17px] font-semibold tabular-nums">
              {device.latest?.[m] !== undefined ? formatDecimal(device.latest[m] as number, m === "co2" ? 0 : 1) : "—"}
              <span className="ml-0.5 text-[11px] font-medium text-[var(--color-muted-foreground)]">{t(`common:unit.${m}`)}</span>
            </p>
          </div>
        ))}
      </div>
      <h3 className="mb-1 mt-4 text-[12.5px] font-semibold">
        {t(`common:metric.${primary}`)} · {t("last6h")}
      </h3>
      {series.length > 0 && (
        <TimeSeriesChart
          series={series}
          unit={t(`common:unit.${primary}`)}
          threshold={thresholdsFor(isCold)[primary]}
          compact
          area
          ariaLabel={`${device.name} ${t(`common:metric.${primary}`)}`}
          className="h-[160px]"
        />
      )}
    </section>
  );
}
