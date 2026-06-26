"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";
import { WorkspaceSubpageShell } from "@/components/scout/workspace-content";
import { useWorkspace } from "@/contexts/workspace-context";
import { clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";

function DashboardClientsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { userRole } = useWorkspace();
  const isAdmin = userRole === "ADMIN";
  const [starting, setStarting] = useState<string | null>(null);

  const tab = searchParams.get("tab");

  useEffect(() => {
    if (tab === "profile") {
      router.replace("/dashboard/expert-profile");
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
      clearClientSessionCaches();
      if (body.user?.id) setActingUserScope(body.user.id);
      window.location.href = "/profile";
    } catch {
      setStarting(null);
    }
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
        apiPath={isAdmin ? "/api/admin/clients" : "/api/coach/clients"}
        onViewAsClient={isAdmin ? viewAsClient : undefined}
        startingUserId={starting}
        detailMode="drawer"
        embedded
        canAddClient={isAdmin}
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
