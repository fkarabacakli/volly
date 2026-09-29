import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BarChart3, Check, ChartLine, Clock, ListChecks, Router, Table2 } from "lucide-react";
import {
  getFacilityLayout,
  getGateways,
  getSensorSeries,
  getSensors,
  thresholdsFor,
  type Device,
  type SensorMetric,
} from "@/api/industrial";
import { EChart, type EChartsOption } from "@/components/charts/echart";
import { useChartPalette } from "@/components/charts/chart-palette";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ExportButton, FacilitySelect, PillSelect } from "@/components/industrial/controls";
import { CardState } from "@/components/industrial/indicators";
import { PageToolbar, PanelCard } from "@/components/industrial/panel";
import { useFacility } from "@/hooks/use-facility";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { formatDecimal, formatNumber } from "@/lib/format";
import {
  intervalMinutes,
  isMetric,
  METRICS,
  RANGE_LABEL_KEY,
  RANGE_MS,
  seriesStats,
  windowEnd,
  type RangeKey,
} from "@/pages/industrial/sensor-query";

const REPORT_RANGES: RangeKey[] = ["24h", "7d", "30d"];
const MAX_COMPARE = 5;

/** Raporlar — side-by-side sensor comparison (Behance "Comparison" page). */
export function ReportsPage() {
  const { t } = useTranslation(["reports", "sensors", "common"]);
  const { facilityId } = useFacility();
  const [params, setParams] = useSearchParams();
  const metricParam = params.get("metric");
  const metric: SensorMetric = isMetric(metricParam) ? metricParam : "temperature";
  const rangeParam = params.get("range");
  const range: RangeKey = REPORT_RANGES.find((r) => r === rangeParam) ?? "7d";

  const update = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  const { data: sensors = [], isPending } = useQuery({
    queryKey: ["industrial", "sensors", { facilityId }],
    queryFn: () => getSensors(facilityId),
  });
  const { data: gateways = [] } = useQuery({
    queryKey: ["industrial", "gateways", { facilityId }],
    queryFn: () => getGateways(facilityId),
  });
  const { data: layout } = useQuery({
    queryKey: ["industrial", "layout", { facilityId }],
    queryFn: () => getFacilityLayout(facilityId),
  });

  const measuring = sensors.filter((s) => s.metrics?.includes(metric));
  const selectedIds = (params.get("sensors") ?? "")
    .split(",")
    .filter((id) => measuring.some((s) => s.id === id))
    .slice(0, MAX_COMPARE);
  const toggle = (id: string) => {
    const next = selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    update({ sensors: next.slice(0, MAX_COMPARE).join(",") || null });
  };

  const intervalMin = intervalMinutes(range, "auto");
  const toMs = windowEnd(intervalMin);
  const seriesQuery = useQuery({
    queryKey: ["industrial", "series", { facilityId, sensorIds: selectedIds, metric, range, intervalMin, toMs }],
    queryFn: () =>
      getSensorSeries({ facilityId, sensorIds: selectedIds, metric, fromMs: toMs - RANGE_MS[range], toMs, intervalMin }),
    enabled: selectedIds.length > 0,
    placeholderData: keepPreviousData,
  });
  const series = useMemo(() => (selectedIds.length > 0 ? (seriesQuery.data ?? []) : []), [seriesQuery.data, selectedIds.length]);

  const zoneOf = (s?: Device) => layout?.plan.zones.find((z) => z.id === s?.zoneId);
  const rows = series.map((s) => {
    const sensor = sensors.find((d) => d.id === s.sensorId);
    const zone = zoneOf(sensor);
    return {
      id: s.sensorId,
      name: sensor?.name ?? s.sensorId,
      zone: zone?.name ?? "—",
      ...seriesStats(s.points, thresholdsFor(zone?.isCold ?? false)[metric]),
    };
  });
  const unit = t(`common:unit.${metric}`);
  const digits = metric === "co2" ? 0 : 1;

  const exportCsv = () =>
    downloadCsv(
      `rapor-${metric}-${range}`,
      [t("colSensor"), t("colZone"), t("common:stats.avg"), t("common:stats.max"), t("common:stats.min"), t("sensors:threshold")],
      rows.map((r) => [r.name, r.zone, formatDecimal(r.avg, digits), formatDecimal(r.max, digits), formatDecimal(r.min, digits), r.breaches]),
    );

  return (
    <div className="fsh-enter space-y-4">
      <PageToolbar title={t("title")}>
        <FacilitySelect />
      </PageToolbar>

      <section className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[linear-gradient(120deg,var(--brand-600),var(--brand-800))] px-6 py-8 text-[var(--color-primary-foreground)] sm:px-10">
        <div aria-hidden className="absolute -right-16 -top-24 size-72 rounded-full bg-[oklch(1_0_0_/_0.08)]" />
        <div aria-hidden className="absolute -bottom-28 right-24 size-60 rounded-full bg-[oklch(1_0_0_/_0.06)]" />
        <h2 className="relative font-display text-[26px] font-semibold tracking-tight sm:text-[30px]">{t("heroTitle")}</h2>
        <p className="relative mt-2 max-w-[560px] text-[14px] opacity-90">{t("heroBody")}</p>
      </section>

      <PanelCard
        title={t("selection")}
        icon={ListChecks}
        actions={
          <span className="text-[12px] text-[var(--color-muted-foreground)]" aria-live="polite">
            {t("selectedCount", { count: selectedIds.length })}
          </span>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <PillSelect
            label={t("sensors:metric")}
            value={metric}
            onChange={(v) => update({ metric: v, sensors: null })}
            options={METRICS.map((m) => ({ value: m, label: `${t(`common:metric.${m}`)} (${t(`common:unit.${m}`)})` }))}
          />
          <PillSelect
            label={t("sensors:range")}
            icon={Clock}
            value={range}
            onChange={(v) => update({ range: v === "7d" ? null : v })}
            options={REPORT_RANGES.map((r) => ({ value: r, label: t(`sensors:${RANGE_LABEL_KEY[r]}`) }))}
          />
          <p className="ml-auto text-[12px] text-[var(--color-muted-foreground)]">{t("selectionHint", { max: MAX_COMPARE })}</p>
        </div>
        {isPending ? (
          <CardState kind="loading" />
        ) : (
          <div className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {gateways.map((g) => {
              const own = sensors.filter((s) => s.gatewayId === g.id);
              if (own.length === 0) return null;
              return (
                <div key={g.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                  <span className="flex w-56 shrink-0 items-center gap-2 text-[12.5px] font-semibold">
                    <Router aria-hidden className="size-4 text-[var(--color-primary)]" />
                    {g.name}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {own.map((s) => (
                      <SensorCheck
                        key={s.id}
                        sensor={s}
                        checked={selectedIds.includes(s.id)}
                        disabled={!s.metrics?.includes(metric) || (!selectedIds.includes(s.id) && selectedIds.length >= MAX_COMPARE)}
                        onToggle={() => toggle(s.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PanelCard>

      {selectedIds.length === 0 ? (
        <CardState kind="empty" message={t("pickSensors")} />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <PanelCard title={`${t("comparison")} · ${t(`common:metric.${metric}`)} (${unit})`} icon={ChartLine}>
              {seriesQuery.isPending ? (
                <CardState kind="loading" />
              ) : (
                <TimeSeriesChart
                  series={series.map((s) => ({ name: sensors.find((d) => d.id === s.sensorId)?.name ?? s.sensorId, points: s.points }))}
                  unit={unit}
                  zoomable
                  ariaLabel={t("comparison")}
                  className="h-[360px]"
                />
              )}
            </PanelCard>
            <PanelCard title={t("averages")} icon={BarChart3}>
              <AverageBars rows={rows} unit={unit} />
            </PanelCard>
          </div>

          <PanelCard title={t("summary")} icon={Table2} actions={<ExportButton onClick={exportCsv} disabled={rows.length === 0} />}>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full min-w-[560px] text-[12.5px]">
                <thead className="bg-[var(--color-muted)] text-left text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <tr>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t("colSensor")}</th>
                    <th scope="col" className="px-3 py-2.5 font-semibold">{t("colZone")}</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("common:stats.avg")}</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("common:stats.max")}</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("common:stats.min")}</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("sensors:threshold")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <th scope="row" className="px-3 py-2 text-left font-medium">{r.name}</th>
                      <td className="px-3 py-2">{r.zone}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.avg, digits)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.max, digits)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.min, digits)}</td>
                      <td className={cn("px-3 py-2 text-right", r.breaches > 0 && "font-semibold text-[var(--color-destructive)]")}>
                        {t("sensors:breaches", { count: r.breaches })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PanelCard>
        </>
      )}
    </div>
  );
}

function SensorCheck({
  sensor,
  checked,
  disabled,
  onToggle,
}: {
  sensor: Device;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[12.5px] font-medium",
        "focus-within:ring-2 focus-within:ring-[var(--color-ring)]",
        checked ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-[var(--color-card)]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={onToggle} />
      <span
        aria-hidden
        className={cn(
          "grid size-4 place-items-center rounded border",
          checked ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]" : "border-[var(--color-border-strong)]",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      {sensor.name}
    </label>
  );
}

function AverageBars({ rows, unit }: { rows: { id: string; name: string; avg: number }[]; unit: string }) {
  const palette = useChartPalette();
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 8, right: 48, top: 8, bottom: 8, containLabel: true },
      tooltip: { trigger: "item", valueFormatter: (v) => `${formatNumber(Number(v))} ${unit}` },
      xAxis: { type: "value", axisLabel: { formatter: (v: number) => formatNumber(v) } },
      yAxis: { type: "category", data: rows.map((r) => r.name), inverse: true },
      series: [
        {
          type: "bar",
          barMaxWidth: 18,
          data: rows.map((r, i) => ({ value: Math.round(r.avg * 10) / 10, itemStyle: { color: palette.series[i % palette.series.length], borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: "right", color: palette.muted, formatter: (p) => formatNumber(Number(p.value)) },
        },
      ],
    }),
    [rows, unit, palette],
  );
  return <EChart option={option} ariaLabel={unit} className="h-[360px]" />;
}
