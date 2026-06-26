// build
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  DashboardIcon,
  OpportunitiesIcon,
  ProfileIcon,
  LiveIcon,
  CoachingIcon,
  NetworkIcon,
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
import { isProductionEnv, shouldShowCommunityNav, canAccessBetaFeature, BETA_FEATURES } from "@/lib/beta-features";
import { isStaffPortalRole } from "@/lib/staff-portal";

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

const SIDEBAR_FOREST = "#1A3A2F";
const SIDEBAR_GOLD = "#E8D5A3";
const SIDEBAR_GOLD_DIM = "rgba(232,213,163,0.48)";
const SIDEBAR_GOLD_FAINT = "rgba(232,213,163,0.38)";
const SIDEBAR_LINE = "1px solid rgba(232,213,163,0.14)";
const SIDEBAR_LINE_ACTIVE = "1px solid rgba(232,213,163,0.35)";

const NAV_SEARCH: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/dashboard", Icon: DashboardIcon },
  { id: "opportunities", label: "Opportunities", path: "/opportunities/pipeline", Icon: OpportunitiesIcon },
];

const NAV_PROFILE: NavItem = {
  id: "profile",
  label: "Profile",
  path: "/profile",
  Icon: ProfileIcon,
};

const NAV_COMMUNITY: NavItem[] = [
  { id: "live", label: BETA_FEATURES.live.navLabel, path: "/live", Icon: LiveIcon },
  { id: "coaching", label: BETA_FEATURES.coaching.navLabel, path: "/coaching", Icon: CoachingIcon },
  { id: "network", label: BETA_FEATURES.network.navLabel, path: "/network", Icon: NetworkIcon },
];

function SidebarSectionLabel({ children, isRail }: { children: React.ReactNode; isRail: boolean }) {
  if (isRail) return null;
  return (
    <p
      style={{
        fontFamily: "var(--font-ui)",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "rgba(232,213,163,0.32)",
        padding: "14px 14px 6px",
        margin: 0,
      }}
    >
      {children}
    </p>
  );
}

function SidebarNavButton({
  active,
  onClick,
  label,
  Icon,
  isRail,
  badge,
  showIncompleteDot,
  showLiveDot,
  indent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: NavItem["Icon"];
  isRail: boolean;
  badge?: number;
  showIncompleteDot?: boolean;
  showLiveDot?: boolean;
  indent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={isRail ? label : undefined}
      style={{
        padding: isRail ? "10px 0" : indent ? "8px 14px 8px 22px" : "10px 14px",
        borderRadius: 0,
        cursor: "pointer",
        background: active ? "rgba(232,213,163,0.12)" : "transparent",
        border: SIDEBAR_LINE,
        borderColor: active ? "rgba(232,213,163,0.35)" : "transparent",
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
          e.currentTarget.style.background = "rgba(232,213,163,0.06)";
          e.currentTarget.style.borderColor = "rgba(232,213,163,0.12)";
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
          color: active ? SIDEBAR_GOLD : SIDEBAR_GOLD_FAINT,
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
              border: `1.5px solid ${SIDEBAR_FOREST}`,
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
              border: `1.5px solid ${SIDEBAR_FOREST}`,
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
              fontWeight: active ? 600 : 400,
              color: active ? SIDEBAR_GOLD : SIDEBAR_GOLD_DIM,
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
                color: SIDEBAR_FOREST,
                background: SIDEBAR_GOLD,
                padding: "2px 7px",
                border: SIDEBAR_LINE_ACTIVE,
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
  } = useWorkspace();

  const user = userProp ?? ctxUser ?? undefined;
  const isAdmin = isAdminProp ?? ctxIsAdmin;
  const userRole = userRoleProp ?? ctxUserRole;
  const showCommunityNav = shouldShowCommunityNav(isAdmin);

  const isStaff = isStaffPortalRole(userRole);
  const { loading: subLoading } = useSubscription();
  const { credits, showCredits, unlimitedAi } = useCredits();
  const { openPricing } = useWorkspace();
  const showUpgrade = !subLoading && !unlimitedAi;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [referEarnOpen, setReferEarnOpen] = useState(false);
  const [hasLiveNow, setHasLiveNow] = useState(false);

  const activePipelineCount = kanbanCards.filter((c) => c.stage !== "closed").length;

  useEffect(() => {
    if (!authChecked) return;
    fetch("/api/live/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.hasLiveNow != null) setHasLiveNow(!!data.hasLiveNow);
      })
      .catch(() => {});
  }, [authChecked]);

  useEffect(() => {
    if (!authChecked) return;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) {
          setProfileIncomplete(profileCompletenessPct(data) < 80);
        }
      })
      .catch(() => {});
  }, [authChecked]);

  // On mobile: collapsed = hidden (off-screen). On desktop: collapsed = icon rail.
  const isVisible = isMobile ? !collapsed : true;
  const isRail = !isMobile && collapsed;
  const sidebarWidth = isRail ? 60 : 252;

  const navigate = (path: string) => {
    router.push(path);
    if (isMobile && onToggle) onToggle(); // close on mobile nav
  };

  const isActive = (path: string) => {
    if (path.startsWith("/opportunities")) return pathname.startsWith("/opportunities");
    if (path === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
    return pathname === path;
  };

  const onToggleNotif = () => setNotifOpen((p) => !p);

  const onNavigateNotif = (section: string) => {
    const path = section === "opportunities" ? "/opportunities/pipeline" : `/${section}`;
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
          background: SIDEBAR_FOREST,
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
              borderRadius: 0,
              background: SIDEBAR_FOREST,
              border: "1px solid rgba(232,213,163,0.2)",
              borderLeft: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(232,213,163,0.6)",
              transition: "background 0.15s, color 0.15s, width 0.15s",
              boxShadow: "3px 0 10px rgba(0,0,0,0.2)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#254d3e";
              e.currentTarget.style.color = "#E8D5A3";
              e.currentTarget.style.width = "20px";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = SIDEBAR_FOREST;
              e.currentTarget.style.color = "rgba(232,213,163,0.6)";
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
                color: "rgba(232,213,163,0.75)",
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
                  border: SIDEBAR_LINE,
                  fontFamily: "var(--font-display)",
                  fontSize: 16,
                  fontWeight: 500,
                  color: SIDEBAR_GOLD,
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
                  borderRadius: 0,
                  background: "none",
                  border: SIDEBAR_LINE,
                  color: "rgba(232,213,163,0.65)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,213,163,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <BellIcon />
                {notifUnreadCount > 0 && (
                  <div style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, background: "#C4574A", border: `1.5px solid ${SIDEBAR_FOREST}` }} />
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
                  color="rgba(232,213,163,0.42)"
                  brandColor="rgba(232,213,163,0.72)"
                  marginTop={3}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                {isMobile && (
                  <button
                    onClick={onToggle}
                    title="Close menu"
                    style={{ cursor: "pointer", padding: 6, borderRadius: 0, background: "none", border: SIDEBAR_LINE, color: "rgba(232,213,163,0.65)", lineHeight: 1, transition: "background 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,213,163,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={onToggleNotif}
                  style={{ position: "relative", cursor: "pointer", padding: 6, borderRadius: 0, background: "none", border: SIDEBAR_LINE, color: "rgba(232,213,163,0.65)", transition: "background 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,213,163,0.1)")}
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
          {isAdmin && (
            <SidebarNavButton
              active={pathname === "/admin"}
              onClick={() => navigate("/admin")}
              label="Admin"
              isRail={isRail}
              Icon={() => (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke={pathname === "/admin" ? SIDEBAR_GOLD : SIDEBAR_GOLD_FAINT}
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

          <SidebarSectionLabel isRail={isRail}>Search</SidebarSectionLabel>
          {NAV_SEARCH.map(({ id, label, path, Icon }) => (
            <SidebarNavButton
              key={id}
              active={isActive(path)}
              onClick={() => navigate(path)}
              label={label}
              Icon={Icon}
              isRail={isRail}
              badge={id === "opportunities" ? activePipelineCount : undefined}
            />
          ))}

          <SidebarSectionLabel isRail={isRail}>You</SidebarSectionLabel>
          <SidebarNavButton
            active={isActive(NAV_PROFILE.path)}
            onClick={() => navigate(NAV_PROFILE.path)}
            label={NAV_PROFILE.label}
            Icon={NAV_PROFILE.Icon}
            isRail={isRail}
            showIncompleteDot={profileIncomplete}
          />

          {showCommunityNav && (
            <>
              <SidebarSectionLabel isRail={isRail}>Community</SidebarSectionLabel>
              {NAV_COMMUNITY.filter(
                ({ id }) =>
                  !(isStaff && id === "live") && canAccessBetaFeature(id as "live" | "coaching" | "network", isAdmin),
              ).map(({ id, label, path, Icon }) => (
                <SidebarNavButton
                  key={id}
                  active={isActive(path)}
                  onClick={() => navigate(path)}
                  label={label}
                  Icon={Icon}
                  isRail={isRail}
                  showLiveDot={id === "live" && hasLiveNow}
                />
              ))}
            </>
          )}
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
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#E8D5A3", letterSpacing: "0.2px" }}>
                🎁 Refer & Earn →
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(232,213,163,0.45)", lineHeight: 1.5 }}>
                Invite friends or share on LinkedIn to earn extra rewards!
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
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#E8D5A3", letterSpacing: "0.2px" }}>
                🎁 Refer & Earn →
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "rgba(232,213,163,0.45)", lineHeight: 1.5 }}>
                Invite friends or share on LinkedIn to earn extra rewards!
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
            borderTop: SIDEBAR_LINE,
            borderLeft: "none",
            borderRight: "none",
            borderBottom: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: isRail ? "center" : "flex-start",
            gap: 10,
            background: SIDEBAR_FOREST,
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            transition: "background 0.15s",
            flexShrink: 0,
            boxSizing: "border-box",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isMobile ? SIDEBAR_FOREST : "rgba(232,213,163,0.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = SIDEBAR_FOREST)}
          aria-label="Account settings"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name ?? ""} style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(232,213,163,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 600, color: "rgba(232,213,163,0.8)" }}>
                {user ? initials(user.name, user.email) : "?"}
              </span>
            </div>
          )}
          {!isRail && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "rgba(232,213,163,0.65)", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.name ?? user?.email?.split("@")[0] ?? "Account"}
                </p>
                {user?.headline && (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 400, color: "rgba(232,213,163,0.28)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.headline}
                  </p>
                )}
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(232,213,163,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
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