"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { ProfileCoachPanel } from "@/components/scout/profile-coach-panel";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { color, fontSans } from "@/lib/typography";
import type { CoachListItem } from "@/lib/coach-types";

type CoachingTab = "directory" | "my-coaches";

function coachingTabFromPath(pathname: string): CoachingTab {
  return pathname === "/coaching/my-coaches" || pathname.startsWith("/coaching/my-coaches/")
    ? "my-coaches"
    : "directory";
}

function CoachingContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const coachingTab = coachingTabFromPath(pathname);
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);
  const [myCoachIds, setMyCoachIds] = useState<Set<string>>(new Set());
  const { openPricing } = useWorkspace();

  const coachParam = searchParams.get("coach");

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (coachingTab !== "directory") return;
    if (!coachParam) return;
    if (drawerCoach?.slug === coachParam || drawerCoach?.id === coachParam) return;
    setDrawerCoach({ id: coachParam, slug: coachParam, displayName: "Coach" } as CoachListItem);
  }, [coachParam, drawerCoach?.slug, drawerCoach?.id, coachingTab]);

  const selectTab = useCallback(
    (tab: CoachingTab) => {
      if (tab === "my-coaches") {
        router.push("/coaching/my-coaches");
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      const qs = params.toString();
      router.push(qs ? `/coaching?${qs}` : "/coaching");
    },
    [router, searchParams],
  );

  const openCoach = useCallback((coach: CoachListItem) => {
    setDrawerCoach(coach);
    const slug = coach.slug ?? coach.id;
    const params = new URLSearchParams(searchParams.toString());
    params.set("coach", slug);
    router.replace(`/coaching?${params.toString()}`, { scroll: false });
    if (coachingTab !== "directory") selectTab("directory");
  }, [router, searchParams, coachingTab, selectTab]);

  const closeDrawer = useCallback(() => {
    setDrawerCoach(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("coach");
    const qs = params.toString();
    router.replace(qs ? `/coaching?${qs}` : "/coaching", { scroll: false });
  }, [router, searchParams]);

  const shellTitle =
    coachingTab === "my-coaches" ? "Your coaches & sessions" : "Talk to someone who's done it.";
  const shellSubtitle =
    coachingTab === "my-coaches"
      ? "Matched coaches, shared files, session notes, and booking activity."
      : "Browse coaches ranked by how well they match your profile.";

  return (
    <>
      <WorkspacePageShell
        isMobile={isMobile}
        label="1:1 coaching"
        mobileBarTitle={coachingTab === "my-coaches" ? "My coaches" : "Coaching"}
        title={shellTitle}
        subtitle={shellSubtitle}
      >
        <WorkspaceSegmentTabs
          isMobile={isMobile}
          tabs={[
            { id: "directory" as const, label: "Browse coaches" },
            { id: "my-coaches" as const, label: "My coaches" },
          ]}
          active={coachingTab}
          onChange={selectTab}
        />

        {coachingTab === "directory" ? (
          <CoachingDirectory
            isMobile={isMobile}
            isPro={isPro}
            onSubscribe={openPricing}
            onOpenCoach={openCoach}
            myCoachIds={myCoachIds}
            onMyCoachIdsChange={setMyCoachIds}
          />
        ) : (
          <ProfileCoachPanel isMobile={isMobile} embedded />
        )}
      </WorkspacePageShell>

      {drawerCoach && coachingTab === "directory" && (
        <CoachDrawer
          slug={drawerCoach.slug ?? drawerCoach.id}
          preview={drawerCoach}
          onClose={closeDrawer}
          isPro={isPro}
          onSubscribe={openPricing}
          onMyCoachChange={(_id, _assigned, coachIds) => setMyCoachIds(new Set(coachIds))}
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
