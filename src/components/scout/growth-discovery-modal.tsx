"use client";

import { useEffect, useState } from "react";
import { DISCOVERY_BLOCKERS, type DiscoveryBlocker } from "@/lib/discovery-lead";

export type GrowthDiscoveryTrigger = "sidebar_help" | "low_match" | "interview" | "dashboard" | "readback";

type ProfilePrefill = {
  name: string;
  email: string;
  targetRoles: string[];
  jobTimeline: string | null;
  targetSalary: string | null;
  linkedinUrl: string | null;
  phone: string | null;
};

type Props = {
  trigger: GrowthDiscoveryTrigger;
  onClose: () => void;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #E5DDD0",
  borderRadius: 0,
  fontFamily: "var(--font-ui)",
  fontSize: 14,
  color: "#1A1A1A",
  background: "#FFFDF9",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  fontWeight: 600,
  color: "#52493F",
  marginBottom: 6,
};

export function GrowthDiscoveryModal({ trigger, onClose }: Props) {
  const [profile, setProfile] = useState<ProfilePrefill | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [blocker, setBlocker] = useState<DiscoveryBlocker | "">("");
  const [targetCompanies, setTargetCompanies] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredContactTime, setPreferredContactTime] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return;
        const parsed = d.parsedData as { phone?: string } | null | undefined;
        setProfile({
          name: d.name ?? "",
          email: d.email ?? "",
          targetRoles: d.targetRoles ?? [],
          jobTimeline: d.jobTimeline ?? null,
          targetSalary: d.targetSalary ?? null,
          linkedinUrl: d.linkedinUrl ?? null,
          phone: parsed?.phone ?? null,
        });
        if (parsed?.phone) setPhone(parsed.phone);
      })
      .catch(() => {})
      .finally(() => setLoadingProfile(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!blocker) {
      setError("Pick the closest match for what's blocking you.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocker,
          targetCompanies,
          phone: phone.trim() || undefined,
          preferredContactTime,
          notes,
          trigger,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const targetRoleLabel =
    profile?.targetRoles?.length ? profile.targetRoles.slice(0, 2).join(", ") : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }}
      />
      <div
        role="dialog"
        aria-labelledby="growth-discovery-title"
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 0,
          padding: "32px 28px",
          maxWidth: 480,
          width: "100%",
          maxHeight: "min(90vh, 720px)",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        {success ? (
          <>
            <p
              id="growth-discovery-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 600,
                fontStyle: "italic",
                color: "#1a1a1a",
                marginBottom: 12,
                lineHeight: 1.3,
              }}
            >
              Request received.
            </p>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 15,
                color: "#52493F",
                lineHeight: 1.65,
                marginBottom: 28,
              }}
            >
              Someone from Second Ladder will reach out within two business days. We&apos;ll use what&apos;s already in your Kimchi profile — no need to send your resume again.
            </p>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: "100%",
                padding: "12px 0",
                background: "#1A3A2F",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 0,
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back to workspace
            </button>
          </>
        ) : (
          <>
            <p
              id="growth-discovery-title"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                fontWeight: 600,
                fontStyle: "italic",
                color: "#1a1a1a",
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              Stuck on the search?
            </p>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                color: "var(--scout-muted)",
                lineHeight: 1.65,
                marginBottom: 20,
              }}
            >
              A Second Ladder strategist can help — 20 minutes, no pitch deck. We&apos;ll pull context from your profile.
            </p>

            {!loadingProfile && profile && (
              <div
                style={{
                  padding: "12px 14px",
                  background: "#F7F5F2",
                  borderRadius: 0,
                  border: "1px solid #E5DDD0",
                  marginBottom: 20,
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  color: "#52493F",
                  lineHeight: 1.55,
                }}
              >
                <strong style={{ color: "#1C3A2F" }}>{profile.name}</strong> · {profile.email}
                {targetRoleLabel && (
                  <>
                    <br />
                    Targeting: {targetRoleLabel}
                  </>
                )}
                {(profile.jobTimeline || profile.targetSalary) && (
                  <>
                    <br />
                    {[profile.jobTimeline, profile.targetSalary && `Target ${profile.targetSalary}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="discovery-blocker">
                  What&apos;s the biggest blocker right now? *
                </label>
                <select
                  id="discovery-blocker"
                  value={blocker}
                  onChange={(e) => setBlocker(e.target.value as DiscoveryBlocker)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  <option value="">Select one…</option>
                  {DISCOVERY_BLOCKERS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="discovery-companies">
                  Target companies (optional)
                </label>
                <input
                  id="discovery-companies"
                  type="text"
                  value={targetCompanies}
                  onChange={(e) => setTargetCompanies(e.target.value)}
                  placeholder="e.g. Stripe, Notion, Figma"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="discovery-phone">
                  Phone {profile?.phone ? "(confirm or update)" : "(optional)"}
                </label>
                <input
                  id="discovery-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle} htmlFor="discovery-time">
                  Best time to reach you (optional)
                </label>
                <input
                  id="discovery-time"
                  type="text"
                  value={preferredContactTime}
                  onChange={(e) => setPreferredContactTime(e.target.value)}
                  placeholder="Weekday mornings, PT"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle} htmlFor="discovery-notes">
                  Anything else? (optional)
                </label>
                <textarea
                  id="discovery-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Context that would help us prep for the call…"
                  style={{ ...inputStyle, resize: "vertical", minHeight: 72 }}
                />
              </div>

              {error && (
                <p style={{ fontSize: 14, color: "#C4574A", marginBottom: 12, lineHeight: 1.5 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || loadingProfile}
                data-offer="discovery"
                data-trigger={trigger}
                style={{
                  width: "100%",
                  padding: "12px 0",
                  background: "#1A3A2F",
                  color: "#E8D5A3",
                  border: "none",
                  borderRadius: 0,
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitting || loadingProfile ? "default" : "pointer",
                  opacity: submitting || loadingProfile ? 0.7 : 1,
                  marginBottom: 10,
                }}
              >
                {submitting ? "Sending…" : "Request a call →"}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  color: "var(--scout-muted)",
                }}
              >
                Maybe later
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
