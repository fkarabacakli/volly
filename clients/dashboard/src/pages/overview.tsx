import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight, MapPinned } from "lucide-react";
import { FacilityMap } from "@/components/facility-map/facility-map";
import { ActivityCard } from "@/components/industrial/cards/activity-card";
import { CameraAlertsCard } from "@/components/industrial/cards/camera-alerts-card";
import { ColdChainCard } from "@/components/industrial/cards/cold-chain-card";
import { StockCard } from "@/components/industrial/cards/stock-card";
import { SystemStatusCard } from "@/components/industrial/cards/system-status-card";
import { FacilitySelect } from "@/components/industrial/controls";
import { CardState, LiveBadge } from "@/components/industrial/indicators";
import { PageToolbar, PanelCard } from "@/components/industrial/panel";
import { useFacility } from "@/hooks/use-facility";
import { useFacilityLayout } from "@/hooks/use-facility-layout";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/cn";

/** Tailwind `xl` — below it the cards stack under the map instead of floating on it. */
const WIDE_QUERY = "(min-width: 1280px)";
const LEFT_COLUMN_PX = 316;
const RIGHT_COLUMN_PX = 332;
const OVERLAY_GAP_PX = 16;

/**
 * Genel Bakış — the facility at a glance. On wide screens the live plan is
 * the canvas and the cards float over its edges (the reference layout);
 * the map is fitted into the window between the two card columns. Narrow
 * screens stack map-first.
 */
export function OverviewPage() {
  const { t } = useTranslation(["overview", "common"]);
  const { facilityId, facility } = useFacility();
  const { layout, alerts } = useFacilityLayout(facilityId);
  const isWide = useMediaQuery(WIDE_QUERY);

  const subtitle = facility
    ? `${facility.name} · ${facility.capabilities.map((c) => t(`common:capability.${c}`)).join(" · ")}`
    : undefined;

  const map = layout.data ? (
    <FacilityMap
      plan={layout.data.plan}
      devices={layout.data.devices}
      alerts={alerts.data}
      fitInsets={
        isWide
          ? {
              top: OVERLAY_GAP_PX * 3,
              bottom: OVERLAY_GAP_PX,
              left: LEFT_COLUMN_PX + OVERLAY_GAP_PX * 2,
              right: RIGHT_COLUMN_PX + OVERLAY_GAP_PX * 2,
            }
          : undefined
      }
      className={isWide ? "absolute inset-0 rounded-none" : "h-[260px] sm:h-[380px] md:h-[480px]"}
    />
  ) : (
    <CardState kind={layout.isError ? "error" : "loading"} />
  );

  const openMapLink = (
    <Link
      to="/monitoring"
      className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
    >
      {t("common:actions.openMap")}
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );

  const left = (
    <>
      <ColdChainCard facilityId={facilityId} />
      <CameraAlertsCard facilityId={facilityId} />
      <SystemStatusCard facilityId={facilityId} />
    </>
  );
  const right = (
    <>
      <StockCard facilityId={facilityId} />
      <ActivityCard facilityId={facilityId} />
    </>
  );

  return (
    <div className="fsh-enter">
      <PageToolbar title={t("title")} subtitle={subtitle}>
        <LiveBadge />
        <FacilitySelect />
      </PageToolbar>

      {isWide ? (
        <section
          aria-label={t("facilityMap")}
          className="relative h-[calc(100dvh-11rem)] min-h-[680px] overflow-hidden rounded-[24px] border border-[var(--color-border)] bg-[var(--color-map-floor)]"
        >
          {map}
          <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 shadow-[var(--shadow-float)]">
            <MapPinned aria-hidden className="size-4 text-[var(--color-primary)]" />
            <span className="text-[13px] font-medium">{t("facilityMap")}</span>
            {openMapLink}
          </div>
          <FloatingColumn side="left" widthPx={LEFT_COLUMN_PX}>
            {left}
          </FloatingColumn>
          <FloatingColumn side="right" widthPx={RIGHT_COLUMN_PX}>
            {right}
          </FloatingColumn>
        </section>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <PanelCard title={t("facilityMap")} icon={MapPinned} className="md:col-span-2" actions={openMapLink}>
            {map}
          </PanelCard>
          <div className="flex min-w-0 flex-col gap-4">{left}</div>
          <div className="flex min-w-0 flex-col gap-4">{right}</div>
        </div>
      )}
    </div>
  );
}

/** Scrollable card stack pinned to one edge of the map canvas; cards go glassy. */
function FloatingColumn({ side, widthPx, children }: { side: "left" | "right"; widthPx: number; children: ReactNode }) {
  return (
    <div
      className={cn(
        "absolute bottom-4 top-4 flex flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none]",
        side === "left" ? "left-4" : "right-4",
        "[&>section]:bg-[oklch(from_var(--color-card)_l_c_h_/_0.94)] [&>section]:shadow-[var(--shadow-float)] [&>section]:backdrop-blur-md",
      )}
      style={{ width: widthPx }}
    >
      {children}
    </div>
  );
}
