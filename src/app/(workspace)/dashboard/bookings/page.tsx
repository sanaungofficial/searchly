"use client";

import { CoachBookingsTab } from "@/components/scout/coach-bookings-tab";
import { useIsMobile } from "@/hooks/use-mobile";

export default function DashboardBookingsPage() {
  const isMobile = useIsMobile();
  const pad = isMobile ? "16px" : "28px";

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: `0 ${pad} ${pad}` }}>
        <CoachBookingsTab />
      </div>
    </div>
  );
}
