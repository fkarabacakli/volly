import { currentLocale } from "@/i18n";

/**
 * Locale-aware formatters. They read the active UI language at call time;
 * components that use them also call `useTranslation()`, which re-renders
 * them on a language switch, so output never goes stale.
 */

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value);
}

/** One decimal, e.g. 4,2 (tr) / 4.2 (en). */
export function formatDecimal(value: number, digits = 1): string {
  return formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** %78 (tr) / 78% (en). Input is 0–100. */
export function formatPercent(value: number, maxDigits = 0): string {
  return formatNumber(value / 100, { style: "percent", maximumFractionDigits: maxDigits });
}

export function formatSigned(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${formatDecimal(Math.abs(value), digits)}`;
}

export function formatTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(currentLocale(), { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat(currentLocale(), { day: "2-digit", month: "short", year: "2-digit" }).format(new Date(value));
}

export function formatDateTime(value: string | number | Date): string {
  return new Intl.DateTimeFormat(currentLocale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

/** "5 dakika önce" / "5 minutes ago". */
export function formatRelative(value: string | number | Date, now = Date.now()): string {
  let delta = (new Date(value).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(currentLocale(), { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(delta) < size) return rtf.format(Math.round(delta), unit);
    delta /= size;
  }
  return rtf.format(Math.round(delta), "year");
}
