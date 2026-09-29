import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ScanEye } from "lucide-react";
import { getCameraAlerts } from "@/api/industrial";
import { AlertThumb, CardState } from "@/components/industrial/indicators";
import { PanelCard } from "@/components/industrial/panel";
import { formatTime } from "@/lib/format";

const ALERT_REFRESH_MS = 30_000;
const PREVIEW_COUNT = 3;

export function CameraAlertsCard({ facilityId }: { facilityId: string }) {
  const { t } = useTranslation(["overview", "common"]);
  const { data = [], isPending, isError } = useQuery({
    queryKey: ["industrial", "alerts", { facilityId }],
    queryFn: () => getCameraAlerts(facilityId),
    refetchInterval: ALERT_REFRESH_MS,
  });
  const open = data.filter((a) => a.status === "open");
  const preview = data.slice(0, PREVIEW_COUNT);

  return (
    <PanelCard
      title={t("cameraAlerts")}
      icon={ScanEye}
      tone="danger"
      actions={
        open.length > 0 ? (
          <span className="grid size-5 place-items-center rounded-full bg-[var(--color-destructive)] text-[10.5px] font-bold text-[var(--color-destructive-foreground)]">
            {open.length}
          </span>
        ) : null
      }
    >
      {isPending ? (
        <CardState kind="loading" />
      ) : isError ? (
        <CardState kind="error" />
      ) : preview.length === 0 ? (
        <CardState kind="empty" message={t("noAlerts")} />
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {preview.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2.5 first:pt-0">
              <AlertThumb type={a.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[var(--color-destructive)]">
                  {t(`common:alertType.${a.type}`)}
                </p>
                <p className="truncate text-[11.5px] text-[var(--color-muted-foreground)]">
                  {a.cameraName} · {a.zoneName}
                </p>
              </div>
              <time dateTime={a.detectedAt} className="shrink-0 text-[11.5px] tabular-nums text-[var(--color-muted-foreground)]">
                {formatTime(a.detectedAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/cameras"
        className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-muted)] text-[12.5px] font-medium text-[var(--color-foreground)] hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
      >
        {t("allEvents")}
        <ArrowRight aria-hidden className="size-3.5" />
      </Link>
    </PanelCard>
  );
}
