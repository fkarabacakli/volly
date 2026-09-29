import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Boxes } from "lucide-react";
import { getStockSummary } from "@/api/industrial";
import { useChartPalette } from "@/components/charts/chart-palette";
import { RingChart } from "@/components/charts/ring-chart";
import { CardState, ZoneBar } from "@/components/industrial/indicators";
import { PanelCard } from "@/components/industrial/panel";
import { formatNumber, formatPercent } from "@/lib/format";

export function StockCard({ facilityId, showLink = true }: { facilityId: string; showLink?: boolean }) {
  const { t } = useTranslation(["overview", "common"]);
  const palette = useChartPalette();
  const { data, isPending, isError } = useQuery({
    queryKey: ["industrial", "stock", { facilityId }],
    queryFn: () => getStockSummary(facilityId),
  });

  const legend = useMemo(
    () =>
      data
        ? [
            { key: "filled", label: t("filled"), value: data.filled, color: palette.primary },
            { key: "empty", label: t("empty"), value: data.empty, color: palette.grid },
            { key: "reserved", label: t("reserved"), value: data.reserved, color: palette.series[1] },
          ]
        : [],
    [data, palette, t],
  );

  return (
    <PanelCard
      title={t("stock")}
      icon={Boxes}
      actions={
        showLink ? (
          <Link
            to="/inventory"
            aria-label={t("common:actions.viewAll")}
            className="grid size-7 place-items-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <ArrowRight className="size-4" />
          </Link>
        ) : null
      }
    >
      {isPending ? (
        <CardState kind="loading" />
      ) : isError || !data ? (
        <CardState kind="error" />
      ) : (
        <>
          <div className="flex items-center gap-4">
            <RingChart
              className="size-[128px] shrink-0"
              ariaLabel={`${t("totalOccupancy")} ${formatPercent(data.occupancyPct)}`}
              slices={legend.map((l) => ({ name: l.label, value: l.value, color: l.color }))}
            >
              <div>
                <p className="font-display text-[24px] font-semibold leading-none tracking-tight">{formatPercent(data.occupancyPct)}</p>
                <p className="mt-1 text-[10px] text-[var(--color-muted-foreground)]">{t("totalOccupancy")}</p>
              </div>
            </RingChart>
            <ul className="min-w-0 flex-1 space-y-2">
              {legend.map((l) => (
                <li key={l.key} className="flex items-center gap-2 text-[12.5px]">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="truncate">{l.label}</span>
                  <span className="ml-auto font-semibold tabular-nums">{formatNumber(l.value)}</span>
                </li>
              ))}
            </ul>
          </div>
          <h3 className="mb-2.5 mt-5 text-[12.5px] font-semibold">{t("zoneOccupancy")}</h3>
          <div className="space-y-2.5">
            {data.zones.map((z) => (
              <ZoneBar key={z.zoneId} name={z.name} pct={z.occupancyPct} />
            ))}
          </div>
        </>
      )}
    </PanelCard>
  );
}
