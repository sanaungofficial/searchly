"use client";

import { CoachProfileTab } from "@/components/scout/coach-profile-tab";
import { ScoutDisplayTitle, ScoutLabel } from "@/components/scout/scout-box";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";
import { useIsMobile } from "@/hooks/use-mobile";
import { color, fontSans, type as T } from "@/lib/typography";

export default function DashboardExpertProfilePage() {
  const isMobile = useIsMobile();

  return (
    <WorkspaceSubpageShell>
      <div style={{ marginBottom: isMobile ? 24 : 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>Dashboard</ScoutLabel>
        </div>
        <ScoutDisplayTitle size={isMobile ? 28 : 36} style={{ marginBottom: 10 }}>
          Expert Profile
        </ScoutDisplayTitle>
        <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: 0, maxWidth: 560, lineHeight: 1.6 }}>
          Your expert directory profile and calendar sync. Connect Google or Outlook so seekers can book sessions with
          you inside Kimchi.
        </p>
      </div>
      <CoachProfileTab setupOnMissing />
    </WorkspaceSubpageShell>
  );
}
