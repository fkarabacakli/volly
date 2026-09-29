import {
  Activity,
  BarChart3,
  Boxes,
  Cctv,
  FolderOpen,
  HeartPulse,
  LayoutDashboard,
  MapPinned,
  Receipt,
  CreditCard,
  ScrollText,
  Settings,
  ShieldCheck,
  Thermometer,
  Trash2,
  Users,
  UsersRound,
  Wifi,
} from "lucide-react";
import type { Messages } from "@/i18n/locales/tr";
import { ALL_TRASH_PERMISSIONS } from "@/lib/trash-permissions";

/** Keys of the `nav` i18n namespace — labels are translated at render time. */
export type NavLabelKey = keyof Messages["nav"];

export type NavSpec = {
  to: string;
  labelKey: NavLabelKey;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /**
   * Permission required to see this item. Items without a `perm` are visible to
   * every authenticated tenant user; gated items are hidden when the current
   * user (or impersonated user) lacks the permission, so they never land on a
   * page the API will reject with 403.
   */
  perm?: string;
  /**
   * Visible only if the user holds *at least one* of these permissions. Use for
   * an item that fronts several independently-gated sub-views (e.g. Trash, whose
   * tabs each require a different permission) — the entry should show as long as
   * the user can reach any one of them. Combined with `perm` via AND.
   */
  anyPerm?: readonly string[];
};

export type NavSection = {
  id: string;
  captionKey: NavLabelKey;
  /** Section-level icon used as a fallback when the sidebar is
   *  collapsed and the section is rendered as a stack of item icons. */
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  items: NavSpec[];
};

// Top-level items: the industrial product surface. They read the mock
// industrial API today (no server permission yet), so they're ungated.
// Chat, Catalog, Tickets and the WhatsApp wallet are starter-kit demo
// modules — their routes still exist but they're intentionally not in
// the nav or the command palette.
export const topNavTop: NavSpec[] = [
  { to: "/", labelKey: "overview", icon: LayoutDashboard },
  { to: "/monitoring", labelKey: "monitoring", icon: MapPinned },
  { to: "/inventory", labelKey: "inventory", icon: Boxes },
  { to: "/cameras", labelKey: "cameras", icon: Cctv },
  { to: "/sensors", labelKey: "sensors", icon: Thermometer },
  { to: "/reports", labelKey: "reports", icon: BarChart3 },
];

export const topNavBottom: NavSpec[] = [
  { to: "/settings", labelKey: "settings", icon: Settings },
];

// Section accordion. Single-select — only one section open at a time.
export const sections: NavSection[] = [
  {
    id: "management",
    captionKey: "sectionManagement",
    icon: Users,
    items: [
      // Gate the identity-management pages on a manage permission (not View): View Users/Roles/Groups
      // are IsBasic so every member holds them, but only managers should see these admin pages.
      { to: "/identity/users", labelKey: "users", icon: Users, perm: "Permissions.Users.Update" },
      { to: "/identity/roles", labelKey: "roles", icon: ShieldCheck, perm: "Permissions.Roles.Update" },
      { to: "/identity/groups", labelKey: "groups", icon: UsersRound, perm: "Permissions.Groups.Update" },
      // Mirrors the permission /files/mine enforces server-side.
      { to: "/files", labelKey: "files", icon: FolderOpen, perm: "Permissions.Files.Upload" },
    ],
  },
  {
    id: "system",
    captionKey: "sectionSystem",
    icon: HeartPulse,
    items: [
      // Live activity is SSE-backed; the stream is auth-only (no permission), so no gate.
      { to: "/activity", labelKey: "liveEvents", icon: Activity },
      // Health hits the anonymous /health/ready probe — visible to everyone.
      { to: "/system/health", labelKey: "health", icon: HeartPulse },
      { to: "/system/audits", labelKey: "audits", icon: ScrollText, perm: "Permissions.AuditTrails.View" },
      { to: "/system/sessions", labelKey: "sessions", icon: Wifi, perm: "Permissions.Sessions.ViewAll" },
      // Trash fronts several tabs, each gated on a different resource's restore /
      // view-trash permission. Show the entry if the user can reach any tab.
      { to: "/system/trash", labelKey: "trash", icon: Trash2, anyPerm: ALL_TRASH_PERMISSIONS },
      { to: "/subscription", labelKey: "subscription", icon: CreditCard, perm: "Permissions.Billing.View" },
      { to: "/invoices", labelKey: "invoices", icon: Receipt, perm: "Permissions.Billing.View" },
    ],
  },
];

/** True when the user satisfies the item's gates: the single `perm` (if any)
 *  AND at least one of `anyPerm` (if any). Ungated items are always visible. */
function isNavItemVisible(item: NavSpec, permissions: readonly string[]): boolean {
  if (item.perm && !permissions.includes(item.perm)) return false;
  if (item.anyPerm && !item.anyPerm.some((p) => permissions.includes(p))) return false;
  return true;
}

/** Drop items the user can't access, then drop any section left empty. */
export function visibleSections(permissions: readonly string[]): NavSection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => isNavItemVisible(i, permissions)) }))
    .filter((s) => s.items.length > 0);
}

/** Filter a flat nav list (top/bottom) by permission. */
export function visibleItems(items: NavSpec[], permissions: readonly string[]): NavSpec[] {
  return items.filter((i) => isNavItemVisible(i, permissions));
}

/** Find the section whose items contain the given path (best prefix match). */
export function findSectionForPath(pathname: string): string | null {
  let bestId: string | null = null;
  let bestLen = 0;
  for (const s of sections) {
    for (const item of s.items) {
      if (
        (item.to === "/" && pathname === "/") ||
        (item.to !== "/" && pathname.startsWith(item.to))
      ) {
        if (item.to.length > bestLen) {
          bestLen = item.to.length;
          bestId = s.id;
        }
      }
    }
  }
  return bestId;
}
