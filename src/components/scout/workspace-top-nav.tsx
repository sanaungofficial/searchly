"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BellIcon } from "./workspace-icons";
import { NOTIFICATIONS } from "./workspace-data";
import { UserSettingsModal } from "./user-settings-modal";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { profileCompletenessPct } from "@/lib/profile-completeness";
import { canAccessBetaFeature } from "@/lib/beta-features";
import { isStaffPortalRole, STAFF_DASHBOARD_NAV, matchStaffDashboardNavPath, isExpertPortalPath } from "@/lib/staff-portal";
import { isAdminClientReviewPath } from "@/lib/workspace-urls";
import { ADMIN_NAV, matchAdminNavPath } from "@/lib/admin-nav";
import { KimchiBySecondLadder } from "./scout-box";
import { border, color, fontDisplay, fontSans, surface, type as T } from "@/lib/typography";
import { matchNetworkingPath, matchOpportunitiesNavPath, INBOX_PATH } from "@/lib/workspace-urls";
import { syncWorkspaceNavHeight } from "@/lib/workspace-layout";
import { TOP_NAV_Z } from "@/lib/z-layers";
import { buildAuthUrl, isPublicCoachingPath } from "@/lib/auth-return-url";

export const TOP_NAV_HEIGHT = 64;
export const TOP_NAV_HEIGHT_MOBILE = 56;

type NavChild = { label: string; path: string; match: (pathname: string) => boolean };

type NavLink = {
  id: string;
  label: string;
  path: string;
  match: (pathname: string) => boolean;
  children?: NavChild[];
};

function buildNavLinks(opts: { isAdmin: boolean }): NavLink[] {
  const { isAdmin } = opts;
  const links: NavLink[] = [];
  links.push({
    id: "dashboard",
    label: "Dashboard",
    path: "/dashboard",
    match: (p) =>
      (p === "/dashboard" || p.startsWith("/dashboard/")) &&
      !isAdminClientReviewPath(p),
  });
  links.push({
    id: "opportunities",
    label: "Opportunities",
    path: "/opportunities",
    match: matchOpportunitiesNavPath,
  });
  links.push({
    id: "networking",
    label: "Networking",
    path: INBOX_PATH,
    match: matchNetworkingPath,
  });
  if (canAccessBetaFeature("coaching", isAdmin)) {
    links.push({
      id: "coaching",
      label: "Coaching",
      path: "/coaching",
      match: (p) => p.startsWith("/coaching"),
    });
  }
  links.push({
    id: "profile",
    label: "Profile",
    path: "/profile",
    match: (p) => p.startsWith("/profile"),
  });
  return links;
}

function initials(name: string | null, email: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function NavDropdownMenuItem({
  label,
  active,
  href,
  onClick,
}: {
  label: string;
  active: boolean;
  href: string;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const highlighted = active || hover;

  return (
    <Link
      href={href}
      role="menuitem"
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onClick?.();
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "10px 12px",
        border: "none",
        borderRadius: "var(--scout-radius)",
        background: highlighted ? "rgba(26,58,47,0.07)" : "transparent",
        color: highlighted ? color.forest : color.stone,
        fontFamily: fontSans,
        fontSize: T.bodySm,
        fontWeight: active ? 600 : hover ? 600 : 500,
        cursor: "pointer",
        textDecoration: "none",
        transition: "background 0.12s ease, color 0.12s ease",
      }}
    >
      {label}
    </Link>
  );
}

function ExpertModeChip({ isMobile }: { isMobile: boolean }) {
  return (
    <span
      aria-label="Expert mode"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: isMobile ? "4px 8px" : "5px 10px",
        borderRadius: "var(--scout-radius)",
        background: "rgba(26,58,47,0.08)",
        border: "1px solid rgba(26,58,47,0.14)",
        fontFamily: fontSans,
        fontSize: isMobile ? 10 : T.caption,
        fontWeight: 600,
        color: color.forest,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      Expert mode
    </span>
  );
}

function NavChevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(180deg)" : "none",
        transition: "transform 0.15s",
        opacity: 0.7,
        flexShrink: 0,
      }}
      aria-hidden
    >
      <path d="M2 4l4 4 4-4" />
    </svg>
  );
}

function UtilityPortalDropdown({
  label,
  defaultPath,
  active,
  items,
  dropdownOpen,
  isMobile,
  onOpen,
  onScheduleClose,
  onToggle,
  resolveHref,
  onNavigate,
  pathname,
}: {
  label: string;
  defaultPath: string;
  active: boolean;
  items: NavChild[];
  dropdownOpen: boolean;
  isMobile: boolean;
  onOpen: () => void;
  onScheduleClose: () => void;
  onToggle: () => void;
  resolveHref: (path: string) => string;
  onNavigate?: (path: string) => void;
  pathname: string;
}) {
  return (
    <div
      style={{ position: "relative", flexShrink: 0 }}
      onMouseEnter={() => {
        if (!isMobile) onOpen();
      }}
      onMouseLeave={() => {
        if (!isMobile) onScheduleClose();
      }}
    >
      <Link
        href={resolveHref(defaultPath)}
        className={`workspace-nav-portal-btn${active ? " is-active" : ""}${dropdownOpen ? " is-open" : ""}`}
        onClick={(e) => {
          if (isMobile) {
            e.preventDefault();
            onToggle();
            return;
          }
          e.preventDefault();
          onNavigate?.(defaultPath);
        }}
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          padding: isMobile ? "6px 10px" : "7px 12px",
          background: dropdownOpen || active ? "rgba(26,58,47,0.06)" : surface.card,
          border: active ? "var(--scout-border)" : "var(--scout-border)",
          borderRadius: "var(--scout-radius)",
          cursor: "pointer",
          fontFamily: fontSans,
          fontSize: isMobile ? 11 : T.caption,
          fontWeight: active ? 600 : 500,
          color: active ? color.forest : color.muted,
          whiteSpace: "nowrap",
          textDecoration: "none",
          transition: "background 0.15s, color 0.15s, border-color 0.15s",
        }}
      >
        {label}
        <NavChevron open={dropdownOpen} />
      </Link>
      {dropdownOpen && (
        <div
          role="menu"
          onMouseEnter={() => {
            if (!isMobile) onOpen();
          }}
          onMouseLeave={() => {
            if (!isMobile) onScheduleClose();
          }}
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            minWidth: 200,
            padding: 4,
            background: surface.card,
            border: "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
            boxShadow: "var(--scout-shadow-card-strong)",
            zIndex: 130,
            animation: "fadeIn 0.15s ease both",
          }}
        >
          {items.map(({ label: childLabel, path: childPath, match: childMatch }) => (
            <NavDropdownMenuItem
              key={childPath}
              label={childLabel}
              active={childMatch(pathname)}
              href={resolveHref(childPath)}
              onClick={() => onNavigate?.(childPath)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationMenuItem({
  unread,
  onClick,
  children,
}: {
  unread: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        background: hover ? "rgba(26,58,47,0.06)" : unread ? "rgba(26,58,47,0.03)" : "transparent",
        border: "none",
        borderRadius: "var(--scout-radius)",
        cursor: "pointer",
        display: "flex",
        gap: 10,
        transition: "background 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}

function BurgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function MobileDrawerLink({
  label,
  active,
  href,
  onClick,
  indent = false,
}: {
  label: string;
  active: boolean;
  href: string;
  onClick?: () => void;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`workspace-nav-drawer-link${active ? " is-active" : ""}`}
      onClick={onClick}
      style={{
        display: "block",
        width: "calc(100% - 24px)",
        margin: "0 12px",
        textAlign: "left",
        padding: indent ? "10px 12px 10px 28px" : "10px 12px",
        border: "none",
        borderRadius: "var(--scout-radius)",
        background: active ? "rgba(26,58,47,0.08)" : "transparent",
        borderLeft: active ? `3px solid ${color.forest}` : "3px solid transparent",
        color: active ? color.forest : color.stone,
        fontFamily: fontSans,
        fontSize: T.bodySm,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}

function MobileDrawerSectionLabel({ label }: { label: string }) {
  return (
    <p
      style={{
        margin: "16px 16px 6px",
        fontFamily: fontSans,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: color.muted,
      }}
    >
      {label}
    </p>
  );
}

function MobileTopNavDrawer({
  open,
  onClose,
  navLinks,
  pathname,
  resolveHref,
  onNavigateMain,
  showExpertModeChip,
  showExpertSection,
  expertNavItems,
  onNavigateExpert,
  showAdminSection,
  adminNavItems,
  onNavigateAdmin,
}: {
  open: boolean;
  onClose: () => void;
  navLinks: NavLink[];
  pathname: string;
  resolveHref: (path: string) => string;
  onNavigateMain: (link: NavLink, childPath?: string) => void;
  showExpertModeChip: boolean;
  showExpertSection: boolean;
  expertNavItems: NavChild[];
  onNavigateExpert: (path: string) => void;
  showAdminSection: boolean;
  adminNavItems: NavChild[];
  onNavigateAdmin: (path: string) => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        onClick={onClose}
        style={{
          position: "fixed",
          top: "var(--workspace-stack-top, 56px)",
          left: 0,
          right: 0,
          bottom: 0,
          border: "none",
          padding: 0,
          background: "rgba(15, 24, 20, 0.35)",
          zIndex: 120,
          cursor: "pointer",
        }}
      />
      <aside
        id="workspace-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        style={{
          position: "fixed",
          top: "var(--workspace-stack-top, 56px)",
          left: 0,
          bottom: 0,
          width: "min(300px, calc(100vw - 48px))",
          background: surface.card,
          borderRight: "var(--scout-border)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.12)",
          zIndex: 125,
          display: "flex",
          flexDirection: "column",
          padding: "12px 0 24px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          animation: "workspaceNavSlideIn 0.2s ease both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 12px",
            marginBottom: 4,
            borderBottom: "var(--scout-border)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: fontSans,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: color.muted,
            }}
          >
            Menu
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              background: "none",
              border: "none",
              fontSize: 22,
              lineHeight: 1,
              color: color.muted,
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        {showExpertModeChip && (
          <div style={{ padding: "8px 16px 4px" }}>
            <ExpertModeChip isMobile />
          </div>
        )}

        <nav aria-label="Main navigation" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navLinks.map((link) => {
            const active = link.match(pathname);
            if (link.children?.length) {
              return (
                <div key={link.id}>
                  <MobileDrawerSectionLabel label={link.label} />
                  {link.children.map((child) => (
                    <MobileDrawerLink
                      key={child.path}
                      label={child.label}
                      active={child.match(pathname)}
                      href={resolveHref(child.path)}
                      onClick={() => onNavigateMain(link, child.path)}
                      indent
                    />
                  ))}
                </div>
              );
            }
            return (
              <MobileDrawerLink
                key={link.id}
                label={link.label}
                active={active}
                href={resolveHref(link.path)}
                onClick={() => onNavigateMain(link)}
              />
            );
          })}
        </nav>

        {showExpertSection && (
          <>
            <MobileDrawerSectionLabel label="Expert" />
            {expertNavItems.map((item) => (
              <MobileDrawerLink
                key={item.path}
                label={item.label}
                active={item.match(pathname)}
                href={resolveHref(item.path)}
                onClick={() => onNavigateExpert(item.path)}
              />
            ))}
          </>
        )}

        {showAdminSection && (
          <>
            <MobileDrawerSectionLabel label="Admin" />
            {adminNavItems.map((item) => (
              <MobileDrawerLink
                key={item.path}
                label={item.label}
                active={item.match(pathname)}
                href={resolveHref(item.path)}
                onClick={() => onNavigateAdmin(item.path)}
              />
            ))}
          </>
        )}
      </aside>
      <style>{`
        @keyframes workspaceNavSlideIn {
          from { transform: translateX(-100%); opacity: 0.6; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}

type Props = {
  isMobile?: boolean;
  user?: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
    headline?: string | null;
  };
  isAdmin?: boolean;
};

export function WorkspaceTopNav({ isMobile: isMobileProp = false, user, isAdmin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const navDropdownCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobileHook = useIsMobile();
  const isMobile = isMobileProp || isMobileHook;

  const {
    notifOpen,
    setNotifOpen,
    notifRead,
    setNotifRead,
    notifUnreadCount,
    handleSignOut,
    updateAvatarUrl,
    authChecked,
    userRole,
    showAdminUi,
    setStaffDashboardView,
    isImpersonating,
    isAdminReviewing,
    withClientScope,
    withClientReviewPath,
  } = useWorkspace();

  const isStaffPortal = isStaffPortalRole(userRole);
  const navHeight = isMobile ? TOP_NAV_HEIGHT_MOBILE : TOP_NAV_HEIGHT;
  const navLinks = buildNavLinks({ isAdmin: showAdminUi });
  const horizontalPad = isMobile ? 16 : 28;
  const [navDropdownOpen, setNavDropdownOpen] = useState<string | null>(null);
  const isLoggedOut = !user;
  const showGuestWorkspaceNav = isLoggedOut && isPublicCoachingPath(pathname);

  const resolveNavHref = (path: string) => {
    if (showGuestWorkspaceNav && !isPublicCoachingPath(path)) {
      return buildAuthUrl("login", path);
    }
    return withClientReviewPath(path);
  };

  const expertPortalActive =
    isStaffPortal &&
    !isImpersonating &&
    !isAdminReviewing &&
    isExpertPortalPath(pathname);
  const showExpertModeChip =
    isStaffPortal &&
    !isImpersonating &&
    isExpertPortalPath(pathname);
  const adminPortalActive = showAdminUi && pathname.startsWith("/admin");

  const expertNavItems: NavChild[] = STAFF_DASHBOARD_NAV.map(({ label, path }) => ({
    label,
    path,
    match: (p) => matchStaffDashboardNavPath(p, path),
  }));

  const adminNavItems: NavChild[] = ADMIN_NAV.map(({ label, path }) => ({
    label,
    path,
    match: (p) => matchAdminNavPath(p, path),
  }));

  const syncSeekerWorkspaceView = () => {
    if (isStaffPortal && !isImpersonating && !isAdminReviewing) setStaffDashboardView("seeker");
  };

  const navigateExpertPortal = (path: string) => {
    if (isStaffPortal && !isImpersonating) setStaffDashboardView("expert");
    setNavDropdownOpen(null);
    router.push(resolveNavHref(path));
  };

  const navigateAdminPortal = (path: string) => {
    setNavDropdownOpen(null);
    router.push(resolveNavHref(path));
  };

  const clearNavDropdownCloseTimer = () => {
    if (navDropdownCloseTimer.current) {
      clearTimeout(navDropdownCloseTimer.current);
      navDropdownCloseTimer.current = null;
    }
  };

  const openNavDropdown = (id: string) => {
    clearNavDropdownCloseTimer();
    setNavDropdownOpen(id);
  };

  const scheduleCloseNavDropdown = () => {
    clearNavDropdownCloseTimer();
    navDropdownCloseTimer.current = setTimeout(() => setNavDropdownOpen(null), 120);
  };

  useEffect(() => {
    if (!authChecked || isAdminReviewing || showGuestWorkspaceNav) return;
    fetch(withClientScope("/api/profile"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setProfileIncomplete(profileCompletenessPct(data) < 80);
        }
      })
      .catch(() => {});
  }, [authChecked, isAdminReviewing, withClientScope, showGuestWorkspaceNav]);

  useEffect(() => {
    setNavDropdownOpen(null);
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen, isMobile]);

  useEffect(() => {
    if (!isMobile && mobileMenuOpen) setMobileMenuOpen(false);
  }, [isMobile, mobileMenuOpen]);

  useEffect(() => {
    if (!navDropdownOpen || !isMobile) return;
    const onDoc = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavDropdownOpen(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [navDropdownOpen, isMobile]);

  useEffect(() => () => clearNavDropdownCloseTimer(), []);

  useEffect(() => {
    syncWorkspaceNavHeight(navHeight);
  }, [navHeight]);

  useEffect(() => {
    if (!isStaffPortal || isImpersonating || isAdminReviewing) return;
    if (isExpertPortalPath(pathname)) {
      setStaffDashboardView("expert");
      return;
    }
    if (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard/") ||
      pathname.startsWith("/opportunities") ||
      matchNetworkingPath(pathname) ||
      pathname.startsWith("/coaching") ||
      pathname.startsWith("/profile")
    ) {
      setStaffDashboardView("seeker");
    }
  }, [pathname, isStaffPortal, isImpersonating, isAdminReviewing, setStaffDashboardView]);

  const onToggleNotif = () => setNotifOpen((p) => !p);

  const onNavigateNotif = (section: string) => {
    const path = section === "opportunities" ? "/opportunities" : `/${section}`;
    router.push(withClientReviewPath(path));
    const allRead: Record<number, boolean> = {};
    NOTIFICATIONS.forEach((n) => (allRead[n.id] = true));
    setNotifRead(allRead);
    setNotifOpen(false);
  };

  const markAllNotificationsRead = () => {
    const allRead: Record<number, boolean> = {};
    NOTIFICATIONS.forEach((n) => (allRead[n.id] = true));
    setNotifRead(allRead);
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const navigateTo = (path: string) => {
    syncSeekerWorkspaceView();
    setNavDropdownOpen(null);
    closeMobileMenu();
    router.push(resolveNavHref(path));
  };

  const onNavLinkClick = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigateTo(path);
  };

  const navigateMainFromDrawer = (link: NavLink, childPath?: string) => {
    navigateTo(childPath ?? link.path);
  };

  const navigateExpertFromDrawer = (path: string) => {
    navigateExpertPortal(path);
    closeMobileMenu();
  };

  const navigateAdminFromDrawer = (path: string) => {
    navigateAdminPortal(path);
    closeMobileMenu();
  };

  const showExpertSection = isStaffPortal && !isImpersonating && !isAdminReviewing;
  const showAdminSection = showAdminUi || isAdminReviewing;

  if (isLoggedOut && !showGuestWorkspaceNav) {
    const homeHref = pathname.startsWith("/coaching") ? "/coaching" : "/";

    return (
      <>
      <header
        style={{
          height: navHeight,
          flexShrink: 0,
          background: surface.page,
          borderBottom: "var(--scout-border)",
          boxSizing: "border-box",
          position: "fixed",
          top: "var(--workspace-top-offset, 0px)",
          left: 0,
          right: 0,
          zIndex: TOP_NAV_Z,
          isolation: "isolate",
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: isMobile ? 12 : 24,
            padding: `0 ${horizontalPad}px`,
            maxWidth: 1440,
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          <Link
            href={homeHref}
            style={{
              textDecoration: "none",
              color: "inherit",
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: fontDisplay,
                fontSize: isMobile ? 20 : 22,
                fontWeight: 500,
                color: color.forest,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
              }}
            >
              Kimchi
            </span>
            {!isMobile && (
              <KimchiBySecondLadder fontSize={11} color={color.muted} marginTop={2} />
            )}
          </Link>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 10, flexShrink: 0 }}>
            <Link
              href="/login"
              className="workspace-nav-outline-btn"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 36,
                padding: isMobile ? "6px 12px" : "8px 14px",
                fontFamily: fontSans,
                fontSize: isMobile ? T.caption : T.bodySm,
                fontWeight: 500,
                color: color.forest,
                textDecoration: "none",
                background: surface.page,
                border: "var(--scout-border)",
              }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="workspace-nav-primary-btn workspace-nav-primary-btn--forest"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 36,
                padding: isMobile ? "6px 14px" : "8px 16px",
                fontFamily: fontSans,
                fontSize: isMobile ? T.caption : T.bodySm,
                fontWeight: 600,
                color: color.gold,
                textDecoration: "none",
                background: color.forest,
                border: "var(--scout-border)",
              }}
            >
              Get started
            </Link>
          </div>
        </div>
      </header>
      <div aria-hidden style={{ height: navHeight, flexShrink: 0 }} />
      </>
    );
  }

  return (
    <>
      <header
        ref={navRef}
        style={{
          height: navHeight,
          flexShrink: 0,
          background: surface.card,
          borderBottom: "var(--scout-border)",
          boxSizing: "border-box",
          position: "fixed",
          top: "var(--workspace-top-offset, 0px)",
          left: 0,
          right: 0,
          zIndex: TOP_NAV_Z,
          isolation: "isolate",
        }}
      >
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            gap: isMobile ? 12 : 32,
            padding: `0 ${horizontalPad}px`,
            maxWidth: 1440,
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {/* Mobile burger */}
          <button
            type="button"
            className="workspace-top-nav-burger"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="workspace-mobile-nav"
            style={{
              alignItems: "center",
              justifyContent: "center",
              width: 40,
              height: 40,
              padding: 0,
              border: "var(--scout-border)",
              borderRadius: "var(--scout-radius)",
              background: surface.card,
              color: color.forest,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <BurgerIcon />
          </button>

          {/* Logo */}
          <Link
            href={showGuestWorkspaceNav ? "/coaching" : resolveNavHref("/dashboard")}
            onClick={() => {
              if (!showGuestWorkspaceNav) syncSeekerWorkspaceView();
            }}
            style={{
              textDecoration: "none",
              color: "inherit",
              flexShrink: 0,
            }}
            aria-label="Kimchi home"
          >
            <span
              style={{
                fontFamily: fontDisplay,
                fontSize: isMobile ? 20 : 22,
                fontWeight: 500,
                color: color.ink,
                letterSpacing: "-0.02em",
              }}
            >
              Kimchi
            </span>
          </Link>

          {/* Nav links — desktop only; mobile uses burger drawer */}
          <nav
            className="workspace-top-nav-desktop-links"
            aria-label="Main"
            style={{
              alignItems: "center",
              gap: isMobile ? 4 : 8,
              flex: 1,
              minWidth: 0,
            }}
          >
            {navLinks.map(({ id, label, path, match, children }) => {
              const active = match(pathname);
              const hasChildren = Boolean(children?.length);
              const dropdownOpen = navDropdownOpen === id;

              if (hasChildren) {
                return (
                  <div
                    key={id}
                    style={{ position: "relative", flexShrink: 0 }}
                    onMouseEnter={() => {
                      if (!isMobile) openNavDropdown(id);
                    }}
                    onMouseLeave={() => {
                      if (!isMobile) scheduleCloseNavDropdown();
                    }}
                  >
                    <Link
                      href={resolveNavHref(path)}
                      className={`workspace-nav-link${active ? " is-active" : ""}${dropdownOpen ? " is-open" : ""}`}
                      onClick={(e) => {
                        if (isMobile) {
                          e.preventDefault();
                          setNavDropdownOpen((prev) => (prev === id ? null : id));
                        } else {
                          onNavLinkClick(path)(e);
                        }
                      }}
                      aria-expanded={dropdownOpen}
                      aria-haspopup="menu"
                      style={{
                        background: dropdownOpen ? "rgba(26,58,47,0.04)" : "none",
                        border: "none",
                        borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
                        padding: isMobile ? "0 10px" : "0 14px",
                        height: navHeight,
                        cursor: "pointer",
                        fontFamily: fontSans,
                        fontSize: isMobile ? T.caption : T.bodySm,
                        fontWeight: active ? 600 : 500,
                        color: active ? color.forest : color.muted,
                        whiteSpace: "nowrap",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        textDecoration: "none",
                        transition: "color 0.15s, background 0.15s",
                        boxSizing: "border-box",
                      }}
                    >
                      {label}
                      <NavChevron open={dropdownOpen} />
                    </Link>
                    {dropdownOpen && (
                      <div
                        role="menu"
                        onMouseEnter={() => {
                          if (!isMobile) openNavDropdown(id);
                        }}
                        onMouseLeave={() => {
                          if (!isMobile) scheduleCloseNavDropdown();
                        }}
                        style={{
                          position: "absolute",
                          top: "100%",
                          left: 0,
                          minWidth: 200,
                          marginTop: 4,
                          padding: 4,
                          background: surface.card,
                          border: "var(--scout-border)",
                          borderRadius: "var(--scout-radius)",
                          boxShadow: "var(--scout-shadow-card-strong)",
                          zIndex: 130,
                          animation: "fadeIn 0.15s ease both",
                        }}
                      >
                        {children!.map(({ label: childLabel, path: childPath, match: childMatch }) => {
                          const childActive = childMatch(pathname);
                          return (
                            <NavDropdownMenuItem
                              key={childPath}
                              label={childLabel}
                              active={childActive}
                              href={resolveNavHref(childPath)}
                              onClick={() => navigateTo(childPath)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={id}
                  href={resolveNavHref(path)}
                  className={`workspace-nav-link${active ? " is-active" : ""}`}
                  onClick={onNavLinkClick(path)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: active ? `2px solid ${color.forest}` : "2px solid transparent",
                    padding: isMobile ? "0 10px" : "0 14px",
                    height: navHeight,
                    cursor: "pointer",
                    fontFamily: fontSans,
                    fontSize: isMobile ? T.caption : T.bodySm,
                    fontWeight: active ? 600 : 500,
                    color: active ? color.forest : color.muted,
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    transition: "color 0.15s",
                    boxSizing: "border-box",
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions — expert/admin portals + account utilities */}
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0, marginLeft: "auto" }}>
            {showGuestWorkspaceNav ? (
              <>
                <Link
                  href={buildAuthUrl("login", pathname)}
                  className="workspace-nav-outline-btn"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 36,
                    padding: isMobile ? "6px 12px" : "8px 14px",
                    fontFamily: fontSans,
                    fontSize: isMobile ? T.caption : T.bodySm,
                    fontWeight: 500,
                    color: color.forest,
                    textDecoration: "none",
                    background: surface.card,
                    border: "var(--scout-border)",
                  }}
                >
                  Sign in
                </Link>
                <Link
                  href={buildAuthUrl("signup", pathname)}
                  className="workspace-nav-primary-btn workspace-nav-primary-btn--forest"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 36,
                    padding: isMobile ? "6px 14px" : "8px 16px",
                    fontFamily: fontSans,
                    fontSize: isMobile ? T.caption : T.bodySm,
                    fontWeight: 600,
                    color: color.gold,
                    textDecoration: "none",
                    background: color.forest,
                    border: "var(--scout-border)",
                  }}
                >
                  Get started
                </Link>
              </>
            ) : (
              <>
            <div
              className="workspace-top-nav-desktop-portals"
              style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, flexShrink: 0 }}
            >
              {showExpertModeChip && <ExpertModeChip isMobile={isMobile} />}
              {showExpertSection && (
                <UtilityPortalDropdown
                  label={isMobile ? "Expert" : "Expert mode"}
                  defaultPath="/expert/dashboard"
                  active={expertPortalActive}
                  items={expertNavItems}
                  dropdownOpen={navDropdownOpen === "expert-portal"}
                  isMobile={isMobile}
                  pathname={pathname}
                  resolveHref={resolveNavHref}
                  onOpen={() => openNavDropdown("expert-portal")}
                  onScheduleClose={scheduleCloseNavDropdown}
                  onToggle={() =>
                    setNavDropdownOpen((prev) => (prev === "expert-portal" ? null : "expert-portal"))
                  }
                  onNavigate={navigateExpertPortal}
                />
              )}
              {showAdminSection && (
                <UtilityPortalDropdown
                  label="Admin"
                  defaultPath="/admin/dashboard"
                  active={adminPortalActive}
                  items={adminNavItems}
                  dropdownOpen={navDropdownOpen === "admin-portal"}
                  isMobile={isMobile}
                  pathname={pathname}
                  resolveHref={resolveNavHref}
                  onOpen={() => openNavDropdown("admin-portal")}
                  onScheduleClose={scheduleCloseNavDropdown}
                  onToggle={() =>
                    setNavDropdownOpen((prev) => (prev === "admin-portal" ? null : "admin-portal"))
                  }
                  onNavigate={navigateAdminPortal}
                />
              )}
            </div>

            <button
              type="button"
              onClick={onToggleNotif}
              aria-label="Notifications"
              style={{
                position: "relative",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: notifOpen ? "rgba(26,58,47,0.06)" : "transparent",
                border: "var(--scout-border)",
                borderColor: notifOpen ? "rgba(17,17,17,0.22)" : "rgba(17,17,17,0.12)",
                borderRadius: "50%",
                cursor: "pointer",
                color: color.forest,
                transition: "background 0.15s",
              }}
            >
              <BellIcon />
              {notifUnreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#4A8B6A",
                    border: "1.5px solid #FFFFFF",
                  }}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Account settings"
              style={{
                position: "relative",
                width: 36,
                height: 36,
                padding: 0,
                border: "var(--scout-border)",
                borderRadius: "50%",
                cursor: "pointer",
                overflow: "hidden",
                background: "rgba(26,58,47,0.06)",
                flexShrink: 0,
              }}
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%",
                    height: "100%",
                    fontFamily: fontSans,
                    fontSize: 12,
                    fontWeight: 600,
                    color: color.forest,
                  }}
                >
                  {user ? initials(user.name, user.email) : "?"}
                </span>
              )}
              {profileIncomplete && (
                <span
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#C4A86A",
                    border: "1.5px solid #FFFFFF",
                  }}
                />
              )}
            </button>
              </>
            )}
          </div>
        </div>
      </header>
      <div aria-hidden style={{ height: navHeight, flexShrink: 0 }} />

      <MobileTopNavDrawer
        open={mobileMenuOpen}
        onClose={closeMobileMenu}
        navLinks={navLinks}
        pathname={pathname}
        resolveHref={resolveNavHref}
        onNavigateMain={navigateMainFromDrawer}
        showExpertModeChip={showExpertModeChip}
        showExpertSection={showExpertSection}
        expertNavItems={expertNavItems}
        onNavigateExpert={navigateExpertFromDrawer}
        showAdminSection={showAdminSection}
        adminNavItems={adminNavItems}
        onNavigateAdmin={navigateAdminFromDrawer}
      />

      <style>{`
        .workspace-top-nav-burger {
          display: none;
        }
        .workspace-top-nav-desktop-links {
          display: flex;
        }
        .workspace-top-nav-desktop-portals {
          display: flex;
        }
        .workspace-nav-link {
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        }
        .workspace-nav-link:not(.is-active):hover {
          color: var(--scout-forest) !important;
          border-bottom-color: rgba(26, 58, 47, 0.4) !important;
          font-weight: 600;
        }
        .workspace-nav-link.is-active:hover {
          background: rgba(26, 58, 47, 0.05);
        }
        .workspace-nav-link.is-open:not(.is-active) {
          color: var(--scout-forest) !important;
        }
        .workspace-nav-outline-btn {
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .workspace-nav-outline-btn:hover {
          background: rgba(26, 58, 47, 0.06) !important;
          border-color: rgba(26, 58, 47, 0.22) !important;
        }
        .workspace-nav-primary-btn {
          cursor: pointer;
          transition: background 0.15s ease, filter 0.15s ease;
        }
        .workspace-nav-primary-btn--forest:hover {
          background: #224a3d !important;
        }
        .workspace-nav-drawer-link {
          cursor: pointer;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .workspace-nav-drawer-link:not(.is-active):hover {
          background: rgba(26, 58, 47, 0.06);
          color: var(--scout-forest);
        }
        .workspace-nav-drawer-link.is-active:hover {
          background: rgba(26, 58, 47, 0.1);
        }
        .workspace-nav-portal-btn {
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }
        .workspace-nav-portal-btn:not(.is-active):hover,
        .workspace-nav-portal-btn.is-open:not(.is-active) {
          background: rgba(26, 58, 47, 0.06) !important;
          color: var(--scout-forest) !important;
        }
        .workspace-nav-portal-btn.is-active:hover {
          background: rgba(26, 58, 47, 0.09) !important;
        }
        .workspace-top-nav-burger:hover {
          background: rgba(26, 58, 47, 0.06) !important;
        }
        @media (max-width: 767px) {
          .workspace-top-nav-burger {
            display: inline-flex;
          }
          .workspace-top-nav-desktop-links {
            display: none !important;
          }
          .workspace-top-nav-desktop-portals {
            display: none !important;
          }
        }
      `}</style>

      {settingsOpen && user && (
        <UserSettingsModal
          user={user}
          onClose={() => setSettingsOpen(false)}
          onSignOut={() => {
            setSettingsOpen(false);
            handleSignOut();
          }}
          onAvatarChange={updateAvatarUrl}
        />
      )}

      {notifOpen && !showGuestWorkspaceNav && (
        <>
          <div
            onClick={onToggleNotif}
            style={{ position: "fixed", top: "var(--workspace-stack-top)", left: 0, right: 0, bottom: 0, zIndex: 110 }}
            aria-hidden
          />
          <div
            style={{
              position: "fixed",
              top: `calc(var(--workspace-stack-top, ${navHeight}px) + 8px)`,
              right: horizontalPad,
              width: isMobile ? "min(320px, calc(100vw - 32px))" : 320,
              background: surface.card,
              border: "var(--scout-border)",
              zIndex: 120,
              overflow: "hidden",
              animation: "fadeIn 0.2s ease both",
              boxShadow: "0 8px 32px rgba(17,17,17,0.1)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "var(--scout-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: T.label,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: color.muted,
                  margin: 0,
                }}
              >
                Notifications
              </p>
              {notifUnreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  style={{
                    background: "none",
                    border: "var(--scout-border)",
                    padding: "4px 8px",
                    fontFamily: fontSans,
                    fontSize: T.label,
                    fontWeight: 600,
                    color: color.forest,
                    cursor: "pointer",
                  }}
                >
                  Mark read
                </button>
              )}
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto", padding: "6px 8px 8px" }}>
              {NOTIFICATIONS.length === 0 ? (
                <div style={{ padding: "36px 18px", textAlign: "center" }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, lineHeight: 1.5, margin: 0 }}>
                    You&apos;re all caught up
                  </p>
                </div>
              ) : (
                NOTIFICATIONS.map((n) => {
                  const dotColor =
                    n.type === "role" ? "#4A8B6A" : n.type === "deadline" ? "#C4574A" : "#C4A86A";
                  return (
                    <NotificationMenuItem
                      key={n.id}
                      unread={n.unread}
                      onClick={() => onNavigateNotif(n.section)}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          background: dotColor,
                          marginTop: 6,
                          flexShrink: 0,
                          opacity: n.unread ? 1 : 0.3,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
                          <span style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink }}>
                            {n.title}
                          </span>
                          <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                            · {n.company}
                          </span>
                        </div>
                        <p
                          style={{
                            fontFamily: fontSans,
                            fontSize: T.caption,
                            fontWeight: 400,
                            color: color.stone,
                            lineHeight: 1.45,
                            margin: "0 0 4px",
                          }}
                        >
                          {n.body}
                        </p>
                        <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted }}>
                          {n.time}
                        </span>
                      </div>
                    </NotificationMenuItem>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
