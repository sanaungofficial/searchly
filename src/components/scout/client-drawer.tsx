"use client";

import { useEffect, useState } from "react";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { ClientCoachAssignmentSection } from "@/components/admin/client-coach-assignment-section";
import { CoachSharedDocumentsPanel } from "@/components/scout/coach-shared-documents-panel";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";

type JobStage = AdminClient["jobs"][number]["stage"];

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

export function ClientDetailBody({
  client,
  onViewAsClient,
  onViewClientProfile,
  startingUserId,
  showViewAsClient,
  onClientUpdated,
}: {
  client: AdminClient;
  onViewAsClient?: (userId: string) => void;
  onViewClientProfile?: (userId: string) => void;
  startingUserId?: string | null;
  showViewAsClient?: boolean;
  onClientUpdated?: (client: AdminClient) => void;
}) {
  const activeJobs = client.jobs.filter((j) => activeStage(j.stage));
  const appliedJobs = client.jobs.filter((j) => ["APPLIED", "SCREENING", "INTERVIEWING"].includes(j.stage));
  const displayName = client.name ?? client.email.split("@")[0];

  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: T.caption, color: color.muted, fontFamily: fontMono, margin: "0 0 6px" }}>{client.email}</p>
          {client.profile?.headline && (
            <p style={{ fontSize: T.bodySm, color: color.stone, margin: 0 }}>{client.profile.headline}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {onViewClientProfile && (
            <ScoutPrimaryBtn
              onClick={() => onViewClientProfile(client.id)}
              style={{ minHeight: 40 }}
            >
              View profile
            </ScoutPrimaryBtn>
          )}
          {showViewAsClient && onViewAsClient && (
            <ScoutSecondaryBtn
              onClick={() => onViewAsClient(client.id)}
              disabled={startingUserId === client.id}
              style={{ minHeight: 40, opacity: startingUserId === client.id ? 0.7 : 1 }}
            >
              {startingUserId === client.id ? "Opening…" : "View as client"}
            </ScoutSecondaryBtn>
          )}
          {client.profile?.linkedinUrl && (
            <a
              href={client.profile.linkedinUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: T.caption,
                fontFamily: fontMono,
                padding: "10px 14px",
                borderRadius: "var(--scout-radius)",
                border: border.line,
                color: color.forest,
                textDecoration: "none",
                background: surface.card,
              }}
            >
              LinkedIn ↗
            </a>
          )}
          {client.profile?.resumeUrl && (
            <a
              href={client.profile.resumeUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: T.caption,
                fontFamily: fontMono,
                padding: "10px 14px",
                borderRadius: "var(--scout-radius)",
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total jobs", value: client._count.jobs },
          { label: "Active pipeline", value: activeJobs.length },
          { label: "Applied / in process", value: appliedJobs.length },
          { label: "Tailored resumes", value: client._count.tailoredResumes },
        ].map(({ label, value }) => (
          <ScoutBox key={label} padding="14px 18px">
            <p style={{ fontSize: T.label, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 6, marginTop: 0 }}>
              {label}
            </p>
            <p style={{ ...displayTitleStyle(24), margin: 0 }}>{value}</p>
          </ScoutBox>
        ))}
      </div>

      {client.profile && (client.profile.targetRoles.length > 0 || client.profile.targetSalary) && (
        <div style={{ background: surface.card, border: border.line, padding: "16px 20px", marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 10 }}>
            Targets
          </p>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {client.profile.targetRoles.length > 0 && (
              <div>
                <p style={{ fontSize: 13, color: color.muted, marginBottom: 4 }}>Roles</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {client.profile.targetRoles.map((r) => (
                    <span key={r} style={{ fontSize: 13, background: "rgba(26,58,47,0.06)", color: color.forest, padding: "2px 8px" }}>
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {client.profile.targetSalary && (
              <div>
                <p style={{ fontSize: 13, color: color.muted, marginBottom: 4 }}>Target salary</p>
                <p style={{ fontSize: 14, color: color.ink, fontWeight: 500 }}>
                  {typeof client.profile.targetSalary === "number"
                    ? `$${client.profile.targetSalary.toLocaleString()}`
                    : client.profile.targetSalary}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {onClientUpdated && (
        <ClientCoachAssignmentSection client={client} onUpdated={onClientUpdated} />
      )}

      <CoachSharedDocumentsPanel
        clientUserId={client.id}
        mode="admin"
        assignedCoaches={(client.coachAssignments ?? []).map((a) => ({
          coachProfileId: a.coachProfile.id,
          displayName: a.coachProfile.displayName,
        }))}
      />

      <div style={{ background: surface.card, border: border.line, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: border.line }}>
          <p style={{ fontSize: 12, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, margin: 0 }}>
            Job pipeline ({client.jobs.length})
          </p>
        </div>
        {client.jobs.length === 0 ? (
          <p style={{ padding: "24px 20px", color: color.muted, fontSize: 14 }}>No jobs tracked yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: border.line }}>
                {["Company", "Role", "Stage", "Added"].map((h, i) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 20px",
                      textAlign: i === 3 ? "right" : "left",
                      fontSize: 12,
                      color: color.muted,
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
              {client.jobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: "1px solid rgba(26,58,47,0.06)" }}>
                  <td style={{ padding: "9px 20px", fontWeight: 500, color: color.ink }}>{j.company}</td>
                  <td style={{ padding: "9px 20px", color: color.stone }}>{j.role}</td>
                  <td style={{ padding: "9px 20px" }}>
                    <StageBadge stage={j.stage} />
                  </td>
                  <td style={{ padding: "9px 20px", textAlign: "right", fontSize: 13, color: color.muted, fontFamily: fontMono }}>
                    {formatDate(j.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

type DrawerProps = {
  client: AdminClient;
  onClose: () => void;
  onViewAsClient?: (userId: string) => void;
  onViewClientProfile?: (userId: string) => void;
  startingUserId?: string | null;
  showViewAsClient?: boolean;
  onClientUpdated?: (client: AdminClient) => void;
};

export function ClientDrawer({
  client,
  onClose,
  onViewAsClient,
  onViewClientProfile,
  startingUserId,
  showViewAsClient,
  onClientUpdated,
}: DrawerProps) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const displayName = client.name ?? client.email.split("@")[0];

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const close = () => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  };

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          left: isMobile ? 0 : undefined,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          overflow: "hidden",
          zIndex: 70,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 28px",
            background: surface.card,
            borderBottom: border.line,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, color: color.muted, padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...displayTitleStyle(18), margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {client.email}
            </p>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            WebkitOverflowScrolling: "touch",
            padding: isMobile ? "20px 16px 32px" : "28px 32px 36px",
          }}
        >
          <ClientDetailBody
            client={client}
            onViewAsClient={onViewAsClient}
            onViewClientProfile={onViewClientProfile}
            startingUserId={startingUserId}
            showViewAsClient={showViewAsClient}
            onClientUpdated={onClientUpdated}
          />
        </div>
      </div>
    </>
  );
}
