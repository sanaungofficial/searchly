"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminClientsPanel } from "@/components/admin/admin-clients-panel";

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
      router.push("/profile");
      router.refresh();
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
