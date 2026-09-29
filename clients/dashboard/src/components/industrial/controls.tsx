import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, Download, Warehouse, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFacility } from "@/hooks/use-facility";
import { cn } from "@/lib/cn";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-background)]";

export type SelectOption = { value: string; label: string };

/**
 * PillSelect — the Behance-style dropdown pill ("Gateway 01 ▾"). A Radix
 * menu rather than a native <select>, so the open list follows the theme
 * (emerald selection, rounded popover) instead of the OS picker; Radix
 * still provides arrow-key navigation, typeahead and Escape.
 */
export function PillSelect({
  label,
  value,
  options,
  onChange,
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  icon?: LucideIcon;
  className?: string;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            "group inline-flex h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-3 pr-2.5 shadow-xs",
            "text-[13px] font-medium text-[var(--color-foreground)]",
            "transition-colors duration-[var(--duration-fast)] hover:border-[oklch(from_var(--color-primary)_l_c_h_/_0.4)]",
            "data-[state=open]:border-[var(--color-primary)] data-[state=open]:ring-3 data-[state=open]:ring-[var(--color-primary-soft)]",
            FOCUS_RING,
            className,
          )}
        >
          {Icon && <Icon aria-hidden className="size-4 shrink-0 text-[var(--color-primary)]" />}
          <span className="min-w-0 truncate">{selected?.label ?? "—"}</span>
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-[var(--duration-default)] group-data-[state=open]:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[min(360px,60vh)] rounded-xl p-1 shadow-[var(--shadow-md)]"
      >
        {options.map((o) => {
          const active = o.value === value;
          return (
            <DropdownMenuItem
              key={o.value}
              role="menuitemradio"
              aria-checked={active}
              onSelect={() => onChange(o.value)}
              className={cn(
                "!mx-0 rounded-lg !py-1.5 text-[13px]",
                active &&
                  "bg-[var(--color-primary-soft)] font-semibold !text-[var(--color-primary)] data-[highlighted]:bg-[var(--color-primary-soft)]",
              )}
            >
              <span className="flex-1 truncate">{o.label}</span>
              <Check aria-hidden className={cn("size-3.5 shrink-0", active ? "opacity-100" : "opacity-0")} />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FacilitySelect() {
  const { t } = useTranslation();
  const { facilityId, facilities, setFacilityId } = useFacility();
  if (facilities.length === 0) return null;
  return (
    <PillSelect
      label={t("facility.select")}
      icon={Warehouse}
      value={facilityId}
      onChange={setFacilityId}
      options={facilities.map((f) => ({ value: f.id, label: f.name }))}
    />
  );
}

export type SegmentOption<T extends string> = { value: T; label: string; icon?: LucideIcon };

/** Radio-group of pill buttons (chart ↔ bar ↔ table, time ranges). */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  iconOnly = false,
}: {
  label: string;
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  iconOnly?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex h-9 items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] p-0.5"
    >
      {options.map((o) => {
        const Icon = o.icon;
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={iconOnly ? o.label : undefined}
            title={iconOnly ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium",
              "transition-colors duration-[var(--duration-fast)]",
              FOCUS_RING,
              active
                ? "bg-[var(--color-card)] text-[var(--color-primary)] shadow-xs"
                : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
            )}
          >
            {Icon && <Icon aria-hidden className="size-4" />}
            {!iconOnly && o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Toggle chip (map layers, device chips). */
export function ChipToggle({
  pressed,
  onClick,
  children,
  icon: Icon,
  count,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: LucideIcon;
  count?: number;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium",
        "transition-colors duration-[var(--duration-fast)]",
        FOCUS_RING,
        pressed
          ? "border-transparent bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
          : "border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-[var(--color-card)] px-1.5 text-[10.5px] tabular-nums text-[var(--color-muted-foreground)]">
          {count}
        </span>
      )}
    </button>
  );
}

export function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={t("actions.exportCsv")}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 shadow-xs",
        "text-[13px] font-medium text-[var(--color-foreground)] hover:bg-[var(--color-accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        FOCUS_RING,
      )}
    >
      <Download aria-hidden className="size-4 text-[var(--color-primary)]" />
      {t("actions.export")}
    </button>
  );
}
