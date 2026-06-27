"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { CoachProfileTab } from "./coach-profile-tab";
import { CoachBookingsTab } from "./coach-bookings-tab";
import { CoachSharedDocumentsPanel } from "./coach-shared-documents-panel";
import { CoachClientSessionNotesPanel } from "./coach-client-session-notes-panel";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { WorkspacePageShell } from "./workspace-page-shell";
import { WorkspaceSegmentTabs } from "./workspace-segment-tabs";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type CoachTab = "clients" | "profile" | "bookings";

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
  isAssignedCoach?: boolean;
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
    <span style={{ fontSize: 12, fontFamily: fontMono, padding: "2px 7px", borderRadius: "var(--scout-radius)", background: bg, color }}>
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

export function WorkspaceCoach({ embedded = false }: { embedded?: boolean }) {
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<CoachTab>("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Client | null>(null);
  const [search, setSearch] = useState("");
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [onboardingPhase, setOnboardingPhase] = useState<string | null>(null);
  const [vouchCount, setVouchCount] = useState(0);

  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab === "profile") setTab("profile");
    else if (!embedded && urlTab === "bookings") setTab("bookings");
    else if (embedded && urlTab !== "profile") setTab("clients");
  }, [searchParams, embedded]);

  useEffect(() => {
    fetch("/api/coach/onboarding-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setOnboardingPhase(data.phase ?? null);
          setVouchCount(data.vouchCount ?? 0);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/coach/clients")
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data) => { setClients(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const toggleClientAssignment = async (client: Client) => {
    setAssignmentLoading(true);
    try {
      const isAssigned = client.isAssignedCoach ?? false;
      const res = await fetch(
        `/api/coach/clients/${client.id}/assignment`,
        { method: isAssigned ? "DELETE" : "POST" },
      );
      if (!res.ok) return;
      setClients((prev) =>
        prev.map((c) => (c.id === client.id ? { ...c, isAssignedCoach: !isAssigned } : c)),
      );
      setSelected((prev) => (prev?.id === client.id ? { ...prev, isAssignedCoach: !isAssigned } : prev));
    } finally {
      setAssignmentLoading(false);
    }
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const tabs = embedded ? null : (
    <WorkspaceSegmentTabs
      tabs={[
        { id: "clients" as const, label: "Clients" },
        { id: "bookings" as const, label: "Bookings" },
        { id: "profile" as const, label: "My Profile" },
      ]}
      active={tab}
      onChange={(id) => { setTab(id); setSelected(null); }}
    />
  );

  const pageTitle =
    tab === "clients" ? "Clients" : tab === "bookings" ? "Bookings" : "My Profile";

  const embeddedPad = isMobile ? "16px" : "28px";

  const shell = (title: string, content: ReactNode) => {
    if (embedded) {
      return (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ padding: `0 ${embeddedPad} 32px` }}>
            <WorkspacePageShell compact title="">
              {onboardingBanner}
              {content}
            </WorkspacePageShell>
          </div>
        </div>
      );
    }
    return (
      <WorkspacePageShell label="Coach portal" title={title}>
        {onboardingBanner}
        {tabs}
        {content}
      </WorkspacePageShell>
    );
  };

  const onboardingBanner =
    onboardingPhase === "vouches" ? (
      <div style={{ background: "rgba(180,83,9,0.08)", border: "1px solid rgba(180,83,9,0.2)", padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#92400e", fontFamily: fontSans }}>
          Profile in review · {vouchCount} vouch{vouchCount === 1 ? "" : "es"} collected
        </p>
        <a href="/coach-onboarding/vouches" style={{ fontSize: 14, fontFamily: fontSans, color: "#1A3A2F", fontWeight: 600 }}>
          Gather vouches →
        </a>
      </div>
    ) : null;

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
    return shell(selected.name ?? selected.email.split("@")[0], (
      <>
        <button onClick={() => setSelected(null)}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: color.muted, fontSize: T.caption, fontFamily: fontSans, marginBottom: 24, padding: 0 }}>
          ← All Clients
        </button>

        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: T.caption, color: color.muted, fontFamily: fontMono, margin: "0 0 6px" }}>{selected.email}</p>
            {selected.profile?.headline && <p style={{ fontSize: T.bodySm, color: color.stone, margin: 0 }}>{selected.profile.headline}</p>}
            {selected.isAssignedCoach && (
              <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, margin: "8px 0 0" }}>
                Working together
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <ScoutSecondaryBtn
              onClick={() => toggleClientAssignment(selected)}
              disabled={assignmentLoading}
              style={{
                minHeight: 40,
                ...(selected.isAssignedCoach ? { borderColor: color.forest, color: color.forest } : {}),
              }}
            >
              {selected.isAssignedCoach ? "Remove from my clients" : "Mark as working together"}
            </ScoutSecondaryBtn>
            {selected.profile?.linkedinUrl && (
              <a href={selected.profile.linkedinUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: T.caption, fontFamily: fontMono, padding: "5px 12px", borderRadius: "var(--scout-radius)", border: border.line, color: color.forest, textDecoration: "none", background: surface.card }}>
                LinkedIn ↗
              </a>
            )}
            {selected.profile?.resumeUrl && (
              <a href={selected.profile.resumeUrl} target="_blank" rel="noreferrer"
                style={{ fontSize: T.caption, fontFamily: fontMono, padding: "5px 12px", borderRadius: "var(--scout-radius)", border: border.line, color: color.forest, textDecoration: "none", background: surface.card }}>
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
          <div style={{ background: "#fff", borderRadius: "var(--scout-radius)", border: "1px solid rgba(26,58,47,0.08)", padding: "16px 20px", marginBottom: 20 }}>
            <p style={{ fontSize: 12, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 10 }}>Targets</p>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {selected.profile.targetRoles.length > 0 && (
                <div>
                  <p style={{ fontSize: 13, color: "var(--scout-muted)", marginBottom: 4 }}>Roles</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {selected.profile.targetRoles.map((r) => (
                      <span key={r} style={{ fontSize: 13, background: "rgba(26,58,47,0.06)", color: "#1a3a2f", padding: "2px 8px", borderRadius: "var(--scout-radius)" }}>{r}</span>
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

        <div style={{ background: "#fff", borderRadius: "var(--scout-radius)", border: "1px solid rgba(26,58,47,0.08)", overflow: "hidden" }}>
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

        <CoachSharedDocumentsPanel clientUserId={selected.id} mode="coach" />
        <CoachClientSessionNotesPanel clientUserId={selected.id} mode="coach" />
      </>
    ));
  }

  return shell(pageTitle, (
    <>
      {tab === "profile" ? (
        <CoachProfileTab />
      ) : tab === "bookings" ? (
        <CoachBookingsTab />
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
              style={{ width: "100%", fontSize: 14, background: surface.card, border: border.line, borderRadius: "var(--scout-radius)", padding: "9px 14px", outline: "none", fontFamily: fontSans, boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((client) => {
              const activeJobs = client.jobs.filter((j) => activeStage(j.stage));
              const inInterview = client.jobs.some((j) => j.stage === "INTERVIEWING");
              const hasOffer = client.jobs.some((j) => j.stage === "OFFER");
              return (
                <button key={client.id} onClick={() => setSelected(client)}
                  style={{ background: "#fff", borderRadius: "var(--scout-radius)", border: `1px solid ${hasOffer ? "rgba(5,150,105,0.3)" : inInterview ? "rgba(124,58,237,0.2)" : "rgba(26,58,47,0.08)"}`, padding: "16px 20px", cursor: "pointer", textAlign: "left", transition: "box-shadow 0.15s", width: "100%" }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <p style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 14 }}>{client.name ?? client.email.split("@")[0]}</p>
                        {hasOffer && <span style={{ fontSize: 12, background: "rgba(5,150,105,0.1)", color: "#059669", padding: "1px 7px", borderRadius: "var(--scout-radius)", fontFamily: fontMono }}>offer</span>}
                        {inInterview && !hasOffer && <span style={{ fontSize: 12, background: "rgba(124,58,237,0.1)", color: "#7c3aed", padding: "1px 7px", borderRadius: "var(--scout-radius)", fontFamily: fontMono }}>interviewing</span>}
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
                        <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 5, background: "#faf8f5", borderRadius: "var(--scout-radius)", padding: "3px 8px" }}>
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
    </>
  ));
}
