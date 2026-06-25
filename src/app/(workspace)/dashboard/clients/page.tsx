"use client";

import { Suspense } from "react";
import { WorkspaceCoach } from "@/components/scout/workspace-coach";

export default function DashboardClientsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
        </div>
      }
    >
      <WorkspaceCoach embedded />
    </Suspense>
  );
}
