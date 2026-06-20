"use client";

import { useEffect, useState } from "react";

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

function StageBadge({ stage }: { stage: JobStage }) {
  const { bg, color } = STAGE_COLORS[stage] ?? STAGE_COLORS.SAVED;
  return (
    <span style={{ fontSize: 10, fontFamily: "var(--font-dm-mono)", padding: "2px 7px", borderRadius: 4, background: bg, color }}>
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

export function WorkspaceCoach() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [search, setSearch] = useState("");

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

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#a09890", fontSize: 13 }}>Loading clients…</p>
    </div>
  );
  if (error) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#a09890", fontSize: 13 }}>Failed to load clients.</p>
    </div>
  );

  /* ── Client detail panel ── */
  if (selected) {
    const activeJobs = selected.jobs.filter((j) => activeStage(j.stage));
    const appliedJobs = selected.jobs.filter((j) => j.stage === "APPLIED" || j.stage === "SCREENING" || j.stage === "INTERVIEWING");
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", background: "#F2EDE3" }}>
        <button
          onClick={() => setSelected(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "#a09890", fontSize: 12, fontFamily: "var(--font-dm-sans)", marginBottom: 24, padding: 0 }}
        >
          ← All Clients
        </button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>
              {selected.name ?? selected.email.split("@")[0]}
            </h1>
            <p style={{ fontSize: 12, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{selected.email}</p>
            {selected.profile?.headline && (
              <p style={{ fontSize: 13, color: "#52493f", marginTop: 6 }}>{selected.profile.headline}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selected.profile?.linkedinUrl && (
              <a href={selected.profile.linkedinUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(26,58,47,0.15)", color: "#1a3a2f", textDecoration: "none", background: "#fff" }}>
                LinkedIn ↗
              </a>
            )}
            {selected.profile?.resumeUrl && (
              <a href={selected.profile.resumeUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, fontFamily: "var(--font-dm-mono)", padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(26,58,47,0.15)", color: "#1a3a2f", textDecoration: "none", background: "#fff" }}>
                Resume ↗
              </a>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total Jobs", value: selected._count.jobs },
            { label: "Active Pipeline", value: activeJobs.length },
            { label: "Applied / In Process", value: appliedJobs.length },
            { label: "Tailored Resumes", value: selected._count.tailoredResumes },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "14px 18px" }}>
              <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>{label}</p>
              <p style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)", lineHeight: 1 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Target info */}
        {selected.profile && (selected.profile.targetRoles.length > 0 || selected.profile.targetSalary) && (
          <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 10 }}>Targets</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {selected.profile.targetRoles.length > 0 && (
                <div>
                  <p style={{ fontSize: 11, color: "#a09890", marginBottom: 4 }}>Roles</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.profile.targetRoles.map((r) => (
                      <span key={r} style={{ fontSize: 11, background: "rgba(26,58,47,0.06)", color: "#1a3a2f", padding: "2px 8px", borderRadius: 4 }}>{r}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.profile.targetSalary && (
                <div>
                  <p style={{ fontSize: 11, color: "#a09890", marginBottom: 4 }}>Target Salary</p>
                  <p style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 500 }}>${selected.profile.targetSalary.toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Jobs table */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0ece6" }}>
            <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)" }}>Job Pipeline ({selected.jobs.length})</p>
          </div>
          {selected.jobs.length === 0 ? (
            <p style={{ padding: "24px 20px", color: "#a09890", fontSize: 13 }}>No jobs tracked yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0ece6" }}>
                  {["Company", "Role", "Stage", "Added"].map((h, i) => (
                    <th key={h} style={{ padding: "9px 20px", textAlign: i === 3 ? "right" : "left", fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.jobs.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid #faf8f5" }}>
                    <td style={{ padding: "9px 20px", fontWeight: 500, color: "#1a1a1a" }}>{j.company}</td>
                    <td style={{ padding: "9px 20px", color: "#52493f" }}>{j.role}</td>
                    <td style={{ padding: "9px 20px" }}><StageBadge stage={j.stage} /></td>
                    <td style={{ padding: "9px 20px", textAlign: "right", fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{formatDate(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  /* ── Client list ── */
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", background: "#F2EDE3" }}>
      <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: 22, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Clients</h1>
      <p style={{ fontSize: 12, color: "#a09890", marginBottom: 24 }}>{clients.length} total clients</p>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total Clients", value: clients.length },
          { label: "Active Subscriptions", value: clients.filter((c) => c.subscription?.status === "ACTIVE").length },
          { label: "With Jobs", value: clients.filter((c) => c._count.jobs > 0).length },
          { label: "In Interviews", value: clients.filter((c) => c.jobs.some((j) => j.stage === "INTERVIEWING")).length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: "#fff", borderRadius: 10, border: "1px solid rgba(26,58,47,0.08)", padding: "14px 18px" }}>
            <p style={{ fontSize: 10, color: "#a09890", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: "var(--font-dm-mono)", marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)", lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: "100%", fontSize: 13, background: "#fff", border: "1px solid rgba(26,58,47,0.12)", borderRadius: 8, padding: "9px 14px", outline: "none", fontFamily: "var(--font-dm-sans)", boxSizing: "border-box" }}
        />
      </div>

      {/* Client cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((client) => {
          const activeJobs = client.jobs.filter((j) => activeStage(j.stage));
          const inInterview = client.jobs.some((j) => j.stage === "INTERVIEWING");
          const hasOffer = client.jobs.some((j) => j.stage === "OFFER");
          return (
            <button
              key={client.id}
              onClick={() => setSelected(client)}
              style={{ background: "#fff", borderRadius: 10, border: `1px solid ${hasOffer ? "rgba(5,150,105,0.3)" : inInterview ? "rgba(124,58,237,0.2)" : "rgba(26,58,47,0.08)"}`, padding: "16px 20px", cursor: "pointer", textAlign: "left", transition: "box-shadow 0.15s", width: "100%" }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 14 }}>{client.name ?? client.email.split("@")[0]}</p>
                    {hasOffer && <span style={{ fontSize: 10, background: "rgba(5,150,105,0.1)", color: "#059669", padding: "1px 7px", borderRadius: 4, fontFamily: "var(--font-dm-mono)" }}>offer</span>}
                    {inInterview && !hasOffer && <span style={{ fontSize: 10, background: "rgba(124,58,237,0.1)", color: "#7c3aed", padding: "1px 7px", borderRadius: 4, fontFamily: "var(--font-dm-mono)" }}>interviewing</span>}
                  </div>
                  <p style={{ fontSize: 11, color: "#a09890", fontFamily: "var(--font-dm-mono)" }}>{client.email}</p>
                  {client.profile?.headline && <p style={{ fontSize: 12, color: "#52493f", marginTop: 4 }}>{client.profile.headline}</p>}
                </div>
                <div style={{ display: "flex", gap: 16, flexShrink: 0, marginLeft: 16 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)" }}>{client._count.jobs}</p>
                    <p style={{ fontSize: 10, color: "#a09890" }}>jobs</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 18, fontWeight: 600, color: "#1a1a1a", fontFamily: "var(--font-playfair)" }}>{activeJobs.length}</p>
                    <p style={{ fontSize: 10, color: "#a09890" }}>active</p>
                  </div>
                </div>
              </div>

              {/* Recent jobs preview */}
              {client.jobs.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {client.jobs.slice(0, 4).map((j) => (
                    <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#faf8f5", borderRadius: 5, padding: "3px 8px" }}>
                      <span style={{ fontSize: 11, color: "#3d3530" }}>{j.company}</span>
                      <StageBadge stage={j.stage} />
                    </div>
                  ))}
                  {client.jobs.length > 4 && (
                    <span style={{ fontSize: 11, color: "#a09890", padding: "3px 4px" }}>+{client.jobs.length - 4} more</span>
                  )}
                </div>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p style={{ color: "#a09890", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No clients found.</p>
        )}
      </div>
    </div>
  );
}
