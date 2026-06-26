"use client";

import { CoachBookingsTab } from "@/components/scout/coach-bookings-tab";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";

export default function DashboardBookingsPage() {
  return (
    <WorkspaceSubpageShell>
      <CoachBookingsTab />
    </WorkspaceSubpageShell>
  );
}
