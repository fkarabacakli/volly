import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { Layers, MapPinned } from "lucide-react";
import type { Device, DeviceKind } from "@/api/industrial";
import { FacilityMap } from "@/components/facility-map/facility-map";
import { ChipToggle, FacilitySelect } from "@/components/industrial/controls";
import { DEVICE_KIND_META, DEVICE_KINDS } from "@/components/industrial/device-meta";
import { CardState, LiveBadge, StatusDot } from "@/components/industrial/indicators";
import { PageToolbar, PanelCard } from "@/components/industrial/panel";
import { useFacility } from "@/hooks/use-facility";
import { useFacilityLayout } from "@/hooks/use-facility-layout";
import { cn } from "@/lib/cn";
import { DeviceDetailPanel } from "@/pages/industrial/device-detail-panel";

const DEVICE_PARAM = "device";

/**
 * Canlı İzleme — the full-size interactive plan. Layer chips filter device
 * kinds; the selection lives in `?device=` so a link opens straight on it.
 */
export function MonitoringPage() {
  const { t } = useTranslation(["monitoring", "common"]);
  const { facilityId } = useFacility();
  const { layout, alerts } = useFacilityLayout(facilityId);
  const [params, setParams] = useSearchParams();
  const [hiddenKinds, setHiddenKinds] = useState<DeviceKind[]>([]);

  const devices = useMemo(() => layout.data?.devices ?? [], [layout.data]);
  const selectedId = params.get(DEVICE_PARAM);
  const selected = devices.find((d) => d.id === selectedId) ?? null;
  const visibleKinds = DEVICE_KINDS.filter((k) => !hiddenKinds.includes(k));

  const select = (device: Device | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (device) next.set(DEVICE_PARAM, device.id);
        else next.delete(DEVICE_PARAM);
        return next;
      },
      { replace: true },
    );

  const toggleKind = (kind: DeviceKind) =>
    setHiddenKinds((cur) => (cur.includes(kind) ? cur.filter((k) => k !== kind) : [...cur, kind]));

  return (
    <div className="fsh-enter">
      <PageToolbar title={t("title")} subtitle={t("subtitle")}>
        <LiveBadge />
        <FacilitySelect />
      </PageToolbar>

      <div role="group" aria-label={t("layers")} className="mb-4 flex flex-wrap items-center gap-2">
        <Layers aria-hidden className="mr-1 size-4 text-[var(--color-muted-foreground)]" />
        {DEVICE_KINDS.map((kind) => (
          <ChipToggle
            key={kind}
            pressed={!hiddenKinds.includes(kind)}
            onClick={() => toggleKind(kind)}
            icon={DEVICE_KIND_META[kind].icon}
            count={devices.filter((d) => d.kind === kind).length}
          >
            {t(`common:deviceKindPlural.${kind}`)}
          </ChipToggle>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative h-[calc(100dvh-15rem)] min-h-[480px] overflow-hidden rounded-2xl border border-[var(--color-border)]">
          {layout.data ? (
            <FacilityMap
              plan={layout.data.plan}
              devices={devices}
              alerts={alerts.data}
              visibleKinds={visibleKinds}
              selectedId={selectedId}
              onSelect={select}
              interactive
              className="absolute inset-0 rounded-none"
            />
          ) : (
            <CardState kind={layout.isError ? "error" : "loading"} />
          )}
        </div>

        <PanelCard
          title={selected ? t("detail") : t("devices")}
          icon={MapPinned}
          className="lg:h-[calc(100dvh-15rem)] lg:min-h-[480px]"
          bodyClassName="overflow-y-auto"
        >
          {selected && layout.data ? (
            <DeviceDetailPanel
              device={selected}
              plan={layout.data.plan}
              devices={devices}
              alerts={alerts.data ?? []}
              onClose={() => select(null)}
            />
          ) : (
            <DeviceList devices={devices.filter((d) => visibleKinds.includes(d.kind))} onSelect={select} />
          )}
        </PanelCard>
      </div>
    </div>
  );
}

function DeviceList({ devices, onSelect }: { devices: Device[]; onSelect: (d: Device) => void }) {
  const { t } = useTranslation(["monitoring", "common"]);
  return (
    <>
      <p className="mb-3 text-[12px] text-[var(--color-muted-foreground)]">{t("selectHint")}</p>
      {DEVICE_KINDS.map((kind) => {
        const items = devices.filter((d) => d.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind} className="mb-3">
            <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              {t(`common:deviceKindPlural.${kind}`)}
            </h3>
            <ul>
              {items.map((d) => {
                const Icon = DEVICE_KIND_META[d.kind].icon;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(d)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px]",
                        "hover:bg-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
                      )}
                    >
                      <StatusDot status={d.status} />
                      <Icon aria-hidden className="size-4 shrink-0 text-[var(--color-muted-foreground)]" />
                      <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                      <span className="shrink-0 text-[11px] text-[var(--color-muted-foreground)]">
                        {d.locationCode ?? d.zoneId ?? "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </>
  );
}
