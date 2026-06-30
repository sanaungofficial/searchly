"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  JobSearchEmailDashboard,
  type NetworkingSection,
} from "@/components/scout/job-search-email-dashboard";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { bruddleHeadingStyle, color, fontSans, surface, type as T } from "@/lib/typography";
import { INBOX_PATH } from "@/lib/workspace-urls";

export function NetworkingPageClient() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { withClientScope } = useWorkspace();
  const [section, setSection] = useState<NetworkingSection>("leads");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "inbox" || tab === "leads") {
      setSection(tab);
      return;
    }
    if (searchParams.get("messageId")) {
      setSection("inbox");
      return;
    }
    if (searchParams.get("contactId")) {
      setSection("leads");
    }
  }, [searchParams]);

  function selectSection(next: NetworkingSection) {
    setSection(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", next);
    params.delete("messageId");
    params.delete("contactId");
    router.replace(withClientScope(`${INBOX_PATH}?${params.toString()}`), { scroll: false });
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
