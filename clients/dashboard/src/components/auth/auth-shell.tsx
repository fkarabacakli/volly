import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { previewLayout } from "@/api/industrial";
import { BrandLogo } from "@/components/brand-logo";
import { FacilityMap } from "@/components/facility-map/facility-map";
import { BRAND_NAME } from "@/lib/brand";
import { formatPercent } from "@/lib/format";

// ────────────────────────────────────────────────────────────────────────
// AuthShell — split chrome for unauthenticated pages (login, forgot /
// reset password, confirm email): the form on a calm canvas on the left,
// and on wide screens a brand panel on the right that previews the live
// facility map — the product's own visual language, not a stock photo.
// ────────────────────────────────────────────────────────────────────────

/**
 * Display headline. `lead`/`accent`/`trail` compose; the accent word takes
 * the brand colour.
 */
export function AuthHeadline({
  lead,
  accent,
  trail,
}: {
  lead?: string;
  accent?: string;
  trail?: string;
}) {
  return (
    <h1 className="mb-1.5 font-display text-[24px] font-semibold tracking-tight text-[var(--color-foreground)]">
      {lead && <>{lead} </>}
      {accent && <span className="text-[var(--color-primary)]">{accent}</span>}
      {trail && <>{trail}</>}
    </h1>
  );
}

const UPTIME_PCT = 99.9;

export function AuthShell({
  children,
  footer,
}: {
  /** Card body */
  children: ReactNode;
  /** Optional row beneath the card — e.g. "Back to sign in" link */
  footer?: ReactNode;
}) {
  const { t } = useTranslation(["auth", "common"]);
  return (
    <div className="grid min-h-screen bg-[var(--color-background)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2.5">
          <BrandLogo className="size-9" />
          <div>
            <p className="font-display text-[18px] font-bold leading-none tracking-tight">{BRAND_NAME}</p>
            <p className="mt-1 text-[11px] font-medium text-[var(--color-muted-foreground)]">{t("common:brand.tagline")}</p>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] fsh-enter fsh-enter-1">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[0_1px_3px_oklch(0_0_0_/_0.04),0_12px_32px_-12px_oklch(0_0_0_/_0.12)]">
              <div className="px-6 py-7 sm:px-8 sm:py-9">{children}</div>
            </div>

            {footer && (
              <div className="mt-6 text-center text-[12.5px] text-[var(--color-muted-foreground)]">{footer}</div>
            )}

            <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
              <ShieldCheck className="size-3" aria-hidden />
              <span>{t("secureNote")}</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[var(--color-muted-foreground)]">{t("common:brand.pillars")}</p>
      </div>

      <BrandPanel />
    </div>
  );
}

function BrandPanel() {
  const { t } = useTranslation(["auth", "common"]);
  const layout = useMemo(() => previewLayout(), []);
  const sensors = layout.devices.filter((d) => d.kind === "sensor").length;
  const cameras = layout.devices.filter((d) => d.kind === "camera").length;

  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-primary-soft)] lg:flex lg:flex-col"
    >
      <div className="px-12 pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{t("heroEyebrow")}</p>
        <h2 className="mt-3 max-w-[480px] font-display text-[30px] font-semibold leading-tight tracking-tight">
          {t("heroTitle")}
        </h2>
        <p className="mt-3 max-w-[440px] text-[14px] leading-relaxed text-[var(--color-muted-foreground)]">{t("heroBody")}</p>
        <dl className="mt-7 flex gap-8">
          <Stat value={String(sensors)} label={t("heroStatSensors")} />
          <Stat value={String(cameras)} label={t("heroStatCameras")} />
          <Stat value={formatPercent(UPTIME_PCT, 1)} label={t("heroStatUptime")} />
        </dl>
      </div>
      <div className="relative mx-10 mb-10 mt-8 flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-2 shadow-lg">
        <FacilityMap plan={layout.plan} devices={layout.devices} className="absolute inset-2" />
      </div>
    </aside>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-[26px] font-semibold leading-none tracking-tight text-[var(--color-foreground)]">{value}</dd>
      <dd className="mt-1 text-[12px] text-[var(--color-muted-foreground)]">{label}</dd>
    </div>
  );
}
