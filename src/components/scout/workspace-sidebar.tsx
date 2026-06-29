// build
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DashboardIcon,
  OpportunitiesIcon,
  InboxIcon,
  ProfileIcon,
  CoachingIcon,
  BellIcon,
  ArrowLeftIcon,
} from "./workspace-icons";
import { NOTIFICATIONS } from "./workspace-data";
import { UserSettingsModal } from "./user-settings-modal";
import { ReferEarnModal } from "./refer-earn-modal";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";
import { CreditsSidebarBlock, CreditsMeter } from "./credits-display";
import { KimchiBySecondLadder } from "./scout-box";
import { profileCompletenessPct } from "@/lib/profile-completeness";
import { border as citeBorder } from "@/lib/typography";
import { BETA_FEATURES, isProductionEnv } from "@/lib/beta-features";
import { sidebarTheme as S } from "@/lib/sidebar-theme";
import { matchInboxPath, matchOpportunitiesNavPath, OPPORTUNITIES_NAV } from "@/lib/workspace-urls";
import { isStaffPortalRole, EXPERT_DASHBOARD_PATH, isExpertPortalPath } from "@/lib/staff-portal";

interface SidebarProps {
  isMobile?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  // legacy props kept for compatibility
  isOpen?: boolean;
  onClose?: () => void;
  user?: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
    headline?: string | null;
  };
  isAdmin?: boolean;
  userRole?: string;
}

interface NavItem {
  id: string;
  label: string;
  path: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}

const IS_PROD = isProductionEnv();

const NAV_MAIN: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", Icon: DashboardIcon },
  {
    id: "coaching",
    label: BETA_FEATURES.coaching.navLabel,
    path: "/coaching",
    Icon: CoachingIcon,
  },
  { id: "profile", label: "Profile", path: "/profile", Icon: ProfileIcon },
];

function SidebarNavButton({
  active,
  onClick,
  label,
  Icon,
  isRail,
  badge,
  showIncompleteDot,
  showLiveDot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: NavItem["Icon"];
  isRail: boolean;
  badge?: number;
  showIncompleteDot?: boolean;
  showLiveDot?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isRail ? label : undefined}
      style={{
        padding: isRail ? "10px 0" : "10px 14px",
        borderRadius: "var(--scout-radius)",
        cursor: "pointer",
        background: active ? S.bgActive : "transparent",
        border: S.border,
        borderColor: active ? "rgba(232,213,163,0.42)" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: isRail ? "center" : "flex-start",
        gap: 11,
        transition: "background 0.15s, border-color 0.15s",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = S.bgHover;
          e.currentTarget.style.borderColor = "rgba(232, 213, 163, 0.22)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          color: active ? S.iconActive : S.icon,
          flexShrink: 0,
        }}
      >
        <Icon />
        {showLiveDot && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 6,
              height: 6,
              background: "#C4574A",
              border: `1.5px solid ${S.bg}`,
              animation: "pulse 1.5s ease infinite",
            }}
          />
        )}
        {showIncompleteDot && (
          <span
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 6,
              height: 6,
              background: "#C4A86A",
              border: `1.5px solid ${S.bg}`,
            }}
          />
        )}
      </span>
      {!isRail && (
        <>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 15,
              fontWeight: active ? 600 : 500,
              color: active ? S.textActive : S.text,
              flex: 1,
              minWidth: 0,
            }}
          >
            {label}
          </span>
          {badge !== undefined && badge > 0 && (
            <span
              style={{
                fontFamily: "var(--font-mono-ui)",
                fontSize: 11,
                fontWeight: 600,
                color: S.bg,
                background: S.gold,
                padding: "2px 7px",
                border: S.borderStrong,
                flexShrink: 0,
              }}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function SidebarNavSubButton({
  active,
  onClick,
  label,
  isRail,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  isRail: boolean;
}) {
  if (isRail) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 14px 8px 38px",
        borderRadius: "var(--scout-radius)",
        cursor: "pointer",
        background: active ? S.bgActive : "transparent",
        border: S.border,
        borderColor: active ? "rgba(232,213,163,0.42)" : "transparent",
        display: "flex",
        alignItems: "center",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = S.bgHover;
          e.currentTarget.style.borderColor = "rgba(232, 213, 163, 0.22)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "transparent";
        }
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 14,
          fontWeight: active ? 600 : 500,
          color: active ? S.textActive : S.text,
        }}
      >
        {label}
      </span>
    </button>
  );
}

function SidebarOpportunitiesNav({
  isRail,
  pathname,
  onNavigate,
  badge,
}: {
  isRail: boolean;
  pathname: string;
  onNavigate: (path: string) => void;
  badge?: number;
}) {
  const opportunitiesActive = matchOpportunitiesNavPath(pathname);
  const [expanded, setExpanded] = useState(opportunitiesActive);

  useEffect(() => {
    if (opportunitiesActive) setExpanded(true);
  }, [opportunitiesActive]);

  const onParentClick = () => {
    if (isRail) {
      onNavigate("/opportunities");
      return;
    }
    if (!expanded) {
      setExpanded(true);
      onNavigate("/opportunities");
      return;
    }
    setExpanded((prev) => !prev);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <SidebarNavButton
        active={opportunitiesActive}
        onClick={onParentClick}
        label="Opportunities"
        Icon={OpportunitiesIcon}
        isRail={isRail}
        badge={badge}
      />
      {!isRail && expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {OPPORTUNITIES_NAV.map(({ id, label, path, match }) => (
            <SidebarNavSubButton
              key={id}
              active={match(pathname)}
              onClick={() => onNavigate(path)}
              label={label}
              isRail={isRail}
            />
          ))}
        </div>
      )}
    </div>
  );
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

export function WorkspaceSidebar({
  isMobile = false,
  collapsed = false,
  onToggle,
  user: userProp,
  isAdmin: isAdminProp,
  userRole: userRoleProp,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    user: ctxUser,
    isAdmin: ctxIsAdmin,
    userRole: ctxUserRole,
    notifOpen,
    setNotifOpen,
    notifRead,
    setNotifRead,
    notifUnreadCount,
    handleSignOut,
    updateAvatarUrl,
    kanbanCards,
    authChecked,
    isImpersonating,
    showAdminUi,
    withClientScope,
    withClientReviewPath,
  } = useWorkspace();

  const user = userProp ?? ctxUser ?? undefined;
  const isAdmin = isAdminProp ?? ctxIsAdmin;
  const showAdminNav = showAdminUi;
  const showExpertNav = isStaffPortalRole(ctxUserRole) && !isImpersonating;

  const { loading: subLoading } = useSubscription();
  const { credits, showCredits, unlimitedAi } = useCredits();
  const { openPricing } = useWorkspace();
  const showUpgrade = !subLoading && !unlimitedAi;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [referEarnOpen, setReferEarnOpen] = useState(false);

  const activePipelineCount = kanbanCards.filter((c) => c.stage !== "closed").length;

  useEffect(() => {
    if (!authChecked) return;
    fetch(withClientScope("/api/profile"))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setProfileIncomplete(profileCompletenessPct(data) < 80);
        }
      })
      .catch(() => {});
  }, [authChecked, withClientScope]);

  // On mobile: collapsed = hidden (off-screen). On desktop: collapsed = icon rail.
  const isVisible = isMobile ? !collapsed : true;
  const isRail = !isMobile && collapsed;
  const sidebarWidth = isRail ? 60 : 252;

  const navigate = (path: string) => {
    router.push(withClientReviewPath(path));
    if (isMobile && onToggle) onToggle(); // close on mobile nav
  };

  const isActive = (path: string) => {
    if (path === EXPERT_DASHBOARD_PATH) return isExpertPortalPath(pathname);
    if (path === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    if (path === "/coaching") return pathname.startsWith("/coaching");
    return pathname === path;
  };

  const onToggleNotif = () => setNotifOpen((p) => !p);

  const onNavigateNotif = (section: string) => {
    const path = section === "opportunities" ? "/opportunities" : `/${section}`;
    router.push(path);
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

  const closeSidebarOnMobile = () => {
    if (isMobile && onToggle) onToggle();
  };

  const openSettings = () => {
    setSettingsOpen(true);
    closeSidebarOnMobile();
  };

  const openReferEarn = () => {
    setReferEarnOpen(true);
    closeSidebarOnMobile();
  };

  // Chevron icons for the toggle button
  const ChevronLeft = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  const ChevronRight = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M5 2L10 7L5 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isMobile && isVisible && (
        <div
          onClick={onToggle}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(26,24,20,0.55)",
            zIndex: 999,
          }}
        />
      )}

      <div
        style={{
          width: sidebarWidth,
          background: S.bg,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRight: "1px solid rgba(232,213,163,0.08)",
          height: isMobile ? "100dvh" : "100vh",
          transition: "width 0.22s ease, transform 0.22s ease",
          overflow: "hidden",
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 1000,
                width: 252,
                transform: isVisible ? "translateX(0)" : "translateX(-100%)",
              }
            : {
                position: "relative",
              }),
        }}
      >
        {/* ── Desktop edge-tab toggle ── */}
        {!isMobile && (
          <button
            onClick={onToggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              position: "absolute",
              top: 72,
              right: -16,
              zIndex: 10,
              width: 16,
              height: 48,
              borderRadius: "var(--scout-radius)",
              background: S.bg,
              border: "1px solid rgba(232,213,163,0.2)",
              borderLeft: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: S.iconMuted,
              transition: "background 0.15s, color 0.15s, width 0.15s",
              boxShadow: "3px 0 10px rgba(0,0,0,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#254d3e";
              e.currentTarget.style.color = "#E8D5A3";
              e.currentTarget.style.width = "20px";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = S.bg;
              e.currentTarget.style.color = S.iconMuted;
              e.currentTarget.style.width = "16px";
            }}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        )}

        {/* ── Header ── */}
        <div style={{ padding: isRail ? "20px 0 16px" : "26px 22px 20px", flexShrink: 0 }}>
          {!IS_PROD && !isRail && (
            <button
              onClick={() => router.push("/onboarding")}
              style={{
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 18,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                color: S.text,
                letterSpacing: "0.4px",
                padding: 0,
              }}
            >
              <ArrowLeftIcon /> Preview onboarding
            </button>
          )}

          {isRail ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: S.border,
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  fontWeight: 500,
                  color: S.gold,
                }}
                title="Kimchi"
              >
                K
              </div>
              <button
                onClick={onToggleNotif}
                style={{
                  position: "relative",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: "var(--scout-radius)",
                  background: "none",
                  border: S.border,
                  color: S.iconMuted,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <BellIcon />
                {notifUnreadCount > 0 && (
                  <div style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, background: "#C4574A", border: `1.5px solid ${S.bg}` }} />
                )}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 500, color: "#E8D5A3" }}>
                  Kimchi
                </div>
                <KimchiBySecondLadder
                  fontSize={12}
                  color={S.textMuted}
                  brandColor={S.text}
                  marginTop={3}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {isMobile && (
                  <button
                    onClick={onToggle}
                    title="Close menu"
                    style={{ cursor: "pointer", padding: 6, borderRadius: "var(--scout-radius)", background: "none", border: S.border, color: S.iconMuted, lineHeight: 1, transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onToggleNotif}
                  style={{ position: "relative", cursor: "pointer", padding: 6, borderRadius: "var(--scout-radius)", background: "none", border: S.border, color: S.iconMuted, transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = S.bgHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                >
                  <BellIcon />
                  {notifUnreadCount > 0 && (
                    <div style={{ position: "absolute", top: 3, right: 3, width: 8, height: 8, borderRadius: "50%", background: "#C4574A", border: "1.5px solid #1A3A2F" }} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* ── Nav items (scrollable on mobile) ── */}
        <div
          style={{
            flex: isMobile ? 1 : undefined,
            minHeight: isMobile ? 0 : undefined,
            overflowY: isMobile ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            paddingBottom: isMobile ? 8 : 0,
          }}
        >
        <div style={{ padding: isRail ? "0 8px" : "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {showExpertNav && (
            <SidebarNavButton
              active={isExpertPortalPath(pathname)}
              onClick={() => navigate(EXPERT_DASHBOARD_PATH)}
              label="Expert"
              isRail={isRail}
              Icon={() => (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={isExpertPortalPath(pathname) ? S.iconActive : S.iconMuted}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <path d="M17.5 14v7M14 17.5h7" />
                </svg>
              )}
            />
          )}

          {showAdminNav && (
            <SidebarNavButton
              active={pathname === "/admin"}
              onClick={() => navigate("/admin")}
              label="Admin"
              isRail={isRail}
              Icon={() => (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={pathname === "/admin" ? S.iconActive : S.iconMuted}
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="7" height="7" rx="0" />
                  <rect x="14" y="3" width="7" height="7" rx="0" />
                  <rect x="3" y="14" width="7" height="7" rx="0" />
                  <rect x="14" y="14" width="7" height="7" rx="0" />
                </svg>
              )}
            />
          )}

          <SidebarOpportunitiesNav
            isRail={isRail}
            pathname={pathname}
            onNavigate={navigate}
            badge={activePipelineCount}
          />

          <SidebarNavButton
            active={matchInboxPath(pathname)}
            onClick={() => navigate("/inbox")}
            label="Inbox"
            Icon={InboxIcon}
            isRail={isRail}
          />

          {NAV_MAIN.map(({ id, label, path, Icon }) => (
            <SidebarNavButton
              key={id}
              active={isActive(path)}
              onClick={() => navigate(path)}
              label={label}
              Icon={Icon}
              isRail={isRail}
              badge={undefined}
              showIncompleteDot={id === "profile" && profileIncomplete}
            />
          ))}
        </div>

        {isMobile && showCredits && credits && !isRail && (
          <CreditsSidebarBlock credits={credits} unlimitedAi={unlimitedAi} onUpgrade={openPricing} />
        )}

        {isMobile && !isRail && (
          <div style={{ padding: "0 14px 12px" }}>
            <button
              type="button"
              onClick={openReferEarn}
              data-offer="referral"
              data-trigger="sidebar_refer_earn"
              style={{
                display: "block",
                width: "100%",
                background: "rgba(74,139,106,0.12)",
                border: "1px solid rgba(74,139,106,0.25)",
                borderRadius: "var(--scout-radius)",
                padding: "10px 14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#E8D5A3", letterSpacing: "0.2px" }}>
                🎁 Refer & Earn →
              </p>
              <p style={{ margin: 0, fontSize: 12, color: S.textSubtle, lineHeight: 1.5 }}>
                Invite a friend or share on LinkedIn for rewards.
              </p>
            </button>
          </div>
        )}

        </div>

        {!isMobile && <div style={{ flex: 1 }} />}

        {/* ── Credits (+ upgrade for free users) ── */}
        {!isMobile && showCredits && credits && !isRail && (
          <CreditsSidebarBlock credits={credits} unlimitedAi={unlimitedAi} onUpgrade={openPricing} />
        )}
        {!isMobile && showCredits && credits && isRail && (
          <div style={{ padding: "0 0 8px", textAlign: "center" }} title={unlimitedAi ? `${credits.used} used this month · unlimited` : `${credits.remaining} credits left`}>
            <CreditsMeter credits={credits} compact unlimitedAi={unlimitedAi} />
          </div>
        )}

        {/* ── Refer & Earn ── */}
        {!isMobile && !isRail && (
          <div style={{ padding: "0 14px 12px" }}>
            <button
              type="button"
              onClick={openReferEarn}
              data-offer="referral"
              data-trigger="sidebar_refer_earn"
              style={{
                display: "block",
                width: "100%",
                background: "rgba(74,139,106,0.12)",
                border: "1px solid rgba(74,139,106,0.25)",
                borderRadius: "var(--scout-radius)",
                padding: "10px 14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#E8D5A3", letterSpacing: "0.2px" }}>
                🎁 Refer & Earn →
              </p>
              <p style={{ margin: 0, fontSize: 12, color: S.textSubtle, lineHeight: 1.5 }}>
                Invite a friend or share on LinkedIn for rewards.
              </p>
            </button>
          </div>
        )}

        {/* ── User badge — pinned on mobile so account settings is always reachable ── */}
        <button
          onClick={openSettings}
          title={isRail ? (user?.name ?? user?.email ?? "Account") : undefined}
          style={{
            padding: isRail ? "12px 0 18px" : isMobile ? "14px 18px max(16px, env(safe-area-inset-bottom))" : "14px 18px 20px",
            borderTop: S.border,
            borderLeft: "none",
            borderRight: "none",
            borderBottom: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: isRail ? "center" : "flex-start",
            gap: 10,
            background: S.bg,
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            transition: "background 0.15s",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isMobile ? S.bg : S.bgHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = S.bg)}
          aria-label="Account settings"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name ?? ""} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(232,213,163,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: S.text }}>
                {user ? initials(user.name, user.email) : "?"}
              </span>
            </div>
          )}
          {!isRail && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: S.textActive, marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.name ?? user?.email?.split("@")[0] ?? "Account"}
                </p>
                {user?.headline && (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 400, color: S.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.headline}
                  </p>
                )}
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={S.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </>
          )}
        </button>
        </div>

        {settingsOpen && user && (
          <UserSettingsModal
            user={user}
            onClose={() => setSettingsOpen(false)}
            onSignOut={() => { setSettingsOpen(false); handleSignOut(); }}
            onAvatarChange={updateAvatarUrl}
          />
        )}

        {referEarnOpen && (
          <ReferEarnModal onClose={() => setReferEarnOpen(false)} />
        )}

        {notifOpen && !isRail && (
          <>
            <div onClick={onToggleNotif} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{ position: "absolute", top: 76, right: 18, width: 320, background: "#FFFFFF", border: citeBorder.lineStrong, zIndex: 50, overflow: "hidden", animation: "fadeIn 0.2s ease both", boxShadow: "4px 4px 0 rgba(17,17,17,0.08)" }}>
              <div style={{ padding: "14px 18px", borderBottom: citeBorder.line, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--scout-muted)", margin: 0 }}>Notifications</p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {notifUnreadCount > 0 && (
                    <>
                      <span style={{ fontFamily: "var(--font-mono-ui)", fontSize: 11, fontWeight: 600, color: "#1A3A2F", background: "#E8D5A3", padding: "2px 7px", border: citeBorder.line }}>{notifUnreadCount}</span>
                      <button
                        type="button"
                        onClick={markAllNotificationsRead}
                        style={{ background: "none", border: citeBorder.line, padding: "4px 8px", fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: 600, color: "#1A3A2F", cursor: "pointer" }}
                      >
                        Mark read
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {NOTIFICATIONS.length === 0 ? (
                  <div style={{ padding: "36px 18px", textAlign: "center" }}>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--scout-muted)", lineHeight: 1.5 }}>You&apos;re all caught up</p>
                  </div>
                ) : NOTIFICATIONS.map((n) => {
                  const dotColor = n.type === "role" ? "#4A8B6A" : n.type === "deadline" ? "#C4574A" : "#C4A86A";
                  return (
                    <button
                      key={n.id}
                      onClick={() => onNavigateNotif(n.section)}
                      style={{ width: "100%", textAlign: "left", padding: "12px 18px", background: n.unread ? "rgba(26,58,47,0.03)" : "transparent", border: "none", borderBottom: citeBorder.line, cursor: "pointer", display: "flex", gap: 10 }}
                    >
                      <div style={{ width: 6, height: 6, background: dotColor, marginTop: 6, flexShrink: 0, opacity: n.unread ? 1 : 0.3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
                          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{n.title}</span>
                          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--scout-muted)" }}>· {n.company}</span>
                        </div>
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 400, color: "#52493F", lineHeight: 1.45, marginBottom: 4 }}>{n.body}</p>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--scout-muted)" }}>{n.time}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}