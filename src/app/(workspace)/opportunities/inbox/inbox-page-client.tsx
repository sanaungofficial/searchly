"use client";

import { JobSearchEmailDashboard } from "@/components/scout/job-search-email-dashboard";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { surface } from "@/lib/typography";
import { useIsMobile } from "@/hooks/use-mobile";

export function InboxPageClient() {
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <WorkspaceScroll style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <WorkspaceContent
          flush
          style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", maxWidth: "100%" }}
        >
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              padding: isMobile ? "16px 16px 16px" : "20px 24px 24px",
            }}
          >
            <JobSearchEmailDashboard />
          </div>
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
