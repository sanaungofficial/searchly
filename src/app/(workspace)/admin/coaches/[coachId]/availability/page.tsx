"use client";

import { use } from "react";
import { CoachEditAvailabilityView } from "@/components/scout/coach-edit-availability-view";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";

export default function AdminCoachAvailabilityPage({
  params,
}: {
  params: Promise<{ coachId: string }>;
}) {
  const { coachId } = use(params);

  return (
    <WorkspaceSubpageShell>
      <CoachEditAvailabilityView
        mode="admin"
        coachId={coachId}
        backHref={`/admin/coaches/${coachId}`}
      />
    </WorkspaceSubpageShell>
  );
}
