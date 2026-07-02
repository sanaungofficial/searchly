"use client";

import { useCallback, useEffect, useState } from "react";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { OrgClientIntroMatchesPanel } from "@/components/admin/org-client-intro-matches-section";
import { OrgEmployeeTargetEmployersSection } from "@/components/org/org-employee-target-employers-section";
import { EmployeeViewAsActions } from "@/components/org/employee-view-as-actions";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

export type EmployeeDrawerClient = {
  userId: string;
  email: string;
  name: string | null;
  assignedAt: string;
  notes: string | null;
};

const DRAWER_WIDTH = "min(920px, calc(100vw - 16px))";

export function EmployeeIntroDrawer({
  orgId,
  client,
  apiBase,
  readOnly = false,
  onClose,
  canReview = false,
  canImpersonate = false,
  startingUserId,
  onViewAsAdmin,
  onViewAsEmployee,
}: {
  orgId: string;
  client: EmployeeDrawerClient;
  apiBase: string;
  readOnly?: boolean;
  onClose: () => void;
  canReview?: boolean;
  canImpersonate?: boolean;
  startingUserId?: string | null;
  onViewAsAdmin?: (userId: string) => void;
  onViewAsEmployee?: (userId: string) => void;
}) {
  const { isMobile, backdropStyle, panelStyle } = useWorkspaceDrawerLayout();
  const [visible, setVisible] = useState(false);
  const [targetCount, setTargetCount] = useState<number | null>(null);

  const label = client.name ?? client.email;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close employee drawer"
        onClick={handleClose}
        style={{
          ...backdropStyle,
          background: "rgba(0,0,0,0.22)",
          zIndex: DRAWER_BACKDROP_Z,
          border: "none",
          cursor: "pointer",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} — employee details`}
        style={{
          ...panelStyle,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          overflow: "hidden",
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "0 8px 40px rgba(0,0,0,0.12)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 20px))",
          transition: "transform 0.22s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "14px 16px" : "18px 24px",
            background: surface.card,
            borderBottom: border.line,
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "0 0 4px" }}>
              Employee
            </p>
            <h2 style={{ ...displayTitleStyle(22), margin: 0 }}>{label}</h2>
            <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "6px 0 0" }}>
              {client.email}
            </p>
            {(canReview || canImpersonate) && (
              <div style={{ marginTop: 14 }}>
                <EmployeeViewAsActions
                  userId={client.userId}
                  startingUserId={startingUserId}
                  canReview={canReview}
                  canImpersonate={canImpersonate}
                  onViewAsAdmin={onViewAsAdmin}
                  onViewAsEmployee={onViewAsEmployee}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            style={{
              border: border.line,
              background: surface.card,
              borderRadius: "var(--scout-radius)",
              padding: "8px 12px",
              fontFamily: fontSans,
              fontSize: T.caption,
              cursor: "pointer",
              color: color.stone,
              flexShrink: 0,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <ScoutBox padding={20}>
              <ScoutLabel>Employee info</ScoutLabel>
              <dl
                style={{
                  margin: "12px 0 0",
                  display: "grid",
                  gridTemplateColumns: "120px 1fr",
                  gap: "8px 16px",
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                }}
              >
                <dt style={{ color: color.muted, fontFamily: fontMono, fontSize: T.caption }}>Name</dt>
                <dd style={{ margin: 0, color: color.ink }}>{client.name ?? "—"}</dd>
                <dt style={{ color: color.muted, fontFamily: fontMono, fontSize: T.caption }}>Email</dt>
                <dd style={{ margin: 0, color: color.ink }}>{client.email}</dd>
                <dt style={{ color: color.muted, fontFamily: fontMono, fontSize: T.caption }}>Assigned</dt>
                <dd style={{ margin: 0, color: color.ink }}>
                  {new Date(client.assignedAt).toLocaleDateString()}
                </dd>
                <dt style={{ color: color.muted, fontFamily: fontMono, fontSize: T.caption }}>Notes</dt>
                <dd style={{ margin: 0, color: color.stone }}>{client.notes?.trim() || "—"}</dd>
              </dl>
            </ScoutBox>

            <ScoutBox
              padding={20}
              style={{
                border: "2px solid rgba(74,139,106,0.35)",
                background: "rgba(74,139,106,0.06)",
              }}
            >
              <ScoutLabel>Target employers</ScoutLabel>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 12px" }}>
                {readOnly
                  ? "Companies this employee is targeting for warm intro paths."
                  : "Add or remove target companies — required before finding intro matches."}
              </p>
              <OrgEmployeeTargetEmployersSection
                orgId={orgId}
                userId={client.userId}
                readOnly={readOnly}
                onChange={setTargetCount}
              />
            </ScoutBox>

            <ScoutBox padding={20}>
              <ScoutLabel>Potential connections</ScoutLabel>
              <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "8px 0 0" }}>
                {targetCount === 0
                  ? "Add target employers above to search the org pooled network."
                  : targetCount != null
                    ? `Employee is targeting ${targetCount} compan${targetCount === 1 ? "y" : "ies"} — ranked intro paths from pooled contacts.`
                    : "Ranked intro paths from the org pooled network, by relationship strength."}
              </p>
              {readOnly && (
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0" }}>
                  Read-only — org admins can find matches and track intros.
                </p>
              )}
              <OrgClientIntroMatchesPanel
                orgId={orgId}
                clientUserId={client.userId}
                clientLabel={label}
                apiBase={apiBase}
                readOnly={readOnly}
                defaultExpanded
                layout="list"
                targetCompanyCount={targetCount ?? undefined}
              />
            </ScoutBox>
          </div>
        </div>
      </div>
    </>
  );
}
