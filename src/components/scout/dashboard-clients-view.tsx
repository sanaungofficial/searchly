"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";
import { useWorkspace } from "@/contexts/workspace-context";
import { clearClientSessionCaches, setActingUserScope, clearAdminReviewClient } from "@/lib/client-session";
import { navigateToAdminClientProfile } from "@/lib/admin-client-navigation";

function DashboardClientsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showAdminUi } = useWorkspace();
  const [starting, setStarting] = useState<string | null>(null);

  const tab = searchParams.get("tab");

  useEffect(() => {
    if (tab === "profile") {
      router.replace("/dashboard/offerings?section=profile");
    }
  }, [tab, router]);

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

  function viewClientProfile(userId: string) {
    void navigateToAdminClientProfile(userId);
  }

  if (tab === "profile") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <WorkspaceSubpageShell>
      <AdminClientsPanel
        apiPath={showAdminUi ? "/api/admin/clients" : "/api/coach/clients"}
        onViewAsClient={showAdminUi ? viewAsClient : undefined}
        onViewClientProfile={showAdminUi ? viewClientProfile : undefined}
        startingUserId={starting}
        detailMode="drawer"
        embedded
        canAddClient={showAdminUi}
      />
    </WorkspaceSubpageShell>
  );
}

export function DashboardClientsView() {
  return (
    <Suspense
      fallback={
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
        </div>
      }
    >
      <DashboardClientsInner />
    </Suspense>
  );
}
