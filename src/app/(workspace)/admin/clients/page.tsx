"use client";

import { useState } from "react";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";
import { clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";

export default function AdminClientsPage() {
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
      const body = await res.json().catch(() => ({})) as { user?: { id?: string } };
      clearClientSessionCaches();
      if (body.user?.id) setActingUserScope(body.user.id);
      window.location.href = "/profile";
    } catch {
      setStarting(null);
    }
  }

  return (
    <AdminClientsPanel
      apiPath="/api/admin/clients"
      onViewAsClient={viewAsClient}
      startingUserId={starting}
    />
  );
}
