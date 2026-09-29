/**
 * Deterministic pseudo-randomness for the mock layer. Everything is a pure
 * function of (seed string, number) so a refetch returns the same history
 * with only the newest points moving — which is what real telemetry does.
 */

/** FNV-1a 32-bit string hash. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, good-enough PRNG. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable value in [0, 1) for a (key, bucket) pair. */
export function unitNoise(key: string, bucket: number): number {
  return createRng(hashString(`${key}:${bucket}`))();
}

/**
 * Smooth noise in [-1, 1]: linearly interpolates `unitNoise` between bucket
 * boundaries so consecutive samples don't jump.
 */
export function smoothNoise(key: string, t: number, bucketMs: number): number {
  const b = Math.floor(t / bucketMs);
  const frac = (t - b * bucketMs) / bucketMs;
  const a = unitNoise(key, b);
  const c = unitNoise(key, b + 1);
  return (a + (c - a) * frac) * 2 - 1;
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
