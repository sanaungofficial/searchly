"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";
import { CoachBookingsTab } from "@/components/scout/coach-bookings-tab";
import { WorkspaceLive } from "@/components/scout/workspace-live";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearAdminReviewClient, clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";
import { navigateToAdminClientProfile } from "@/lib/admin-client-navigation";
import { color, fontSans, type as T } from "@/lib/typography";

type OpsTab = "clients" | "bookings" | "live";

function ExpertOpsInner() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAdminUi } = useWorkspace();
  const [tab, setTab] = useState<OpsTab>("clients");
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "bookings" || section === "live" || section === "clients") {
      setTab(section);
    }
  }, [searchParams]);

  function selectTab(next: OpsTab) {
    setTab(next);
    router.replace(`/expert/ops?section=${next}`, { scroll: false });
  }

  async function viewAsClient(userId: string) {
    setStarting(userId);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to start impersonation");
      const body = (await res.json().catch(() => ({}))) as { user?: { id?: string } };
      clearAdminReviewClient();
      clearClientSessionCaches();
      if (body.user?.id) setActingUserScope(body.user.id);
      window.location.href = "/profile";
    } catch {
      setStarting(null);
    }
  }

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto" }}>
      <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 24px 40px" }}>
        <header style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>
            Ops Tools
          </h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, maxWidth: 560 }}>
            Day-to-day operations — client roster, session calendar, and live events.
          </p>
        </header>

        <WorkspaceSegmentTabs
          isMobile={isMobile}
          tabs={[
            { id: "clients" as const, label: "Clients" },
            { id: "bookings" as const, label: "Bookings" },
            { id: "live" as const, label: "Live" },
          ]}
          active={tab}
          onChange={selectTab}
        />

        {tab === "clients" && (
          <AdminClientsPanel
            apiPath={showAdminUi ? "/api/admin/clients" : "/api/coach/clients"}
            onViewAsClient={showAdminUi ? viewAsClient : undefined}
            onViewClientProfile={showAdminUi ? (userId) => void navigateToAdminClientProfile(userId) : undefined}
            startingUserId={starting}
          />
        )}
        {tab === "bookings" && <CoachBookingsTab />}
        {tab === "live" && <WorkspaceLive embedded />}
      </div>
    </div>
  );
}

export function ExpertOpsView() {
  return (
    <Suspense fallback={<p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Loading…</p>}>
      <ExpertOpsInner />
    </Suspense>
  );
}
