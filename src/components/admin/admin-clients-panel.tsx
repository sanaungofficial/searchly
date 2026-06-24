"use client";

import { useEffect, useState } from "react";
import { ScoutBox } from "@/components/scout/scout-box";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";
import { formatApiErrorMessage } from "@/lib/api-error-message";

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.8px",
  color: "var(--scout-muted)",
  fontFamily: fontMono,
  margin: "0 0 4px",
};

type JobStage = "SAVED" | "APPLYING" | "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN";

type ClientJob = {
  id: string;
  company: string;
  role: string;
  stage: JobStage;
  appliedAt: string | null;
  createdAt: string;
};

export type AdminClient = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  profile: {
    headline: string | null;
    targetRoles: string[];
    targetSalary: number | string | null;
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
  SAVED: { bg: "rgba(160,152,144,0.12)", color: "#78716c" },
  APPLYING: { bg: "rgba(37,99,235,0.08)", color: "#2563eb" },
  APPLIED: { bg: "rgba(37,99,235,0.12)", color: "#1d4ed8" },
  SCREENING: { bg: "rgba(217,119,6,0.1)", color: "#b45309" },
  INTERVIEWING: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed" },
  OFFER: { bg: "rgba(5,150,105,0.1)", color: "#059669" },
  REJECTED: { bg: "rgba(220,38,38,0.08)", color: "#dc2626" },
  WITHDRAWN: { bg: "rgba(160,152,144,0.1)", color: "#78716c" },
};

function StageBadge({ stage }: { stage: JobStage }) {
  const { bg, color: c } = STAGE_COLORS[stage] ?? STAGE_COLORS.SAVED;
  return (
    <span style={{ fontSize: 12, fontFamily: fontMono, padding: "2px 7px", borderRadius: 0, background: bg, color: c }}>
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

export function AdminClientsPanel({
  apiPath,
  onViewAsClient,
  startingUserId,
}: {
  apiPath: string;
  onViewAsClient: (userId: string) => void;
  startingUserId?: string | null;
}) {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(apiPath)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok) {
          throw new Error(formatApiErrorMessage(data?.error ?? data, "Failed to load clients."));
        }
        if (!Array.isArray(data)) {
          throw new Error("Unexpected response from clients API.");
        }
        return data as AdminClient[];
      })
      .then((data) => {
        setClients(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(formatApiErrorMessage(err, "Failed to load clients."));
        setLoading(false);
      });
  }, [apiPath]);

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  if (loading) {
    return <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading clients…</p>;
  }
  if (error) {
    return <p style={{ color: "#C4574A", fontSize: 14 }}>{error}</p>;
  }

  if (selected) {
    const activeJobs = selected.jobs.filter((j) => activeStage(j.stage));
    const appliedJobs = selected.jobs.filter((j) => ["APPLIED", "SCREENING", "INTERVIEWING"].includes(j.stage));
    const displayName = selected.name ?? selected.email.split("@")[0];

    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: color.muted,
            fontSize: T.caption,
            fontFamily: fontSans,
            marginBottom: 24,
            padding: 0,
          }}
        >
          ← All clients
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={sectionLabelStyle}>Client</p>
            <h1 style={{ ...displayTitleStyle(28), margin: "4px 0 6px" }}>{displayName}</h1>
            <p style={{ fontSize: T.caption, color: color.muted, fontFamily: fontMono, margin: 0 }}>{selected.email}</p>
            {selected.profile?.headline && (
              <p style={{ fontSize: T.bodySm, color: color.stone, margin: "8px 0 0" }}>{selected.profile.headline}</p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => onViewAsClient(selected.id)}
              disabled={startingUserId === selected.id}
              style={{
                padding: "10px 18px",
                background: color.forest,
                color: color.gold,
                border: "none",
                borderRadius: 0,
                fontSize: 14,
                fontWeight: 600,
                cursor: startingUserId === selected.id ? "default" : "pointer",
                fontFamily: fontSans,
                opacity: startingUserId === selected.id ? 0.7 : 1,
              }}
            >
              {startingUserId === selected.id ? "Opening…" : "View as client"}
            </button>
            {selected.profile?.linkedinUrl && (
              <a
                href={selected.profile.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: T.caption,
                  fontFamily: fontMono,
                  padding: "10px 14px",
                  borderRadius: 0,
                  border: border.line,
                  color: color.forest,
                  textDecoration: "none",
                  background: surface.card,
                }}
              >
                LinkedIn ↗
              </a>
            )}
            {selected.profile?.resumeUrl && (
              <a
                href={selected.profile.resumeUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: T.caption,
                  fontFamily: fontMono,
                  padding: "10px 14px",
                  borderRadius: 0,
                  border: border.line,
                  color: color.forest,
                  textDecoration: "none",
                  background: surface.card,
                }}
              >
                Resume ↗
              </a>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { label: "Total jobs", value: selected._count.jobs },
            { label: "Active pipeline", value: activeJobs.length },
            { label: "Applied / in process", value: appliedJobs.length },
            { label: "Tailored resumes", value: selected._count.tailoredResumes },
          ].map(({ label, value }) => (
            <ScoutBox key={label} padding="14px 18px">
              <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 6, marginTop: 0 }}>
                {label}
              </p>
              <p style={{ ...displayTitleStyle(24), margin: 0 }}>{value}</p>
            </ScoutBox>
          ))}
        </div>

        {selected.profile && (selected.profile.targetRoles.length > 0 || selected.profile.targetSalary) && (
          <div style={{ background: "#fff", border: border.line, padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 10 }}>
              Targets
            </p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {selected.profile.targetRoles.length > 0 && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", marginBottom: 4 }}>Roles</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.profile.targetRoles.map((r) => (
                      <span key={r} style={{ fontSize: 13, background: "rgba(26,58,47,0.06)", color: "#1a3a2f", padding: "2px 8px" }}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selected.profile.targetSalary && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", marginBottom: 4 }}>Target salary</p>
                  <p style={{ fontSize: 14, color: "#1a1a1a", fontWeight: 500 }}>
                    {typeof selected.profile.targetSalary === "number"
                      ? `$${selected.profile.targetSalary.toLocaleString()}`
                      : selected.profile.targetSalary}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div style={{ background: "#fff", border: border.line, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0ece6" }}>
            <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono }}>
              Job pipeline ({selected.jobs.length})
            </p>
          </div>
          {selected.jobs.length === 0 ? (
            <p style={{ padding: "24px 20px", color: "var(--scout-muted)", fontSize: 14 }}>No jobs tracked yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f0ece6" }}>
                  {["Company", "Role", "Stage", "Added"].map((h, i) => (
                    <th
                      key={h}
                      style={{
                        padding: "9px 20px",
                        textAlign: i === 3 ? "right" : "left",
                        fontSize: 12,
                        color: "var(--scout-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.8px",
                        fontFamily: fontMono,
                        fontWeight: 400,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.jobs.map((j) => (
                  <tr key={j.id} style={{ borderBottom: "1px solid #faf8f5" }}>
                    <td style={{ padding: "9px 20px", fontWeight: 500, color: "#1a1a1a" }}>{j.company}</td>
                    <td style={{ padding: "9px 20px", color: "#52493f" }}>{j.role}</td>
                    <td style={{ padding: "9px 20px" }}>
                      <StageBadge stage={j.stage} />
                    </td>
                    <td style={{ padding: "9px 20px", textAlign: "right", fontSize: 13, color: "var(--scout-muted)", fontFamily: fontMono }}>
                      {formatDate(j.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <p style={sectionLabelStyle}>Clients</p>
        <h1 style={{ ...displayTitleStyle(28), margin: "4px 0 8px" }}>Manage clients</h1>
        <p style={{ fontSize: 14, color: color.stone, margin: 0, maxWidth: 560 }}>
          View client accounts, check their pipeline, and open their workspace to upload resumes or review job matches.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total clients", value: clients.length },
          { label: "Active subscriptions", value: clients.filter((c) => c.subscription?.status === "ACTIVE").length },
          { label: "With jobs", value: clients.filter((c) => c._count.jobs > 0).length },
          { label: "In interviews", value: clients.filter((c) => c.jobs.some((j) => j.stage === "INTERVIEWING")).length },
        ].map(({ label, value }) => (
          <ScoutBox key={label} padding="14px 18px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 6, marginTop: 0 }}>
              {label}
            </p>
            <p style={{ ...displayTitleStyle(24), margin: 0 }}>{value}</p>
          </ScoutBox>
        ))}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            fontSize: 14,
            background: surface.card,
            border: border.line,
            borderRadius: 0,
            padding: "9px 14px",
            outline: "none",
            fontFamily: fontSans,
            boxSizing: "border-box",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((client) => {
          const activeJobs = client.jobs.filter((j) => activeStage(j.stage));
          const inInterview = client.jobs.some((j) => j.stage === "INTERVIEWING");
          const hasOffer = client.jobs.some((j) => j.stage === "OFFER");
          const displayName = client.name ?? client.email.split("@")[0];

          return (
            <div
              key={client.id}
              style={{
                background: "#fff",
                border: `1px solid ${hasOffer ? "rgba(5,150,105,0.3)" : inInterview ? "rgba(124,58,237,0.2)" : "rgba(26,58,47,0.08)"}`,
                padding: "16px 20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <button
                  onClick={() => setSelected(client)}
                  style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0, flex: 1, minWidth: 0 }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 14, margin: 0 }}>{displayName}</p>
                    {hasOffer && (
                      <span style={{ fontSize: 12, background: "rgba(5,150,105,0.1)", color: "#059669", padding: "1px 7px", fontFamily: fontMono }}>
                        offer
                      </span>
                    )}
                    {inInterview && !hasOffer && (
                      <span style={{ fontSize: 12, background: "rgba(124,58,237,0.1)", color: "#7c3aed", padding: "1px 7px", fontFamily: fontMono }}>
                        interviewing
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", fontFamily: fontMono, margin: 0 }}>{client.email}</p>
                  {client.profile?.headline && (
                    <p style={{ fontSize: 13, color: "#52493f", marginTop: 4, marginBottom: 0 }}>{client.profile.headline}</p>
                  )}
                </button>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 20, fontWeight: 600, color: color.ink, fontFamily: fontSans, margin: 0 }}>{client._count.jobs}</p>
                    <p style={{ fontSize: 12, color: "var(--scout-muted)", margin: 0 }}>jobs</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 20, fontWeight: 600, color: color.ink, fontFamily: fontSans, margin: 0 }}>{activeJobs.length}</p>
                    <p style={{ fontSize: 12, color: "var(--scout-muted)", margin: 0 }}>active</p>
                  </div>
                  <button
                    onClick={() => onViewAsClient(client.id)}
                    disabled={startingUserId === client.id}
                    style={{
                      padding: "8px 14px",
                      background: color.forest,
                      color: color.gold,
                      border: "none",
                      borderRadius: 0,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: startingUserId === client.id ? "default" : "pointer",
                      fontFamily: fontSans,
                      whiteSpace: "nowrap",
                      opacity: startingUserId === client.id ? 0.7 : 1,
                    }}
                  >
                    {startingUserId === client.id ? "Opening…" : "View as client"}
                  </button>
                </div>
              </div>

              {client.jobs.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                  {client.jobs.slice(0, 4).map((j) => (
                    <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#faf8f5", padding: "3px 8px" }}>
                      <span style={{ fontSize: 13, color: "#3d3530" }}>{j.company}</span>
                      <StageBadge stage={j.stage} />
                    </div>
                  ))}
                  {client.jobs.length > 4 && (
                    <span style={{ fontSize: 13, color: "var(--scout-muted)", padding: "3px 4px" }}>+{client.jobs.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ color: "var(--scout-muted)", fontSize: 14, textAlign: "center", padding: "40px 0" }}>No clients found.</p>
        )}
      </div>
    </div>
  );
}
