import type { MetricThreshold, SensorMetric, SeriesPoint } from "../types";
import { DAY_MS, HOUR_MS, MINUTE_MS, round, smoothNoise, unitNoise } from "./random";

/** Cold-chain + ambient limits. Shared with the UI so charts draw the band. */
export const METRIC_THRESHOLDS: Record<"cold" | "ambient", Record<SensorMetric, MetricThreshold>> = {
  cold: {
    temperature: { min: 2, max: 8 },
    humidity: { min: 40, max: 75 },
    co2: { max: 1000 },
  },
  ambient: {
    temperature: { min: 10, max: 28 },
    humidity: { min: 30, max: 65 },
    co2: { max: 1000 },
  },
};

type Profile = { base: number; amp: number; periodMs: number; noise: number; spike: number };

const PROFILES: Record<"cold" | "ambient", Record<SensorMetric, Profile>> = {
  cold: {
    temperature: { base: 4.2, amp: 1.0, periodMs: 6 * HOUR_MS, noise: 0.15, spike: 4.5 },
    humidity: { base: 60, amp: 5, periodMs: 8 * HOUR_MS, noise: 1.2, spike: 12 },
    co2: { base: 480, amp: 60, periodMs: 12 * HOUR_MS, noise: 25, spike: 300 },
  },
  ambient: {
    temperature: { base: 18.5, amp: 3.2, periodMs: DAY_MS, noise: 0.6, spike: 9 },
    humidity: { base: 46, amp: 7, periodMs: DAY_MS, noise: 3, spike: 18 },
    co2: { base: 560, amp: 170, periodMs: 10 * HOUR_MS, noise: 40, spike: 520 },
  },
};

/** One in ~14 hours carries an excursion, so threshold breaches show up in history. */
const SPIKE_ODDS = 1 / 14;

/**
 * Reading for a sensor at an instant. Pure: the same (sensor, metric, t)
 * always yields the same value, so history is stable across refetches.
 */
export function sampleMetric(
  sensorId: string,
  metric: SensorMetric,
  isCold: boolean,
  t: number,
): number {
  const p = PROFILES[isCold ? "cold" : "ambient"][metric];
  const key = `${sensorId}:${metric}`;
  const phase = unitNoise(key, 0) * p.periodMs;
  const wave = Math.sin(((t + phase) / p.periodMs) * Math.PI * 2);
  const noise = smoothNoise(key, t, 30 * MINUTE_MS) * p.noise;
  const hour = Math.floor(t / HOUR_MS);
  const isSpikeHour = unitNoise(`${key}:spike`, hour) < SPIKE_ODDS;
  // Bell-shaped excursion inside the spike hour rather than a step.
  const inHour = (t - hour * HOUR_MS) / HOUR_MS;
  const spike = isSpikeHour ? Math.sin(inHour * Math.PI) * p.spike : 0;
  const digits = metric === "co2" ? 0 : 1;
  return round(p.base + wave * p.amp + noise + spike, digits);
}

/** Cap so a year at 1-minute interval can't freeze the tab. */
const MAX_POINTS = 6000;

export function sampleSeries(
  sensorId: string,
  metric: SensorMetric,
  isCold: boolean,
  fromMs: number,
  toMs: number,
  intervalMin: number,
): SeriesPoint[] {
  const step = Math.max(intervalMin * MINUTE_MS, (toMs - fromMs) / MAX_POINTS);
  const start = Math.ceil(fromMs / step) * step;
  const points: SeriesPoint[] = [];
  for (let t = start; t <= toMs; t += step) {
    points.push([t, sampleMetric(sensorId, metric, isCold, t)]);
  }
  return points;
}
