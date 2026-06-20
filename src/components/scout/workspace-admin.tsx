"use client";

import { useEffect, useState } from "react";

type UserRole = "USER" | "COACH" | "RECRUITER" | "ADMIN";

type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
  jobCount: number;
  subscriptionStatus: string | null;
};

type Funnel = {
  signedUp: number;
  profileCreated: number;
  resumeUploaded: number;
  firstJobAdded: number;
  coverLetterGenerated: number;
  fitAnalysisRun: number;
  linkedinAdded: number;
};

type AdminData = {
  totalUsers: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalJobs: number;
  usersWithJobs: number;
  usersWithResume: number;
  usersWithCoverLetter: number;
  usersWithFitAnalysis: number;
  subCounts: { active: number; trialing: number; pastDue: number; canceled: number };
  stageCounts: Record<string, number>;
  funnel: Funnel;
  users: AdminUser[];
};

type AiFeatureBreakdown = { feature: string; calls: number; costUsd: number };

type RevenueData = {
  mrr: number;
  revenueThisMonth: number;
  activeSubscribers: number;
  trialingSubscribers: number;
  churnedThisMonth: number;
  ai: {
    costThisMonth: number;
    callsThisMonth: number;
    costTotal: number;
    callsTotal: number;
    byFeature: AiFeatureBreakdown[];
  };
};

type UserDetail = AdminUser & {
  profile: {
    resumeUrl: string | null;
    linkedinUrl: string | null;
    headline: string | null;
    targetRoles: string[];
    targetSalary: number | null;
    createdAt: string;
  } | null;
  jobs: {
    id: string;
    company: string;
    role: string;
    stage: string;
    coverLetter: string | null;
    fitAnalysis: string | null;
    appliedAt: string | null;
    createdAt: string;
  }[];
  subscription: { status: string; stripeCurrentPeriodEnd: string } | null;
  tailoredResumes: { id: string }[];
  aiSummary: {
    totalCalls: number;
    totalCostUsd: number;
    byFeature: AiFeatureBreakdown[];
  };
};

const STAGE_LABELS: Record<string, string> = {
  SAVED: "Saved", APPLYING: "Applying", APPLIED: "Applied",
  SCREENING: "Screening", INTERVIEWING: "Interviewing",
  OFFER: "Offer", REJECTED: "Rejected", WITHDRAWN: "Withdrawn",
};

const FEATURE_LABELS: Record<string, string> = {
  COVER_LETTER: "Cover Letter", FIT_ANALYSIS: "Fit Analysis",
  RESUME_BULLETS: "Resume Bullets", RESUME_PARSE: "Resume Parse",
  JOB_PARSE: "Job Parse", CHAT: "Chat (Scout)", RESUME_TAILOR: "Tailored Resume",
};

const STATUS_STYLES: Record<string, { color: string; background: string; border: string }> = {
  ACTIVE:   { color: "#2d7a50", background: "rgba(45,122,80,0.1)",   border: "1px solid rgba(45,122,80,0.2)" },
  TRIALING: { color: "#2563eb", background: "rgba(37,99,235,0.08)",  border: "1px solid rgba(37,99,235,0.15)" },
  PAST_DUE: { color: "#b45309", background: "rgba(180,83,9,0.08)",   border: "1px solid rgba(180,83,9,0.15)" },
  CANCELED: { color: "#78716c", background: "rgba(120,113,108,0.08)",border: "1px solid rgba(120,113,108,0.15)" },
  free:     { color: "#a8a29e", background: "transparent",            border: "1px solid rgba(168,162,158,0.2)" },
};

const ROLE_STYLES: Record<UserRole, { color: string; background: string; border: string }> = {
  ADMIN:     { color: "#7c3aed", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" },
  COACH:     { color: "#0369a1", background: "rgba(3,105,161,0.08)",  border: "1px solid rgba(3,105,161,0.2)" },
  RECRUITER: { color: "#0f766e", background: "rgba(15,118,110,0.08)", border: "1px solid rgba(15,118,110,0.2)" },
  USER:      { color: "#a8a29e", background: "transparent",           border: "1px solid rgba(168,162,158,0.2)" },
};

const ROLES: UserRole[] = ["USER", "COACH", "RECRUITER", "ADMIN"];

function StatCard({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px" }}>
      <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color: accent ?? "#1a1a1a", fontFamily: "var(--font-playfair)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: "#a09890", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 28 }}>
      <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", margin: 0 }}>{children}</p>
      {action}
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const s = ROLE_STYLES[role];
  return (
    <span style={{ fontSize: 10, fontFamily: "var(--font-dm-mono)", padding: "2px 7px", borderRadius: 4, ...s }}>
      {role.toLowerCase()}
    </span>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmt$(n: number) {
  return n < 0.01 ? "<$0.01" : `$${n.toFixed(n < 1 ? 4 : 2)}`;
}

/* ── User Detail Panel ── */
function UserDetailPanel({ userId, onClose, onEdit }: { userId: string; onClose: () => void; onEdit: () => void }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then(setDetail)
      .finally(() => setLoading(false));
  }, [userId]);

  const stageCounts = detail?.jobs.reduce<Record<string, number>>((acc, j) => {
    acc[j.stage] = (acc[j.stage] ?? 0) + 1;
    return acc;
  }, {}) ?? {};

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />
      <div style={{
        position: "relative", width: 420, height: "100%", background: "#fff",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", overflowY: "auto",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0ece6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: "var(--font-playfair)", fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>User Detail</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onEdit} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #e8e2da", background: "transparent", cursor: "pointer", color: "#3d3530", fontFamily: "var(--font-dm-sans)" }}>Edit</button>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a09890", fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#a09890", fontSize: 13 }}>Loading…</p>
          </div>
        ) : !detail ? (
          <div style={{ padding: 24 }}><p style={{ color: "#a09890", fontSize: 13 }}>Failed to load.</p></div>
        ) : (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Identity */}
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", marginBottom: 2 }}>{detail.name ?? "—"}</p>
              <p style={{ fontSize: 12, color: "#a09890", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>{detail.email}</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <RoleBadge role={detail.role} />
                {detail.subscription && (
                  <span style={{ fontSize: 10, fontFamily: "var(--font-dm-mono)", padding: "2px 7px", borderRadius: 4, ...STATUS_STYLES[detail.subscription.status] }}>
                    {detail.subscription.status.toLowerCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Joined", value: formatDate(detail.createdAt) },
                { label: "Total Jobs", value: detail.jobs.length },
                { label: "Resume", value: detail.profile?.resumeUrl ? "Uploaded" : "None" },
                { label: "Tailored Resumes", value: detail.tailoredResumes.length },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "#faf8f5", borderRadius: 8, padding: "10px 12px" }}>
                  <p style={{ fontSize: 9, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.6px", fontFamily: "var(--font-dm-mono)", marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#1a1a1a" }}>{value}</p>
                </div>
              ))}
            </div>

            {/* Profile */}
            {detail.profile && (
              <div>
                <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 8 }}>Profile</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {detail.profile.headline && <p style={{ fontSize: 12, color: "#3d3530" }}>{detail.profile.headline}</p>}
                  {detail.profile.linkedinUrl && <p style={{ fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>LinkedIn ✓</p>}
                  {detail.profile.targetRoles?.length > 0 && (
                    <p style={{ fontSize: 11, color: "#a09890" }}>Targeting: {detail.profile.targetRoles.join(", ")}</p>
                  )}
                  {detail.profile.targetSalary && (
                    <p style={{ fontSize: 11, color: "#a09890" }}>Target salary: ${detail.profile.targetSalary.toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}

            {/* Jobs by stage */}
            {detail.jobs.length > 0 && (
              <div>
                <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 8 }}>Pipeline ({detail.jobs.length} jobs)</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {Object.entries(stageCounts).map(([stage, count]) => (
                    <span key={stage} style={{ fontSize: 10, fontFamily: "var(--font-dm-mono)", padding: "2px 7px", borderRadius: 4, background: "#f0ece6", color: "#3d3530" }}>
                      {STAGE_LABELS[stage] ?? stage} · {count}
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {detail.jobs.slice(0, 8).map((j) => (
                    <div key={j.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #faf8f5" }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 500, color: "#1a1a1a" }}>{j.role}</span>
                        <span style={{ fontSize: 11, color: "#a09890" }}> · {j.company}</span>
                      </div>
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {j.coverLetter && <span style={{ fontSize: 9, color: "#2d7a50", fontFamily: "var(--font-dm-mono)" }}>CL</span>}
                        {j.fitAnalysis && <span style={{ fontSize: 9, color: "#2563eb", fontFamily: "var(--font-dm-mono)" }}>FIT</span>}
                        <span style={{ fontSize: 10, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{STAGE_LABELS[j.stage] ?? j.stage}</span>
                      </div>
                    </div>
                  ))}
                  {detail.jobs.length > 8 && (
                    <p style={{ fontSize: 11, color: "#a09890", marginTop: 4 }}>+{detail.jobs.length - 8} more jobs</p>
                  )}
                </div>
              </div>
            )}

            {/* AI usage */}
            {detail.aiSummary.totalCalls > 0 ? (
              <div>
                <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 8 }}>AI Usage</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div style={{ background: "#faf8f5", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ fontSize: 9, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.6px", fontFamily: "var(--font-dm-mono)", marginBottom: 3 }}>Total Calls</p>
                    <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)" }}>{detail.aiSummary.totalCalls}</p>
                  </div>
                  <div style={{ background: "#faf8f5", borderRadius: 8, padding: "10px 12px" }}>
                    <p style={{ fontSize: 9, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.6px", fontFamily: "var(--font-dm-mono)", marginBottom: 3 }}>AI Cost</p>
                    <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)" }}>{fmt$(detail.aiSummary.totalCostUsd)}</p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {detail.aiSummary.byFeature.map((f) => (
                    <div key={f.feature} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11 }}>
                      <span style={{ color: "#3d3530" }}>{FEATURE_LABELS[f.feature] ?? f.feature}</span>
                      <span style={{ color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{f.calls}x · {fmt$(f.costUsd)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 4 }}>AI Usage</p>
                <p style={{ fontSize: 12, color: "#a09890" }}>No AI calls yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Edit Panel ── */
function EditPanel({ user, onClose, onSaved }: { user: AdminUser; onClose: () => void; onSaved: (updated: AdminUser) => void }) {
  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true); setErr("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, role }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      onSaved({ ...user, name: name.trim() || null, role });
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setSaving(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, background: "#faf8f5", border: "1px solid #e8e2da",
    borderRadius: 7, padding: "8px 10px", outline: "none", fontFamily: "var(--font-dm-sans)",
    color: "#1a1a1a", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />
      <div style={{ position: "relative", width: 340, height: "100%", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20, overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: "var(--font-playfair)", fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>Edit User</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a09890", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div>
          <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 4 }}>Email</p>
          <p style={{ fontSize: 13, color: "#3d3530", fontFamily: "var(--font-dm-mono)" }}>{user.email}</p>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ ...inputStyle, cursor: "pointer" }}>
            {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
          </select>
        </div>
        {err && <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
          <button onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #e8e2da", background: "transparent", cursor: "pointer", fontSize: 13, color: "#3d3530", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: saving ? "#d4c9b8" : "#1a3a2f", cursor: saving ? "default" : "pointer", fontSize: 13, color: "#fff", fontFamily: "var(--font-dm-sans)" }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── Invite Modal ── */
function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (u: AdminUser) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<UserRole>("USER");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function send() {
    if (!email.trim()) { setErr("Email required"); return; }
    setSending(true); setErr("");
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), name: name.trim() || null, role }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setDone(true); onInvited(d);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Error"); }
    finally { setSending(false); }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, background: "#faf8f5", border: "1px solid #e8e2da",
    borderRadius: 7, padding: "8px 10px", outline: "none", fontFamily: "var(--font-dm-sans)", color: "#1a1a1a", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
      <div style={{ position: "relative", width: 380, background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,0.12)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontFamily: "var(--font-playfair)", fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>Invite User</p>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#a09890", fontSize: 18 }}>×</button>
        </div>
        {done ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ fontSize: 22, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 14, color: "#2d7a50", fontWeight: 500 }}>Invite sent to {email}</p>
            <button onClick={onClose} style={{ marginTop: 16, padding: "8px 20px", borderRadius: 8, border: "none", background: "#1a3a2f", color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "var(--font-dm-sans)" }}>Done</button>
          </div>
        ) : (
          <>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>Email *</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="user@example.com" type="email" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} style={{ ...inputStyle, cursor: "pointer" }}>
                {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            {err && <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>{err}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #e8e2da", background: "transparent", cursor: "pointer", fontSize: 13, color: "#3d3530", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
              <button onClick={send} disabled={sending} style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: sending ? "#d4c9b8" : "#1a3a2f", cursor: sending ? "default" : "pointer", fontSize: 13, color: "#fff", fontFamily: "var(--font-dm-sans)" }}>{sending ? "Sending…" : "Send Invite"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Funnel Bar ── */
function FunnelRow({ label, value, total, color = "#1a3a2f" }: { label: string; value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0" }}>
      <div style={{ width: 160, fontSize: 12, color: "#3d3530", flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: "#f0ece6", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ width: 60, textAlign: "right", fontSize: 11, fontFamily: "var(--font-dm-mono)", color: "#a09890" }}>{value} ({pct}%)</div>
    </div>
  );
}

/* ── Main ── */
export function WorkspaceAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenueError, setRevenueError] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "jobs">("date");
  const [viewUserId, setViewUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin").then((r) => r.json()).then(setData).catch(() => setError(true));
    fetch("/api/admin/revenue").then((r) => r.json()).then((d) => {
      if (d.error) setRevenueError(true);
      else setRevenue(d);
    }).catch(() => setRevenueError(true));
  }, []);

  if (error) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#a09890", fontSize: 13 }}>Failed to load admin data.</p>
    </div>
  );
  if (!data) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#a09890", fontSize: 13 }}>Loading…</p>
    </div>
  );

  const filtered = data.users
    .filter((u) => {
      const q = search.toLowerCase();
      return u.email.toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q);
    })
    .sort((a, b) => sort === "jobs"
      ? b.jobCount - a.jobCount
      : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function handleUserSaved(updated: AdminUser) {
    setData((d) => d ? { ...d, users: d.users.map((u) => u.id === updated.id ? updated : u) } : d);
    setEditUser(null);
  }

  function handleUserInvited(newUser: AdminUser) {
    setData((d) => d ? { ...d, users: [newUser, ...d.users], totalUsers: d.totalUsers + 1 } : d);
  }

  const viewUser = viewUserId ? data.users.find((u) => u.id === viewUserId) ?? null : null;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", background: "#F2EDE3" }}>
      <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Admin</h1>
      <p style={{ fontSize: 12, color: "#a09890", marginBottom: 0 }}>Live data — super admin only</p>

      {/* Revenue */}
      <SectionLabel>Revenue</SectionLabel>
      {revenueError ? (
        <p style={{ fontSize: 12, color: "#a09890" }}>Stripe not connected or missing key.</p>
      ) : !revenue ? (
        <p style={{ fontSize: 12, color: "#a09890" }}>Loading revenue…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <StatCard label="MRR" value={`$${revenue.mrr.toLocaleString()}`} accent="#2d7a50" />
          <StatCard label="Revenue This Month" value={`$${revenue.revenueThisMonth.toLocaleString()}`} />
          <StatCard label="Active Subscribers" value={revenue.activeSubscribers} />
          <StatCard label="Trialing" value={revenue.trialingSubscribers} />
          <StatCard label="Churned (30d)" value={revenue.churnedThisMonth} accent={revenue.churnedThisMonth > 0 ? "#b45309" : undefined} />
        </div>
      )}

      {/* AI Costs */}
      {revenue && (
        <>
          <SectionLabel>AI Costs</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <StatCard label="Cost This Month" value={fmt$(revenue.ai.costThisMonth)} accent={revenue.ai.costThisMonth > 10 ? "#b45309" : undefined} />
            <StatCard label="Calls This Month" value={revenue.ai.callsThisMonth} />
            <StatCard label="Total AI Cost" value={fmt$(revenue.ai.costTotal)} />
            <StatCard label="Total Calls" value={revenue.ai.callsTotal} />
          </div>
          {revenue.ai.byFeature.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f0ece6" }}>
                    {["Feature", "Calls", "Cost"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 20px", textAlign: i > 0 ? "right" : "left", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...revenue.ai.byFeature].sort((a, b) => b.costUsd - a.costUsd).map((f) => (
                    <tr key={f.feature} style={{ borderBottom: "1px solid #faf8f5" }}>
                      <td style={{ padding: "9px 20px", color: "#3d3530" }}>{FEATURE_LABELS[f.feature] ?? f.feature}</td>
                      <td style={{ padding: "9px 20px", textAlign: "right", fontFamily: "var(--font-dm-mono)", color: "#a09890" }}>{f.calls}</td>
                      <td style={{ padding: "9px 20px", textAlign: "right", fontFamily: "var(--font-dm-mono)", color: "#3d3530" }}>{fmt$(f.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Users */}
      <SectionLabel>Users</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Users" value={data.totalUsers} />
        <StatCard label="New This Week" value={data.newUsersThisWeek} />
        <StatCard label="New This Month" value={data.newUsersThisMonth} />
        <StatCard label="With Jobs" value={data.usersWithJobs} sub={`${Math.round((data.usersWithJobs / Math.max(data.totalUsers, 1)) * 100)}% of users`} />
      </div>

      {/* Onboarding Funnel */}
      <SectionLabel>Onboarding Funnel</SectionLabel>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px" }}>
        {[
          { label: "Signed up", value: data.funnel.signedUp },
          { label: "Profile created", value: data.funnel.profileCreated },
          { label: "Resume uploaded", value: data.funnel.resumeUploaded },
          { label: "First job added", value: data.funnel.firstJobAdded },
          { label: "Cover letter generated", value: data.funnel.coverLetterGenerated },
          { label: "Fit analysis run", value: data.funnel.fitAnalysisRun },
          { label: "LinkedIn added", value: data.funnel.linkedinAdded },
        ].map(({ label, value }) => (
          <FunnelRow key={label} label={label} value={value} total={data.funnel.signedUp} />
        ))}
      </div>

      {/* Subscriptions */}
      <SectionLabel>Subscriptions</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Active" value={data.subCounts.active} />
        <StatCard label="Trialing" value={data.subCounts.trialing} />
        <StatCard label="Past Due" value={data.subCounts.pastDue} />
        <StatCard label="Canceled" value={data.subCounts.canceled} />
      </div>

      {/* Usage */}
      <SectionLabel>Usage</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Jobs" value={data.totalJobs} />
        <StatCard label="Resumes Uploaded" value={data.usersWithResume} />
        <StatCard label="Cover Letters" value={data.usersWithCoverLetter} />
        <StatCard label="Fit Analyses" value={data.usersWithFitAnalysis} />
      </div>

      {/* Jobs by Stage */}
      <SectionLabel>Jobs by Stage</SectionLabel>
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f0ece6" }}>
              {["Stage", "Count", "% of Total"].map((h, i) => (
                <th key={h} style={{ padding: "10px 20px", textAlign: i === 0 ? "left" : "right", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(STAGE_LABELS).map(([key, label]) => {
              const count = data.stageCounts[key] ?? 0;
              const pct = data.totalJobs > 0 ? Math.round((count / data.totalJobs) * 100) : 0;
              return (
                <tr key={key} style={{ borderBottom: "1px solid #faf8f5" }}>
                  <td style={{ padding: "9px 20px", color: "#3d3530" }}>{label}</td>
                  <td style={{ padding: "9px 20px", textAlign: "right", fontFamily: "var(--font-dm-mono)", color: "#3d3530" }}>{count}</td>
                  <td style={{ padding: "9px 20px", textAlign: "right", fontFamily: "var(--font-dm-mono)", color: "#a09890" }}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* All Users */}
      <SectionLabel action={
        <button onClick={() => setInviteOpen(true)} style={{ fontSize: 11, fontFamily: "var(--font-dm-sans)", padding: "5px 12px", borderRadius: 7, border: "none", background: "#1a3a2f", color: "#E8D5A3", cursor: "pointer" }}>+ Invite User</button>
      }>All Users</SectionLabel>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f0ece6" }}>
          <input type="text" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, fontSize: 12, background: "#faf8f5", border: "1px solid #e8e2da", borderRadius: 7, padding: "6px 10px", outline: "none", fontFamily: "var(--font-dm-sans)" }} />
          <div style={{ display: "flex", gap: 4, fontSize: 10, fontFamily: "var(--font-dm-mono)", color: "#a09890" }}>
            {(["date", "jobs"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)} style={{ padding: "4px 8px", borderRadius: 5, border: "none", cursor: "pointer", background: sort === s ? "#f0ece6" : "transparent", color: sort === s ? "#3d3530" : "#a09890" }}>{s === "date" ? "newest" : "most jobs"}</button>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{filtered.length} users</span>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f0ece6" }}>
              {["User", "Role", "Joined", "Subscription", "Jobs", ""].map((h, i) => (
                <th key={i} style={{ padding: "10px 20px", textAlign: i >= 4 ? "right" : "left", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#a09890", fontSize: 12 }}>No users found</td></tr>
            )}
            {filtered.map((u) => {
              const statusKey = u.subscriptionStatus ?? "free";
              const subStyle = STATUS_STYLES[statusKey] ?? STATUS_STYLES.free;
              return (
                <tr key={u.id} onClick={() => setViewUserId(u.id)} style={{ borderBottom: "1px solid #faf8f5", cursor: "pointer" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#faf8f5")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "10px 20px" }}>
                    <div style={{ fontWeight: 500, color: "#1a1a1a" }}>{u.name ?? "—"}</div>
                    <div style={{ fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "10px 20px" }}><RoleBadge role={u.role ?? "USER"} /></td>
                  <td style={{ padding: "10px 20px", fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{formatDate(u.createdAt)}</td>
                  <td style={{ padding: "10px 20px" }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-dm-mono)", padding: "2px 7px", borderRadius: 4, ...subStyle }}>
                      {statusKey.toLowerCase()}
                    </span>
                  </td>
                  <td style={{ padding: "10px 20px", textAlign: "right", fontFamily: "var(--font-dm-mono)", color: "#3d3530" }}>{u.jobCount}</td>
                  <td style={{ padding: "10px 20px", textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditUser(u)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid #e8e2da", background: "transparent", cursor: "pointer", color: "#3d3530", fontFamily: "var(--font-dm-sans)" }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {viewUserId && viewUser && !editUser && (
        <UserDetailPanel
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
          onEdit={() => { setEditUser(viewUser); setViewUserId(null); }}
        />
      )}
      {editUser && <EditPanel user={editUser} onClose={() => setEditUser(null)} onSaved={handleUserSaved} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={handleUserInvited} />}
    </div>
  );
}
