"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkspaceCoach } from "@/components/scout/workspace-coach";
import { useWorkspace } from "@/contexts/workspace-context";

export function CoachClientsPage() {
  const router = useRouter();
  const { userRole } = useWorkspace();
  const isStaff = userRole === "COACH" || userRole === "RECRUITER" || userRole === "ADMIN";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userRole) return;
    if (!isStaff) {
      router.replace("/dashboard");
      return;
    }

    if (userRole === "COACH" || userRole === "ADMIN") {
      fetch("/api/coach/onboarding-status")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.phase === "questionnaire") {
            router.replace("/coach-onboarding");
            return;
          }
          setReady(true);
        })
        .catch(() => setReady(true));
      return;
    }

    setReady(true);
  }, [userRole, isStaff, router]);

  if (!ready) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
      </div>
    }>
      <WorkspaceCoach />
    </Suspense>
  );
}
