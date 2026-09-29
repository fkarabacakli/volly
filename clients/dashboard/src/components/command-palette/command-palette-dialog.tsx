import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  Activity,
  BarChart3,
  Boxes,
  Cctv,
  Folder,
  Globe,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Monitor,
  Moon,
  Package,
  Palette,
  Plus,
  Receipt,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Thermometer,
  Users,
  UserRound,
} from "lucide-react";
import { LANGUAGES, setLanguage } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/auth/use-auth";
import { useTheme } from "@/components/theme/theme-provider";
import { accents, accentText } from "@/components/theme/appearance-options";
import { ALL_TRASH_PERMISSIONS } from "@/lib/trash-permissions";
import { BRAND_NAME } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * Command palette dialog — separated from the provider so cmdk + the full
 * action graph (lucide icons, accent options, navigate logic) are
 * code-split into their own chunk. The provider in command-palette.tsx
 * lazy-imports this module on first ⌘K, keeping the main shell shipping
 * a smaller bundle for cold start.
 */

type ActionItem = {
  id: string;
  label: string;
  hint?: string;
  Icon: React.ComponentType<{ className?: string }>;
  /** Free-form keywords for fuzzy matching. */
  keywords?: string[];
  shortcut?: string;
  perform: () => void;
  /**
   * Permission gates — same semantics as NavSpec in layout/nav-data.ts: the item
   * is hidden unless the user holds `perm` AND at least one of `anyPerm`. Each
   * value mirrors what the destination page's API (or the create action's
   * endpoint) enforces server-side, so the palette never offers a guaranteed 403.
   */
  perm?: string;
  anyPerm?: readonly string[];
};

type ActionGroup = {
  heading: string;
  items: ActionItem[];
};

export function CommandPaletteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { t } = useTranslation(["palette", "nav", "shell", "common"]);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setMode, setAccent } = useTheme();
  const permissions = useMemo(() => user?.permissions ?? [], [user]);

  // Build the action set fresh each time the palette opens. The ones
  // that navigate close the palette; the ones that mutate appearance
  // don't, so the user can preview multiple choices.
  const groups = useMemo<ActionGroup[]>(() => {
    const close = () => onOpenChange(false);
    const go = (path: string) => () => {
      navigate(path);
      close();
    };
    // Mirrors isNavItemVisible in layout/nav-data.ts.
    const visible = (item: ActionItem) => {
      if (item.perm && !permissions.includes(item.perm)) return false;
      if (item.anyPerm && !item.anyPerm.some((p) => permissions.includes(p))) return false;
      return true;
    };
    const allGroups: ActionGroup[] = [
      {
        heading: t("groupNavigate"),
        items: [
          { id: "nav-overview", label: t("nav:overview"), hint: t("overviewHint"), Icon: LayoutDashboard, keywords: ["home", "dashboard", "genel"], perform: go("/") },
          { id: "nav-monitoring", label: t("nav:monitoring"), hint: t("monitoringHint"), Icon: MapPinned, keywords: ["map", "harita", "live", "canlı"], perform: go("/monitoring") },
          { id: "nav-inventory", label: t("nav:inventory"), hint: t("inventoryHint"), Icon: Boxes, keywords: ["stock", "stok", "rack", "raf"], perform: go("/inventory") },
          { id: "nav-cameras", label: t("nav:cameras"), hint: t("camerasHint"), Icon: Cctv, keywords: ["camera", "kamera", "ai", "alert", "uyarı"], perform: go("/cameras") },
          { id: "nav-sensors", label: t("nav:sensors"), hint: t("sensorsHint"), Icon: Thermometer, keywords: ["iot", "temperature", "sıcaklık", "nem"], perform: go("/sensors") },
          { id: "nav-reports", label: t("nav:reports"), hint: t("reportsHint"), Icon: BarChart3, keywords: ["report", "rapor", "compare", "karşılaştır"], perform: go("/reports") },
          { id: "nav-activity", label: t("nav:liveEvents"), hint: t("liveEventsHint"), Icon: Activity, keywords: ["events", "sse", "log"], perform: go("/activity") },
          { id: "nav-files", label: t("nav:files"), hint: t("filesHint"), Icon: Folder, keywords: ["storage", "uploads", "documents"], perform: go("/files"), perm: "Permissions.Files.Upload" },
          { id: "nav-users", label: t("nav:users"), hint: t("usersHint"), Icon: Users, keywords: ["identity", "people", "members"], perform: go("/identity/users"), perm: "Permissions.Users.Update" },
          { id: "nav-roles", label: t("nav:roles"), hint: t("rolesHint"), Icon: ShieldCheck, keywords: ["identity", "permissions", "rbac"], perform: go("/identity/roles"), perm: "Permissions.Roles.Update" },
          { id: "nav-groups", label: t("nav:groups"), hint: t("groupsHint"), Icon: Users, keywords: ["identity", "teams", "org"], perform: go("/identity/groups"), perm: "Permissions.Groups.Update" },
          { id: "nav-invoices", label: t("nav:invoices"), hint: t("invoicesHint"), Icon: Receipt, keywords: ["billing", "payment"], perform: go("/invoices"), perm: "Permissions.Billing.View" },
          { id: "nav-health", label: t("nav:health"), hint: t("healthHint"), Icon: HeartPulse, keywords: ["status", "uptime", "system"], perform: go("/system/health") },
          { id: "nav-audits", label: t("nav:audits"), hint: t("auditsHint"), Icon: ScrollText, keywords: ["audit", "log", "security"], perform: go("/system/audits"), perm: "Permissions.AuditTrails.View" },
          { id: "nav-trash", label: t("nav:trash"), hint: t("trashHint"), Icon: Package, keywords: ["recycle", "deleted", "restore"], perform: go("/system/trash"), anyPerm: ALL_TRASH_PERMISSIONS },
          { id: "nav-sessions", label: t("nav:sessions"), hint: t("sessionsHint"), Icon: Shield, keywords: ["devices", "logins"], perform: go("/system/sessions"), perm: "Permissions.Sessions.ViewAll" },
          { id: "nav-settings", label: t("nav:settings"), Icon: SettingsIcon, keywords: ["preferences", "config"], perform: go("/settings") },
        ],
      },
      {
        heading: t("groupCreate"),
        items: [
          { id: "create-user", label: t("createUser"), hint: t("createUserHint"), Icon: Plus, keywords: ["new", "invite", "identity"], perform: go("/identity/users?action=create"), perm: "Permissions.Users.Create" },
          { id: "create-role", label: t("createRole"), hint: t("createRoleHint"), Icon: Plus, keywords: ["new", "permissions"], perform: go("/identity/roles?action=create"), perm: "Permissions.Roles.Create" },
          { id: "create-group", label: t("createGroup"), hint: t("createGroupHint"), Icon: Plus, keywords: ["new", "team"], perform: go("/identity/groups?action=create"), perm: "Permissions.Groups.Create" },
          { id: "create-file", label: t("uploadFile"), hint: t("uploadFileHint"), Icon: Plus, keywords: ["new", "upload", "attach"], perform: go("/files?action=upload"), perm: "Permissions.Files.Upload" },
        ],
      },
      {
        heading: t("groupAccount"),
        items: [
          { id: "acc-profile", label: t("shell:profile"), hint: t("profileHint"), Icon: UserRound, perform: go("/settings/profile") },
          { id: "acc-security", label: t("security"), hint: t("securityHint"), Icon: Shield, keywords: ["password", "2fa"], perform: go("/settings/security") },
          { id: "acc-keys", label: t("shell:apiKeys"), hint: t("apiKeysHint"), Icon: KeyRound, keywords: ["token", "credentials"], perform: go("/settings/api-keys") },
          { id: "acc-notifications", label: t("notifications"), hint: t("notificationsHint"), Icon: Sparkles, perform: go("/settings/notifications") },
          { id: "acc-appearance", label: t("appearance"), hint: t("appearanceHint"), Icon: Palette, keywords: ["theme", "font", "dark", "light"], perform: go("/settings/appearance") },
        ],
      },
      {
        heading: t("groupTheme"),
        items: [
          { id: "theme-light", label: t("switchLight"), Icon: Sun, keywords: ["bright", "day"], perform: () => setMode("light") },
          { id: "theme-dark", label: t("switchDark"), Icon: Moon, keywords: ["night"], perform: () => setMode("dark") },
          { id: "theme-system", label: t("followSystem"), Icon: Monitor, keywords: ["auto"], perform: () => setMode("system") },
          ...LANGUAGES.map((lng) => ({
            id: `lang-${lng}`,
            label: t("switchLanguage", { name: t(`common:language.${lng}`) }),
            Icon: Globe,
            keywords: ["language", "dil", lng],
            perform: () => setLanguage(lng),
          })),
        ],
      },
      {
        heading: t("groupAccent"),
        items: accents.map((a) => ({
          id: `accent-${a.id}`,
          label: t("setAccent", { name: accentText(a).label }),
          hint: accentText(a).description,
          Icon: Palette,
          keywords: ["color", "brand", a.id],
          perform: () => setAccent(a.id),
        })),
      },
      {
        heading: t("groupSession"),
        items: [
          {
            id: "sess-logout",
            label: t("shell:signOut"),
            hint: t("signOutHint"),
            Icon: LogOut,
            keywords: ["logout", "exit", "çıkış"],
            perform: () => {
              close();
              logout();
            },
          },
        ],
      },
    ];
    // Drop items the user can't access, then drop any group left empty —
    // same shape as visibleSections() in layout/nav-data.ts.
    return allGroups
      .map((g) => ({ ...g, items: g.items.filter(visible) }))
      .filter((g) => g.items.length > 0);
  }, [navigate, onOpenChange, setMode, setAccent, logout, permissions, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[640px] p-0 sm:max-w-[640px]",
          "bg-[var(--color-popover)]",
        )}
      >
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("description")}</DialogDescription>

        <Command
          loop
          className="flex flex-col"
          // cmdk sets [cmdk-...] data attrs we hook into with selectors below.
        >
          {/* Search row — mirrors EntitySearch shape (rounded-xl, soft icon left). */}
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <Search className="h-[18px] w-[18px] shrink-0 text-[oklch(from_var(--color-muted-foreground)_l_c_h_/_0.5)]" aria-hidden />
            <Command.Input
              placeholder={t("placeholder")}
              aria-label={t("searchLabel")}
              className={cn(
                "h-7 flex-1 bg-transparent text-[14px] tracking-tight placeholder:text-[var(--color-muted-foreground)]",
                "focus:outline-none focus-visible:outline-none focus-visible:shadow-none",
              )}
              autoFocus
            />
            <kbd className="rounded border border-border bg-[var(--color-muted)] px-1.5 py-px text-[10px] tracking-tight text-[var(--color-muted-foreground)]">
              Esc
            </kbd>
          </div>

          {/* Results */}
          <Command.List className="max-h-[420px] overflow-y-auto px-2 py-2">
            <Command.Empty className="px-4 py-12 text-center">
              <p className="text-sm font-medium tracking-tight">{t("emptyTitle")}</p>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{t("emptyHint")}</p>
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group
                key={group.heading}
                heading={group.heading}
                className={cn(
                  // Heading text styling via cmdk's nested rendering.
                  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3",
                  "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold",
                  "[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider",
                  "[&_[cmdk-group-heading]]:text-[var(--color-muted-foreground)]",
                )}
              >
                {group.items.map((item) => (
                  <CommandRow key={item.id} item={item} />
                ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted-foreground)]">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-[var(--color-muted)] px-1 py-px text-[9px]">↑</kbd>
                <kbd className="rounded border border-border bg-[var(--color-muted)] px-1 py-px text-[9px]">↓</kbd>
                {t("navigate")}
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-[var(--color-muted)] px-1 py-px text-[9px]">↵</kbd>
                {t("select")}
              </span>
            </div>
            <span className="text-[11px] text-[var(--color-muted-foreground)]">{BRAND_NAME}</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function CommandRow({ item }: { item: ActionItem }) {
  const { Icon, label, hint, keywords, perform } = item;
  return (
    <Command.Item
      value={[label, hint, ...(keywords ?? [])].filter(Boolean).join(" ")}
      onSelect={perform}
      className={cn(
        "group/cmd flex cursor-default select-none items-center gap-3 rounded-md px-2.5 py-2 text-sm",
        "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-cubic)]",
        "outline-none focus:outline-none focus-visible:outline-none focus-visible:shadow-none",
        "hover:bg-[oklch(from_var(--color-accent)_l_c_h_/_0.4)]",
        "data-[selected=true]:bg-[var(--color-primary-soft)] data-[selected=true]:text-[var(--color-foreground)]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-md",
          "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
          "transition-colors group-data-[selected=true]/cmd:bg-[var(--color-primary-soft)] group-data-[selected=true]/cmd:text-[var(--color-primary)]",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium tracking-tight">{label}</span>
        {hint && (
          <span className="truncate text-[11px] text-[var(--color-muted-foreground)]">
            {hint}
          </span>
        )}
      </span>
    </Command.Item>
  );
}
