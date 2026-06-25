"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { color, fontSans } from "@/lib/typography";
import type { CoachListItem } from "@/lib/coach-types";

function CoachingContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);
  const { openPricing } = useWorkspace();

  const coachParam = searchParams.get("coach");

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!coachParam) return;
    if (drawerCoach?.slug === coachParam || drawerCoach?.id === coachParam) return;
    setDrawerCoach({ id: coachParam, slug: coachParam, displayName: "Coach" } as CoachListItem);
  }, [coachParam, drawerCoach?.slug, drawerCoach?.id]);

  const openCoach = useCallback((coach: CoachListItem) => {
    setDrawerCoach(coach);
    const slug = coach.slug ?? coach.id;
    const params = new URLSearchParams(searchParams.toString());
    params.set("coach", slug);
    router.replace(`/coaching?${params.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const closeDrawer = useCallback(() => {
    setDrawerCoach(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("coach");
    const qs = params.toString();
    router.replace(qs ? `/coaching?${qs}` : "/coaching", { scroll: false });
  }, [router, searchParams]);

  return (
    <>
      <WorkspacePageShell
        isMobile={isMobile}
        label="1:1 coaching"
        mobileBarTitle="Coaching"
        title="Talk to someone who's done it."
        subtitle="Browse coaches ranked by how well they match your profile."
      >
        <CoachingDirectory
          isMobile={isMobile}
          isPro={isPro}
          onSubscribe={openPricing}
          onOpenCoach={openCoach}
        />
      </WorkspacePageShell>

      {drawerCoach && (
        <CoachDrawer
          slug={drawerCoach.slug ?? drawerCoach.id}
          preview={drawerCoach}
          onClose={closeDrawer}
          isPro={isPro}
          onSubscribe={openPricing}
        />
      )}

      {showUpgrade && (
        <GrowthUpgradeModal trigger="coaching" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </>
  );
}

export function WorkspaceCoaching() {
  return (
    <Suspense fallback={<p style={{ color: color.muted, fontFamily: fontSans, padding: 24 }}>Loading coaching…</p>}>
      <CoachingContent />
    </Suspense>
  );
}
