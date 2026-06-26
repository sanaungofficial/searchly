"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Sends users without completed onboarding to /onboarding. */
export function RequireOnboardingComplete() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/sync-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.redirectTo === "/onboarding") {
          router.replace("/onboarding");
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}

/** Resolves post-login destination (onboarding vs dashboard). */
export async function resolvePostAuthRedirect(): Promise<string> {
  const res = await fetch("/api/auth/sync-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not resolve redirect");
  return typeof data.redirectTo === "string" ? data.redirectTo : "/dashboard";
}
