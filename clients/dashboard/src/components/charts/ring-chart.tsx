import { useMemo, type ReactNode } from "react";
import { EChart, type EChartsOption } from "@/components/charts/echart";
import { useChartPalette } from "@/components/charts/chart-palette";
import { cn } from "@/lib/cn";

export type RingSlice = { name: string; value: number; color: string };

/**
 * Donut with an HTML center label (the label is regular DOM so it picks up
 * the app font, i18n formatting and screen readers).
 */
export function RingChart({
  slices,
  ariaLabel,
  children,
  className,
}: {
  slices: RingSlice[];
  ariaLabel: string;
  children?: ReactNode;
  className?: string;
}) {
  const palette = useChartPalette();
  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["74%", "90%"],
          startAngle: 90,
          padAngle: 1.5,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          emphasis: { scale: false },
          itemStyle: { borderRadius: 6, borderColor: palette.card, borderWidth: 0 },
          data: slices.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
        },
      ],
    }),
    [slices, palette.card],
  );
  return (
    <div className={cn("relative", className)}>
      <EChart option={option} ariaLabel={ariaLabel} className="h-full" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
