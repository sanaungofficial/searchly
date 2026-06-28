"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { CoachBookingsTab } from "@/components/scout/coach-bookings-tab";
import { bruddleHeadingStyle, color, fontSans, type as T } from "@/lib/typography";

/** Inbox = session bookings and requests (not client roster or live events). */
export function ExpertInboxView() {
  const isMobile = useIsMobile();

  return (
    <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 24px 40px" }}>
      <header style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ ...bruddleHeadingStyle(isMobile ? "h4" : "h3"), margin: "0 0 8px", color: color.forest }}>
          Inbox
        </h1>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, maxWidth: 560 }}>
          Upcoming and past sessions booked through Kimchi — requests, confirmations, and your calendar.
        </p>
      </header>
      <CoachBookingsTab embedded />
    </div>
  );
}