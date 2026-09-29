import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChartColumn, ChartLine, Clock, Cpu, Router, Table2, Thermometer, X } from "lucide-react";
import {
  getFacilityLayout,
  getGateways,
  getSensorSeries,
  getSensors,
  thresholdsFor,
  type Device,
  type SensorMetric,
} from "@/api/industrial";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ExportButton, FacilitySelect, PillSelect, SegmentedControl } from "@/components/industrial/controls";
import { CardState, LiveBadge, StatusDot } from "@/components/industrial/indicators";
import { PageToolbar, PanelCard } from "@/components/industrial/panel";
import { useFacility } from "@/hooks/use-facility";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { formatDate, formatDateTime, formatDecimal, formatTime } from "@/lib/format";
import {
  INTERVAL_LABEL_KEY,
  INTERVALS,
  intervalMinutes,
  isInterval,
  isMetric,
  isRange,
  METRICS,
  RANGE_LABEL_KEY,
  RANGE_MS,
  RANGES,
  windowEnd,
  type IntervalKey,
  type RangeKey,
} from "@/pages/industrial/sensor-query";
import { FullTable, OverallTable } from "@/pages/industrial/sensor-tables";

type View = "line" | "bar" | "table";
const MAX_DEVICES = 4;
const SERIES_REFRESH_MS = 30_000;

/**
 * Sensörler — Behance "Pure Air" pattern: gateway/device selectors, a metric
 * card with range + interval + view toggle (line / bar / table), the
 * Avg/Max/Min table and CSV export. All state is in the URL.
 */
export function SensorsPage() {
  const { t } = useTranslation(["sensors", "common"]);
  const { facilityId } = useFacility();
  const [params, setParams] = useSearchParams();

  const gatewayId = params.get("gateway") ?? "";
  const metricParam = params.get("metric");
  const metric: SensorMetric = isMetric(metricParam) ? metricParam : "temperature";
  const rangeParam = params.get("range");
  const range: RangeKey = isRange(rangeParam) ? rangeParam : "24h";
  const intervalParam = params.get("interval");
  const interval: IntervalKey = isInterval(intervalParam) ? intervalParam : "auto";
  const viewParam = params.get("view");
  const view: View = viewParam === "bar" || viewParam === "table" ? viewParam : "line";

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
    refetchInterval: SERIES_REFRESH_MS,
  });
  const { data: gateways = [] } = useQuery({
    queryKey: ["industrial", "gateways", { facilityId }],
    queryFn: () => getGateways(facilityId),
  });
  const { data: layout } = useQuery({
    queryKey: ["industrial", "layout", { facilityId }],
    queryFn: () => getFacilityLayout(facilityId),
  });

  const pool = sensors.filter((s) => !gatewayId || s.gatewayId === gatewayId);
  const measuring = pool.filter((s) => s.metrics?.includes(metric));
  const requested = (params.get("sensors") ?? "").split(",").filter(Boolean);
  // Query keys hash structurally, so a fresh array each render is fine here.
  const validRequested = requested.filter((id) => measuring.some((s) => s.id === id)).slice(0, MAX_DEVICES);
  const selectedIds = validRequested.length > 0 ? validRequested : measuring.slice(0, 1).map((s) => s.id);

  const isCold = (sensorId: string) =>
    layout?.plan.zones.find((z) => z.id === sensors.find((s) => s.id === sensorId)?.zoneId)?.isCold ?? false;
  const thresholdOf = (sensorId: string) => thresholdsFor(isCold(sensorId))[metric];

  const intervalMin = intervalMinutes(range, interval);
  const toMs = windowEnd(intervalMin);
  const fromMs = toMs - RANGE_MS[range];
  const seriesQuery = useQuery({
    queryKey: ["industrial", "series", { facilityId, sensorIds: selectedIds, metric, range, intervalMin, toMs }],
    queryFn: () => getSensorSeries({ facilityId, sensorIds: selectedIds, metric, fromMs, toMs, intervalMin }),
    enabled: selectedIds.length > 0,
    placeholderData: keepPreviousData,
  });
  const series = useMemo(() => seriesQuery.data ?? [], [seriesQuery.data]);
  const nameOf = (id: string) => sensors.find((s) => s.id === id)?.name ?? id;
  const chartSeries = useMemo(
    () => series.map((s) => ({ name: sensors.find((d) => d.id === s.sensorId)?.name ?? s.sensorId, points: s.points })),
    [series, sensors],
  );

  const setSelected = (ids: string[]) => update({ sensors: ids.join(",") || null });
  const addable = measuring.filter((s) => !selectedIds.includes(s.id));

  const exportCsv = () => {
    const base = series[0]?.points ?? [];
    downloadCsv(
      `sensor-${metric}-${range}`,
      [t("colDate"), t("colTime"), ...series.map((s) => `${nameOf(s.sensorId)} (${t(`common:unit.${metric}`)})`)],
      base.map((p, i) => [formatDate(p[0]), formatTime(p[0]), ...series.map((s) => (s.points[i] ? formatDecimal(s.points[i][1], metric === "co2" ? 0 : 1) : ""))]),
    );
  };

  return (
    <div className="fsh-enter">
      <PageToolbar title={t("title")} subtitle={t("subtitle")}>
        <FacilitySelect />
        <PillSelect
          label={t("gateway")}
          icon={Router}
          value={gatewayId}
          onChange={(v) => update({ gateway: v || null, sensors: null })}
          options={[{ value: "", label: t("allGateways") }, ...gateways.map((g) => ({ value: g.id, label: g.name }))]}
        />
      </PageToolbar>

      {isPending ? (
        <CardState kind="loading" />
      ) : pool.length === 0 ? (
        <CardState kind="empty" message={t("noSensors")} />
      ) : (
        <SensorStrip
          sensors={pool}
          metric={metric}
          selectedIds={selectedIds}
          onToggle={(id) =>
            setSelected(
              selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id].slice(-MAX_DEVICES),
            )
          }
        />
      )}

      <PanelCard
        className="mt-4"
        icon={Thermometer}
        tone="info"
        title={
          <PillSelect
            label={t("metric")}
            value={metric}
            onChange={(v) => update({ metric: v, sensors: null })}
            options={METRICS.map((m) => ({ value: m, label: `${t(`common:metric.${m}`)} (${t(`common:unit.${m}`)})` }))}
            className="border-transparent bg-transparent pl-0 text-[16px] font-semibold shadow-none"
          />
        }
        actions={<LiveBadge />}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("devices")} className="flex flex-wrap items-center gap-1.5">
            {selectedIds.map((id, i) => (
              <span
                key={id}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--color-primary-soft)] pl-2.5 pr-1 text-[12.5px] font-medium text-[var(--color-foreground)]"
              >
                <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: `var(--color-chart-${(i % 5) + 1})` }} />
                {nameOf(id)}
                <button
                  type="button"
                  aria-label={t("removeDevice", { name: nameOf(id) })}
                  onClick={() => setSelected(selectedIds.filter((x) => x !== id))}
                  className="grid size-6 place-items-center rounded-md text-[var(--color-muted-foreground)] hover:bg-[var(--color-card)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {addable.length > 0 && selectedIds.length < MAX_DEVICES && (
              <PillSelect
                label={t("addDevice")}
                icon={Cpu}
                value=""
                onChange={(v) => v && setSelected([...selectedIds, v])}
                options={[{ value: "", label: `+ ${t("addDevice")}` }, ...addable.map((s) => ({ value: s.id, label: s.name }))]}
                className="h-8"
              />
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PillSelect
              label={t("range")}
              icon={Clock}
              value={range}
              onChange={(v) => update({ range: v === "24h" ? null : v })}
              options={RANGES.map((r) => ({ value: r, label: t(RANGE_LABEL_KEY[r]) }))}
            />
            <PillSelect
              label={t("interval")}
              value={interval}
              onChange={(v) => update({ interval: v === "auto" ? null : v })}
              options={INTERVALS.map((i) => ({ value: i, label: t(INTERVAL_LABEL_KEY[i]) }))}
            />
            <SegmentedControl<View>
              label={t("view")}
              value={view}
              iconOnly
              onChange={(v) => update({ view: v === "line" ? null : v })}
              options={[
                { value: "line", label: t("viewLine"), icon: ChartLine },
                { value: "bar", label: t("viewBar"), icon: ChartColumn },
                { value: "table", label: t("viewTable"), icon: Table2 },
              ]}
            />
            <ExportButton onClick={exportCsv} disabled={series.length === 0} />
          </div>
        </div>
        <p className="mb-2 text-[11.5px] text-[var(--color-muted-foreground)]">
          {t("rangeLabel", { from: formatDateTime(fromMs), to: formatDateTime(toMs) })}
        </p>

        {selectedIds.length === 0 ? (
          <CardState kind="empty" message={t("pickDevice")} />
        ) : seriesQuery.isPending ? (
          <CardState kind="loading" />
        ) : view === "table" ? (
          <FullTable series={series} sensors={sensors} metric={metric} />
        ) : (
          <TimeSeriesChart
            series={chartSeries}
            kind={view}
            unit={t(`common:unit.${metric}`)}
            threshold={selectedIds[0] ? thresholdOf(selectedIds[0]) : undefined}
            thresholdLabel={t("thresholdBand")}
            zoomable
            area={view === "line" && chartSeries.length === 1}
            ariaLabel={`${t(`common:metric.${metric}`)} · ${selectedIds.map(nameOf).join(", ")}`}
            className="h-[380px]"
          />
        )}

        {series.length > 0 && (
          <div className="mt-4">
            <OverallTable series={series} sensors={sensors} metric={metric} thresholdOf={thresholdOf} />
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function SensorStrip({
  sensors,
  metric,
  selectedIds,
  onToggle,
}: {
  sensors: Device[];
  metric: SensorMetric;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation(["sensors", "common"]);
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 2xl:grid-cols-8">
      {sensors.map((s) => {
        const value = s.latest?.[metric];
        const measures = s.metrics?.includes(metric) ?? false;
        const selected = selectedIds.includes(s.id);
        return (
          <li key={s.id}>
            <button
              type="button"
              aria-pressed={selected}
              disabled={!measures}
              onClick={() => onToggle(s.id)}
              className={cn(
                "flex w-full flex-col gap-1 rounded-2xl border bg-[var(--color-card)] p-3 text-left shadow-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                "disabled:cursor-not-allowed disabled:opacity-50",
                selected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
              )}
            >
              <span className="flex items-center gap-1.5 text-[12px] font-semibold">
                <StatusDot status={s.status} />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="font-display text-[20px] font-semibold tabular-nums">
                {value !== undefined && s.status !== "offline" ? formatDecimal(value, metric === "co2" ? 0 : 1) : "—"}
                <span className="ml-0.5 text-[11px] font-medium text-[var(--color-muted-foreground)]">{t(`common:unit.${metric}`)}</span>
              </span>
              <span className="text-[11px] text-[var(--color-muted-foreground)]">{t(`common:status.${s.status}`)}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
