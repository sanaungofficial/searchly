"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LinkedInOrgPicker } from "@/components/scout/linkedin-org-picker";
import { CoachPricingDrawer } from "@/components/scout/coach-pricing-drawer";
import { ScoutBox, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { color, fontMono, fontSans } from "@/lib/typography";

type CoachProfile = {
  id: string;
  slug?: string | null;
  displayName: string;
  email: string | null;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  lelandUrl: string | null;
  photoUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  hourlyRate: number | null;
  category: string | null;
  calLink: string | null;
  status?: "ACTIVE" | "PENDING" | "INACTIVE";
  featured?: boolean;
  isInternal?: boolean;
  clientSpecializations?: string[];
  experienceLevel?: string | null;
  clientTier?: string | null;
  industryYears?: number | null;
  isProfessionalCoach?: boolean;
  whyCoach?: string | null;
  aboutMe?: string | null;
  nylasGrantId?: string | null;
  nylasSchedulerConfigId?: string | null;
  nylasSchedulerSlug?: string | null;
  schedulerDurationMinutes?: number;
  schedulerTimezone?: string | null;
  schedulerOpenHourStart?: string | null;
  schedulerOpenHourEnd?: string | null;
  schedulerOpenDays?: number[];
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  background: "#fff",
  border: "1px solid rgba(26,58,47,0.12)",
  borderRadius: "var(--scout-radius)",
  padding: "9px 12px",
  outline: "none",
  fontFamily: fontSans,
  boxSizing: "border-box",
  color: "#1a1a1a",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "var(--scout-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  fontFamily: fontMono,
  marginBottom: 5,
};

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function add() {
    const t = input.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setInput("");
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {value.map((t) => (
          <span
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "rgba(26,58,47,0.08)",
              borderRadius: "var(--scout-radius)",
              padding: "2px 8px",
              fontSize: 13,
              color: "#1a3a2f",
            }}
          >
            {t}
            <button
              onClick={() => onChange(value.filter((x) => x !== t))}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--scout-muted)",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder ?? "Type and press Enter"}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={add}
          style={{
            padding: "9px 14px",
            borderRadius: "var(--scout-radius)",
            border: "1px solid rgba(26,58,47,0.15)",
            background: "transparent",
            cursor: "pointer",
            fontSize: 13,
            color: "#1a3a2f",
            fontFamily: fontSans,
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

type CoachProfileTabProps = {
  /** When true, auto-creates a coach profile via PATCH if none exists (for admins). */
  setupOnMissing?: boolean;
  emptyMessage?: string;
  /** Admin mode: edit any coach by id via /api/admin/coaches/[id] */
  mode?: "coach" | "admin";
  coachId?: string;
};

export function CoachProfileTab({
  setupOnMissing = false,
  emptyMessage = "No coach profile found linked to your account. Contact an admin to get set up.",
  mode = "coach",
  coachId,
}: CoachProfileTabProps) {
  const isAdminEdit = mode === "admin" && Boolean(coachId);
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<CoachProfile>>({});
  const [nylasStatus, setNylasStatus] = useState<{
    configured: boolean;
    connected: boolean;
    configurationId: string | null;
  } | null>(null);
  const [nylasNotice, setNylasNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [retryingScheduler, setRetryingScheduler] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

  async function loadProfile() {
    const url = isAdminEdit ? `/api/admin/coaches/${coachId}` : "/api/coach/profile";
    const r = await fetch(url);
    const d = await r.json();
    if (d && !d.error) {
      setProfile(d);
      setForm(d);
      return d as CoachProfile;
    }
    return null;
  }

  async function refreshNylasStatus() {
    const r = await fetch("/api/nylas/status");
    if (r.ok) {
      const d = await r.json();
      setNylasStatus(d);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let data = await loadProfile();

      if (!data && setupOnMissing && !isAdminEdit) {
        setSettingUp(true);
        const r = await fetch("/api/coach/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (r.ok) {
          data = await r.json();
          if (!cancelled && data) {
            setProfile(data);
            setForm(data);
          }
        }
        if (!cancelled) setSettingUp(false);
      }

      if (!cancelled) setLoading(false);
    }

    init().catch(() => {
      if (!cancelled) setLoading(false);
    });

    refreshNylasStatus().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [setupOnMissing, isAdminEdit, coachId]);

  useEffect(() => {
    const nylas = searchParams.get("nylas");
    const reason = searchParams.get("reason");
    const detail = searchParams.get("detail");
    if (nylas === "connected") {
      setNylasNotice({ type: "success", message: "Calendar connected — in-app booking is enabled." });
      refreshNylasStatus().catch(() => {});
    } else if (nylas === "error") {
      const messages: Record<string, string> = {
        config: "Nylas is not configured on this environment.",
        auth: "Calendar authorization was cancelled or failed.",
        denied:
          "Calendar access was denied. If you use Nylas sandbox, add your Google account under Hosted Authentication → Test users, then try again.",
        provider:
          "Google sign-in is not enabled in Nylas. In the Nylas dashboard, open Hosted Authentication → Identity providers and enable Google.",
        state: "Session expired — please try connecting again.",
        profile: "Coach profile not found.",
        redirect:
          "OAuth redirect URI mismatch. In Nylas → Hosted Authentication, add https://app.kimchi.so/api/nylas/callback",
        setup: "Connected, but scheduler setup failed. Try again or contact support.",
      };
      let base = messages[reason ?? ""] ?? "Calendar connection failed. Please try again.";
      if (detail === "missing_code") {
        base =
          "Google login finished but Nylas did not return an authorization code. In the Nylas dashboard, confirm Google is enabled under Identity providers and your account is listed under Test users (sandbox).";
      }
      setNylasNotice({
        type: "error",
        message: detail ? `${base} (${detail})` : base,
      });
    }
  }, [searchParams]);

  async function retryScheduler() {
    setRetryingScheduler(true);
    setNylasNotice(null);
    try {
      const r = await fetch("/api/nylas/retry-scheduler", { method: "POST" });
      const d = await r.json();
      if (!r.ok) {
        setNylasNotice({ type: "error", message: d.error ?? "Scheduler setup failed." });
        return;
      }
      await loadProfile();
      await refreshNylasStatus();
      setNylasNotice({
        type: "success",
        message: d.created ? "Scheduler created — in-app booking is enabled." : "Scheduler updated.",
      });
    } catch {
      setNylasNotice({ type: "error", message: "Scheduler setup failed. Please try again." });
    } finally {
      setRetryingScheduler(false);
    }
  }

  const calendarConnected = Boolean(form.nylasGrantId);
  const schedulerReady = Boolean(form.nylasGrantId && form.nylasSchedulerConfigId);

  function field(key: keyof CoachProfile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    const url = isAdminEdit ? `/api/admin/coaches/${coachId}` : "/api/coach/profile";
    const r = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      const updated = await r.json();
      setProfile(updated);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  }

  if (loading || settingUp) {
    return (
      <p style={{ color: "var(--scout-muted)", fontSize: 14, padding: "40px 0" }}>
        {settingUp ? "Setting up your profile…" : "Loading…"}
      </p>
    );
  }

  if (!profile) {
    return (
      <ScoutBox padding={24}>
        <p style={{ fontSize: 14, color: "var(--scout-muted)" }}>{emptyMessage}</p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 60 }}>
      {!isAdminEdit && nylasNotice && (
        <div
          style={{
            background: nylasNotice.type === "success" ? "rgba(45,122,80,0.08)" : "rgba(220,38,38,0.08)",
            border: `1px solid ${nylasNotice.type === "success" ? "rgba(45,122,80,0.2)" : "rgba(220,38,38,0.2)"}`,
            padding: "12px 16px",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 14,
              fontFamily: fontSans,
              color: nylasNotice.type === "success" ? "#2d7a50" : "#dc2626",
            }}
          >
            {nylasNotice.message}
          </p>
        </div>
      )}

      {isAdminEdit && (
        <ScoutBox padding="20px 24px">
          <p
            style={{
              fontSize: 12,
              color: "var(--scout-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              fontFamily: fontMono,
              marginBottom: 16,
            }}
          >
            Admin settings
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input value={form.email ?? ""} onChange={field("email")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={form.status ?? "ACTIVE"}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CoachProfile["status"] }))}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING">Pending</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input value={form.category ?? ""} onChange={field("category")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Industry years</label>
              <input
                type="number"
                value={form.industryYears ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    industryYears: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
              <input
                type="checkbox"
                id="featured-coach"
                checked={form.featured ?? false}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
                style={{ width: 14, height: 14, cursor: "pointer" }}
              />
              <label htmlFor="featured-coach" style={{ fontSize: 13, color: color.stone, cursor: "pointer", fontFamily: fontSans }}>
                Featured in directory
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
              <input
                type="checkbox"
                id="internal-coach"
                checked={form.isInternal ?? false}
                onChange={(e) => setForm((f) => ({ ...f, isInternal: e.target.checked }))}
                style={{ width: 14, height: 14, cursor: "pointer" }}
              />
              <label htmlFor="internal-coach" style={{ fontSize: 13, color: color.stone, cursor: "pointer", fontFamily: fontSans }}>
                Internal Kimchi coach
              </label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 18 }}>
              <input
                type="checkbox"
                id="pro-coach"
                checked={form.isProfessionalCoach ?? false}
                onChange={(e) => setForm((f) => ({ ...f, isProfessionalCoach: e.target.checked }))}
                style={{ width: 14, height: 14, cursor: "pointer" }}
              />
              <label htmlFor="pro-coach" style={{ fontSize: 13, color: color.stone, cursor: "pointer", fontFamily: fontSans }}>
                Professional coach
              </label>
            </div>
          </div>
        </ScoutBox>
      )}

      {!isAdminEdit && (
        <ScoutBox
          padding="20px 24px"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 12,
                color: "var(--scout-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.8px",
                fontFamily: fontMono,
                margin: "0 0 6px",
              }}
            >
              Pricing
            </p>
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 22, fontWeight: 600, color: color.forest }}>
              {form.hourlyRate != null ? `$${form.hourlyRate}/hr` : "Not set"}
            </p>
            <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
              Hourly rate, packages, bulk discounts, and lead settings
            </p>
          </div>
          <ScoutSecondaryBtn onClick={() => setPricingOpen(true)} style={{ minHeight: 40 }}>
            Manage pricing
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      <ScoutBox padding="20px 24px">
        <p
          style={{
            fontSize: 12,
            color: "var(--scout-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontFamily: fontMono,
            marginBottom: 16,
          }}
        >
          Basic Info
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Display Name *</label>
            <input value={form.displayName ?? ""} onChange={field("displayName")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input
              value={form.location ?? ""}
              onChange={field("location")}
              placeholder="City, State"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Current Role</label>
            <input value={form.currentRole ?? ""} onChange={field("currentRole")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Current Company</label>
            <LinkedInOrgPicker
              value={form.currentCompany ?? ""}
              placeholder="Search company (Hirebase lookup)…"
              onChange={(name) => setForm((f) => ({ ...f, currentCompany: name || null }))}
              inputStyle={inputStyle}
              logoSize={36}
              hintLabel="employer"
            />
          </div>
          <div>
            <label style={labelStyle}>Photo URL</label>
            <input value={form.photoUrl ?? ""} onChange={field("photoUrl")} placeholder="https://…" style={inputStyle} />
          </div>
        </div>
      </ScoutBox>

      <ScoutBox padding="20px 24px">
        <p
          style={{
            fontSize: 12,
            color: "var(--scout-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontFamily: fontMono,
            marginBottom: 16,
          }}
        >
          About
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Headline</label>
            <input
              value={form.headline ?? ""}
              onChange={field("headline")}
              placeholder="One-line description of your coaching"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Bio</label>
            <textarea
              value={form.bio ?? ""}
              onChange={field("bio")}
              rows={5}
              placeholder="Tell candidates about your background and what you help with…"
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
            />
          </div>
        </div>
      </ScoutBox>

      {!isAdminEdit && (
      <ScoutBox padding="20px 24px">
        <p
          style={{
            fontSize: 12,
            color: "var(--scout-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontFamily: fontMono,
            marginBottom: 8,
          }}
        >
          Calendar & email sync
        </p>
        <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.6, margin: "0 0 16px" }}>
          Connect Google or Outlook so seekers can book sessions inside Kimchi. Gmail and calendar access is managed
          through Nylas — your external Cal.com link still works as a fallback.
        </p>
        {schedulerReady ? (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontFamily: fontSans, fontSize: 14, color: "#2d7a50", margin: "0 0 12px" }}>
              Calendar connected — in-app booking is enabled.
            </p>
            <Link
              href="/expert/offerings?section=availability"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                background: color.forest,
                color: color.gold,
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Edit availability
            </Link>
          </div>
        ) : calendarConnected ? (
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontFamily: fontSans, fontSize: 14, color: "#b45309", margin: "0 0 10px" }}>
              Calendar connected, but booking setup did not finish. Retry without reconnecting OAuth.
            </p>
            <button
              type="button"
              onClick={retryScheduler}
              disabled={retryingScheduler}
              style={{
                padding: "10px 18px",
                background: retryingScheduler ? "#d4c9b8" : color.forest,
                color: color.gold,
                border: "none",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
                cursor: retryingScheduler ? "default" : "pointer",
              }}
            >
              {retryingScheduler ? "Setting up…" : "Retry scheduler setup"}
            </button>
          </div>
        ) : nylasStatus?.configured === false ? (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>
            Nylas is not configured on this environment yet.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href="/api/nylas/connect?provider=google&returnPath=%2Fdashboard%2Favailability"
              style={{
                padding: "10px 18px",
                background: color.forest,
                color: color.gold,
                textDecoration: "none",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Connect Google Calendar
            </a>
            <a
              href="/api/nylas/connect?provider=microsoft&returnPath=%2Fdashboard%2Favailability"
              style={{
                padding: "10px 18px",
                border: "1px solid rgba(26,58,47,0.2)",
                color: color.forest,
                textDecoration: "none",
                fontFamily: fontSans,
                fontSize: 14,
                fontWeight: 600,
                background: "#fff",
              }}
            >
              Connect Outlook
            </a>
          </div>
        )}

      </ScoutBox>
      )}

      {isAdminEdit && (
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.55 }}>
          Calendar connection and weekly hours are in the <strong>Overview</strong> and <strong>Availability</strong> tabs.
          Packages and hourly rate are in the <strong>Pricing</strong> tab.
        </p>
      )}

      <ScoutBox padding="20px 24px">
        <p
          style={{
            fontSize: 12,
            color: "var(--scout-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontFamily: fontMono,
            marginBottom: 16,
          }}
        >
          Links
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input
              value={form.linkedinUrl ?? ""}
              onChange={field("linkedinUrl")}
              placeholder="https://linkedin.com/in/…"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Booking link (Cal.com / Calendly)</label>
            <input
              value={form.calLink ?? ""}
              onChange={field("calLink")}
              placeholder="https://cal.com/your-name"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Leland URL</label>
            <input
              value={form.lelandUrl ?? ""}
              onChange={field("lelandUrl")}
              placeholder="https://leland.com/…"
              style={inputStyle}
            />
          </div>
        </div>
      </ScoutBox>

      <ScoutBox padding="20px 24px">
        <p
          style={{
            fontSize: 12,
            color: "var(--scout-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            fontFamily: fontMono,
            marginBottom: 16,
          }}
        >
          Background & Expertise
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Firms (MBB, Big 4, etc.)</label>
            <TagInput
              value={form.firms ?? []}
              onChange={(v) => setForm((f) => ({ ...f, firms: v }))}
              placeholder="e.g. McKinsey"
            />
          </div>
          <div>
            <label style={labelStyle}>Schools</label>
            <TagInput
              value={form.schools ?? []}
              onChange={(v) => setForm((f) => ({ ...f, schools: v }))}
              placeholder="e.g. Wharton MBA"
            />
          </div>
          <div>
            <label style={labelStyle}>Specialties</label>
            <TagInput
              value={form.specialties ?? []}
              onChange={(v) => setForm((f) => ({ ...f, specialties: v }))}
              placeholder="e.g. Interview Prep"
            />
          </div>
          <div>
            <label style={labelStyle}>Industries</label>
            <TagInput
              value={form.industries ?? []}
              onChange={(v) => setForm((f) => ({ ...f, industries: v }))}
              placeholder="e.g. Tech"
            />
          </div>
          {isAdminEdit && (
            <>
              <div>
                <label style={labelStyle}>Client specializations</label>
                <TagInput
                  value={form.clientSpecializations ?? []}
                  onChange={(v) => setForm((f) => ({ ...f, clientSpecializations: v }))}
                  placeholder="e.g. MBA candidates"
                />
              </div>
              <div>
                <label style={labelStyle}>Experience level</label>
                <input value={form.experienceLevel ?? ""} onChange={field("experienceLevel")} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Client tier</label>
                <input value={form.clientTier ?? ""} onChange={field("clientTier")} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Why coach</label>
                <textarea
                  value={form.whyCoach ?? ""}
                  onChange={field("whyCoach")}
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </div>
              <div>
                <label style={labelStyle}>About me (extended)</label>
                <textarea
                  value={form.aboutMe ?? ""}
                  onChange={field("aboutMe")}
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
                />
              </div>
            </>
          )}
        </div>
      </ScoutBox>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{
            padding: "10px 24px",
            background: saving ? "#d4c9b8" : color.forest,
            color: color.gold,
            border: "none",
            borderRadius: "var(--scout-radius)",
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? "default" : "pointer",
            fontFamily: fontSans,
          }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <p style={{ fontSize: 13, color: "#2d7a50", fontFamily: fontSans }}>Saved ✓</p>
        )}
      </div>

      {!isAdminEdit && pricingOpen && (
        <CoachPricingDrawer
          coachSlug={profile.slug}
          onClose={() => {
            setPricingOpen(false);
            loadProfile().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
