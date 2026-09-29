import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { BRAND_NAME } from "@/lib/brand";
import { useAuth } from "@/auth/use-auth";
import { BrandLogo } from "@/components/brand-logo";
import { SignOutDialog } from "@/components/layout/sign-out-dialog";
import {
  findSectionForPath,
  topNavBottom,
  topNavTop,
  visibleItems,
  visibleSections,
  type NavSection,
  type NavSpec,
} from "@/components/layout/nav-data";

const COLLAPSED_KEY = "fsh.sidebar.collapsed";

/** Persisted collapsed state. Reads localStorage on mount; writes on change. */
function useCollapsedSidebar() {
  const [collapsed, setRaw] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const setCollapsed = useCallback((next: boolean) => {
    setRaw(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(next));
    } catch {
      /* storage unavailable */
    }
  }, []);
  return {
    collapsed,
    toggle: () => setCollapsed(!collapsed),
  };
}

export function Sidebar() {
  const { t } = useTranslation(["nav", "shell"]);
  const { collapsed, toggle } = useCollapsedSidebar();
  const location = useLocation();
  const [signOutOpen, setSignOutOpen] = useState(false);

  // Single-select accordion: which section is currently open. Defaults
  // to the section that owns the current route. Manual clicks override
  // until the user navigates again.
  const [openSection, setOpenSection] = useState<string | null>(() =>
    findSectionForPath(location.pathname),
  );

  // Re-sync the open section on every route change (command palette,
  // back/forward, links outside the sidebar). Top-level pages close it.
  useEffect(() => {
    setOpenSection(findSectionForPath(location.pathname));
  }, [location.pathname]);

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? t("expand") : t("collapse");

  return (
    // Flush with the page background, no divider — the reference's quiet
    // left rail. Content cards carry the surfaces; the nav stays out of the way.
    <aside
      data-collapsed={collapsed || undefined}
      aria-label={t("primary")}
      className={cn(
        "hidden shrink-0 flex-col bg-[var(--color-background)] md:flex",
        "transition-[width] duration-[var(--duration-default)] ease-[var(--ease-out-cubic)]",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
    >
      {/* Brand row: wordmark + collapse toggle. */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          collapsed ? "justify-center" : "justify-between pl-5 pr-4",
        )}
      >
        {collapsed ? (
          <button
            type="button"
            onClick={toggle}
            aria-label={toggleLabel}
            aria-expanded={false}
            title={toggleLabel}
            className="group/brand relative grid cursor-pointer place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
          >
            <BrandLogo className="size-10" />
          </button>
        ) : (
          <>
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo className="size-10" />
              <span className="truncate font-display text-[22px] font-bold tracking-tight text-[var(--color-foreground)]">
                {BRAND_NAME}
              </span>
            </div>
            <button
              type="button"
              onClick={toggle}
              aria-label={toggleLabel}
              aria-expanded
              title={toggleLabel}
              className={cn(
                "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg",
                "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
                "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-cubic)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
              )}
            >
              <ToggleIcon className="size-[18px]" strokeWidth={1.6} aria-hidden />
            </button>
          </>
        )}
      </div>

      <SidebarNavBody
        collapsed={collapsed}
        openSection={openSection}
        setOpenSection={setOpenSection}
      />

      {/* Footer: sign out, as in the reference's bottom-left "Log out". */}
      <div className={cn("shrink-0 pb-5 pt-2", collapsed ? "px-3" : "px-4")}>
        <button
          type="button"
          onClick={() => setSignOutOpen(true)}
          title={collapsed ? t("shell:signOut") : undefined}
          aria-label={collapsed ? t("shell:signOut") : undefined}
          className={cn(itemClass(false, collapsed), "w-full cursor-pointer")}
        >
          <LogOut className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
          {!collapsed && <span className="truncate">{t("shell:signOut")}</span>}
        </button>
      </div>

      <SignOutDialog open={signOutOpen} onOpenChange={setSignOutOpen} />
    </aside>
  );
}

/** Shared row styling for nav links, section headers and the sign-out row. */
function itemClass(isActive: boolean, collapsed: boolean) {
  return cn(
    "group/nav relative flex h-10 items-center gap-3 rounded-xl text-[13.5px]",
    "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-cubic)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
    collapsed ? "justify-center px-0" : "px-3",
    isActive
      ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]"
      : "font-medium text-[oklch(from_var(--color-foreground)_l_c_h_/_0.72)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
  );
}

// ────────────────────────────────────────────────────────────────────────
// SidebarNavBody — the nav itself (product pages, collapsible admin
// sections, settings). Shared by the desktop <Sidebar> and the mobile
// drawer; pass `onNavigate` from the drawer so clicks dismiss the sheet.
// ────────────────────────────────────────────────────────────────────────

export function SidebarNavBody({
  collapsed,
  openSection,
  setOpenSection,
  onNavigate,
}: {
  collapsed: boolean;
  openSection: string | null;
  setOpenSection: React.Dispatch<React.SetStateAction<string | null>>;
  /** Called after a nav item link is clicked. Used by the mobile
   *  drawer to close itself on navigation. */
  onNavigate?: () => void;
}) {
  // Hide nav entries the current (or impersonated) user lacks permission for,
  // so they can't navigate to a page the API will reject with 403.
  const { user } = useAuth();
  const perms = user?.permissions ?? [];
  const navTop = visibleItems(topNavTop, perms);
  const navSections = visibleSections(perms);
  const navBottom = visibleItems(topNavBottom, perms);

  return (
    <nav
      className={cn(
        "flex flex-1 flex-col overflow-y-auto overflow-x-clip py-2",
        collapsed ? "px-3" : "px-4",
      )}
    >
      <div className="space-y-1">
        {navTop.map((item) => (
          <NavItemLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>

      <div className={cn("mt-5 space-y-1", collapsed && "border-t border-[var(--color-border)] pt-4")}>
        {navSections.map((section) =>
          collapsed ? (
            // Collapsed rail: no labels to toggle, so list every item as an icon.
            section.items.map((item) => (
              <NavItemLink key={item.to} item={item} collapsed onNavigate={onNavigate} />
            ))
          ) : (
            <SectionGroup
              key={section.id}
              section={section}
              isOpen={openSection === section.id}
              onToggle={() => setOpenSection((cur) => (cur === section.id ? null : section.id))}
              onNavigate={onNavigate}
            />
          ),
        )}
      </div>

      <div className="mt-auto space-y-1 pt-5">
        {navBottom.map((item) => (
          <NavItemLink key={item.to} item={item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </div>
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Collapsible section (expanded sidebar only): a quiet row with the
// section name + chevron; items reveal underneath with the same row style.
// ────────────────────────────────────────────────────────────────────────

function SectionGroup({
  section,
  isOpen,
  onToggle,
  onNavigate,
}: {
  section: NavSection;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation("nav");
  const SectionIcon = section.icon;
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`nav-section-${section.id}`}
        className={cn(itemClass(false, false), "w-full cursor-pointer text-left")}
      >
        <SectionIcon className="size-[18px] shrink-0" strokeWidth={1.6} aria-hidden />
        <span className="flex-1 truncate">{t(section.captionKey)}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-[var(--color-muted-foreground)]",
            "transition-transform duration-[var(--duration-default)] ease-[var(--ease-out-cubic)]",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* 0fr ↔ 1fr grid-row trick animates the panel height. */}
      <div
        id={`nav-section-${section.id}`}
        className={cn(
          "grid transition-[grid-template-rows] duration-[var(--duration-default)] ease-[var(--ease-out-cubic)]",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            aria-hidden={!isOpen}
            className={cn(
              "ml-[21px] mt-1 space-y-1 border-l border-[var(--color-border)] pl-2.5",
              "transition-opacity ease-[var(--ease-out-cubic)]",
              isOpen ? "opacity-100 duration-[var(--duration-default)]" : "opacity-0 duration-[var(--duration-fast)]",
            )}
          >
            {section.items.map((item) => (
              <NavItemLink key={item.to} item={item} collapsed={false} compact onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Nav item link — top-level pages, section children (compact: no icon)
// and the collapsed rail's icon stack.
// ────────────────────────────────────────────────────────────────────────

function NavItemLink({
  item,
  collapsed,
  compact = false,
  onNavigate,
}: {
  item: NavSpec;
  collapsed: boolean;
  /** Section children: text-only rows hung off the section's guide line. */
  compact?: boolean;
  /** Fired after the link click. Used by the mobile sheet to close
   *  itself once the user navigates somewhere. */
  onNavigate?: () => void;
}) {
  const { t } = useTranslation("nav");
  const Icon = item.icon;
  const label = t(item.labelKey);
  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      title={collapsed ? label : undefined}
      // When collapsed the text label is hidden, so the icon-only link needs
      // an explicit accessible name (title alone is the weakest AT signal).
      aria-label={collapsed ? label : undefined}
      onClick={onNavigate}
      className={({ isActive }) => cn(itemClass(isActive, collapsed), compact && "h-9 text-[13px]")}
    >
      {!compact && <Icon className="size-[18px] shrink-0" strokeWidth={1.6} />}

      {!collapsed && <span className="truncate">{label}</span>}

      {/* Tooltip in collapsed mode — hover or keyboard focus. */}
      {collapsed && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap",
            "rounded-md border border-[var(--color-border)] bg-[var(--color-popover)] px-2 py-1",
            "text-xs font-medium text-[var(--color-popover-foreground)] shadow-[var(--shadow-md)]",
            "opacity-0 transition-opacity duration-[var(--duration-fast)] ease-[var(--ease-out-cubic)]",
            "group-hover/nav:opacity-100 group-focus-visible/nav:opacity-100",
          )}
        >
          {label}
        </span>
      )}
    </NavLink>
  );
}
