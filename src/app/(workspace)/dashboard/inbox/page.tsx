import { Suspense } from "react";
import { ExpertInboxView } from "@/components/scout/expert-inbox-view";

export default function DashboardInboxPage() {
  return (
    <Suspense fallback={<p style={{ padding: 24, color: "var(--scout-muted)" }}>Loading inbox…</p>}>
      <ExpertInboxView />
    </Suspense>
  );
}
