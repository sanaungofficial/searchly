"use client";

import { MyCoachesPanel } from "@/components/scout/my-coaches-panel";
import { displayTitleStyle, fontSans, color, type as T } from "@/lib/typography";

export default function MyCoachesPage() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "24px 28px 32px", maxWidth: 900 }}>
        <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>My coaches</h1>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 24px", lineHeight: 1.6 }}>
          Sessions booked through Kimchi, plus confirmation and scheduling updates.
        </p>
        <MyCoachesPanel />
      </div>
    </div>
  );
}
