"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";

export function CoachLiveRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userRole } = useWorkspace();

  useEffect(() => {
    if (userRole === "COACH") {
      router.replace("/dashboard/live");
    }
  }, [userRole, router]);

  if (userRole === "COACH") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
