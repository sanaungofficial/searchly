"use client";

import { usePathname } from "next/navigation";
import { WorkspaceOpportunities } from "@/components/scout/workspace-opportunities";

/** Pipeline/network routes keep the kanban shell mounted; inbox is a standalone page. */
export function OpportunitiesLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isInbox = pathname.startsWith("/opportunities/inbox");

  if (isInbox) {
    return <>{children}</>;
  }

  return (
    <>
      <WorkspaceOpportunities />
      {children}
    </>
  );
}
