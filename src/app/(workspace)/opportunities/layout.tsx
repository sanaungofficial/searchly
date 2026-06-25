import { WorkspaceOpportunities } from "@/components/scout/workspace-opportunities";

/** Keeps opportunities UI mounted across nested routes so job drawers do not remount on URL updates. */
export default function OpportunitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <WorkspaceOpportunities />
      {children}
    </>
  );
}
