"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { isStaffPortalRole } from "@/lib/staff-portal";

/** Legacy /clients route — staff use Dashboard → Clients tab. */
export function CoachClientsPage() {
  const router = useRouter();
  const { userRole } = useWorkspace();
  const isStaff = isStaffPortalRole(userRole);

  useEffect(() => {
    if (!userRole) return;
    if (!isStaff) {
      router.replace("/dashboard");
      return;
    }

    fetch("/api/coach/onboarding-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.phase === "questionnaire") {
          router.replace("/coach-onboarding");
          return;
        }
        router.replace("/dashboard/clients");
      })
      .catch(() => router.replace("/dashboard/clients"));
  }, [userRole, isStaff, router]);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
    </div>
  );
}
