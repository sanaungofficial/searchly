"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachVouchesScreen } from "@/components/scout/coach-vouches-screen";

export default function CoachVouchesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showWelcome = searchParams.get("welcome") === "1";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/coach/onboarding-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          router.replace("/login");
          return;
        }
        if (data.phase === "questionnaire") {
          router.replace("/coach-onboarding");
          return;
        }
        if (data.phase === "portal") {
          router.replace("/clients");
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace("/coach-onboarding"));
  }, [router]);

  if (!ready) {
    return (
      <div className="onboarding-loading" role="status">
        <div className="onboarding-loading__spinner" aria-hidden="true" />
        <span>Loading…</span>
      </div>
    );
  }

  return <CoachVouchesScreen showWelcome={showWelcome} />;
}
