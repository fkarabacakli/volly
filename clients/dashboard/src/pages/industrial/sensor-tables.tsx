import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Device, MetricThreshold, SensorMetric, SensorSeries } from "@/api/industrial";
import { cn } from "@/lib/cn";
import { formatDate, formatDecimal, formatTime } from "@/lib/format";
import { seriesStats } from "@/pages/industrial/sensor-query";

const ROW_HEIGHT_PX = 36;

function digitsFor(metric: SensorMetric) {
  return metric === "co2" ? 0 : 1;
}

/** Behance "Overall Measurements": Avg / Max / Min per selected device. */
export function OverallTable({
  series,
  sensors,
  metric,
  thresholdOf,
}: {
  series: SensorSeries[];
  sensors: Device[];
  metric: SensorMetric;
  thresholdOf: (sensorId: string) => MetricThreshold;
}) {
  const { t } = useTranslation(["sensors", "common"]);
  const unit = t(`common:unit.${metric}`);
  const stats = series.map((s) => ({ id: s.sensorId, ...seriesStats(s.points, thresholdOf(s.sensorId)) }));
  const nameOf = (id: string) => sensors.find((d) => d.id === id)?.name ?? id;
  const rows = [
    { key: "avg", label: t("common:stats.avg"), pick: (x: (typeof stats)[number]) => x.avg },
    { key: "max", label: t("common:stats.max"), pick: (x: (typeof stats)[number]) => x.max },
    { key: "min", label: t("common:stats.min"), pick: (x: (typeof stats)[number]) => x.min },
  ];

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full text-[12.5px]">
        <caption className="bg-[var(--color-muted)] px-3 py-2 text-left text-[13px] font-semibold">{t("overall")}</caption>
        <thead className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-semibold">{t(`common:metric.${metric}`)} ({unit})</th>
            {stats.map((s) => (
              <th key={s.id} scope="col" className="px-3 py-2 text-right font-semibold">{nameOf(s.id)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="px-3 py-2 text-left font-medium">{r.label}</th>
              {stats.map((s) => (
                <td key={s.id} className="px-3 py-2 text-right tabular-nums">{formatDecimal(r.pick(s), digitsFor(metric))}</td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="px-3 py-2 text-left font-medium">{t("threshold")}</th>
            {stats.map((s) => (
              <td
                key={s.id}
                className={cn("px-3 py-2 text-right", s.breaches > 0 ? "font-semibold text-[var(--color-destructive)]" : "text-[var(--color-muted-foreground)]")}
              >
                {t("breaches", { count: s.breaches })}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Behance "Full Measurements": every sample, one column per device (virtualised). */
export function FullTable({
  series,
  sensors,
  metric,
}: {
  series: SensorSeries[];
  sensors: Device[];
  metric: SensorMetric;
}) {
  const { t } = useTranslation(["sensors", "common"]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Series share timestamps (same window + interval); newest first reads like a log.
  const rows = useMemo(() => {
    const base = series[0]?.points ?? [];
    return base
      .map((p, i) => ({ ts: p[0], values: series.map((s) => s.points[i]?.[1]) }))
      .reverse();
  }, [series]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT_PX,
    overscan: 12,
  });
  const nameOf = (id: string) => sensors.find((d) => d.id === id)?.name ?? id;
  const cols = `3.5rem 7rem 5rem repeat(${Math.max(series.length, 1)}, minmax(6rem, 1fr))`;

  return (
    <div role="table" aria-label={t("full")} className="rounded-xl border border-[var(--color-border)]">
      <p aria-hidden className="bg-[var(--color-muted)] px-3 py-2 text-[13px] font-semibold">{t("full")}</p>
      <div
        role="row"
        className="grid border-b border-[var(--color-border)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]"
        style={{ gridTemplateColumns: cols }}
      >
        <span role="columnheader">{t("colNo")}</span>
        <span role="columnheader">{t("colDate")}</span>
        <span role="columnheader">{t("colTime")}</span>
        {series.map((s) => (
          <span role="columnheader" key={s.sensorId} className="truncate text-right">
            {nameOf(s.sensorId)} ({t(`common:unit.${metric}`)})
          </span>
        ))}
      </div>
      <div ref={scrollRef} role="rowgroup" className="h-[420px] overflow-y-auto">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((v) => {
            const r = rows[v.index];
            return (
              <div
                key={r.ts}
                role="row"
                className="absolute inset-x-0 grid items-center border-b border-[var(--color-border)] px-3 text-[12.5px] tabular-nums"
                style={{ gridTemplateColumns: cols, height: v.size, transform: `translateY(${v.start}px)` }}
              >
                <span role="cell" className="text-[var(--color-muted-foreground)]">{String(v.index + 1).padStart(2, "0")}</span>
                <span role="cell">{formatDate(r.ts)}</span>
                <span role="cell">{formatTime(r.ts)}</span>
                {r.values.map((val, i) => (
                  <span role="cell" key={i} className="text-right">
                    {val !== undefined ? formatDecimal(val, digitsFor(metric)) : "—"}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
