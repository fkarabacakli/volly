import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Inbox } from "lucide-react";
import { currentLocale } from "@/i18n";
import { useSseEvents, useSseStatus, type SseEvent } from "@/sse/sse-context";
import { Badge } from "@/components/ui/badge";
import {
  EntityEmpty,
  EntityListCard,
  EntityListHeader,
  EntityListRow,
  EntityPageHeader,
  EntityStatusBadge,
  type EntityStatusTone,
} from "@/components/list";


function formatTime(ts: number) {
  return new Intl.DateTimeFormat(currentLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

function payloadSummary(data: unknown, raw: string): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    try {
      return JSON.stringify(data);
    } catch {
      return raw;
    }
  }
  return raw;
}

// Map an event type to a status badge tone — failures pop red, successes
// green, warnings amber, everything else neutral. Mirrors the heuristic
// the legacy live-feed component used.
function eventTone(type: string): EntityStatusTone {
  const t = type.toLowerCase();
  if (t.includes("fail") || t.includes("error") || t.includes("revoke")) return "danger";
  if (t.includes("warn") || t.includes("retry")) return "warning";
  if (t.includes("login") || t.includes("issued") || t.includes("created")) return "success";
  if (t.includes("token") || t.includes("auth")) return "info";
  return "default";
}

// Try to extract a friendlier "entity" label from the event payload —
// most domain events carry an aggregate id under a predictable field.
function entityLabel(data: unknown): string {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["entityId", "aggregateId", "id", "tenantId", "userId"]) {
      const v = obj[key];
      if (typeof v === "string" && v.length > 0) return v;
    }
  }
  return "—";
}

// ───────────────────────────────────────────────────────────────────────
//  Page
// ───────────────────────────────────────────────────────────────────────

const DESKTOP_GRID = "grid-cols-[1fr_240px_120px]";

export function ActivityPage() {
  const { t } = useTranslation("activityLog");
  const { status, eventCount } = useSseStatus();
  const { events } = useSseEvents();

  const items = useMemo(() => events.slice(0, 200), [events]);
  const isLive = status === "connected";

  return (
    <div className="space-y-4 sm:space-y-6">
      <EntityPageHeader
        icon={Activity}
        title={t("title")}
        total={eventCount}
        unit="event"
        description={t("description")}
      >
        {isLive ? (
          <Badge variant="success">{t("streaming")}</Badge>
        ) : status === "error" ? (
          <Badge variant="danger">{t("offline")}</Badge>
        ) : (
          <Badge variant="default">{status}</Badge>
        )}
      </EntityPageHeader>

      {items.length === 0 ? (
        <EntityEmpty
          icon={Inbox}
          title={isLive ? t("listening") : t("noEvents")}
          body={
            isLive
              ? t("openBody")
              : t("closedBody")
          }
        />
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[12px] font-medium text-[var(--color-muted-foreground)]">
              {items.length} event{items.length === 1 ? "" : "s"} shown
              <span className="ml-2 opacity-60">
                · {new Intl.NumberFormat("en-US").format(eventCount)} total
              </span>
            </p>
          </div>

          {/* Mobile: card list */}
          <div
            className="space-y-2 md:hidden"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t("events")}
          >
            {items.map((ev) => (
              <MobileCard key={ev.id} ev={ev} />
            ))}
          </div>

          {/* Desktop: table */}
          <EntityListCard
            className="hidden md:block"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={t("events")}
          >
            <EntityListHeader className={DESKTOP_GRID}>
              <span>{t("colAction")}</span>
              <span>{t("colEntity")}</span>
              <span className="text-right">{t("colTime")}</span>
            </EntityListHeader>
            {items.map((ev, i) => (
              <DesktopRow
                key={ev.id}
                ev={ev}
                isLast={i === items.length - 1}
              />
            ))}
          </EntityListCard>
        </div>
      )}
    </div>
  );
}

// Mobile uses a static div (no navigation target — the activity feed is
// a stream of events, not a list of routable entities).
function MobileCard({ ev }: { ev: SseEvent }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <EntityStatusBadge tone={eventTone(ev.type)}>{ev.type}</EntityStatusBadge>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-muted-foreground)]">
          {formatTime(ev.receivedAt)}
        </span>
      </div>
      <p className="mt-2 line-clamp-2 break-words font-mono text-[11.5px] leading-relaxed text-[var(--color-muted-foreground)]">
        {payloadSummary(ev.data, ev.rawData)}
      </p>
    </div>
  );
}

function DesktopRow({ ev, isLast }: { ev: SseEvent; isLast: boolean }) {
  return (
    <EntityListRow className={DESKTOP_GRID} isLast={isLast}>
      <div className="flex min-w-0 items-center gap-2">
        <EntityStatusBadge tone={eventTone(ev.type)}>{ev.type}</EntityStatusBadge>
        <span className="truncate font-mono text-[11.5px] text-[var(--color-muted-foreground)]">
          {payloadSummary(ev.data, ev.rawData)}
        </span>
      </div>
      <code
        title={entityLabel(ev.data)}
        className="truncate font-mono text-[12px] text-[var(--color-muted-foreground)]"
      >
        {entityLabel(ev.data)}
      </code>
      <span className="text-right font-mono text-[11.5px] tabular-nums text-[var(--color-muted-foreground)]">
        {formatTime(ev.receivedAt)}
      </span>
    </EntityListRow>
  );
}
