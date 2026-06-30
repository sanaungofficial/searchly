"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  JobSearchEmailDashboard,
  type NetworkingSection,
} from "@/components/scout/job-search-email-dashboard";
import {
  NETWORKING_SIDEBAR_TABS,
  NetworkingLayoutSidebar,
} from "@/components/scout/networking-layout-sidebar";
import { ScoutDisplayTitle, ScoutLabel } from "@/components/scout/scout-box";
import { WORKSPACE_MAX_WIDTH, WorkspaceContent, WorkspaceScroll } from "@/components/scout/workspace-content";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { color, fontSans, surface, type as T } from "@/lib/typography";
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
    if (next !== "inbox") params.delete("messageId");
    if (next !== "leads") params.delete("contactId");
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
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <WorkspaceScroll style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <WorkspaceContent style={{ maxWidth: WORKSPACE_MAX_WIDTH, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {isMobile && (
            <div style={{ marginBottom: 24, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
                <ScoutLabel>Networking</ScoutLabel>
              </div>
              <ScoutDisplayTitle size={28} style={{ marginBottom: 8 }}>
                Leads &amp; inbox
              </ScoutDisplayTitle>
              <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: 0, lineHeight: 1.5 }}>
                Manage leads and email outreach in one place.
              </p>
            </div>
          )}

          {isMobile && (
            <div
              style={{
                display: "flex",
                border: "var(--scout-border)",
                overflowX: "auto",
                marginBottom: 24,
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
                flexShrink: 0,
              }}
            >
              {NETWORKING_SIDEBAR_TABS.map(({ id, label }, i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectSection(id)}
                  style={{
                    padding: "10px 14px",
                    minHeight: 44,
                    border: "none",
                    borderRight: i < NETWORKING_SIDEBAR_TABS.length - 1 ? "var(--scout-border)" : "none",
                    background: section === id ? color.forest : surface.card,
                    color: section === id ? color.gold : color.muted,
                    fontFamily: fontSans,
                    fontSize: T.bodySm,
                    fontWeight: section === id ? 600 : 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: isMobile ? "block" : "flex", gap: 32, alignItems: "flex-start", flex: 1, minHeight: 0 }}>
            {!isMobile && (
              <NetworkingLayoutSidebar
                tabs={NETWORKING_SIDEBAR_TABS}
                activeSection={section}
                onNavigate={selectSection}
              />
            )}

            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <JobSearchEmailDashboard section={section} />
            </div>
          </div>
        </WorkspaceContent>
      </WorkspaceScroll>
    </div>
  );
}
