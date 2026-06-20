"use client";

import { useEffect, useState } from "react";

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
  users: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
    jobCount: number;
    subscriptionStatus: string | null;
  }[];
};

const STAGE_LABELS: Record<string, string> = {
  SAVED: "Saved", APPLYING: "Applying", APPLIED: "Applied",
  SCREENING: "Screening", INTERVIEWING: "Interviewing",
  OFFER: "Offer", REJECTED: "Rejected", WITHDRAWN: "Withdrawn",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "color:#2d7a50;background:rgba(45,122,80,0.1);border:1px solid rgba(45,122,80,0.2)",
  TRIALING: "color:#2563eb;background:rgba(37,99,235,0.08);border:1px solid rgba(37,99,235,0.15)",
  PAST_DUE: "color:#b45309;background:rgba(180,83,9,0.08);border:1px solid rgba(180,83,9,0.15)",
  CANCELED: "color:#78716c;background:rgba(120,113,108,0.08);border:1px solid rgba(120,113,108,0.15)",
  free: "color:#a8a29e;background:transparent;border:1px solid rgba(168,162,158,0.2)",
};

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px" }}>
      <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)", lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: 10, color: "#a09890", marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 12, marginTop: 28 }}>
      {children}
    </p>
  );
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function WorkspaceAdmin() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"date" | "jobs">("date");

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
    .sort((a, b) => sort === "jobs" ? b.jobCount - a.jobCount : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

      <SectionLabel>All Users</SectionLabel>
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
              {["User", "Joined", "Subscription", "Jobs"].map((h, i) => (
                <th key={h} style={{ padding: "10px 20px", textAlign: i === 3 ? "right" : "left", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", fontWeight: 400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#a09890", fontSize: 12 }}>No users found</td></tr>
            )}
            {filtered.map((u) => {
              const statusKey = u.subscriptionStatus ?? "free";
              const styleStr = STATUS_STYLES[statusKey] ?? STATUS_STYLES.free;
              return (
                <tr key={u.id} style={{ borderBottom: "1px solid #faf8f5" }}>
                  <td style={{ padding: "10px 20px" }}>
                    <div style={{ fontWeight: 500, color: "#1a1a1a" }}>{u.name ?? "—"}</div>
                    <div style={{ fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{u.email}</div>
                  </td>
                  <td style={{ padding: "10px 20px", fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{formatDate(u.createdAt)}</td>
                  <td style={{ padding: "10px 20px" }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-dm-mono)", padding: "2px 7px", borderRadius: 4, ...Object.fromEntries(styleStr.split(";").filter(Boolean).map(s => { const [k, v] = s.split(":"); return [k.trim().replace(/-([a-z])/g, (_,c) => c.toUpperCase()), v.trim()]; })) }}>
                      {statusKey.toLowerCase()}
                    </span>
                  </td>
                  <td style={{ padding: "10px 20px", textAlign: "right", fontFamily: "var(--font-dm-mono)", color: "#3d3530" }}>{u.jobCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
