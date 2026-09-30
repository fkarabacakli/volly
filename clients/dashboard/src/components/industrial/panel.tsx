import { useId, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * PanelCard — the industrial card: flat white sheet, 20px radius, a hairline
 * edge and no resting shadow. The title carries a plain line icon (no tinted
 * chip) and an optional trailing action slot ("Tümünü gör →", export, filters).
 */
export function PanelCard({
  title,
  icon: Icon,
  tone = "primary",
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "info" | "danger" | "warning";
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 flex-col rounded-[20px] border border-[var(--color-border)] bg-[var(--color-card)]",
        className,
      )}
    >
      <header className="flex items-center gap-2.5 px-5 pb-3 pt-5">
        {Icon && <Icon aria-hidden strokeWidth={1.6} className={cn("size-[18px] shrink-0", TONE_TEXT[tone])} />}
        <h2 id={headingId} className="min-w-0 truncate text-[15px] font-medium tracking-[-0.01em] text-[var(--color-foreground)]">
          {title}
        </h2>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={cn("min-h-0 flex-1 px-5 pb-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Header icon ink — neutral by default; colour only when the card means it. */
const TONE_TEXT = {
  primary: "text-[var(--color-muted-foreground)]",
  info: "text-[var(--color-info)]",
  danger: "text-[var(--color-destructive)]",
  warning: "text-[var(--color-warning)]",
} as const;

const TONE_CLASSES = {
  primary: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  info: "bg-[oklch(from_var(--color-info)_l_c_h_/_0.12)] text-[var(--color-info)]",
  danger: "bg-[oklch(from_var(--color-destructive)_l_c_h_/_0.12)] text-[var(--color-destructive)]",
  warning: "bg-[oklch(from_var(--color-warning)_l_c_h_/_0.14)] text-[var(--color-warning)]",
} as const;

export function ToneIcon({
  icon: Icon,
  tone = "primary",
  className,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONE_CLASSES;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-full", TONE_CLASSES[tone], className)}>
      <Icon className="size-4" />
    </span>
  );
}

/** Big-number tile (cameras online, open alerts…). */
export function KpiTile({
  icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: keyof typeof TONE_CLASSES;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <ToneIcon icon={icon} tone={tone} className="size-10" />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-medium text-[var(--color-muted-foreground)]">{label}</p>
        <p className="font-display text-[22px] font-semibold leading-tight tracking-tight">{value}</p>
        {hint && <p className="truncate text-[11px] text-[var(--color-muted-foreground)]">{hint}</p>}
      </div>
    </div>
  );
}

/** Page heading row + trailing controls (facility / device selectors). */
export function PageToolbar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div className="mr-auto min-w-0">
        <h1 className="font-display text-[26px] font-medium leading-tight tracking-[-0.02em] text-[var(--color-foreground)]">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-[var(--color-muted-foreground)]">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
