"use client";

import { useEffect, useState } from "react";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { ClientDetailBody, ClientDrawer } from "@/components/scout/client-drawer";
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
  coachAssignments?: Array<{
    id: string;
    notes: string | null;
    createdAt: string;
    coachProfile: {
      id: string;
      displayName: string;
      slug: string | null;
      photoUrl: string | null;
      headline: string | null;
      isInternal: boolean;
      nylasSchedulerConfigId: string | null;
    };
  }>;
  orgAssignments?: Array<{
    assignmentId: string;
    orgId: string;
    orgName: string;
    orgSlug: string;
    assignedAt: string;
    notes: string | null;
  }>;
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
    <span style={{ fontSize: 12, fontFamily: fontMono, padding: "2px 7px", borderRadius: "var(--scout-radius)", background: bg, color: c }}>
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

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (client: AdminClient, meta: { warnings: string[] }) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [sendInvite, setSendInvite] = useState(false);
  const [initialPassword, setInitialPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email.trim());
      if (name.trim()) formData.set("name", name.trim());
      if (linkedinUrl.trim()) formData.set("linkedinUrl", linkedinUrl.trim());
      if (resumeFile) formData.set("resume", resumeFile);
      if (sendInvite && !initialPassword.trim()) formData.set("sendInvite", "true");
      if (initialPassword.trim()) formData.set("initialPassword", initialPassword.trim());

      const res = await fetch("/api/admin/clients", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(formatApiErrorMessage(data?.error ?? data, "Could not create client."));
      }
      if (!data.client) {
        throw new Error("Unexpected response from server.");
      }
      onCreated(data.client as AdminClient, { warnings: Array.isArray(data.warnings) ? data.warnings : [] });
      onClose();
    } catch (err) {
      setError(formatApiErrorMessage(err, "Could not create client."));
    } finally {
      setLoading(false);
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    fontSize: 14,
    background: surface.card,
    border: "var(--scout-border)",
    borderRadius: "var(--scout-radius)",
    padding: "9px 12px",
    outline: "none",
    fontFamily: fontSans,
    boxSizing: "border-box",
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 300 }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 301,
          padding: 16,
        }}
      >
        <div
          style={{
            background: surface.card,
            border: "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
            width: "100%",
            maxWidth: 480,
            padding: 24,
            boxShadow: "var(--scout-shadow-card-strong)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ ...displayTitleStyle(22), margin: 0 }}>Add client</h2>
            <button
              type="button"
              onClick={onClose}
              style={{ background: "none", border: "none", fontSize: 18, color: color.muted, cursor: "pointer" }}
            >
              ×
            </button>
          </div>

          <p style={{ fontSize: T.bodySm, color: color.stone, margin: "0 0 20px", lineHeight: 1.55 }}>
            Creates a client account you can manage right away. Resume, LinkedIn, and sign-in invite are all optional — add what you have now and fill in the rest later via View as client.
          </p>

          <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Email *
              </label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                style={fieldStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Resume (optional — PDF, DOCX, or TXT)
              </label>
              <input
                type="file"
                accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                style={{ ...fieldStyle, padding: "8px 12px" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                LinkedIn profile URL (optional)
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://linkedin.com/in/…"
                style={fieldStyle}
              />
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                fontSize: T.bodySm,
                color: color.stone,
                lineHeight: 1.45,
                cursor: "pointer",
                opacity: initialPassword.trim() ? 0.55 : 1,
              }}
            >
              <input
                type="checkbox"
                checked={sendInvite}
                disabled={Boolean(initialPassword.trim())}
                onChange={(e) => setSendInvite(e.target.checked)}
                style={{ marginTop: 3 }}
              />
              <span>
                Send sign-in invite email
                <span style={{ display: "block", fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                  {initialPassword.trim()
                    ? "Disabled when you set a password — they can log in with that instead."
                    : "Recommended. They'll get an email to set up their account."}
                </span>
              </span>
            </label>
            <div>
              <label style={{ display: "block", fontSize: T.caption, color: color.muted, fontFamily: fontMono, marginBottom: 6 }}>
                Initial password (optional)
              </label>
              <input
                type="password"
                value={initialPassword}
                onChange={(e) => {
                  setInitialPassword(e.target.value);
                  if (e.target.value.trim()) setSendInvite(false);
                }}
                autoComplete="new-password"
                placeholder="Set a password they can use to sign in"
                style={fieldStyle}
              />
              <p style={{ fontSize: T.caption, color: color.muted, margin: "6px 0 0", lineHeight: 1.45 }}>
                Creates their login immediately — no email sent. You can sign in as them on the login page with this password.
              </p>
            </div>
            <p style={{ fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.45 }}>
              Resume parse uses AI on production. LinkedIn import needs Apify configured.
            </p>
            {error && <p style={{ fontSize: T.bodySm, color: "#C4574A", margin: 0 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: "10px 16px",
                  background: surface.inset,
                  border: "var(--scout-border)",
                  borderRadius: "var(--scout-radius)",
                  fontSize: 14,
                  fontFamily: fontSans,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: "10px 18px",
                  background: color.forest,
                  color: color.gold,
                  border: "none",
                  borderRadius: "var(--scout-radius)",
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: fontSans,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? "Creating…" : "Create client"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

export function AdminClientsPanel({
  apiPath,
  onViewAsClient,
  onViewClientProfile,
  startingUserId,
  detailMode = "drawer",
  embedded = false,
  canAddClient = true,
}: {
  apiPath: string;
  onViewAsClient?: (userId: string) => void;
  onViewClientProfile?: (userId: string) => void;
  startingUserId?: string | null;
  detailMode?: "page" | "drawer";
  embedded?: boolean;
  canAddClient?: boolean;
}) {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminClient | null>(null);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createNotice, setCreateNotice] = useState<string | null>(null);

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

  if (selected && detailMode === "page") {
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

        <div style={{ marginBottom: 28 }}>
          <p style={sectionLabelStyle}>Client</p>
          <h1 style={{ ...displayTitleStyle(28), margin: "4px 0 6px" }}>{displayName}</h1>
        </div>

        <ClientDetailBody
          client={selected}
          onViewAsClient={onViewAsClient}
          onViewClientProfile={onViewClientProfile}
          startingUserId={startingUserId}
          showViewAsClient={!!onViewAsClient}
          onClientUpdated={(updated) => {
            setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setSelected(updated);
          }}
          showAuthAccountTools={canAddClient}
        />
      </div>
    );
  }

  const listHeader = embedded ? (
    <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
        {clients.length} client{clients.length === 1 ? "" : "s"}
      </p>
      {canAddClient && (
        <ScoutPrimaryBtn
          onClick={() => { setShowCreate(true); setCreateNotice(null); }}
          style={{ minHeight: 40 }}
        >
          + Add client
        </ScoutPrimaryBtn>
      )}
    </div>
  ) : (
    <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <div>
        <p style={sectionLabelStyle}>Clients</p>
        <h1 style={{ ...displayTitleStyle(28), margin: "4px 0 8px" }}>Manage clients</h1>
        <p style={{ fontSize: 14, color: color.stone, margin: 0, maxWidth: 560 }}>
          Create client accounts with optional resume, LinkedIn, or sign-in invite — then open their workspace to finish setup.
        </p>
      </div>
      {canAddClient && (
        <ScoutPrimaryBtn
          onClick={() => { setShowCreate(true); setCreateNotice(null); }}
          style={{ minHeight: 40 }}
        >
          + Add client
        </ScoutPrimaryBtn>
      )}
    </div>
  );

  return (
    <div>
      {listHeader}

      {createNotice && (
        <div style={{ background: "rgba(26,58,47,0.06)", border: "var(--scout-border)", padding: "12px 16px", marginBottom: 20, fontSize: T.bodySm, color: color.stone, lineHeight: 1.5 }}>
          {createNotice}
        </div>
      )}

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
            border: "var(--scout-border)",
            borderRadius: "var(--scout-radius)",
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
              role="button"
              tabIndex={0}
              onClick={() => setSelected(client)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelected(client);
                }
              }}
              style={{
                background: surface.card,
                border: `1px solid ${hasOffer ? "rgba(5,150,105,0.3)" : inInterview ? "rgba(124,58,237,0.2)" : "rgba(26,58,47,0.08)"}`,
                borderRadius: "var(--scout-radius)",
                boxShadow: "var(--scout-shadow-card)",
                padding: "16px 20px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <p style={{ fontWeight: 600, color: "#1a1a1a", fontSize: 14, margin: 0 }}>{displayName}</p>
                    {(client.orgAssignments?.length ?? 0) > 0 && (
                      <span style={{ fontSize: 12, background: "rgba(26,58,47,0.08)", color: color.forest, padding: "1px 7px", fontFamily: fontMono }}>
                        {client.orgAssignments!.length} org{client.orgAssignments!.length === 1 ? "" : "s"}
                      </span>
                    )}
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
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 20, fontWeight: 600, color: color.ink, fontFamily: fontSans, margin: 0 }}>{client._count.jobs}</p>
                    <p style={{ fontSize: 12, color: "var(--scout-muted)", margin: 0 }}>jobs</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 20, fontWeight: 600, color: color.ink, fontFamily: fontSans, margin: 0 }}>{activeJobs.length}</p>
                    <p style={{ fontSize: 12, color: "var(--scout-muted)", margin: 0 }}>active</p>
                  </div>
                  {onViewClientProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewClientProfile(client.id);
                      }}
                      style={{
                        padding: "8px 14px",
                        background: color.forest,
                        color: color.gold,
                        border: "none",
                        borderRadius: "var(--scout-radius)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: fontSans,
                        whiteSpace: "nowrap",
                      }}
                    >
                      View as admin
                    </button>
                  )}
                  {onViewAsClient && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewAsClient(client.id);
                      }}
                      disabled={startingUserId === client.id}
                      style={{
                        padding: "8px 14px",
                        background: "transparent",
                        color: color.forest,
                        border: "var(--scout-border)",
                        borderRadius: "var(--scout-radius)",
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
                  )}
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

      {showCreate && canAddClient && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={(client, meta) => {
            setClients((prev) => [client, ...prev.filter((c) => c.id !== client.id)]);
            setSelected(client);
            setCreateNotice(
              meta.warnings.length > 0
                ? meta.warnings.join(" ")
                : "Client account created.",
            );
          }}
        />
      )}

      {selected && detailMode === "drawer" && (
        <ClientDrawer
          client={selected}
          onClose={() => setSelected(null)}
          onViewAsClient={onViewAsClient}
          onViewClientProfile={onViewClientProfile}
          startingUserId={startingUserId}
          showViewAsClient={!!onViewAsClient}
          onClientUpdated={(updated) => {
            setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setSelected(updated);
          }}
          showAuthAccountTools={canAddClient}
        />
      )}
    </div>
  );
}
