"use client";

import { CoachHubPanel } from "@/components/admin/coach-hub-panel";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";

export function DashboardCoachHubView() {
  return (
    <WorkspaceSubpageShell bruddle>
      <CoachHubPanel apiPath="/api/coach/hub" mode="coach" />
    </WorkspaceSubpageShell>
  );
}
