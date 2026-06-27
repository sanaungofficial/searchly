"use client";

import { useEffect, useState } from "react";
import { DISCOVERY_BLOCKERS, type DiscoveryBlocker } from "@/lib/discovery-lead";
import { ScoutInsetBox, scoutFieldStyle } from "@/components/scout/scout-box";
import { ScoutModal } from "@/components/scout/scout-modal";

export type GrowthDiscoveryTrigger =
  | "sidebar_help"
  | "dashboard_schedule"
  | "low_match"
  | "interview"
  | "dashboard"
  | "readback";

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

const inputStyle = scoutFieldStyle;

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  fontWeight: 600,
  color: "#52493F",
  marginBottom: 6,
};

export function GrowthDiscoveryModal({ trigger, onClose }: Props) {
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    setMounted(true);
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

  const isSchedule = trigger === "dashboard_schedule";
  const title = isSchedule ? "Schedule a call with our team" : "Stuck on the search?";
  const subtitle = isSchedule
    ? "A Kimchi strategist can walk through your goals — 20 minutes, no pitch deck. We'll pull context from your profile."
    : "A Second Ladder strategist can help — 20 minutes, no pitch deck. We'll pull context from your profile.";
  const submitLabel = isSchedule ? "Request a call →" : "Request a call →";

  if (!mounted) return null;

  return (
    <ScoutModal
      open
      onClose={onClose}
      ariaLabelledBy="growth-discovery-title"
      maxWidth={480}
      padding="32px 28px"
      panelStyle={{ maxHeight: "min(90vh, 720px)", overflowY: "auto" }}
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
                borderRadius: "var(--scout-radius)",
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
              {title}
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
              {subtitle}
            </p>

            {!loadingProfile && profile && (
              <ScoutInsetBox padding="12px 14px" style={{ marginBottom: 20, fontFamily: "var(--font-ui)", fontSize: 13, color: "#52493F", lineHeight: 1.55 }}>
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
              </ScoutInsetBox>
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
                  borderRadius: "var(--scout-radius)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: submitting || loadingProfile ? "default" : "pointer",
                  opacity: submitting || loadingProfile ? 0.7 : 1,
                  marginBottom: 10,
                }}
              >
                {submitting ? "Sending…" : submitLabel}
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
    </ScoutModal>
  );
}
