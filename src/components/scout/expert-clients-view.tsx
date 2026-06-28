"use client";

import { Suspense, useState } from "react";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { clearAdminReviewClient, clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";
import { navigateToAdminClientProfile } from "@/lib/admin-client-navigation";
import { color, fontSans, type as T } from "@/lib/typography";

function ExpertClientsInner() {
  const isMobile = useIsMobile();
  const { showAdminUi } = useWorkspace();
  const [starting, setStarting] = useState<string | null>(null);

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
    <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 28px 40px" }}>
      <header style={{ marginBottom: isMobile ? 20 : 28 }}>
        <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>
          Clients
        </h1>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, maxWidth: 560 }}>
          Your roster — pipeline, session notes, shared documents, and full profiles for everyone you coach.
        </p>
      </header>

      <AdminClientsPanel
        apiPath={showAdminUi ? "/api/admin/clients" : "/api/coach/clients"}
        onViewAsClient={showAdminUi ? viewAsClient : undefined}
        onViewClientProfile={showAdminUi ? (userId) => void navigateToAdminClientProfile(userId) : undefined}
        startingUserId={starting}
        detailMode="drawer"
        embedded
        canAddClient={showAdminUi}
      />
    </div>
  );
}

export function ExpertClientsView() {
  return (
    <Suspense fallback={<p style={{ padding: 24, fontFamily: fontSans, color: color.muted }}>Loading…</p>}>
      <ExpertClientsInner />
    </Suspense>
  );
}