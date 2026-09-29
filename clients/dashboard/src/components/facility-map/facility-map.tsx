import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, ShieldAlert, ZoomIn, ZoomOut } from "lucide-react";
import type { CameraAlert, Device, DeviceKind, FloorPlan, Rack } from "@/api/industrial";
import { DEVICE_KIND_META, STATUS_TONE } from "@/components/industrial/device-meta";
import { cn } from "@/lib/cn";
import { formatDecimal, formatPercent } from "@/lib/format";

/**
 * FacilityMap — top-down 2D plan (SVG, 1 user unit = 1 metre).
 *
 * The props are the contract, not the renderer: Phase 2 swaps this body
 * for the CAD plan viewer (R3F / isometric) behind the same props, so
 * pages never change. Keep new features expressed as props.
 */
export type FacilityMapProps = {
  plan: FloorPlan;
  devices: Device[];
  /** Open alerts — their zones glow red and their cameras' cones turn red. */
  alerts?: CameraAlert[];
  /** Device kinds to draw; default = all. */
  visibleKinds?: DeviceKind[];
  selectedId?: string | null;
  onSelect?: (device: Device | null) => void;
  /** Adds wheel/drag zoom + pan and the zoom buttons. */
  interactive?: boolean;
  /** "key" labels gateways, radar, alerting cameras + the selection; "all" labels everything. */
  labels?: "key" | "all";
  /**
   * Pixels on each side covered by floating UI (the overview's glass cards).
   * The plan is fitted into the remaining window instead of the full box.
   */
  fitInsets?: Insets;
  className?: string;
};

type Insets = { top: number; right: number; bottom: number; left: number };
const NO_INSETS: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

type View = { x: number; y: number; w: number; h: number };

const PAD_M = 4;
const DOCK_DEPTH_M = 3;
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 1.25;
const WHEEL_STEP = 1.12;
/** Marker/label sizes are tuned for a 120 m wide plan and scaled from there. */
const REFERENCE_WIDTH_M = 120;
const HIGH_OCCUPANCY = 0.95;

function planExtent(plan: FloorPlan): View {
  return { x: -PAD_M, y: -PAD_M, w: plan.widthM + PAD_M * 2, h: plan.depthM + PAD_M * 2 + DOCK_DEPTH_M };
}

/**
 * viewBox whose aspect matches the host box exactly, scaled so the plan
 * fits inside the host minus `insets` and centred in that window.
 */
function fittedView(plan: FloorPlan, size: { w: number; h: number } | null, insets: Insets): View {
  const extent = planExtent(plan);
  if (!size || size.w <= 0 || size.h <= 0) return extent;
  const availW = Math.max(1, size.w - insets.left - insets.right);
  const availH = Math.max(1, size.h - insets.top - insets.bottom);
  const pxPerM = Math.min(availW / extent.w, availH / extent.h);
  const slackW = (availW / pxPerM - extent.w) / 2;
  const slackH = (availH / pxPerM - extent.h) / 2;
  return {
    x: extent.x - insets.left / pxPerM - slackW,
    y: extent.y - insets.top / pxPerM - slackH,
    w: size.w / pxPerM,
    h: size.h / pxPerM,
  };
}

function conePath(d: Device): string {
  const r = d.rangeM ?? 10;
  const half = ((d.fovDeg ?? 60) / 2) * (Math.PI / 180);
  const h = (d.headingDeg ?? 0) * (Math.PI / 180);
  const { xM: x, yM: y } = d.position;
  const a = { x: x + r * Math.cos(h - half), y: y + r * Math.sin(h - half) };
  const b = { x: x + r * Math.cos(h + half), y: y + r * Math.sin(h + half) };
  return `M ${x} ${y} L ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y} Z`;
}

export function FacilityMap({
  plan,
  devices,
  alerts = [],
  visibleKinds,
  selectedId = null,
  onSelect,
  interactive = false,
  labels = "key",
  fitInsets = NO_INSETS,
  className,
}: FacilityMapProps) {
  const { t } = useTranslation(["map", "common"]);
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const { top, right, bottom, left } = fitInsets;
  const base = useMemo(
    () => fittedView(plan, size, { top, right, bottom, left }),
    [plan, size, top, right, bottom, left],
  );
  const [view, setView] = useState<View>(base);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) => (prev && prev.w === width && prev.h === height ? prev : { w: width, h: height }));
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // New facility or resized host → refit (drops any manual zoom).
  useEffect(() => setView(base), [base]);

  const k = Math.max(plan.widthM, plan.depthM * 1.5) / REFERENCE_WIDTH_M;

  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);
  const alertZoneIds = useMemo(() => new Set(openAlerts.map((a) => a.zoneId)), [openAlerts]);
  const alertCameraIds = useMemo(() => new Set(openAlerts.map((a) => a.cameraId)), [openAlerts]);

  const shown = useMemo(
    () => devices.filter((d) => !visibleKinds || visibleKinds.includes(d.kind)),
    [devices, visibleKinds],
  );

  // ── Zoom / pan ─────────────────────────────────────────────────────────
  const zoomBy = useCallback(
    (factor: number, focus?: { x: number; y: number }) => {
      setView((v) => {
        const nextW = Math.min(base.w * MAX_ZOOM, Math.max(base.w * MIN_ZOOM, v.w * factor));
        const s = nextW / v.w;
        const fx = focus?.x ?? v.x + v.w / 2;
        const fy = focus?.y ?? v.y + v.h / 2;
        return { x: fx - (fx - v.x) * s, y: fy - (fy - v.y) * s, w: nextW, h: v.h * s };
      });
    },
    [base.w],
  );

  /** px → user units, honouring preserveAspectRatio="xMidYMid meet". */
  const unitsPerPx = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 1;
    return Math.max(view.w / rect.width, view.h / rect.height);
  }, [view.w, view.h]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !interactive) return undefined;
    // Non-passive so the page doesn't scroll while zooming the map.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      const p = ctm ? pt.matrixTransform(ctm.inverse()) : undefined;
      zoomBy(e.deltaY > 0 ? WHEEL_STEP : 1 / WHEEL_STEP, p ? { x: p.x, y: p.y } : undefined);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [interactive, zoomBy]);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (!interactive || e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId);
    d.moved = true;
    const u = unitsPerPx();
    setView({ ...d.view, x: d.view.x - dx * u, y: d.view.y - dy * u });
  };
  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // A click on empty floor clears the selection.
    if (d && !d.moved && e.target === e.currentTarget) onSelect?.(null);
  };

  const isLabelled = (d: Device) =>
    labels === "all" ||
    d.id === selectedId ||
    d.kind === "gateway" ||
    d.kind === "radar" ||
    alertCameraIds.has(d.id);

  const subtitle = (d: Device): string => {
    switch (d.kind) {
      case "camera":
        return d.aiEnabled ? t("aiActive") : t("aiPaused");
      case "sensor": {
        const temp = d.latest?.temperature;
        const hum = d.latest?.humidity;
        return [temp !== undefined ? `${formatDecimal(temp)}°C` : null, hum !== undefined ? formatPercent(hum) : null]
          .filter(Boolean)
          .join(" · ");
      }
      case "forklift":
      case "personnel":
        return d.locationCode ? t("locationShort", { code: d.locationCode }) : "";
      default:
        return t(`common:status.${d.status === "online" ? "connected" : d.status}`);
    }
  };

  const zoneFor = (id: string) => plan.zones.find((z) => z.id === id);

  return (
    <div ref={hostRef} className={cn("relative overflow-hidden rounded-xl bg-[var(--color-map-floor)]", className)}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={t("label")}
        className={cn("absolute inset-0 h-full w-full select-none touch-none", interactive && "cursor-grab active:cursor-grabbing")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => (drag.current = null)}
      >
        <defs>
          <pattern id={`grid-${plan.facilityId}`} width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M 5 0 L 0 0 0 5" fill="none" className="stroke-[var(--color-map-grid)]" strokeWidth={0.08} />
          </pattern>
        </defs>

        <rect
          x={view.x - view.w}
          y={view.y - view.h}
          width={view.w * 3}
          height={view.h * 3}
          fill={`url(#grid-${plan.facilityId})`}
          pointerEvents="none"
        />

        {/* Zones */}
        {plan.zones.map((z) => {
          const isAlert = alertZoneIds.has(z.id);
          return (
            <g key={z.id} pointerEvents="none">
              <rect
                x={z.xM}
                y={z.yM}
                width={z.widthM}
                height={z.depthM}
                rx={0.8}
                className={cn(
                  isAlert
                    ? "fill-[var(--color-map-alert)] stroke-[var(--color-map-alert-edge)]"
                    : z.isCold
                      ? "fill-[oklch(from_var(--color-info)_l_c_h_/_0.08)] stroke-[oklch(from_var(--color-info)_l_c_h_/_0.45)]"
                      : "fill-[var(--color-map-zone)] stroke-[var(--color-map-zone-edge)]",
                )}
                strokeWidth={0.2 * k}
                strokeDasharray={isAlert ? undefined : `${0.8 * k} ${0.6 * k}`}
              />
              <text
                x={z.xM + 0.8 * k}
                y={z.yM - 0.7 * k}
                fontSize={1.5 * k}
                fontWeight={600}
                className="fill-[var(--color-muted-foreground)]"
              >
                {z.name}
              </text>
            </g>
          );
        })}

        {/* Racks — the fill bar shows occupancy. */}
        {plan.racks.map((r) => (
          <RackShape key={r.id} rack={r} />
        ))}

        {/* Walls */}
        {plan.walls.map((w, i) => (
          <line
            key={i}
            x1={w.from.xM}
            y1={w.from.yM}
            x2={w.to.xM}
            y2={w.to.yM}
            className="stroke-[var(--color-map-wall)]"
            strokeWidth={0.7 * k}
            strokeLinecap="square"
            pointerEvents="none"
          />
        ))}

        {/* Loading docks */}
        {plan.docks.map((d) => (
          <g key={d.id} pointerEvents="none">
            <rect
              x={d.position.xM - d.widthM / 2}
              y={d.position.yM}
              width={d.widthM}
              height={DOCK_DEPTH_M * 0.6}
              rx={0.3}
              className={d.occupied ? "fill-[var(--color-primary)]" : "fill-[var(--color-map-rack)] stroke-[var(--color-map-rack-edge)]"}
              strokeWidth={0.1}
            />
            <text
              x={d.position.xM}
              y={d.position.yM + DOCK_DEPTH_M * 0.6 + 1.3 * k}
              fontSize={1.1 * k}
              textAnchor="middle"
              className="fill-[var(--color-muted-foreground)]"
            >
              {d.id}
            </text>
          </g>
        ))}

        {/* Camera view cones (under the markers). */}
        {shown
          .filter((d) => d.kind === "camera")
          .map((d) => (
            <path
              key={`cone-${d.id}`}
              d={conePath(d)}
              pointerEvents="none"
              className={
                alertCameraIds.has(d.id)
                  ? "fill-[oklch(from_var(--color-destructive)_l_c_h_/_0.16)]"
                  : "fill-[var(--color-map-cone)]"
              }
            />
          ))}

        {/* Alert callouts at the top of each alerting zone. */}
        {Array.from(alertZoneIds).map((zoneId) => {
          const z = zoneFor(zoneId);
          const alert = openAlerts.find((a) => a.zoneId === zoneId);
          if (!z || !alert) return null;
          const text = t(`common:alertType.${alert.type}`);
          const w = (text.length * 0.62 + 3.4) * k;
          const cx = z.xM + z.widthM / 2;
          const cy = z.yM + z.depthM * 0.18;
          return (
            <g key={`alert-${zoneId}`} transform={`translate(${cx - w / 2} ${cy - 1.4 * k})`} pointerEvents="none">
              <rect width={w} height={2.8 * k} rx={1.4 * k} className="fill-[var(--color-card)] stroke-[var(--color-map-alert-edge)]" strokeWidth={0.12 * k} />
              <ShieldAlert x={0.6 * k} y={0.55 * k} width={1.7 * k} height={1.7 * k} className="text-[var(--color-destructive)]" />
              <text x={2.7 * k} y={1.85 * k} fontSize={1.15 * k} fontWeight={600} className="fill-[var(--color-destructive)]">
                {text}
              </text>
            </g>
          );
        })}

        {/* Device markers */}
        {shown.map((d) => {
          const meta = DEVICE_KIND_META[d.kind];
          const Icon = meta.icon;
          const r = 1.35 * k;
          const isSelected = d.id === selectedId;
          const moving = d.kind === "forklift" || d.kind === "personnel";
          return (
            <g
              key={d.id}
              role="button"
              tabIndex={onSelect ? 0 : -1}
              aria-label={`${d.name}, ${t(`common:status.${d.status}`)}`}
              aria-pressed={onSelect ? isSelected : undefined}
              data-device-id={d.id}
              className={cn("group/marker outline-none", onSelect && "cursor-pointer")}
              // Movers glide between polls instead of teleporting.
              style={{
                transform: `translate(${d.position.xM}px, ${d.position.yM}px)`,
                transition: moving ? "transform 4.5s linear" : undefined,
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(d);
              }}
              onKeyDown={(e: KeyboardEvent<SVGGElement>) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect?.(d);
                }
              }}
            >
              {isSelected && (
                <circle r={r * 2} className="fill-[var(--color-primary-soft)] stroke-[var(--color-primary)]" strokeWidth={0.12 * k} />
              )}
              <circle
                r={r}
                className="fill-[var(--color-card)] group-focus-visible/marker:stroke-[var(--color-ring)]"
                stroke={STATUS_TONE[d.status]}
                strokeWidth={0.28 * k}
              />
              <Icon x={-r * 0.62} y={-r * 0.62} width={r * 1.24} height={r * 1.24} strokeWidth={2.2} color={meta.tone} />
              {isLabelled(d) && <MarkerLabel k={k} name={d.name} sub={subtitle(d)} />}
            </g>
          );
        })}
      </svg>

      {interactive && (
        <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
          <MapButton label={t("zoomIn")} onClick={() => zoomBy(1 / 1.4)}>
            <ZoomIn className="size-4" />
          </MapButton>
          <MapButton label={t("zoomOut")} onClick={() => zoomBy(1.4)}>
            <ZoomOut className="size-4" />
          </MapButton>
          <MapButton label={t("reset")} onClick={() => setView(base)}>
            <Maximize2 className="size-4" />
          </MapButton>
        </div>
      )}
    </div>
  );
}

function RackShape({ rack }: { rack: Rack }) {
  const occ = rack.filled / rack.capacity;
  return (
    <g pointerEvents="none">
      <rect
        x={rack.xM}
        y={rack.yM}
        width={rack.widthM}
        height={rack.depthM}
        rx={0.25}
        className="fill-[var(--color-map-rack)] stroke-[var(--color-map-rack-edge)]"
        strokeWidth={0.08}
      />
      <rect
        x={rack.xM}
        y={rack.yM}
        width={rack.widthM * occ}
        height={rack.depthM}
        rx={0.25}
        className={
          occ >= HIGH_OCCUPANCY
            ? "fill-[oklch(from_var(--color-warning)_l_c_h_/_0.45)]"
            : "fill-[oklch(from_var(--color-primary)_l_c_h_/_0.32)]"
        }
      />
    </g>
  );
}

/** Two-line pill to the right of a marker ("Kamera 01 / AI Analiz Aktif"). */
function MarkerLabel({ k, name, sub }: { k: number; name: string; sub: string }) {
  const nameSize = 1.2 * k;
  const subSize = 1.0 * k;
  // SVG text can't be measured before paint; a per-glyph estimate is close
  // enough for a label pill (Figtree averages ~0.56 em).
  const w = Math.max(name.length * nameSize, sub.length * subSize) * 0.56 + 1.6 * k;
  const h = (sub ? 3.6 : 2.4) * k;
  const x = 2 * k;
  return (
    <g transform={`translate(${x} ${-h / 2})`} pointerEvents="none">
      <rect width={w} height={h} rx={0.9 * k} className="fill-[var(--color-card)] stroke-[var(--color-border)]" strokeWidth={0.08 * k} />
      <text x={0.8 * k} y={1.5 * k} fontSize={nameSize} fontWeight={650} className="fill-[var(--color-foreground)]">
        {name}
      </text>
      {sub && (
        <text x={0.8 * k} y={2.9 * k} fontSize={subSize} className="fill-[var(--color-primary)]">
          {sub}
        </text>
      )}
    </g>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-8 cursor-pointer place-items-center text-[var(--color-muted-foreground)]",
        "border-b border-[var(--color-border)] last:border-b-0",
        "hover:bg-[var(--color-accent)] hover:text-[var(--color-foreground)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-ring)]",
      )}
    >
      {children}
    </button>
  );
}
