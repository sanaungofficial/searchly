"use client";

import { usePathname, useRouter } from "next/navigation";
import { WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { bruddleHeadingStyle, color, fontSans, surface, type as T } from "@/lib/typography";
import {
  NETWORKING_INBOX_PATH,
  networkingSectionPath,
  type NetworkingSection,
} from "@/lib/workspace-urls";

export function NetworkingLayoutClient({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const router = useRouter();
  const { withClientScope } = useWorkspace();
  const activeSection: NetworkingSection = pathname.startsWith(NETWORKING_INBOX_PATH) ? "inbox" : "leads";

  return (
    <div className="bruddle" style={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: surface.page }}>
      <WorkspaceScroll style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <WorkspaceContent style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <header style={{ marginBottom: isMobile ? 12 : 16, flexShrink: 0 }}>
            <h1 style={bruddleHeadingStyle("h5")}>Networking</h1>
            <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.5 }}>
              {activeSection === "leads"
                ? "People and companies to reach — track status, notes, and pipeline links."
                : "Connect mail to read threads, compose messages, and tie replies to your pipeline."}
            </p>
          </header>
          <WorkspaceSegmentTabs
            isMobile={isMobile}
            tabs={[
              { id: "leads" as const, label: "Leads" },
              { id: "inbox" as const, label: "Inbox" },
            ]}
            active={activeSection}
            onChange={(section) => router.push(withClientScope(networkingSectionPath(section)))}
          />
          {children}
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
