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
  users: AdminUser[];
};

const STAGE_LABELS: Record<string, string> = {
  SAVED: "Saved", APPLYING: "Applying", APPLIED: "Applied",
  SCREENING: "Screening", INTERVIEWING: "Interviewing",
  OFFER: "Offer", REJECTED: "Rejected", WITHDRAWN: "Withdrawn",
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

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px" }}>
      <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: "#a09890", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children, action }: { children: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 28 }}>
      <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", margin: 0 }}>
        {children}
      </p>
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

/* ── Edit Panel ── */
function EditPanel({
  user,
  onClose,
  onSaved,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}) {
  const [name, setName] = useState(user.name ?? "");
  const [role, setRole] = useState<UserRole>(user.role);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || null, role }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed"); }
      onSaved({ ...user, name: name.trim() || null, role });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, background: "#faf8f5", border: "1px solid #e8e2da",
    borderRadius: 7, padding: "8px 10px", outline: "none", fontFamily: "var(--font-dm-sans)",
    color: "#1a1a1a", boxSizing: "border-box",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
    }}>
      {/* backdrop */}
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />

      {/* panel */}
      <div style={{
        position: "relative", width: 340, height: "100%", background: "#fff",
        boxShadow: "-4px 0 24px rgba(0,0,0,0.08)", padding: "28px 24px",
        display: "flex", flexDirection: "column", gap: 20, overflowY: "auto",
      }}>
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
          <button onClick={onClose} style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #e8e2da",
            background: "transparent", cursor: "pointer", fontSize: 13, color: "#3d3530",
            fontFamily: "var(--font-dm-sans)",
          }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{
            flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
            background: saving ? "#d4c9b8" : "#1a3a2f", cursor: saving ? "default" : "pointer",
            fontSize: 13, color: "#fff", fontFamily: "var(--font-dm-sans)",
          }}>{saving ? "Saving…" : "Save"}</button>
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
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || null, role }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Failed");
      setDone(true);
      onInvited(d);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: 13, background: "#faf8f5", border: "1px solid #e8e2da",
    borderRadius: 7, padding: "8px 10px", outline: "none", fontFamily: "var(--font-dm-sans)",
    color: "#1a1a1a", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.2)" }} />
      <div style={{
        position: "relative", width: 380, background: "#fff", borderRadius: 14,
        boxShadow: "0 8px 40px rgba(0,0,0,0.12)", padding: "28px 24px",
        display: "flex", flexDirection: "column", gap: 18,
      }}>
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
              <button onClick={onClose} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "1px solid #e8e2da",
                background: "transparent", cursor: "pointer", fontSize: 13, color: "#3d3530",
                fontFamily: "var(--font-dm-sans)",
              }}>Cancel</button>
              <button onClick={send} disabled={sending} style={{
                flex: 1, padding: "9px 0", borderRadius: 8, border: "none",
                background: sending ? "#d4c9b8" : "#1a3a2f", cursor: sending ? "default" : "pointer",
                fontSize: 13, color: "#fff", fontFamily: "var(--font-dm-sans)",
              }}>{sending ? "Sending…" : "Send Invite"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Main ── */
export function WorkspaceAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "jobs">("date");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true));
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

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", background: "#F2EDE3" }}>
      <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Admin</h1>
      <p style={{ fontSize: 12, color: "#a09890", marginBottom: 0 }}>Live data — super admin only</p>

      <SectionLabel>Users</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Users" value={data.totalUsers} />
        <StatCard label="New This Week" value={data.newUsersThisWeek} />
        <StatCard label="New This Month" value={data.newUsersThisMonth} />
        <StatCard label="With Jobs" value={data.usersWithJobs} sub={`${Math.round((data.usersWithJobs / Math.max(data.totalUsers, 1)) * 100)}% of users`} />
      </div>

      <SectionLabel>Subscriptions</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Active" value={data.subCounts.active} />
        <StatCard label="Trialing" value={data.subCounts.trialing} />
        <StatCard label="Past Due" value={data.subCounts.pastDue} />
        <StatCard label="Canceled" value={data.subCounts.canceled} />
      </div>

      <SectionLabel>Usage</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <StatCard label="Total Jobs" value={data.totalJobs} />
        <StatCard label="Resumes Uploaded" value={data.usersWithResume} />
        <StatCard label="Cover Letters" value={data.usersWithCoverLetter} />
        <StatCard label="Fit Analyses" value={data.usersWithFitAnalysis} />
      </div>

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

      <SectionLabel action={
        <button onClick={() => setInviteOpen(true)} style={{
          fontSize: 11, fontFamily: "var(--font-dm-sans)", padding: "5px 12px", borderRadius: 7,
          border: "none", background: "#1a3a2f", color: "#E8D5A3", cursor: "pointer",
        }}>+ Invite User</button>
      }>All Users</SectionLabel>

      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f0ece6" }}>
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, fontSize: 12, background: "#faf8f5", border: "1px solid #e8e2da", borderRadius: 7, padding: "6px 10px", outline: "none", fontFamily: "var(--font-dm-sans)" }}
          />
          <div style={{ display: "flex", gap: 4, fontSize: 10, fontFamily: "var(--font-dm-mono)", color: "#a09890" }}>
            {(["date", "jobs"] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)} style={{ padding: "4px 8px", borderRadius: 5, border: "none", cursor: "pointer", background: sort === s ? "#f0ece6" : "transparent", color: sort === s ? "#3d3530" : "#a09890" }}>{s === "date" ? "newest" : "most jobs"}</button>
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{filtered.length} users</span>
        </div>

        {/* Table */}
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
                <tr key={u.id} style={{ borderBottom: "1px solid #faf8f5" }}>
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
                  <td style={{ padding: "10px 20px", textAlign: "right" }}>
                    <button onClick={() => setEditUser(u)} style={{
                      fontSize: 11, padding: "3px 10px", borderRadius: 6,
                      border: "1px solid #e8e2da", background: "transparent",
                      cursor: "pointer", color: "#3d3530", fontFamily: "var(--font-dm-sans)",
                    }}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editUser && <EditPanel user={editUser} onClose={() => setEditUser(null)} onSaved={handleUserSaved} />}
      {inviteOpen && <InviteModal onClose={() => setInviteOpen(false)} onInvited={handleUserInvited} />}
    </div>
  );
}
