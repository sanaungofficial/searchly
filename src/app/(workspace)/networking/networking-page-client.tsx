"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { JobSearchEmailDashboard } from "@/components/scout/job-search-email-dashboard";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { bruddleHeadingStyle, color, fontSans, surface, type as T } from "@/lib/typography";
import {
  INBOX_PATH,
  networkingSectionPath,
  parseNetworkingSection,
  type NetworkingSection,
} from "@/lib/workspace-urls";

export function NetworkingPageClient() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { withClientScope } = useWorkspace();
  const [section, setSection] = useState<NetworkingSection>("leads");

  useEffect(() => {
    setSection(parseNetworkingSection(searchParams));
  }, [searchParams]);

  function selectSection(next: NetworkingSection) {
    setSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("section");
    params.delete("networkJobId");
    if (next === "inbox") {
      params.set("tab", "inbox");
      params.delete("contactId");
    } else {
      params.delete("tab");
      params.delete("messageId");
    }
    const qs = params.toString();
    router.replace(withClientScope(qs ? `${INBOX_PATH}?${qs}` : networkingSectionPath(next)), { scroll: false });
  }

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
          <header style={{ marginBottom: isMobile ? 12 : 16, flexShrink: 0 }}>
            <h1 style={bruddleHeadingStyle("h5")}>Networking</h1>
            <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.5 }}>
              Manage leads and email outreach in one place.
            </p>
          </header>

          <WorkspaceSegmentTabs
            isMobile={isMobile}
            variant="bruddle"
            tabs={[
              { id: "leads" as const, label: "Leads" },
              { id: "inbox" as const, label: "Inbox" },
            ]}
            active={section}
            onChange={selectSection}
          />

          <JobSearchEmailDashboard section={section} />
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
