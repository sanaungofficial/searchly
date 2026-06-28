"use client";

import { JobSearchEmailDashboard } from "@/components/scout/job-search-email-dashboard";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { surface } from "@/lib/typography";

export function InboxPageClient() {
  return (
    <div
      className="bruddle"
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
      }}
    >
      <WorkspaceScroll style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <WorkspaceContent style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <JobSearchEmailDashboard />
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
