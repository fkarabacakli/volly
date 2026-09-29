import { cn } from "@/lib/cn";

/**
 * Volly isometric-cube mark. Faces are tinted from the brand ramp so the
 * logo follows the selected accent; the inner hexagon stays white on both
 * themes because it always sits on the saturated cube.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <path d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25z" fill="var(--brand-600)" />
      <path d="M16 2.5 28 9.25 16 16 4 9.25z" fill="var(--brand-400)" />
      <path d="M16 16v13.5L4 22.75V9.25z" fill="var(--brand-800)" />
      <path
        d="M16 9.5 21.5 12.6v6.2L16 21.9l-5.5-3.1v-6.2z"
        fill="none"
        stroke="white"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
