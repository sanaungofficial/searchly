"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useCredits } from "@/hooks/useCredits";
import { ReferEarnModal } from "./refer-earn-modal";
import { fontSans } from "@/lib/typography";

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
  onAvatarChange?: (url: string) => void;
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

export function UserSettingsModal({ user, onClose, onSignOut, onAvatarChange }: Props) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [referEarnOpen, setReferEarnOpen] = useState(false);
  const [dailyEmailEnabled, setDailyEmailEnabled] = useState(true);
  const [watchlistEmailEnabled, setWatchlistEmailEnabled] = useState(true);
  const [pipelineEmailEnabled, setPipelineEmailEnabled] = useState(true);
  const [digestLoading, setDigestLoading] = useState(true);
  const [digestSaving, setDigestSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isPro, isAdmin, status, currentPeriodEnd, credits, loading, startCheckout, openPortal } = useSubscription();
  const { showCredits, unlimitedAi } = useCredits();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch("/api/user/digest-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.dailyEmailEnabled === "boolean") {
          setDailyEmailEnabled(data.dailyEmailEnabled);
        }
        if (data && typeof data.watchlistEmailEnabled === "boolean") {
          setWatchlistEmailEnabled(data.watchlistEmailEnabled);
        }
        if (data && typeof data.pipelineEmailEnabled === "boolean") {
          setPipelineEmailEnabled(data.pipelineEmailEnabled);
        }
      })
      .catch(() => {})
      .finally(() => setDigestLoading(false));
  }, []);

  async function patchDigestSetting(body: Record<string, boolean>) {
    setDigestSaving(true);
    try {
      const res = await fetch("/api/user/digest-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.dailyEmailEnabled === "boolean") setDailyEmailEnabled(data.dailyEmailEnabled);
        if (typeof data.watchlistEmailEnabled === "boolean") setWatchlistEmailEnabled(data.watchlistEmailEnabled);
        if (typeof data.pipelineEmailEnabled === "boolean") setPipelineEmailEnabled(data.pipelineEmailEnabled);
      }
    } finally {
      setDigestSaving(false);
    }
  }

  async function toggleDailyEmail() {
    await patchDigestSetting({ dailyEmailEnabled: !dailyEmailEnabled });
  }

  async function toggleWatchlistEmail() {
    await patchDigestSetting({ watchlistEmailEnabled: !watchlistEmailEnabled });
  }

  async function togglePipelineEmail() {
    await patchDigestSetting({ pipelineEmailEnabled: !pipelineEmailEnabled });
  }

  function EmailToggle({
    label,
    description,
    enabled,
    onToggle,
  }: {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
  }) {
    return (
      <div style={{ borderTop: "1px solid #EEE9E2", paddingTop: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: "0 0 4px" }}>{label}</p>
        <p style={{ fontSize: 14, color: "#8A7F72", margin: "0 0 12px", lineHeight: 1.5 }}>{description}</p>
        <button
          type="button"
          onClick={onToggle}
          disabled={digestLoading || digestSaving}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            border: "1px solid #EEE9E2",
            borderRadius: "var(--scout-radius)",
            background: enabled ? "rgba(26,58,47,0.06)" : "transparent",
            cursor: digestLoading || digestSaving ? "not-allowed" : "pointer",
            opacity: digestLoading || digestSaving ? 0.6 : 1,
          }}
        >
          <span
            style={{
              width: 36,
              height: 20,
              borderRadius: "var(--scout-radius)",
              background: enabled ? "#1A3A2F" : "#D4CCC0",
              position: "relative",
              transition: "background 0.15s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: enabled ? 18 : 2,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "#FFFDF9",
                transition: "left 0.15s",
              }}
            />
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: "#52493F" }}>
            {digestLoading ? "Loading…" : enabled ? "On" : "Off"}
          </span>
        </button>
      </div>
    );
  }

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

  async function handleAvatarUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAvatarUrl(data.url);
      onAvatarChange?.(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 1100,
          animation: "fadeIn 0.15s ease both",
        }}
      />

      {/* Modal — portaled so it is not clipped by the sidebar transform stack */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 680,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(80vh, calc(100dvh - 32px))",
          background: "#FFFFFF",
          borderRadius: "var(--scout-radius)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.1)",
          zIndex: 1101,
          display: "flex",
          overflow: "hidden",
          animation: "fadeIn 0.2s ease both",
        }}
      >
        {/* Left nav */}
        <div
          style={{
            width: 200,
            background: "var(--scout-cream)",
            borderRight: "1px solid #EEE9E2",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            padding: "20px 0",
          }}
        >
          {/* User avatar — clickable to upload */}
          <div style={{ padding: "0 16px 20px", borderBottom: "1px solid #EEE9E2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={user.name ?? ""}
                    style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", display: "block" }}
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
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#E8D5A3" }}>
                      {initials(user.name, user.email)}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user.name ?? user.email.split("@")[0]}
                </p>
                {user.headline && (
                  <p style={{ fontSize: 13, color: "#8A7F72", margin: "2px 0 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                  borderRadius: "var(--scout-radius)",
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

          {/* Bottom: sign out */}
          <div style={{ padding: "0 8px" }}>
            <button
              onClick={onSignOut}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 10px",
                borderRadius: "var(--scout-radius)",
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
                borderRadius: "var(--scout-radius)",
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
                {/* Avatar upload */}
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#8A7F72", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                    Profile Photo
                  </p>
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    {/* Avatar preview */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", display: "block", border: "var(--scout-border)" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: "50%",
                            background: color.forest,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "var(--scout-border)",
                          }}
                        >
                          <span style={{ fontFamily: fontSans, fontSize: 20, fontWeight: 600, color: color.gold }}>
                            {initials(user.name, user.email)}
                          </span>
                        </div>
                      )}
                      {uploading && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.45)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                              <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
                            </path>
                          </svg>
                        </div>
                      )}
                    </div>
                    {/* Upload button */}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAvatarUpload(file);
                          e.target.value = "";
                        }}
                      />
                      <ScoutSecondaryBtn
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{ marginBottom: 6, display: "block" }}
                      >
                        {uploading ? "Uploading…" : "Upload photo"}
                      </ScoutSecondaryBtn>
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
                        JPG, PNG, WebP or GIF · Max 5 MB
                      </p>
                      {uploadError && (
                        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "6px 0 0" }}>{uploadError}</p>
                      )}
                    </div>
                  </div>
                </div>

                <Field label="Full Name" value={user.name ?? "—"} />
                <Field label="Email" value={user.email} />
                {user.headline && <Field label="Headline" value={user.headline} />}
                <div
                  style={{
                    padding: "12px 16px",
                    background: surface.page,
                    border: "var(--scout-border)",
                    borderRadius: 0,
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    color: color.mutedLight,
                    lineHeight: 1.5,
                  }}
                >
                  To update your profile details, go to the <strong style={{ color: color.stone }}>Profile</strong> section in the main workspace.
                </div>
              </div>
            )}

            {tab === "security" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Field label="Email" value={user.email} />
                <EmailToggle
                  label="Daily job match emails"
                  description="Up to 3 matched roles per day with fit scores and why each role fits your profile."
                  enabled={dailyEmailEnabled}
                  onToggle={toggleDailyEmail}
                />
                <EmailToggle
                  label="Watchlist company alerts"
                  description="Separate from your daily digest — emailed when a company you track posts new matching roles."
                  enabled={watchlistEmailEnabled}
                  onToggle={toggleWatchlistEmail}
                />
                <EmailToggle
                  label="Pipeline follow-up reminders"
                  description="A nudge when an application in your pipeline has gone quiet for 7+ days."
                  enabled={pipelineEmailEnabled}
                  onToggle={togglePipelineEmail}
                />
                <div style={{ borderTop: "var(--scout-border)", paddingTop: 20 }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>Password</p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: "0 0 12px" }}>
                    You signed in with {user.email.includes("google") ? "Google" : "email"}. Password changes are managed through your email provider.
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
                    To reset your password, sign out and use the &quot;Forgot password&quot; link on the login page.
                  </p>
                </div>
              </div>
            )}

            {tab === "subscription" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Current plan */}
                <div>
                  <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.mutedLight, margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
                    Current Plan
                  </p>
                  <div
                    style={{
                      padding: "16px",
                      border: "var(--scout-border)",
                      borderRadius: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: surface.card,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontFamily: fontSans,
                            fontSize: T.bodySm,
                            fontWeight: 700,
                            color: isPro ? color.forest : color.stone,
                            letterSpacing: "0.3px",
                          }}
                        >
                          {loading ? "Loading…" : isAdmin ? "KIMCHI ADMIN" : isPro ? "KIMCHI PRO" : "KIMCHI FREE"}
                        </span>
                        {(isPro || isAdmin) && (
                          <span
                            style={{
                              fontFamily: fontSans,
                              fontSize: T.label,
                              fontWeight: 600,
                              color: surface.card,
                              background: isAdmin ? "#6B4A8A" : color.forest,
                              padding: "2px 8px",
                              border: "var(--scout-border)",
                              borderRadius: 0,
                              letterSpacing: "0.4px",
                            }}
                          >
                            {isAdmin ? "ADMIN" : "ACTIVE"}
                          </span>
                        )}
                      </div>
                      {isPro && !isAdmin && periodEndFormatted && (
                        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
                          Renews {periodEndFormatted}
                        </p>
                      )}
                      {isAdmin && (
                        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
                          Unlimited access · all features enabled
                        </p>
                      )}
                      {!isPro && !isAdmin && !unlimitedAi && (
                        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
                          15 AI credits per month on Free
                        </p>
                      )}
                      {!isPro && !isAdmin && unlimitedAi && (
                        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: 0 }}>
                          Unlimited AI access enabled
                        </p>
                      )}
                    </div>
                    {isAdmin ? null : isPro ? (
                      <ScoutSecondaryBtn onClick={openPortal}>
                        Manage Billing
                      </ScoutSecondaryBtn>
                    ) : unlimitedAi ? null : (
                      <ScoutPrimaryBtn onClick={startCheckout}>
                        Upgrade Now
                      </ScoutPrimaryBtn>
                    )}
                  </div>
                </div>

                {/* AI credits — free users + admins (visibility) */}
                {credits && showCredits && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: surface.page,
                      border: "var(--scout-border)",
                      borderRadius: 0,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0 }}>
                        {isAdmin ? "Your AI access" : "AI credits this month"}
                      </p>
                      <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: isAdmin ? "#6B4A8A" : credits.remaining <= 0 ? "#C4574A" : color.mutedLight }}>
                        {isAdmin ? `${credits.used} / unlimited` : `${credits.remaining} left · ${credits.used}/${credits.limit} used`}
                      </span>
                    </div>
                    {!isAdmin && (
                    <div style={{ height: 6, background: surface.inset, border: "var(--scout-border)", borderRadius: 0, overflow: "hidden", boxSizing: "border-box" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, (credits.used / credits.limit) * 100)}%`,
                          background: credits.remaining <= 0 ? "#C4574A" : credits.remaining <= 3 ? "#C4A86A" : color.forest,
                          borderRadius: 0,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                    )}
                    {isAdmin && (
                      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "8px 0 0", lineHeight: 1.5 }}>
                        1 credit per AI action · Resets monthly
                      </p>
                    )}
                    {!isAdmin && credits.remaining <= 0 && (
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#C4574A", margin: "8px 0 0" }}>
                        Out of credits — Pro removes the monthly cap.
                      </p>
                    )}
                    {!isAdmin && credits.remaining > 0 && credits.remaining <= 3 && (
                      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: "#7A6020", margin: "8px 0 0", lineHeight: 1.5 }}>
                        Running low — {credits.remaining} credit{credits.remaining !== 1 ? "s" : ""} left. Each AI action uses 1 credit.
                      </p>
                    )}
                    {!isAdmin && credits.remaining > 3 && (
                      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, margin: "8px 0 0", lineHeight: 1.5 }}>
                        1 credit per match, tailor, cover letter, or Scout message. Resets monthly.
                      </p>
                    )}
                  </div>
                )}

                {/* Refer & Earn */}
                <button
                  type="button"
                  onClick={() => setReferEarnOpen(true)}
                  data-offer="referral"
                  data-trigger="settings_refer_earn"
                  style={{
                    display: "block",
                    width: "100%",
                    background: surface.page,
                    border: "var(--scout-border)",
                    borderRadius: 0,
                    padding: "14px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(26,58,47,0.06)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = surface.page; }}
                >
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest }}>
                    Refer & Earn
                  </p>
                  <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.caption, color: color.mutedLight, lineHeight: 1.5 }}>
                    Invite a friend or share on LinkedIn for bonus AI credits.
                  </p>
                </button>

                {/* What&apos;s included */}
                {!isPro && !isAdmin && !unlimitedAi && (
                  <div
                    style={{
                      padding: "14px 16px",
                      background: surface.page,
                      border: "var(--scout-border)",
                      borderRadius: 0,
                    }}
                  >
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, margin: "0 0 10px" }}>
                      Pro includes:
                    </p>
                    {[
                      "No monthly cap on AI actions",
                      "Fit analysis on every role you paste",
                      "Resume tailoring and cover letters",
                      "Live coaching access",
                      "Unlimited company watchlist and alerts",
                    ].map((feat) => (
                      <div key={feat} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color.forest} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone }}>{feat}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Refresh notice */}
                <div
                  style={{
                    padding: "14px 16px",
                    background: surface.page,
                    border: "var(--scout-border)",
                    borderRadius: 0,
                    textAlign: "center",
                  }}
                >
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.stone, margin: "0 0 4px" }}>
                    Not seeing your updated subscription?
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.mutedLight, margin: "0 0 10px", lineHeight: 1.5 }}>
                    If you just upgraded, refresh the page to sync your plan status.
                  </p>
                  <ScoutSecondaryBtn onClick={() => window.location.reload()}>
                    Refresh Status
                  </ScoutSecondaryBtn>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {referEarnOpen && <ReferEarnModal onClose={() => setReferEarnOpen(false)} />}
    </>,
    document.body,
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: fontSans, fontSize: T.label, fontWeight: 600, color: color.mutedLight, margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: 0, padding: "10px 12px", background: surface.inset, borderRadius: 0, border: "var(--scout-border)" }}>
        {value}
      </p>
    </div>
  );
}
