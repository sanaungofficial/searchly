"use client";

import { CoachProfileTab } from "@/components/scout/coach-profile-tab";
import { useIsMobile } from "@/hooks/use-mobile";
import { color, fontSans, type as T } from "@/lib/typography";

export default function DashboardExpertProfilePage() {
  const isMobile = useIsMobile();
  const pad = isMobile ? "16px" : "28px";

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: `0 ${pad} 32px` }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 24px", maxWidth: 640 }}>
          Your expert directory profile and calendar sync. Connect Google or Outlook so seekers can book sessions with
          you inside Kimchi.
        </p>
        <CoachProfileTab setupOnMissing />
      </div>
    </div>
  );
}
