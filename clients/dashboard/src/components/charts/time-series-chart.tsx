import { useMemo } from "react";
import type { LineSeriesOption } from "echarts/charts";
import type { MetricThreshold, SeriesPoint } from "@/api/industrial";
import { EChart, type EChartsOption } from "@/components/charts/echart";
import { useChartPalette, withAlpha } from "@/components/charts/chart-palette";
import { formatDateTime, formatNumber } from "@/lib/format";

export type TimeSeries = {
  name: string;
  points: SeriesPoint[];
};

export type TimeSeriesChartProps = {
  series: TimeSeries[];
  kind?: "line" | "bar";
  unit: string;
  ariaLabel: string;
  /** Draws the allowed band (min–max) and dashed limit lines. */
  threshold?: MetricThreshold;
  thresholdLabel?: string;
  /** Adds the drag-to-zoom slider under the plot. */
  zoomable?: boolean;
  /** Dense sparkline-ish layout: no legend, tight grid. */
  compact?: boolean;
  /** Fill under the first line series. */
  area?: boolean;
  /** Second series on its own right-hand axis (e.g. °C + % in one card). */
  dualAxis?: boolean;
  /** Unit of the second series when `dualAxis` is on. */
  secondaryUnit?: string;
  className?: string;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

/** Above this many points per series, switch bars to ECharts' large mode. */
const LARGE_BAR_THRESHOLD = 600;

export function TimeSeriesChart({
  series,
  kind = "line",
  unit,
  ariaLabel,
  threshold,
  thresholdLabel,
  zoomable = false,
  compact = false,
  area = false,
  dualAxis = false,
  secondaryUnit,
  className,
}: TimeSeriesChartProps) {
  const palette = useChartPalette();

  const option = useMemo<EChartsOption>(() => {
    const limitLines = [
      threshold?.min !== undefined ? { yAxis: threshold.min } : null,
      threshold?.max !== undefined ? { yAxis: threshold.max } : null,
    ].filter((x): x is { yAxis: number } => x !== null);
    const unitOf = (index: number) => (dualAxis && index === 1 ? (secondaryUnit ?? unit) : unit);
    const valueAxis = {
      type: "value" as const,
      scale: true,
      axisLabel: { formatter: (v: number) => formatNumber(v) },
    };

    return {
      animation: !compact,
      grid: compact
        ? { left: 36, right: dualAxis ? 36 : 12, top: 12, bottom: 24 }
        : { left: 48, right: dualAxis ? 48 : 20, top: 36, bottom: zoomable ? 64 : 32 },
      legend: compact || series.length < 2 ? { show: false } : { top: 0, left: 0 },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: kind === "bar" ? "shadow" : "line" },
        formatter: (raw: unknown) => {
          const items = (Array.isArray(raw) ? raw : [raw]) as {
            seriesName: string;
            seriesIndex: number;
            marker: string;
            value: SeriesPoint;
          }[];
          if (items.length === 0) return "";
          const head = `<div style="margin-bottom:4px;opacity:.7">${formatDateTime(items[0].value[0])}</div>`;
          const rows = items
            .map(
              (it) =>
                `<div>${it.marker}${escapeHtml(it.seriesName)} <b style="margin-left:8px">${formatNumber(it.value[1])} ${escapeHtml(unitOf(it.seriesIndex))}</b></div>`,
            )
            .join("");
          return head + rows;
        },
      },
      xAxis: { type: "time", axisLabel: { hideOverlap: true } },
      yAxis: dualAxis ? [valueAxis, { ...valueAxis, splitLine: { show: false } }] : valueAxis,
      dataZoom: zoomable
        ? [
            { type: "inside", throttle: 50 },
            { type: "slider", height: 22, bottom: 12 },
          ]
        : [],
      series: series.map((s, i) => {
        const isFirst = i === 0;
        const markLine: LineSeriesOption["markLine"] =
          isFirst && limitLines.length
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: palette.danger, type: "dashed", width: 1 },
                label: compact
                  ? { show: false }
                  : { color: palette.danger, formatter: (p) => `${formatNumber(Number(p.value))} ${unit}` },
                data: limitLines,
              }
            : undefined;
        const markArea: LineSeriesOption["markArea"] =
          isFirst && threshold?.min !== undefined && threshold.max !== undefined
            ? {
                silent: true,
                itemStyle: { color: withAlpha(palette.success, 0.06) },
                label: { show: false },
                data: [[{ yAxis: threshold.min, name: thresholdLabel ?? "" }, { yAxis: threshold.max }]],
              }
            : undefined;
        const marks = { markLine, markArea };
        if (kind === "bar") {
          return {
            type: "bar" as const,
            name: s.name,
            data: s.points,
            barMaxWidth: 14,
            large: s.points.length > LARGE_BAR_THRESHOLD,
            itemStyle: { borderRadius: [3, 3, 0, 0] },
            ...marks,
          };
        }
        return {
          type: "line" as const,
          name: s.name,
          data: s.points,
          yAxisIndex: dualAxis && i === 1 ? 1 : 0,
          showSymbol: false,
          smooth: 0.25,
          sampling: "lttb" as const,
          lineStyle: { width: compact ? 1.75 : 2, type: i === 1 && compact ? ("dashed" as const) : ("solid" as const) },
          areaStyle:
            area && isFirst
              ? {
                  color: {
                    type: "linear" as const,
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                      { offset: 0, color: withAlpha(palette.series[0], 0.22) },
                      { offset: 1, color: withAlpha(palette.series[0], 0) },
                    ],
                  },
                }
              : undefined,
          ...marks,
        };
      }),
    };
  }, [series, kind, unit, secondaryUnit, dualAxis, threshold, thresholdLabel, zoomable, compact, area, palette]);

  return <EChart option={option} ariaLabel={ariaLabel} className={className} />;
}
