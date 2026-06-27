"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { WorkspaceLive } from "@/components/scout/workspace-live";
import { color, fontSans, type as T } from "@/lib/typography";

export function ExpertLiveView() {
  const isMobile = useIsMobile();

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 24px 40px" }}>
        <header style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>
            Live Webinar
          </h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, maxWidth: 560 }}>
            Schedule and run live group sessions — set up rooms, share links, and manage registrations.
          </p>
        </header>
        <WorkspaceLive embedded />
      </div>
    </div>
  );
}
