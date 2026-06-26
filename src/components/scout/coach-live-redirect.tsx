"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { isStaffPortalRole } from "@/lib/staff-portal";

export function CoachLiveRedirect({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userRole } = useWorkspace();
  const isStaff = isStaffPortalRole(userRole);

  useEffect(() => {
    if (isStaff) {
      router.replace("/expert/inbox?section=live");
    }
  }, [isStaff, router]);

  if (isStaff) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading…</p>
      </div>
    );
  }

  return <>{children}</>;
}
