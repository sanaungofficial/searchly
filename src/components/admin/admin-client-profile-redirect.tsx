"use client";

import { useEffect } from "react";
import {
  setAdminReviewClient,
  setActingUserScope,
  clearClientSessionCaches,
} from "@/lib/client-session";

type Props = {
  userId: string;
  /** Path after `/profile` (e.g. `/about/education`, `/assets/abc`). */
  profileSuffix: string;
};

/** Legacy `/dashboard/clients/:id/profile/*` → session-scoped `/profile/*`. */
export function AdminClientProfileRedirect({ userId, profileSuffix }: Props) {
  useEffect(() => {
    clearClientSessionCaches();
    setActingUserScope(userId);
    setAdminReviewClient(userId);
    const target = profileSuffix ? `/profile${profileSuffix}` : "/profile";
    window.location.replace(target);
  }, [userId, profileSuffix]);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading client profile…</p>
    </div>
  );
}
