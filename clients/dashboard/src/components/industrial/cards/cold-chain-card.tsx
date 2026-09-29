import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Snowflake } from "lucide-react";
import { getColdChainSummary } from "@/api/industrial";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { CardState, LiveBadge } from "@/components/industrial/indicators";
import { PanelCard } from "@/components/industrial/panel";
import { cn } from "@/lib/cn";
import { formatDecimal, formatPercent, formatSigned } from "@/lib/format";

const COLD_CHAIN_REFRESH_MS = 10_000;

export function ColdChainCard({ facilityId }: { facilityId: string }) {
  const { t } = useTranslation(["overview", "common"]);
  const { data, isPending, isError } = useQuery({
    queryKey: ["industrial", "cold-chain", { facilityId }],
    queryFn: () => getColdChainSummary(facilityId),
    refetchInterval: COLD_CHAIN_REFRESH_MS,
  });

  const series = useMemo(
    () =>
      data
        ? [
            { name: `${t("common:metric.temperature")} (°C)`, points: data.temperatureSeries },
            { name: `${t("common:metric.humidity")} (%)`, points: data.humiditySeries },
          ]
        : [],
    [data, t],
  );

  return (
    <PanelCard title={t("coldChain")} icon={Snowflake} tone="info" actions={<LiveBadge />}>
      {isPending ? (
        <CardState kind="loading" />
      ) : isError ? (
        <CardState kind="error" />
      ) : !data ? (
        <CardState kind="empty" message={t("noColdChain")} />
      ) : (
        <>
          <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
            <Reading
              label={t("common:metric.temperature")}
              value={`${formatDecimal(data.temperature)}°C`}
              delta={data.temperatureDelta}
              deltaText={`${formatSigned(data.temperatureDelta)}°C`}
            />
            <Reading
              label={t("common:metric.humidity")}
              value={formatPercent(data.humidity)}
              delta={data.humidityDelta}
              deltaText={formatSigned(data.humidityDelta)}
              className="pl-4"
            />
          </div>
          <TimeSeriesChart
            series={series}
            unit="°C"
            secondaryUnit="%"
            dualAxis
            compact
            threshold={data.thresholds.temperature}
            ariaLabel={t("coldChain")}
            className="mt-3 h-[150px]"
          />
          <div className="mt-2 flex items-center gap-4 text-[11px] text-[var(--color-muted-foreground)]">
            <LegendDot className="bg-[var(--color-chart-1)]" label={series[0].name} />
            <LegendDot className="bg-[var(--color-chart-2)]" label={series[1].name} />
          </div>
        </>
      )}
    </PanelCard>
  );
}

function Reading({
  label,
  value,
  delta,
  deltaText,
  className,
}: {
  label: string;
  value: string;
  delta: number;
  deltaText: string;
  className?: string;
}) {
  const Arrow = delta >= 0 ? ArrowUp : ArrowDown;
  return (
    <div className={className}>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[28px] font-semibold leading-none tracking-tight">{value}</span>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-semibold",
            delta >= 0 ? "text-[var(--color-destructive)]" : "text-[var(--color-success)]",
          )}
        >
          <Arrow aria-hidden className="size-3" />
          {deltaText}
        </span>
      </div>
      <p className="mt-1 text-[12px] text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}
