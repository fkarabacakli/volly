import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Cctv, Forklift, History, PackageX, Thermometer, Truck, UserRound, type LucideIcon } from "lucide-react";
import { getActivities, type ActivityType } from "@/api/industrial";
import { CardState } from "@/components/industrial/indicators";
import { PanelCard, ToneIcon } from "@/components/industrial/panel";
import { cn } from "@/lib/cn";
import { formatTime } from "@/lib/format";

const ACTIVITY_REFRESH_MS = 15_000;

const ICONS: Record<ActivityType, LucideIcon> = {
  personnelDetected: UserRound,
  forkliftMoving: Forklift,
  temperatureNormal: Thermometer,
  temperatureHigh: Thermometer,
  cameraAnalysisDone: Cctv,
  packageDamageDetected: PackageX,
  dockAssigned: Truck,
};

export function ActivityCard({ facilityId, limit = 6 }: { facilityId: string; limit?: number }) {
  const { t } = useTranslation(["overview", "activity"]);
  const { data = [], isPending, isError } = useQuery({
    queryKey: ["industrial", "activity", { facilityId, limit }],
    queryFn: () => getActivities(facilityId, limit),
    refetchInterval: ACTIVITY_REFRESH_MS,
  });

  return (
    <PanelCard title={t("recentActivity")} icon={History}>
      {isPending ? (
        <CardState kind="loading" />
      ) : isError ? (
        <CardState kind="error" />
      ) : data.length === 0 ? (
        <CardState kind="empty" />
      ) : (
        <ul className="space-y-1" aria-live="polite">
          {data.map((e) => (
            <li
              key={e.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-1.5 py-1.5",
                e.isAlert && "bg-[oklch(from_var(--color-destructive)_l_c_h_/_0.06)]",
              )}
            >
              <ToneIcon icon={ICONS[e.type]} tone={e.isAlert ? "danger" : "primary"} className="size-7" />
              <p className={cn("min-w-0 flex-1 text-[12px] leading-snug", e.isAlert && "font-medium text-[var(--color-destructive)]")}>
                {t(`activity:${e.type}`, e.params)}
              </p>
              <time dateTime={e.at} className="shrink-0 text-[11px] tabular-nums text-[var(--color-muted-foreground)]">
                {formatTime(e.at)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
