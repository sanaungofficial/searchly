"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
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
import { useWorkspace } from "@/contexts/workspace-context";

interface SidebarProps {
  isMobile?: boolean;
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

const NAV_ITEMS: NavItem[] = [
  { id: "opportunities", label: "Opportunities", path: "/opportunities", Icon: OpportunitiesIcon },
  { id: "profile", label: "Profile", path: "/profile", Icon: ProfileIcon },
  { id: "live", label: "Live", path: "/live", Icon: LiveIcon },
  { id: "coaching", label: "Coaching", path: "/coaching", Icon: CoachingIcon },
  { id: "network", label: "Network", path: "/network", Icon: NetworkIcon },
];

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
  isOpen,
  onClose,
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
  } = useWorkspace();

  const user = userProp ?? ctxUser ?? undefined;
  const isAdmin = isAdminProp ?? ctxIsAdmin;
  const userRole = userRoleProp ?? ctxUserRole;

  const isStaff = userRole === "COACH" || userRole === "RECRUITER" || userRole === "ADMIN";
  const [settingsOpen, setSettingsOpen] = useState(false);
  const hasLiveNow = true;

  const sidebarVisible = isMobile ? (isOpen ?? false) : true;

  const navigate = (path: string) => {
    router.push(path);
    if (isMobile && onClose) onClose();
  };

  const isActive = (path: string) => {
    if (path === "/opportunities") return pathname.startsWith("/opportunities");
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

  return (
    <>
      {isMobile && sidebarVisible && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 999,
          }}
        />
      )}

      <div
        style={{
          width: 252,
          background: "#1A3A2F",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          borderRight: "1px solid rgba(232,213,163,0.08)",
          height: "100vh",
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 1000,
                transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.25s ease",
              }
            : {
                position: "relative",
              }),
        }}
      >
        {/* Brand */}
        <div style={{ padding: "26px 22px 20px" }}>
          <button
            onClick={() => router.push("/")}
            style={{
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 18,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              color: "rgba(232,213,163,0.75)",
              letterSpacing: "0.4px",
              padding: 0,
            }}
          >
            <ArrowLeftIcon /> Preview onboarding
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontSize: 22,
                  fontWeight: 500,
                  color: "#E8D5A3",
                }}
              >
                Kimchi
              </div>
              <div
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  color: "rgba(232,213,163,0.32)",
                  letterSpacing: "1.1px",
                  textTransform: "uppercase",
                  marginTop: 3,
                }}
              >
                by Second Ladder
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {isMobile && (
                <button
                  onClick={onClose}
                  style={{
                    cursor: "pointer",
                    padding: 6,
                    borderRadius: 6,
                    background: "none",
                    border: "none",
                    color: "rgba(232,213,163,0.65)",
                    lineHeight: 1,
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,213,163,0.1)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  aria-label="Close menu"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <button
                onClick={onToggleNotif}
                style={{
                  position: "relative",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  background: "none",
                  border: "none",
                  color: "rgba(232,213,163,0.65)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,213,163,0.1)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <BellIcon />
                {notifUnreadCount > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      right: 3,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#C4574A",
                      border: "1.5px solid #1A3A2F",
                    }}
                  />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              style={{
                padding: "10px 14px",
                borderRadius: 7,
                cursor: "pointer",
                background: pathname === "/admin" ? "rgba(232,213,163,0.12)" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 11,
                border: "none",
                transition: "background 0.15s",
                textAlign: "left",
              }}
            >
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={pathname === "/admin" ? "#E8D5A3" : "rgba(232,213,163,0.38)"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 15,
                fontWeight: 400,
                color: pathname === "/admin" ? "#E8D5A3" : "rgba(232,213,163,0.48)",
              }}>
                Admin
              </span>
            </button>
          )}

          {isStaff && (
            <button
              onClick={() => navigate("/clients")}
              style={{
                padding: "10px 14px",
                borderRadius: 7,
                cursor: "pointer",
                background: pathname === "/clients" ? "rgba(232,213,163,0.12)" : "transparent",
                display: "flex",
                alignItems: "center",
                gap: 11,
                border: "none",
                transition: "background 0.15s",
                textAlign: "left",
              }}
            >
              <svg
                width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={pathname === "/clients" ? "#E8D5A3" : "rgba(232,213,163,0.38)"}
                strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 15,
                fontWeight: 400,
                color: pathname === "/clients" ? "#E8D5A3" : "rgba(232,213,163,0.48)",
              }}>
                Clients
              </span>
            </button>
          )}

          {NAV_ITEMS.map(({ id, label, path, Icon }) => {
            const active = isActive(path);
            const bg = active ? "rgba(232,213,163,0.12)" : "transparent";
            const color = active ? "#E8D5A3" : "rgba(232,213,163,0.48)";
            const iconColor = active ? "#E8D5A3" : "rgba(232,213,163,0.38)";
            return (
              <button
                key={id}
                onClick={() => navigate(path)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 7,
                  cursor: "pointer",
                  background: bg,
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  border: "none",
                  transition: "background 0.15s",
                  textAlign: "left",
                }}
              >
                <span style={{ position: "relative", display: "inline-flex", color: iconColor }}>
                  <Icon />
                  {id === "live" && hasLiveNow && (
                    <span
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#C4574A",
                        border: "1.5px solid #1A3A2F",
                        animation: "pulse 1.5s ease infinite",
                      }}
                    />
                  )}
                </span>
                <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 15, fontWeight: 400, color }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Upgrade CTA */}
        <div style={{ padding: "0 14px 12px" }}>
          <a
            href="/pricing"
            style={{
              display: "block",
              background: "rgba(232,213,163,0.08)",
              border: "1px solid rgba(232,213,163,0.15)",
              borderRadius: 10,
              padding: "10px 14px",
              textDecoration: "none",
            }}
          >
            <p style={{ margin: "0 0 3px", fontSize: 13, fontWeight: 600, color: "#E8D5A3", letterSpacing: "0.3px" }}>Upgrade to Pro</p>
            <p style={{ margin: 0, fontSize: 12, color: "rgba(232,213,163,0.4)", lineHeight: 1.5 }}>Unlimited AI tools &amp; chat</p>
          </a>
        </div>

        {/* User badge */}
        <button
          onClick={() => setSettingsOpen(true)}
          style={{
            padding: "14px 18px 20px",
            borderTop: "1px solid rgba(232,213,163,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(232,213,163,0.05)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          title="Account settings"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name ?? ""}
              style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: "rgba(232,213,163,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, color: "rgba(232,213,163,0.8)" }}>
                {user ? initials(user.name, user.email) : "?"}
              </span>
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 400, color: "rgba(232,213,163,0.65)", marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name ?? user?.email?.split("@")[0] ?? "Account"}
            </p>
            {user?.headline && (
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 300, color: "rgba(232,213,163,0.28)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.headline}
              </p>
            )}
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(232,213,163,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {settingsOpen && user && (
          <UserSettingsModal
            user={user}
            onClose={() => setSettingsOpen(false)}
            onSignOut={() => { setSettingsOpen(false); handleSignOut(); }}
          />
        )}

        {notifOpen && (
          <>
            <div onClick={onToggleNotif} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div
              style={{
                position: "absolute",
                top: 76,
                right: 18,
                width: 320,
                background: "#FFFFFF",
                borderRadius: 10,
                boxShadow: "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
                zIndex: 50,
                overflow: "hidden",
                animation: "fadeIn 0.2s ease both",
              }}
            >
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #EEE9E2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>Notifications</p>
                {notifUnreadCount > 0 && (
                  <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>
                    {notifUnreadCount} unread
                  </span>
                )}
              </div>
              <div style={{ maxHeight: 360, overflowY: "auto" }}>
                {NOTIFICATIONS.map((n) => {
                  const dotColor = n.type === "role" ? "#4A8B6A" : n.type === "deadline" ? "#C4574A" : "#C4A86A";
                  return (
                    <button
                      key={n.id}
                      onClick={() => { onNavigateNotif(n.section); }}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 18px",
                        background: n.unread ? "rgba(26,58,47,0.03)" : "transparent",
                        border: "none",
                        borderBottom: "1px solid #F5F2EC",
                        cursor: "pointer",
                        display: "flex",
                        gap: 10,
                      }}
                    >
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, marginTop: 6, flexShrink: 0, opacity: n.unread ? 1 : 0.3 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
                          <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>{n.title}</span>
                          <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>· {n.company}</span>
                        </div>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 300, color: "#52493F", lineHeight: 1.45, marginBottom: 4 }}>{n.body}</p>
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>{n.time}</span>
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
