"use client";

import Link from "next/link";
import { OrgClientAssignmentSection } from "@/components/admin/org-client-assignment-section";
import { OrgSettingsNav } from "@/components/org/org-settings-nav";
import { color, displayTitleStyle, fontSans, type as T } from "@/lib/typography";

export function OrgClientSettingsPanel({ orgId }: { orgId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 960 }}>
      <div>
        <Link href={`/org/${orgId}/dashboard`} style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, textDecoration: "none" }}>
          ← Org dashboard
        </Link>
        <h1 style={{ ...displayTitleStyle(28), margin: "12px 0 8px" }}>Organization settings</h1>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          Manage employee accounts for your organization.
        </p>
        <OrgSettingsNav orgId={orgId} active="clients" />
      </div>

      <OrgClientAssignmentSection
        orgId={orgId}
        apiBase={`/api/org/${orgId}`}
        showIntroMatches={false}
      />
    </div>
  );
}
