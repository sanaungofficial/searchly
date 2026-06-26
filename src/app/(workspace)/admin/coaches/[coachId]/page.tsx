"use client";

import { use } from "react";
import { AdminNav } from "@/app/(workspace)/admin/admin-nav";
import { CoachHubPanel } from "@/components/admin/coach-hub-panel";
import { displayTitleStyle } from "@/lib/typography";

export default function AdminCoachDetailPage({ params }: { params: Promise<{ coachId: string }> }) {
  const { coachId } = use(params);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <h1 style={{ ...displayTitleStyle(28), margin: 0 }}>Coach hub</h1>
        <AdminNav />
      </div>
      <CoachHubPanel
        apiPath={`/api/admin/coach-hub?coachId=${encodeURIComponent(coachId)}`}
        mode="admin"
        backHref="/admin/coaches"
        showAdminLinks
      />
    </div>
  );
}
