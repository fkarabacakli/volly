import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, PackageCheck, PackageOpen, Rows3, Search } from "lucide-react";
import { getFacilityLayout, getRacks, getStockSummary, type Rack, type RackQuery } from "@/api/industrial";
import { StockCard } from "@/components/industrial/cards/stock-card";
import { ChipToggle, ExportButton, FacilitySelect, PillSelect } from "@/components/industrial/controls";
import { CardState } from "@/components/industrial/indicators";
import { KpiTile, PageToolbar, PanelCard } from "@/components/industrial/panel";
import { useFacility } from "@/hooks/use-facility";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import { formatDateTime, formatNumber, formatPercent, formatRelative } from "@/lib/format";

const HIGH_PCT = 90;
const LOW_PCT = 50;

/**
 * Stok Yönetimi — zone/rack occupancy. Filters live in the URL
 * (`zone`, `occupancy`, `q`) so a filtered view is a shareable link.
 */
export function InventoryPage() {
  const { t } = useTranslation(["inventory", "overview", "common"]);
  const { facilityId } = useFacility();
  const [params, setParams] = useSearchParams();
  const zoneId = params.get("zone") ?? undefined;
  const occupancyParam = params.get("occupancy");
  const occupancy: RackQuery["occupancy"] = occupancyParam === "high" || occupancyParam === "low" ? occupancyParam : undefined;
  const search = params.get("q") ?? "";

  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  const { data: layout } = useQuery({
    queryKey: ["industrial", "layout", { facilityId }],
    queryFn: () => getFacilityLayout(facilityId),
  });
  const { data: stock } = useQuery({
    queryKey: ["industrial", "stock", { facilityId }],
    queryFn: () => getStockSummary(facilityId),
  });
  const racksQuery = useQuery({
    queryKey: ["industrial", "racks", { facilityId, zoneId, occupancy, search }],
    queryFn: () => getRacks(facilityId, { zoneId, occupancy, search }),
    placeholderData: keepPreviousData,
  });
  const racks = useMemo(() => racksQuery.data ?? [], [racksQuery.data]);
  const zones = layout?.plan.zones ?? [];
  const zoneName = (id: string) => zones.find((z) => z.id === id)?.name ?? id;
  const criticalCount = layout?.plan.racks.filter((r) => (r.filled / r.capacity) * 100 >= HIGH_PCT).length;

  const exportCsv = () =>
    downloadCsv(
      `stok-${facilityId}`,
      [t("colRack"), t("colZone"), t("colOccupancy"), t("colFilled"), t("colReserved"), t("colLastMove")],
      racks.map((r) => [
        r.id,
        zoneName(r.zoneId),
        formatPercent((r.filled / r.capacity) * 100),
        `${r.filled}/${r.capacity}`,
        r.reserved,
        formatDateTime(r.lastMovementAt),
      ]),
    );

  return (
    <div className="fsh-enter">
      <PageToolbar title={t("title")} subtitle={t("subtitle")}>
        <FacilitySelect />
      </PageToolbar>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile icon={Boxes} label={t("overview:totalOccupancy")} value={stock ? formatPercent(stock.occupancyPct) : "—"} />
        <KpiTile icon={PackageCheck} label={t("overview:filled")} value={stock ? formatNumber(stock.filled) : "—"} tone="info" />
        <KpiTile icon={PackageOpen} label={t("overview:empty")} value={stock ? formatNumber(stock.empty) : "—"} />
        <KpiTile
          icon={AlertTriangle}
          label={t("occupancyHigh")}
          value={criticalCount !== undefined ? formatNumber(criticalCount) : "—"}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div>
          <StockCard facilityId={facilityId} showLink={false} />
        </div>

        <PanelCard
          title={
            <>
              {t("racks")}
              <span className="ml-2 text-[12px] font-normal text-[var(--color-muted-foreground)]" aria-live="polite">
                {t("rackCount", { count: racks.length })}
              </span>
            </>
          }
          icon={Rows3}
          actions={<ExportButton onClick={exportCsv} disabled={racks.length === 0} />}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ChipToggle pressed={!zoneId} onClick={() => setParam("zone", undefined)}>
              {t("allZones")}
            </ChipToggle>
            {zones.map((z) => (
              <ChipToggle key={z.id} pressed={zoneId === z.id} onClick={() => setParam("zone", z.id)}>
                {z.name}
              </ChipToggle>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <PillSelect
                label={t("occupancy")}
                value={occupancy ?? ""}
                onChange={(v) => setParam("occupancy", v || undefined)}
                options={[
                  { value: "", label: t("occupancyAll") },
                  { value: "high", label: t("occupancyHigh") },
                  { value: "low", label: t("occupancyLow") },
                ]}
              />
              <label className="relative">
                <span className="sr-only">{t("search")}</span>
                <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setParam("q", e.target.value || undefined)}
                  placeholder={t("search")}
                  className="h-9 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-8 pr-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                />
              </label>
            </div>
          </div>

          {racksQuery.isPending ? (
            <CardState kind="loading" />
          ) : racks.length === 0 ? (
            <CardState kind="empty" message={t("noRacks")} />
          ) : (
            <RackTable racks={racks} zoneName={zoneName} />
          )}
        </PanelCard>
      </div>
    </div>
  );
}

function RackTable({ racks, zoneName }: { racks: Rack[]; zoneName: (id: string) => string }) {
  const { t } = useTranslation("inventory");
  return (
    <div className="max-h-[560px] overflow-auto rounded-xl border border-[var(--color-border)]">
      <table className="w-full min-w-[640px] text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-[var(--color-muted)] text-left text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-semibold">{t("colRack")}</th>
            <th scope="col" className="px-3 py-2.5 font-semibold">{t("colZone")}</th>
            <th scope="col" className="w-[30%] px-3 py-2.5 font-semibold">{t("colOccupancy")}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("colFilled")}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("colReserved")}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-semibold">{t("colLastMove")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {racks.map((r) => {
            const pct = Math.round((r.filled / r.capacity) * 100);
            return (
              <tr key={r.id} className="hover:bg-[var(--color-surface-2-hover)]">
                <th scope="row" className="px-3 py-2 text-left font-mono text-[12px] font-semibold">{r.id}</th>
                <td className="px-3 py-2">{zoneName(r.zoneId)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          pct >= HIGH_PCT ? "bg-[var(--color-warning)]" : pct < LOW_PCT ? "bg-[var(--color-info)]" : "bg-[var(--color-primary)]",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right tabular-nums">{formatPercent(pct)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{t("capacity", { filled: r.filled, capacity: r.capacity })}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.reserved}</td>
                <td className="px-3 py-2 text-right text-[var(--color-muted-foreground)]">
                  <time dateTime={r.lastMovementAt} title={formatDateTime(r.lastMovementAt)}>
                    {formatRelative(r.lastMovementAt)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
