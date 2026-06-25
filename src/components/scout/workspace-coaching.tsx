"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { MatchScoreBadge } from "@/components/scout/match-score-ui";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { color, fontSans, surface, type as T } from "@/lib/typography";
import type { CoachListItem } from "@/lib/coach-types";

type CoachingTab = "coaches" | "mycoach";

function CoachingContent() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<CoachingTab>("coaches");
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
      >
        <WorkspaceSegmentTabs
          isMobile={isMobile}
          tabs={[
            { id: "coaches", label: "Find a Coach" },
            { id: "mycoach", label: "My Coach" },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === "coaches" ? (
          <CoachingDirectory isMobile={isMobile} isPro={isPro} onSubscribe={openPricing} onOpenCoach={openCoach} />
        ) : (
          <MyCoachTab isPro={isPro} isMobile={isMobile} onSubscribe={openPricing} onOpenCoach={openCoach} onBrowse={() => setTab("coaches")} />
        )}

        {showUpgrade && (
          <GrowthUpgradeModal trigger="coaching" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
        )}
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

function MyCoachTab({
  isPro,
  isMobile,
  onSubscribe,
  onOpenCoach,
  onBrowse,
}: {
  isPro: boolean;
  isMobile: boolean;
  onSubscribe: () => void;
  onOpenCoach: (coach: CoachListItem) => void;
  onBrowse: () => void;
}) {
  const [coaches, setCoaches] = useState<CoachListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coaches/following")
      .then((r) => r.json())
      .then((data) => { setCoaches(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: color.muted, fontSize: T.bodySm, fontFamily: fontSans }}>Loading…</p>;
  }

  if (!coaches.length) {
    return (
      <div style={{ minHeight: isMobile ? 320 : 400, background: surface.page, borderRadius: 0 }}>
        <ScoutBox padding={isMobile ? 24 : 32} style={{ maxWidth: 560 }}>
          <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.stone, margin: "0 0 8px", lineHeight: 1.6 }}>
            Coaches you follow or work with will show up here.
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 20px", lineHeight: 1.6 }}>
            Browse the directory and tap <strong>+ Follow</strong> to save coaches. When you book sessions, they&apos;ll appear here too.
          </p>
          <ScoutPrimaryBtn onClick={onBrowse}>Browse coaches →</ScoutPrimaryBtn>
        </ScoutBox>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 48, minHeight: isMobile ? 320 : 400 }}>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
        Following · {coaches.length}
      </p>
      {coaches.map((c) => (
        <ScoutBox key={c.id} padding={isMobile ? 20 : 24}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
            <button type="button" onClick={() => onOpenCoach(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <CoachAvatar name={c.displayName} photoUrl={c.photoUrl} size={60} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                <div>
                  <button type="button" onClick={() => onOpenCoach(c)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                    <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: color.ink, margin: 0 }}>{c.displayName}</p>
                  </button>
                  <div style={{ marginTop: 4 }}>
                    <CoachStarRating rating={c.avgRating} count={c.reviewCount} />
                  </div>
                  {c.headline && (
                    <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, marginTop: 6, marginBottom: 0 }}>{c.headline}</p>
                  )}
                </div>
                {(c.matchScore ?? 0) > 0 && <MatchScoreBadge score={c.matchScore!} label={c.matchLabel ?? ""} />}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <ScoutPrimaryBtn onClick={() => onOpenCoach(c)} style={{ minHeight: isMobile ? 44 : undefined }}>View profile</ScoutPrimaryBtn>
            {isPro && c.calLink ? (
              <a href={c.calLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <ScoutSecondaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>Book session →</ScoutSecondaryBtn>
              </a>
            ) : (
              <ScoutSecondaryBtn onClick={onSubscribe} style={{ minHeight: isMobile ? 44 : undefined }}>Subscribe to book</ScoutSecondaryBtn>
            )}
          </div>
        </ScoutBox>
      ))}

      <ScoutBox padding={isMobile ? "16px 20px" : "18px 24px"}>
        <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.muted, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          Upcoming sessions
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          No upcoming sessions scheduled. Book one to start your prep.
        </p>
      </ScoutBox>
    </div>
  );
}
