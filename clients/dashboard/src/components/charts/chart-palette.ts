import { useSyncExternalStore } from "react";

/**
 * Bridges the CSS design tokens (oklch, relative colors, accent classes)
 * into plain rgba strings ECharts can parse — zrender's color parser only
 * understands hex/rgb/hsl, so handing it `oklch(...)` would break hover
 * emphasis and gradients.
 *
 * A single MutationObserver on <html> watches `class` (dark mode, accent
 * swaps) and `style` (custom accent stops) and republishes the palette,
 * so every chart re-tones in lockstep with the rest of the UI.
 */

export type ChartPalette = {
  series: string[];
  primary: string;
  primarySoft: string;
  text: string;
  muted: string;
  grid: string;
  border: string;
  card: string;
  popover: string;
  danger: string;
  warning: string;
  success: string;
  info: string;
  font: string;
  isDark: boolean;
};

let probe: CanvasRenderingContext2D | null = null;

/** Resolve any CSS color the browser understands to rgba() via a 1px paint. */
function toRgba(cssColor: string, fallback: string): string {
  const value = cssColor.trim();
  if (!value) return fallback;
  if (!probe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = fallback;
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
}

function read(): ChartPalette {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => toRgba(style.getPropertyValue(name), fallback);
  return {
    series: [
      v("--chart-1", "#16a36a"),
      v("--chart-2", "#3b82f6"),
      v("--chart-3", "#f59e0b"),
      v("--chart-4", "#8b5cf6"),
      v("--chart-5", "#14b8a6"),
    ],
    primary: v("--primary", "#16a36a"),
    primarySoft: v("--primary-soft", "rgba(22,163,106,0.1)"),
    text: v("--foreground", "#111"),
    muted: v("--muted-foreground", "#666"),
    grid: v("--chart-grid", "rgba(0,0,0,0.08)"),
    border: v("--border", "#e5e5e5"),
    card: v("--card", "#fff"),
    popover: v("--popover", "#fff"),
    danger: v("--destructive", "#dc2626"),
    warning: v("--warning", "#d97706"),
    success: v("--success", "#16a34a"),
    info: v("--info", "#0284c7"),
    font: style.getPropertyValue("--font-sans").trim() || "sans-serif",
    isDark: document.documentElement.classList.contains("dark"),
  };
}

let cached: ChartPalette | null = null;
let cachedKey = "";
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function refresh() {
  const next = read();
  const key = JSON.stringify(next);
  if (key === cachedKey) return;
  cached = next;
  cachedKey = key;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!observer) {
    observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && observer) {
      observer.disconnect();
      observer = null;
    }
  };
}

function getSnapshot(): ChartPalette {
  if (!cached) refresh();
  return cached as ChartPalette;
}

export function useChartPalette(): ChartPalette {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** `rgba(r, g, b, a)` → same color at a new alpha (for area fills, bands). */
export function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, `rgba($1,$2,$3, ${alpha})`);
}
