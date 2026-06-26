"use client";

import { use } from "react";
import { CoachHubPanel } from "@/components/admin/coach-hub-panel";
import { displayTitleStyle } from "@/lib/typography";

export default function AdminCoachDetailPage({ params }: { params: Promise<{ coachId: string }> }) {
  const { coachId } = use(params);

  return (
    <div>
      <h1 style={{ ...displayTitleStyle(28), margin: "0 0 24px" }}>Coach hub</h1>
      <CoachHubPanel
        apiPath={`/api/admin/coach-hub?coachId=${encodeURIComponent(coachId)}`}
        mode="admin"
        backHref="/admin/coaches"
        showAdminLinks
      />
    </div>
  );
}
