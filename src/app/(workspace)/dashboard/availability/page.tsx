"use client";

import { CoachEditAvailabilityView } from "@/components/scout/coach-edit-availability-view";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";

export default function DashboardAvailabilityPage() {
  return (
    <WorkspaceSubpageShell>
      <CoachEditAvailabilityView mode="coach" backHref="/dashboard/bookings" />
    </WorkspaceSubpageShell>
  );
}
