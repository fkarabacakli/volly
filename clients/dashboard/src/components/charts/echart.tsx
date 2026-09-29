import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, GaugeChart, LineChart, PieChart } from "echarts/charts";
import type { BarSeriesOption, GaugeSeriesOption, LineSeriesOption, PieSeriesOption } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import type {
  DataZoomComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import { useChartPalette, type ChartPalette } from "@/components/charts/chart-palette";
import { cn } from "@/lib/cn";

// Tree-shaken registration: only the chart types and components the app
// uses. Add new ones here (e.g. HeatmapChart for a temperature heat map).
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GaugeChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  CanvasRenderer,
]);

export type EChartsOption = echarts.ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | GaugeSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | MarkLineComponentOption
  | MarkAreaComponentOption
>;

function buildTheme(p: ChartPalette) {
  const axis = {
    axisLine: { lineStyle: { color: p.border } },
    axisTick: { lineStyle: { color: p.border } },
    axisLabel: { color: p.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: p.grid, type: "dashed" as const } },
    nameTextStyle: { color: p.muted },
  };
  return {
    color: p.series,
    backgroundColor: "transparent",
    textStyle: { fontFamily: p.font, color: p.text },
    tooltip: {
      backgroundColor: p.popover,
      borderColor: p.border,
      borderWidth: 1,
      textStyle: { color: p.text, fontSize: 12 },
      extraCssText: "border-radius: 10px; box-shadow: 0 8px 24px -12px rgba(0,0,0,0.25);",
    },
    legend: { textStyle: { color: p.muted }, icon: "roundRect", itemWidth: 10, itemHeight: 10 },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    dataZoom: {
      borderColor: p.border,
      fillerColor: p.primarySoft,
      handleStyle: { color: p.card, borderColor: p.primary },
      textStyle: { color: p.muted },
      dataBackground: { lineStyle: { color: p.grid }, areaStyle: { color: p.grid } },
    },
  };
}

export type EChartProps = {
  option: EChartsOption;
  /** Accessible summary of what the chart shows (it's a canvas). */
  ariaLabel: string;
  className?: string;
};

/**
 * Thin ECharts host. Owns init / resize / dispose; re-initialises when the
 * palette changes (light/dark, accent) because ECharts themes are fixed at
 * init time. Options are replaced wholesale (`notMerge`) so removing a
 * series actually removes it.
 */
export function EChart({ option, ariaLabel, className }: EChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const palette = useChartPalette();
  const theme = useMemo(() => buildTheme(palette), [palette]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const chart = echarts.init(host, theme, { renderer: "canvas" });
    chartRef.current = chart;
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(host);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true });
  }, [option, theme]);

  return <div ref={hostRef} role="img" aria-label={ariaLabel} className={cn("w-full", className)} />;
}
