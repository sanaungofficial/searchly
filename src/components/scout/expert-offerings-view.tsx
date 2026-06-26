"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CoachProfileTab } from "@/components/scout/coach-profile-tab";
import { CoachPricingDrawer } from "@/components/scout/coach-pricing-drawer";
import { CoachEditAvailabilityView } from "@/components/scout/coach-edit-availability-view";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { color, fontSans, type as T } from "@/lib/typography";

type OfferingsTab = "profile" | "packages" | "availability";

export function ExpertOfferingsView() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<OfferingsTab>("profile");
  const [coachSlug, setCoachSlug] = useState<string | null>(null);

  useEffect(() => {
    const section = searchParams.get("section");
    if (section === "packages" || section === "availability" || section === "profile") {
      setTab(section);
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/coach/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setCoachSlug(p?.slug ?? null))
      .catch(() => {});
  }, []);

  function selectTab(next: OfferingsTab) {
    setTab(next);
    router.replace(`/dashboard/offerings?section=${next}`, { scroll: false });
  }

  return (
    <div style={{ height: "100%", minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: isMobile ? "16px 16px 32px" : "24px 28px 40px", maxWidth: 960 }}>
        <header style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h1 style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: isMobile ? 22 : 26, fontWeight: 600, color: color.forest }}>
            Offerings
          </h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, maxWidth: 560 }}>
            Your public profile, session packages, and booking availability — what clients see when they book with you.
          </p>
        </header>

        <WorkspaceSegmentTabs
          isMobile={isMobile}
          tabs={[
            { id: "profile" as const, label: "Profile" },
            { id: "packages" as const, label: "Packages" },
            { id: "availability" as const, label: "Availability" },
          ]}
          active={tab}
          onChange={selectTab}
        />

        {tab === "profile" && <CoachProfileTab setupOnMissing />}
        {tab === "packages" && <CoachPricingDrawer embedded coachSlug={coachSlug} />}
        {tab === "availability" && (
          <CoachEditAvailabilityView mode="coach" embedded backHref="/dashboard/offerings?section=availability" />
        )}
      </div>
    </div>
  );
}
