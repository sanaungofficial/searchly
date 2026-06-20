"use client";

import { useState } from "react";
import { useSubscription } from "@/hooks/useSubscription";

type SettingsTab = "profile" | "security" | "subscription";

interface Props {
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
    headline?: string | null;
  };
  onClose: () => void;
  onSignOut: () => void;
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

export function UserSettingsModal({ user, onClose, onSignOut }: Props) {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const { isPro, isAdmin, status, currentPeriodEnd, usage, loading, startCheckout, openPortal } = useSubscription();

  const navItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "profile",
      label: "Profile",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      id: "security",
      label: "Login & Security",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
    },
    {
      id: "subscription",
      label: "Subscription",
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
          <line x1="1" y1="10" x2="23" y2="10" />
        </svg>
      ),
    },
  ];

  const periodEndFormatted = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 100,
          animation: "fadeIn 0.15s ease both",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 680,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "80vh",
          background: "#FFFFFF",
          borderRadius: 14,
          boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
          zIndex: 101,
          display: "flex",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease both",
        }}
      >
        {/* Left nav */}
        <div
          style={{
            width: 200,
            background: "#F7F5F2",
            borderRight: "1px solid #EEE9E2",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            padding: "20px 0",
          }}
        >
          {/* User avatar */}
          <div style={{ padding: "0 16px 20px", borderBottom: "1px solid #EEE9E2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name ?? ""}
                  style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#1A3A2F",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#E8D5A3" }}>
                    {initials(user.name, user.email)}
                  </span>
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name ?? user.email.split("@")[0]}
                </p>
                {user.headline && (
                  <p style={{ fontSize: 10, color: "#8A7F72", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {user.headline}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Nav items */}
          <div style={{ padding: "12px 8px", flex: 1 }}>
            {navItems.map(({ id, label, icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: tab === id ? "#1A3A2F" : "transparent",
                  color: tab === id ? "#E8D5A3" : "#52493F",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: tab === id ? 500 : 400,
                  textAlign: "left",
                  transition: "background 0.15s, color 0.15s",
                  marginBottom: 2,
                }}
                onMouseEnter={(e) => {
                  if (tab !== id) {
                    e.currentTarget.style.background = "rgba(26,58,47,0.07)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (tab !== id) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          {/* Bottom: sign out + privacy */}
          <div style={{ padding: "0 8px" }}>
            <button
              onClick={onSignOut}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "#C4574A",
                cursor: "pointer",
                fontSize: 13,
                textAlign: "left",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(196,87,74,0.07)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Log Out
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Header */}
          <div
            style={{
              padding: "20px 24px 16px",
              borderBottom: "1px solid #EEE9E2",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1A1A1A" }}>
              {navItems.find((n) => n.id === tab)?.label}
            </h2>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#8A7F72",
                padding: 4,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#8A7F72")}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            {tab === "profile" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Field label="Full Name" value={user.name ?? "—"} />
                <Field label="Email" value={user.email} />
                {user.headline && <Field label="Headline" value={user.headline} />}
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#F7F5F2",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#8A7F72",
                    lineHeight: 1.5,
                  }}
                >
                  To update your profile details, go to the <strong style={{ color: "#52493F" }}>Profile</strong> section in the main workspace.
                </div>
              </div>
            )}

            {tab === "security" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Field label="Email" value={user.email} />
                <div style={{ borderTop: "1px solid #EEE9E2", paddingTop: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: "0 0 4px" }}>Password</p>
                  <p style={{ fontSize: 12, color: "#8A7F72", margin: "0 0 12px" }}>
                    You signed in with {user.email.includes("google") ? "Google" : "email"}. Password changes are managed through your email provider.
                  </p>
                  <p style={{ fontSize: 12, color: "#8A7F72", margin: 0 }}>
                    To reset your password, sign out and use the "Forgot password" link on the login page.
                  </p>
                </div>
              </div>
            )}

            {tab === "subscription" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Current plan */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#8A7F72", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                    Current Plan
                  </p>
                  <div
                    style={{
                      padding: "16px",
                      border: "1px solid #EEE9E2",
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: isPro ? "#1A3A2F" : "#52493F",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {loading ? "Loading…" : isAdmin ? "SEARCHLY ADMIN" : isPro ? "SEARCHLY PRO" : "SEARCHLY FREE"}
                        </span>
                        {(isPro || isAdmin) && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#FFFFFF",
                              background: isAdmin ? "#6B4A8A" : "#1A3A2F",
                              padding: "2px 8px",
                              borderRadius: 20,
                              letterSpacing: "0.4px",
                            }}
                          >
                            {isAdmin ? "ADMIN" : "ACTIVE"}
                          </span>
                        )}
                      </div>
                      {isPro && !isAdmin && periodEndFormatted && (
                        <p style={{ fontSize: 11, color: "#8A7F72", margin: 0 }}>
                          Renews {periodEndFormatted}
                        </p>
                      )}
                      {isAdmin && (
                        <p style={{ fontSize: 11, color: "#8A7F72", margin: 0 }}>
                          Unlimited access · all features enabled
                        </p>
                      )}
                      {!isPro && !isAdmin && (
                        <p style={{ fontSize: 11, color: "#8A7F72", margin: 0 }}>
                          Unlock unlimited AI tools &amp; job tracking
                        </p>
                      )}
                    </div>
                    {isAdmin ? null : isPro ? (
                      <button
                        onClick={openPortal}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "1px solid #D5CFC8",
                          background: "transparent",
                          color: "#52493F",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F7F5F2")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Manage Billing
                      </button>
                    ) : (
                      <button
                        onClick={startCheckout}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 8,
                          border: "none",
                          background: "#1A3A2F",
                          color: "#E8D5A3",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "opacity 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        Upgrade Now
                      </button>
                    )}
                  </div>
                </div>

                {/* AI usage meter — free users only */}
                {!isPro && !isAdmin && usage && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "#FDFCFA",
                      border: "1px solid #EEE9E2",
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                        AI requests this month
                      </p>
                      <span style={{ fontSize: 11, color: usage.used >= (usage.limit ?? 10) ? "#C4574A" : "#8A7F72" }}>
                        {usage.used} / {usage.limit ?? 10}
                      </span>
                    </div>
                    <div style={{ height: 6, background: "#EEE9E2", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, ((usage.used) / (usage.limit ?? 10)) * 100)}%`,
                          background: usage.used >= (usage.limit ?? 10) ? "#C4574A" : "#4A8B6A",
                          borderRadius: 4,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    {usage.used >= (usage.limit ?? 10) && (
                      <p style={{ fontSize: 11, color: "#C4574A", margin: "8px 0 0" }}>
                        Limit reached — upgrade for unlimited AI access.
                      </p>
                    )}
                  </div>
                )}

                {/* What's included */}
                {!isPro && !isAdmin && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: "rgba(26,58,47,0.04)",
                      border: "1px solid rgba(26,58,47,0.1)",
                      borderRadius: 10,
                    }}
                  >
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#1A3A2F", margin: "0 0 10px" }}>
                      Pro includes:
                    </p>
                    {[
                      "Unlimited job tracking",
                      "AI fit analysis on every role",
                      "AI-generated cover letters",
                      "Resume tailoring per application",
                      "Priority support",
                    ].map((feat) => (
                      <div key={feat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4A8B6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontSize: 12, color: "#52493F" }}>{feat}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Refresh notice */}
                <div
                  style={{
                    padding: "14px 16px",
                    background: "#F7F5F2",
                    border: "1px dashed #D5CFC8",
                    borderRadius: 10,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#52493F", margin: "0 0 4px" }}>
                    Not seeing your updated subscription?
                  </p>
                  <p style={{ fontSize: 11, color: "#8A7F72", margin: "0 0 10px", lineHeight: 1.5 }}>
                    If you just upgraded, refresh the page to sync your plan status.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 6,
                      border: "1px solid #D5CFC8",
                      background: "white",
                      color: "#52493F",
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Refresh Status
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 500, color: "#8A7F72", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </p>
      <p style={{ fontSize: 13, color: "#1A1A1A", margin: 0, padding: "10px 12px", background: "#F7F5F2", borderRadius: 7, border: "1px solid #EEE9E2" }}>
        {value}
      </p>
    </div>
  );
}
