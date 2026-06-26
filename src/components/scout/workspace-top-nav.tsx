"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { BellIcon } from "./workspace-icons";
import { NOTIFICATIONS } from "./workspace-data";
import { UserSettingsModal } from "./user-settings-modal";
import { useWorkspace } from "@/contexts/workspace-context";
import { profileCompletenessPct } from "@/lib/profile-completeness";
import { canAccessBetaFeature } from "@/lib/beta-features";
import { border, color, fontDisplay, fontSans, surface, type as T } from "@/lib/typography";

export const TOP_NAV_HEIGHT = 64;
export const TOP_NAV_HEIGHT_MOBILE = 56;

type NavLink = { id: string; label: string; path: string; match: (pathname: string) => boolean };

function buildNavLinks(isAdmin: boolean): NavLink[] {
  const links: NavLink[] = [];
  if (isAdmin) {
    links.push({
      id: "admin",
      label: "Admin",
      path: "/admin",
      match: (p) => p.startsWith("/admin"),
    });
  }
  links.push(
    {
      id: "dashboard",
      label: "Dashboard",
      path: "/dashboard",
      match: (p) => p === "/dashboard" || p.startsWith("/dashboard/"),
    },
    {
      id: "opportunities",
      label: "Opportunities",
      path: "/opportunities",
      match: (p) => p.startsWith("/opportunities"),
    },
  );
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

export function WorkspaceTopNav({ isMobile = false, user, isAdmin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const {
    notifOpen,
    setNotifOpen,
    notifRead,
    setNotifRead,
    notifUnreadCount,
    handleSignOut,
    updateAvatarUrl,
    authChecked,
  } = useWorkspace();

  const navHeight = isMobile ? TOP_NAV_HEIGHT_MOBILE : TOP_NAV_HEIGHT;
  const navLinks = buildNavLinks(isAdmin);
  const horizontalPad = isMobile ? 16 : 28;

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

  return (
    <>
      <header
        ref={navRef}
        style={{
          height: navHeight,
          flexShrink: 0,
          background: surface.card,
          borderBottom: border.line,
          boxSizing: "border-box",
          position: "relative",
          zIndex: 100,
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
          {/* Logo */}
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
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
          </button>

          {/* Nav links */}
          <nav
            aria-label="Main"
            style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 4 : 8,
              flex: 1,
              minWidth: 0,
              overflowX: isMobile ? "auto" : "visible",
              WebkitOverflowScrolling: "touch",
              scrollbarWidth: "none",
            }}
          >
            {navLinks.map(({ id, label, path, match }) => {
              const active = match(pathname);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => router.push(path)}
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
                    transition: "color 0.15s",
                    boxSizing: "border-box",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Right actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
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
                border: border.line,
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
                border: border.line,
                borderColor: "rgba(17,17,17,0.12)",
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
          </div>
        </div>
      </header>

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

      {notifOpen && (
        <>
          <div
            onClick={onToggleNotif}
            style={{ position: "fixed", inset: 0, zIndex: 110 }}
            aria-hidden
          />
          <div
            style={{
              position: "fixed",
              top: navHeight + 8,
              right: horizontalPad,
              width: isMobile ? "min(320px, calc(100vw - 32px))" : 320,
              background: surface.card,
              border: border.lineStrong,
              zIndex: 120,
              overflow: "hidden",
              animation: "fadeIn 0.2s ease both",
              boxShadow: "0 8px 32px rgba(17,17,17,0.1)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: border.line,
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
                    border: border.line,
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
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
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
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onNavigateNotif(n.section)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 18px",
                        background: n.unread ? "rgba(26,58,47,0.03)" : "transparent",
                        border: "none",
                        borderBottom: border.line,
                        cursor: "pointer",
                        display: "flex",
                        gap: 10,
                      }}
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
                    </button>
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
