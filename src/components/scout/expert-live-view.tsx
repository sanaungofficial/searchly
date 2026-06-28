"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { ExpertWebinarsView } from "@/components/scout/expert-webinars-view";
import { bruddleHeadingStyle, color, fontSans, type as T } from "@/lib/typography";

export function ExpertLiveView() {
  const isMobile = useIsMobile();

  return (
    <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 24px 40px" }}>
      <header style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ ...bruddleHeadingStyle(isMobile ? "h4" : "h3"), margin: "0 0 8px", color: color.forest }}>
          Live Webinar
        </h1>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, maxWidth: 560 }}>
          Create webinars, manage registrations, and go live when you&apos;re ready.
        </p>
      </header>
      <ExpertWebinarsView />
    </div>
  );
}