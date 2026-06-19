"use client";

import {
  OpportunitiesIcon,
  ProfileIcon,
  LiveIcon,
  CoachingIcon,
  NetworkIcon,
  BellIcon,
  ArrowLeftIcon,
} from "./workspace-icons";
import { NOTIFICATIONS, type Section } from "./workspace-data";

interface SidebarProps {
  activeSection: Section;
  onNavigate: (s: Section) => void;
  onBackToOnboarding: () => void;
  notifOpen: boolean;
  notifUnreadCount: number;
  onToggleNotif: () => void;
  onNavigateNotif: (s: Section) => void;
}

interface NavItem {
  id: Section;
  label: string;
  Icon: (p: { className?: string }) => JSX.Element;
}

const NAV_ITEMS: NavItem[] = [
  { id: "opportunities", label: "Opportunities", Icon: OpportunitiesIcon },
  { id: "profile", label: "Profile", Icon: ProfileIcon },
  { id: "live", label: "Live", Icon: LiveIcon },
  { id: "coaching", label: "Coaching", Icon: CoachingIcon },
  { id: "network", label: "Network", Icon: NetworkIcon },
];

export function WorkspaceSidebar({
  activeSection,
  onNavigate,
  onBackToOnboarding,
  notifOpen,
  notifUnreadCount,
  onToggleNotif,
  onNavigateNotif,
}: SidebarProps) {
  const hasLiveNow = true; // LIVE_SESSIONS has one isLive session

  return (
    <div
      style={{
        width: 252,
        background: "#1A3A2F",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        borderRight: "1px solid rgba(232,213,163,0.08)",
        height: "100vh",
        position: "relative",
      }}
    >
      {/* Brand */}
      <div style={{ padding: "26px 22px 20px" }}>
        <button
          onClick={onBackToOnboarding}
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
            fontSize: 10,
            color: "rgba(232,213,163,0.4)",
            letterSpacing: "0.4px",
            padding: 0,
          }}
        >
          <ArrowLeftIcon /> Onboarding
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 20,
                fontWeight: 500,
                color: "#E8D5A3",
              }}
            >
              Searchly
            </div>
            <div
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                color: "rgba(232,213,163,0.32)",
                letterSpacing: "1.1px",
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              by Second Ladder
            </div>
          </div>
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

      {/* Nav items */}
      <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeSection === id;
          const bg = active ? "rgba(232,213,163,0.12)" : "transparent";
          const color = active ? "#E8D5A3" : "rgba(232,213,163,0.48)";
          const iconColor = active ? "#E8D5A3" : "rgba(232,213,163,0.38)";
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
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
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 13,
                  fontWeight: 400,
                  color,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* User badge */}
      <div
        style={{
          padding: "14px 18px 20px",
          borderTop: "1px solid rgba(232,213,163,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
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
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              fontWeight: 600,
              color: "rgba(232,213,163,0.8)",
            }}
          >
            SC
          </span>
        </div>
        <div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 400,
              color: "rgba(232,213,163,0.65)",
              marginBottom: 1,
            }}
          >
            Sarah Chen
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              fontWeight: 300,
              color: "rgba(232,213,163,0.28)",
            }}
          >
            Senior PM · 8 yrs
          </p>
        </div>
      </div>

      {/* Notifications popover */}
      {notifOpen && (
        <>
          {/* click-away catcher */}
          <div
            onClick={onToggleNotif}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
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
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #EEE9E2",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1A1A1A",
                }}
              >
                Notifications
              </p>
              {notifUnreadCount > 0 && (
                <span
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 10,
                    color: "#A09890",
                  }}
                >
                  {notifUnreadCount} unread
                </span>
              )}
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {NOTIFICATIONS.map((n) => {
                const dotColor =
                  n.type === "role" ? "#4A8B6A" : n.type === "deadline" ? "#C4574A" : "#C4A86A";
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      onNavigateNotif(n.section);
                      onToggleNotif();
                    }}
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
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: dotColor,
                        marginTop: 6,
                        flexShrink: 0,
                        opacity: n.unread ? 1 : 0.3,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "baseline", marginBottom: 2 }}>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#1A1A1A",
                          }}
                        >
                          {n.title}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 10,
                            color: "#A09890",
                          }}
                        >
                          · {n.company}
                        </span>
                      </div>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 300,
                          color: "#52493F",
                          lineHeight: 1.45,
                          marginBottom: 4,
                        }}
                      >
                        {n.body}
                      </p>
                      <span
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 10,
                          color: "#A09890",
                        }}
                      >
                        {n.time}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
