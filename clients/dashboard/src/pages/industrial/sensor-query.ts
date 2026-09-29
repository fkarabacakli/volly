import type { MetricThreshold, SensorMetric, SeriesPoint } from "@/api/industrial";

/** Time windows offered by the sensor + report pages. */
export const RANGES = ["1h", "6h", "24h", "7d", "30d"] as const;
export type RangeKey = (typeof RANGES)[number];

export const INTERVALS = ["auto", "1", "5", "15", "60", "1440"] as const;
export type IntervalKey = (typeof INTERVALS)[number];

export const METRICS: SensorMetric[] = ["temperature", "humidity", "co2"];

const HOUR_MS = 60 * 60 * 1000;

export const RANGE_MS: Record<RangeKey, number> = {
  "1h": HOUR_MS,
  "6h": 6 * HOUR_MS,
  "24h": 24 * HOUR_MS,
  "7d": 7 * 24 * HOUR_MS,
  "30d": 30 * 24 * HOUR_MS,
};

/** "Otomatik" keeps every range at a few hundred points. */
const AUTO_INTERVAL_MIN: Record<RangeKey, number> = {
  "1h": 1,
  "6h": 5,
  "24h": 15,
  "7d": 60,
  "30d": 60,
};

export function intervalMinutes(range: RangeKey, interval: IntervalKey): number {
  return interval === "auto" ? AUTO_INTERVAL_MIN[range] : Number(interval);
}

export function isRange(v: string | null): v is RangeKey {
  return v !== null && (RANGES as readonly string[]).includes(v);
}

export function isInterval(v: string | null): v is IntervalKey {
  return v !== null && (INTERVALS as readonly string[]).includes(v);
}

export function isMetric(v: string | null): v is SensorMetric {
  return v !== null && (METRICS as string[]).includes(v);
}

/**
 * Window end snapped to the interval so the query key only changes when a
 * new bucket exists (otherwise every render would refetch).
 */
export function windowEnd(intervalMin: number, now = Date.now()): number {
  const step = intervalMin * 60_000;
  return Math.floor(now / step) * step;
}

export type SeriesStats = { avg: number; max: number; min: number; breaches: number };

export function seriesStats(points: SeriesPoint[], threshold?: MetricThreshold): SeriesStats {
  if (points.length === 0) return { avg: 0, max: 0, min: 0, breaches: 0 };
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  let breaches = 0;
  for (const [, v] of points) {
    sum += v;
    if (v > max) max = v;
    if (v < min) min = v;
    if ((threshold?.max !== undefined && v > threshold.max) || (threshold?.min !== undefined && v < threshold.min)) breaches++;
  }
  return { avg: sum / points.length, max, min, breaches };
}

export const RANGE_LABEL_KEY: Record<RangeKey, "range1h" | "range6h" | "range24h" | "range7d" | "range30d"> = {
  "1h": "range1h",
  "6h": "range6h",
  "24h": "range24h",
  "7d": "range7d",
  "30d": "range30d",
};

export const INTERVAL_LABEL_KEY: Record<
  IntervalKey,
  "intervalAuto" | "interval1m" | "interval5m" | "interval15m" | "interval1h" | "interval1d"
> = {
  auto: "intervalAuto",
  "1": "interval1m",
  "5": "interval5m",
  "15": "interval15m",
  "60": "interval1h",
  "1440": "interval1d",
};
