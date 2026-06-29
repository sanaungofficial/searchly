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
    let cancelled = false;

    async function startReview() {
      clearClientSessionCaches();
      setActingUserScope(userId);
      setAdminReviewClient(userId);
      try {
        await fetch("/api/admin/client-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
      } catch {
        /* sessionStorage still scopes client-side navigation */
      }
      if (cancelled) return;
      const target = profileSuffix ? `/profile${profileSuffix}` : "/profile";
      const url = new URL(target, window.location.origin);
      url.searchParams.set("clientUserId", userId);
      window.location.replace(`${url.pathname}${url.search}`);
    }

    void startReview();

    return () => {
      cancelled = true;
    };
  }, [userId, profileSuffix]);

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--scout-muted)", fontSize: 14 }}>Loading client profile…</p>
    </div>
  );
}
