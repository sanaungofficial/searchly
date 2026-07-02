"use client";

import { useState } from "react";
import Link from "next/link";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { OrgClientAssignmentSection } from "@/components/admin/org-client-assignment-section";
import { OrgTeamEmployeesSection } from "@/components/admin/org-team-employees-section";
import { color, fontSans, type as T } from "@/lib/typography";

type EmployeeTab = "team" | "supported";

const tabStyle = (active: boolean): React.CSSProperties => ({
  fontFamily: fontSans,
  fontSize: T.bodySm,
  fontWeight: active ? 600 : 500,
  color: active ? color.forest : color.muted,
  padding: "8px 14px",
  borderRadius: "var(--scout-radius)",
  border: active ? "1px solid rgba(26,58,47,0.18)" : "1px solid transparent",
  background: active ? "rgba(26,58,47,0.06)" : "transparent",
  cursor: "pointer",
});

export function OrgEmployeesSection({ orgId }: { orgId: string }) {
  const [tab, setTab] = useState<EmployeeTab>("team");

  return (
    <ScoutBox padding={20} id="employees">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <ScoutLabel>Employees</ScoutLabel>
        <Link
          href={`/org/${orgId}/contacts`}
          style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, textDecoration: "underline" }}
        >
          Browse pooled contacts →
        </Link>
      </div>
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "8px 0 16px" }}>
        Team members contribute network and manage the org. Supported employees are job seekers assigned for intro matching.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <button type="button" style={tabStyle(tab === "team")} onClick={() => setTab("team")}>
          Team
        </button>
        <button type="button" style={tabStyle(tab === "supported")} onClick={() => setTab("supported")}>
          Supported employees
        </button>
      </div>

      {tab === "team" ? (
        <OrgTeamEmployeesSection orgId={orgId} />
      ) : (
        <OrgClientAssignmentSection orgId={orgId} embedded showIntroMatches />
      )}
    </ScoutBox>
  );
}
