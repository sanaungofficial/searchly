"use client";

import { WorkspaceOpportunities } from "@/components/scout/workspace-opportunities";

/** Pipeline/network routes keep the kanban shell mounted. */
export function OpportunitiesLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WorkspaceOpportunities />
      {children}
    </>
  );
}
