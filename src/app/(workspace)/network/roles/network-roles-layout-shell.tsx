"use client";

import { WorkspaceRecruiterNetwork } from "@/components/scout/workspace-recruiter-network";

export function NetworkRolesLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WorkspaceRecruiterNetwork />
      {children}
    </>
  );
}
