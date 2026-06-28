"use client";

import { useIsMobile } from "@/hooks/use-mobile";
import { CoachBookingsTab } from "@/components/scout/coach-bookings-tab";
import { color, fontSans, type as T } from "@/lib/typography";

/** Inbox = session bookings and requests (not client roster or live events). */
export function ExpertInboxView() {
  const isMobile = useIsMobile();

  return (
    <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 24px 40px" }}>
      <header style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>
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