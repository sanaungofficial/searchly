"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";
import { clearClientSessionCaches, setActingUserScope } from "@/lib/client-session";
import { adminClientProfileBase } from "@/lib/workspace-urls";

export default function AdminClientsPage() {
  const router = useRouter();
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
      clearClientSessionCaches();
      if (body.user?.id) setActingUserScope(body.user.id);
      window.location.href = "/profile";
    } catch {
      setStarting(null);
    }
  }

  function viewClientProfile(userId: string) {
    router.push(adminClientProfileBase(userId));
  }

  return (
    <AdminClientsPanel
      apiPath="/api/admin/clients"
      onViewAsClient={viewAsClient}
      onViewClientProfile={viewClientProfile}
      startingUserId={starting}
      detailMode="drawer"
    />
  );
}
