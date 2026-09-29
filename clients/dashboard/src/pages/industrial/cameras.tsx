import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BellRing, Cctv, ScanEye, Sparkles, TriangleAlert, Video } from "lucide-react";
import {
  getCameraAlerts,
  getCameras,
  type AlertSeverity,
  type CameraAlert,
  type CameraAlertType,
  type Device,
} from "@/api/industrial";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ExportButton, FacilitySelect, PillSelect } from "@/components/industrial/controls";
import { AlertStatusBadge, AlertThumb, CardState, SeverityBadge, StatusDot } from "@/components/industrial/indicators";
import { KpiTile, PageToolbar, PanelCard } from "@/components/industrial/panel";
import { useFacility } from "@/hooks/use-facility";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

const ALERT_TYPES: CameraAlertType[] = ["packageDamage", "misplacement", "irregularStacking", "unauthorizedAccess"];
const SEVERITIES: AlertSeverity[] = ["high", "medium", "low"];
const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_HEIGHT_PX = 64;
const ALERT_REFRESH_MS = 30_000;

/** Kamera Analizi — camera feeds + the AI alert stream. */
export function CamerasPage() {
  const { t } = useTranslation(["cameras", "common"]);
  const { facilityId } = useFacility();
  const [type, setType] = useState<CameraAlertType | "">("");
  const [severity, setSeverity] = useState<AlertSeverity | "">("");
  const [openAlert, setOpenAlert] = useState<CameraAlert | null>(null);

  const { data: cameras = [], isPending: camerasPending } = useQuery({
    queryKey: ["industrial", "cameras", { facilityId }],
    queryFn: () => getCameras(facilityId),
  });
  // Unfiltered list feeds the KPIs + per-camera counts (shared cache with the overview card).
  const { data: allAlerts = [] } = useQuery({
    queryKey: ["industrial", "alerts", { facilityId }],
    queryFn: () => getCameraAlerts(facilityId),
    refetchInterval: ALERT_REFRESH_MS,
  });
  const filtered = useQuery({
    queryKey: ["industrial", "alerts", { facilityId, type, severity }],
    queryFn: () => getCameraAlerts(facilityId, { type: type || undefined, severity: severity || undefined }),
    placeholderData: keepPreviousData,
    refetchInterval: ALERT_REFRESH_MS,
  });
  const alerts = useMemo(() => filtered.data ?? [], [filtered.data]);

  const open = allAlerts.filter((a) => a.status === "open");
  const now = Date.now();
  const last24h = allAlerts.filter((a) => now - new Date(a.detectedAt).getTime() < DAY_MS).length;
  const online = cameras.filter((c) => c.status !== "offline").length;
  const aiOn = cameras.filter((c) => c.aiEnabled).length;

  const exportCsv = () =>
    downloadCsv(
      `kamera-uyarilari-${facilityId}`,
      [t("colType"), t("severity"), t("camera"), t("zone"), t("detectedAt"), t("colConfidence"), t("status")],
      alerts.map((a) => [
        t(`common:alertType.${a.type}`),
        t(`common:severity.${a.severity}`),
        a.cameraName,
        a.zoneName,
        formatDateTime(a.detectedAt),
        Math.round(a.confidence * 100),
        t(`common:alertStatus.${a.status}`),
      ]),
    );

  return (
    <div className="fsh-enter">
      <PageToolbar title={t("title")} subtitle={t("subtitle")}>
        <FacilitySelect />
      </PageToolbar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Cctv} label={t("kpiOnline")} value={`${online}/${cameras.length}`} />
        <KpiTile icon={Sparkles} label={t("kpiAi")} value={formatNumber(aiOn)} tone="info" />
        <KpiTile icon={TriangleAlert} label={t("kpiOpen")} value={formatNumber(open.length)} tone="danger" />
        <KpiTile icon={BellRing} label={t("kpiToday")} value={formatNumber(last24h)} tone="warning" />
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PanelCard title={t("feeds")} icon={Video}>
          {camerasPending ? (
            <CardState kind="loading" />
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {cameras.map((c) => (
                <li key={c.id}>
                  <CameraFeedTile camera={c} openAlerts={open.filter((a) => a.cameraId === c.id).length} />
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title={
            <>
              {t("alerts")}
              <span className="ml-2 text-[12px] font-normal text-[var(--color-muted-foreground)]" aria-live="polite">
                {t("alertCount", { count: alerts.length })}
              </span>
            </>
          }
          icon={ScanEye}
          tone="danger"
          actions={<ExportButton onClick={exportCsv} disabled={alerts.length === 0} />}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <PillSelect
              label={t("colType")}
              value={type}
              onChange={(v) => setType(v as CameraAlertType | "")}
              options={[{ value: "", label: t("allTypes") }, ...ALERT_TYPES.map((a) => ({ value: a, label: t(`common:alertType.${a}`) }))]}
            />
            <PillSelect
              label={t("severity")}
              value={severity}
              onChange={(v) => setSeverity(v as AlertSeverity | "")}
              options={[{ value: "", label: t("allSeverities") }, ...SEVERITIES.map((s) => ({ value: s, label: t(`common:severity.${s}`) }))]}
            />
          </div>
          {filtered.isPending ? (
            <CardState kind="loading" />
          ) : alerts.length === 0 ? (
            <CardState kind="empty" />
          ) : (
            <AlertList alerts={alerts} onOpen={setOpenAlert} />
          )}
        </PanelCard>
      </div>

      <AlertDialog alert={openAlert} onClose={() => setOpenAlert(null)} />
    </div>
  );
}

function CameraFeedTile({ camera, openAlerts }: { camera: Device; openAlerts: number }) {
  const { t } = useTranslation(["cameras", "map"]);
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
      {/* Placeholder "feed" until the edge video gateway exposes snapshots. */}
      <div
        className={cn(
          "relative aspect-video bg-[linear-gradient(135deg,var(--neutral-700),var(--neutral-900))]",
          openAlerts > 0 && "ring-2 ring-inset ring-[var(--color-destructive)]",
        )}
      >
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,oklch(1_0_0_/_0.04)_0_1px,transparent_1px_4px)]" />
        <Cctv aria-hidden className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-[oklch(1_0_0_/_0.35)]" />
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-[oklch(0_0_0_/_0.55)] px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[oklch(0.97_0_0)]">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-destructive)]" />
          {t("feedLive")}
        </span>
        {openAlerts > 0 && (
          <span className="absolute right-2 top-2 rounded bg-[var(--color-destructive)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-destructive-foreground)]">
            {t("feedAlerts", { count: openAlerts })}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <StatusDot status={camera.status} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{camera.name}</span>
        <span className="text-[11px] text-[var(--color-muted-foreground)]">{camera.zoneId}</span>
      </div>
      <p className={cn("px-3 pb-2 text-[11px]", camera.aiEnabled ? "text-[var(--color-primary)]" : "text-[var(--color-muted-foreground)]")}>
        {camera.aiEnabled ? t("map:aiActive") : t("map:aiPaused")}
      </p>
    </div>
  );
}

function AlertList({ alerts, onOpen }: { alerts: CameraAlert[]; onOpen: (a: CameraAlert) => void }) {
  const { t } = useTranslation(["cameras", "common"]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: alerts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 8,
  });

  return (
    <div ref={scrollRef} className="h-[520px] overflow-y-auto rounded-xl border border-[var(--color-border)]">
      <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((row) => {
          const a = alerts[row.index];
          return (
            <li
              key={a.id}
              className="absolute inset-x-0 border-b border-[var(--color-border)]"
              style={{ height: row.size, transform: `translateY(${row.start}px)` }}
            >
              <button
                type="button"
                onClick={() => onOpen(a)}
                className="flex h-full w-full items-center gap-3 px-3 text-left hover:bg-[var(--color-surface-2-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]"
              >
                <AlertThumb type={a.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-semibold">{t(`common:alertType.${a.type}`)}</span>
                  <span className="block truncate text-[11.5px] text-[var(--color-muted-foreground)]">
                    {a.cameraName} · {a.zoneName}
                  </span>
                </span>
                <span className="hidden sm:block">
                  <SeverityBadge severity={a.severity} />
                </span>
                <AlertStatusBadge status={a.status} />
                <time dateTime={a.detectedAt} className="w-20 shrink-0 text-right text-[11.5px] text-[var(--color-muted-foreground)]">
                  {formatRelative(a.detectedAt)}
                </time>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AlertDialog({ alert, onClose }: { alert: CameraAlert | null; onClose: () => void }) {
  const { t } = useTranslation(["cameras", "common"]);
  return (
    <Dialog open={alert !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {alert && (
          <>
            <DialogHeader>
              <DialogTitle>{t(`common:alertType.${alert.type}`)}</DialogTitle>
              <DialogDescription>{t("detailTitle")}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <AlertThumb type={alert.type} className="mb-4 h-40 w-full [&>svg]:size-10" />
              <dl className="grid grid-cols-2 gap-3 text-[13px]">
                <Detail label={t("camera")} value={alert.cameraName} />
                <Detail label={t("zone")} value={alert.zoneName} />
                <Detail label={t("detectedAt")} value={formatDateTime(alert.detectedAt)} />
                <Detail label={t("colConfidence")} value={t("confidence", { value: Math.round(alert.confidence * 100) })} />
                <div>
                  <dt className="text-[11.5px] text-[var(--color-muted-foreground)]">{t("severity")}</dt>
                  <dd className="mt-0.5"><SeverityBadge severity={alert.severity} /></dd>
                </div>
                <div>
                  <dt className="text-[11.5px] text-[var(--color-muted-foreground)]">{t("status")}</dt>
                  <dd className="mt-0.5"><AlertStatusBadge status={alert.status} /></dd>
                </div>
              </dl>
            </DialogBody>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={onClose}>
                {t("common:actions.close")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11.5px] text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
