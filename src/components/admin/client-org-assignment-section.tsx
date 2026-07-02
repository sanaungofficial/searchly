"use client";

import type { AdminClient } from "@/components/admin/admin-clients-panel";
import { ScoutBox } from "@/components/scout/scout-box";
import { color, fontMono, fontSans, type as T } from "@/lib/typography";

export function ClientOrgAssignmentSection({ client }: { client: AdminClient }) {
  const assignments = client.orgAssignments ?? [];
  if (assignments.length === 0) return null;

  return (
    <ScoutBox padding="16px 20px" style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 12, color: color.muted, textTransform: "uppercase", letterSpacing: "0.8px", fontFamily: fontMono, marginBottom: 10 }}>
        Organization assignments
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {assignments.map((assignment) => (
          <div
            key={assignment.assignmentId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: 0 }}>
                {assignment.orgName}
              </p>
              <p style={{ fontFamily: fontMono, fontSize: T.caption, color: color.muted, margin: "2px 0 0" }}>
                {assignment.orgSlug}
              </p>
            </div>
            <span
              style={{
                fontFamily: fontMono,
                fontSize: T.caption,
                padding: "2px 7px",
                borderRadius: "var(--scout-radius)",
                background: "rgba(26,58,47,0.08)",
                color: color.forest,
              }}
            >
              org
            </span>
          </div>
        ))}
      </div>
    </ScoutBox>
  );
}
