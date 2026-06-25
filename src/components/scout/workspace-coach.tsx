"use client";

import { useEffect, useState } from "react";
import { ScoutBox } from "./scout-box";
import { WorkspacePageShell } from "./workspace-page-shell";
import { WorkspaceSegmentTabs } from "./workspace-segment-tabs";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type CoachTab = "clients" | "profile";

type JobStage = "SAVED" | "APPLYING" | "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN";

type ClientJob = {
  id: string;
  company: string;
  role: string;
  stage: JobStage;
  appliedAt: string | null;
  createdAt: string;
};

type Client = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  profile: {
    headline: string | null;
    targetRoles: string[];
    targetSalary: number | null;
    resumeUrl: string | null;
    linkedinUrl: string | null;
  } | null;
  subscription: {
    status: string;
    stripeCurrentPeriodEnd: string;
  } | null;
  jobs: ClientJob[];
  _count: { jobs: number; tailoredResumes: number };
};

type CoachProfile = {
  id: string;
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
};

const STAGE_COLORS: Record<JobStage, { bg: string; color: string }> = {
  SAVED:        { bg: "rgba(160,152,144,0.12)", color: "#78716c" },
  APPLYING:     { bg: "rgba(37,99,235,0.08)",   color: "#2563eb" },
  APPLIED:      { bg: "rgba(37,99,235,0.12)",   color: "#1d4ed8" },
  SCREENING:    { bg: "rgba(217,119,6,0.1)",    color: "#b45309" },
  INTERVIEWING: { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed" },
  OFFER:        { bg: "rgba(5,150,105,0.1)",    color: "#059669" },
  REJECTED:     { bg: "rgba(220,38,38,0.08)",   color: "#dc2626" },
  WITHDRAWN:    { bg: "rgba(160,152,144,0.1)",  color: "#78716c" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  background: "#fff",
  border: "1px solid rgba(26,58,47,0.12)",
  borderRadius: 0,
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

function StageBadge({ stage }: { stage: JobStage }) {
  const { bg, color } = STAGE_COLORS[stage] ?? STAGE_COLORS.SAVED;
  return (
    <span style={{ fontSize: 12, fontFamily: fontMono, padding: "2px 7px", borderRadius: 0, background: bg, color }}>
      {stage.toLowerCase()}
    </span>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function activeStage(stage: JobStage) {
  return !["REJECTED", "WITHDRAWN", "SAVED"].includes(stage);
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
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
          <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(26,58,47,0.08)", borderRadius: 0, padding: "2px 8px", fontSize: 13, color: "#1a3a2f" }}>
            {t}
            <button onClick={() => onChange(value.filter((x) => x !== t))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--scout-muted)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? "Type and press Enter"}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={add} style={{ padding: "9px 14px", borderRadius: 8, border: "1px solid rgba(26,58,47,0.15)", background: "transparent", cursor: "pointer", fontSize: 13, color: "#1a3a2f", fontFamily: fontSans }}>Add</button>
      </div>
    </div>
  );
}

function MyProfileTab() {
  const [profile, setProfile] = useState<CoachProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState<Partial<CoachProfile>>({});

  useEffect(() => {
    fetch("/api/coach/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d);
        if (d) setForm(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function field(key: keyof CoachProfile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    const r = await fetch("/api/coach/profile", {
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

  if (loading) return <p style={{ color: "var(--scout-muted)", fontSize: 14, padding: "40px 0" }}>Loading…</p>;
  if (!profile) return (
    <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", padding: 24 }}>
      <p style={{ fontSize: 14, color: "var(--scout-muted)" }}>No coach profile found linked to your account. Contact an admin to get set up.</p>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 60 }}>
      {/* Basic info */}
      <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", padding: "20px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 16 }}>Basic Info</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>Display Name *</label>
            <input value={form.displayName ?? ""} onChange={field("displayName")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input value={form.location ?? ""} onChange={field("location")} placeholder="City, State" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Current Role</label>
            <input value={form.currentRole ?? ""} onChange={field("currentRole")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Current Company</label>
            <input value={form.currentCompany ?? ""} onChange={field("currentCompany")} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Hourly Rate ($)</label>
            <input type="number" value={form.hourlyRate ?? ""} onChange={field("hourlyRate")} placeholder="200" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Photo URL</label>
            <input value={form.photoUrl ?? ""} onChange={field("photoUrl")} placeholder="https://…" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Headline & bio */}
      <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", padding: "20px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 16 }}>About</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Headline</label>
            <input value={form.headline ?? ""} onChange={field("headline")} placeholder="One-line description of your coaching" style={inputStyle} />
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
      </div>

      {/* Links */}
      <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", padding: "20px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 16 }}>Links</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={labelStyle}>LinkedIn URL</label>
            <input value={form.linkedinUrl ?? ""} onChange={field("linkedinUrl")} placeholder="https://linkedin.com/in/…" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Leland URL</label>
            <input value={form.lelandUrl ?? ""} onChange={field("lelandUrl")} placeholder="https://leland.com/…" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", padding: "20px 24px" }}>
        <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 16 }}>Background & Expertise</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>Firms (MBB, Big 4, etc.)</label>
            <TagInput value={form.firms ?? []} onChange={(v) => setForm((f) => ({ ...f, firms: v }))} placeholder="e.g. McKinsey" />
          </div>
          <div>
            <label style={labelStyle}>Schools</label>
            <TagInput value={form.schools ?? []} onChange={(v) => setForm((f) => ({ ...f, schools: v }))} placeholder="e.g. Wharton MBA" />
          </div>
          <div>
            <label style={labelStyle}>Specialties</label>
            <TagInput value={form.specialties ?? []} onChange={(v) => setForm((f) => ({ ...f, specialties: v }))} placeholder="e.g. Interview Prep" />
          </div>
          <div>
            <label style={labelStyle}>Industries</label>
            <TagInput value={form.industries ?? []} onChange={(v) => setForm((f) => ({ ...f, industries: v }))} placeholder="e.g. Tech" />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={save}
          disabled={saving}
          style={{ padding: "10px 24px", background: saving ? "#d4c9b8" : color.forest, color: color.gold, border: "none", borderRadius: 0, fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer", fontFamily: fontSans }}
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {saved && <p style={{ fontSize: 13, color: "#2d7a50", fontFamily: fontSans }}>Saved ✓</p>}
      </div>
    </div>
  );
}

export function WorkspaceCoach() {
  const [tab, setTab] = useState<CoachTab>("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [showSubmittedBanner, setShowSubmittedBanner] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("onboarding") === "submitted") {
      setShowSubmittedBanner(true);
      window.history.replaceState({}, "", "/clients");
    }
  }, []);

  useEffect(() => {
    fetch("/api/coach/clients")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { setClients(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const tabs = (
    <WorkspaceSegmentTabs
      tabs={[
        { id: "clients" as const, label: "Clients" },
        { id: "profile" as const, label: "My Profile" },
      ]}
      active={tab}
      onChange={(id) => { setTab(id); setSelected(null); }}
    />
  );

  if (loading && tab === "clients") return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading clients…</p>
    </div>
  );
  if (error && tab === "clients") return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Failed to load clients.</p>
    </div>
  );

  /* Client detail */
  if (selected && tab === "clients") {
    const activeJobs = selected.jobs.filter((j) => activeStage(j.stage));
    const appliedJobs = selected.jobs.filter((j) => ["APPLIED", "SCREENING", "INTERVIEWING"].includes(j.stage));
    return (
      <WorkspacePageShell label="Coach portal" title={selected.name ?? selected.email.split("@")[0]}>
        {tabs}
        <button onClick={() => setSelected(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: color.muted, fontSize: T.caption, fontFamily: fontSans, marginBottom: 24, padding: 0 }}>
          ← All Clients
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <p style={{ fontSize: T.caption, color: color.muted, fontFamily: fontMono, margin: "0 0 6px" }}>{selected.email}</p>
            {selected.profile?.headline && <p style={{ fontSize: T.bodySm, color: color.stone, margin: 0 }}>{selected.profile.headline}</p>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selected.profile?.linkedinUrl && (
              <a href={selected.profile.linkedinUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: T.caption, fontFamily: fontMono, padding: "5px 12px", borderRadius: 0, border: border.line, color: color.forest, textDecoration: "none", background: surface.card }}>
                LinkedIn ↗
              </a>
            )}
            {selected.profile?.resumeUrl && (
              <a href={selected.profile.resumeUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: T.caption, fontFamily: fontMono, padding: "5px 12px", borderRadius: 0, border: border.line, color: color.forest, textDecoration: "none", background: surface.card }}>
                Resume ↗
              </a>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Jobs", value: selected._count.jobs },
            { label: "Active Pipeline", value: activeJobs.length },
            { label: "Applied / In Process", value: appliedJobs.length },
            { label: "Tailored Resumes", value: selected._count.tailoredResumes },
          ].map(({ label, value }) => (
            <ScoutBox key={label} padding="14px 18px">
              <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 6, marginTop: 0 }}>{label}</p>
              <p style={{ ...displayTitleStyle(24), margin: 0 }}>{value}</p>
            </ScoutBox>
          ))}
        </div>

        {selected.profile && (selected.profile.targetRoles.length > 0 || selected.profile.targetSalary) && (
          <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 10 }}>Targets</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {selected.profile.targetRoles.length > 0 && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", marginBottom: 4 }}>Roles</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.profile.targetRoles.map((r) => (
                      <span key={r} style={{ fontSize: 13, background: "rgba(26,58,47,0.06)", color: "#1a3a2f", padding: "2px 8px", borderRadius: 0 }}>{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.profile.targetSalary && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", marginBottom: 4 }}>Target Salary</p>
                  <p style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 500 }}>${selected.profile.targetSalary.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 0, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0ece6" }}>
            <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono }}>Job Pipeline ({selected.jobs.length})</p>
          </div>
          {selected.jobs.length === 0 ? (
            <p style={{ padding: "24px 20px", color: "var(--scout-muted)", fontSize: 14 }}>No jobs tracked yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0ece6" }}>
                  {["Company", "Role", "Stage", "Added"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 20px", textAlign: i === 3 ? "right" : "left", fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.jobs.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid #faf8f5" }}>
                    <td style={{ padding: "9px 20px", fontWeight: 500, color: "#1a1a1a" }}>{j.company}</td>
                    <td style={{ padding: "9px 20px", color: "#52493f" }}>{j.role}</td>
                    <td style={{ padding: "9px 20px" }}><StageBadge stage={j.stage} /></td>
                    <td style={{ padding: "9px 20px", textAlign: "right", fontSize: 13, color: "var(--scout-muted)", fontFamily: fontMono }}>{formatDate(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </WorkspacePageShell>
    );
  }

  return (
    <WorkspacePageShell label="Coach portal" title={tab === "clients" ? "Clients" : "My Profile"}>
      {showSubmittedBanner && (
        <div style={{ background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.25)", padding: "12px 16px", marginBottom: 20 }}>
          <p style={{ margin: 0, fontSize: 14, color: "#047857", fontFamily: fontSans }}>
            Profile submitted for review. We&apos;ll notify you when your coach listing is approved.
          </p>
        </div>
      )}
      {tabs}

      {tab === "profile" ? (
        <MyProfileTab />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            {[
              { label: "Total Clients", value: clients.length },
              { label: "Active Subscriptions", value: clients.filter((c) => c.subscription?.status === "ACTIVE").length },
              { label: "With Jobs", value: clients.filter((c) => c._count.jobs > 0).length },
              { label: "In Interviews", value: clients.filter((c) => c.jobs.some((j) => j.stage === "INTERVIEWING")).length },
            ].map(({ label, value }) => (
              <ScoutBox key={label} padding="14px 18px">
                <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 6, marginTop: 0 }}>{label}</p>
                <p style={{ ...displayTitleStyle(24), margin: 0 }}>{value}</p>
              </ScoutBox>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <input type="text" placeholder="Search clients…" value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ width: "100%", fontSize: 14, background: surface.card, border: border.line, borderRadius: 0, padding: "9px 14px", outline: "none", fontFamily: fontSans, boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((client) => {
              const activeJobs = client.jobs.filter((j) => activeStage(j.stage));
              const inInterview = client.jobs.some((j) => j.stage === "INTERVIEWING");
              const hasOffer = client.jobs.some((j) => j.stage === "OFFER");
              return (
                <button key={client.id} onClick={() => setSelected(client)}
                  style={{ background: "#fff", borderRadius: 0, border: `1px solid ${hasOffer ? "rgba(5,150,105,0.3)" : inInterview ? "rgba(124,58,237,0.2)" : "rgba(26,58,47,0.08)"}`, padding: "16px 20px", cursor: "pointer", textAlign: "left", transition: "box-shadow 0.15s", width: "100%" }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 14 }}>{client.name ?? client.email.split("@")[0]}</p>
                        {hasOffer && <span style={{ fontSize: 12, background: "rgba(5,150,105,0.1)", color: "#059669", padding: "1px 7px", borderRadius: 0, fontFamily: fontMono }}>offer</span>}
                        {inInterview && !hasOffer && <span style={{ fontSize: 12, background: "rgba(124,58,237,0.1)", color: "#7c3aed", padding: "1px 7px", borderRadius: 0, fontFamily: fontMono }}>interviewing</span>}
                      </div>
                      <p style={{ fontSize: 13, color: "var(--scout-muted)", fontFamily: fontMono }}>{client.email}</p>
                      {client.profile?.headline && <p style={{ fontSize: 13, color: "#52493f", marginTop: 4 }}>{client.profile.headline}</p>}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 20, fontWeight: 600, color: color.ink, fontFamily: fontSans, margin: 0 }}>{client._count.jobs}</p>
                        <p style={{ fontSize: 12, color: "var(--scout-muted)" }}>jobs</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 20, fontWeight: 600, color: color.ink, fontFamily: fontSans, margin: 0 }}>{activeJobs.length}</p>
                        <p style={{ fontSize: 12, color: "var(--scout-muted)" }}>active</p>
                      </div>
                    </div>
                  </div>
                  {client.jobs.length > 0 && (
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      {client.jobs.slice(0, 4).map((j) => (
                        <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#faf8f5", borderRadius: 0, padding: "3px 8px" }}>
                          <span style={{ fontSize: 13, color: "#3d3530" }}>{j.company}</span>
                          <StageBadge stage={j.stage} />
                        </div>
                      ))}
                      {client.jobs.length > 4 && <span style={{ fontSize: 13, color: "var(--scout-muted)", padding: "3px 4px" }}>+{client.jobs.length - 4} more</span>}
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && <p style={{ color: "var(--scout-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No clients found.</p>}
          </div>
        </>
      )}
    </WorkspacePageShell>
  );
}
