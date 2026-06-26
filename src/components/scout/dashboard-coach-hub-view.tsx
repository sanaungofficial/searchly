"use client";

import { CoachHubPanel } from "@/components/admin/coach-hub-panel";

export function DashboardCoachHubView() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "0 28px 32px" }}>
        <CoachHubPanel apiPath="/api/coach/hub" mode="coach" />
      </div>
    </div>
  );
}
