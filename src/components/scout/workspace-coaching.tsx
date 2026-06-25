"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { GrowthUpgradeModal } from "@/components/scout/growth-upgrade-modal";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CoachingDirectory } from "@/components/scout/coaching-directory";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { WorkspacePageShell } from "@/components/scout/workspace-page-shell";
import { WorkspaceSegmentTabs } from "@/components/scout/workspace-segment-tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/contexts/workspace-context";
import { border, color, fontSans, type as T } from "@/lib/typography";
import type { CoachListItem } from "@/lib/coach-types";

type CoachingTab = "mycoach" | "coaches";

function coachHref(coach: CoachListItem) {
  return `/coaching/coach/${coach.slug ?? coach.id}`;
}

export function WorkspaceCoaching() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<CoachingTab>("mycoach");
  const [isPro, setIsPro] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const { openPricing } = useWorkspace();

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="1:1 coaching"
      mobileBarTitle="Coaching"
      title="Talk to someone who's done it."
    >
      <WorkspaceSegmentTabs
        isMobile={isMobile}
        tabs={[
          { id: "mycoach", label: "My Coach" },
          { id: "coaches", label: "Find a Coach" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "mycoach" ? (
        <MyCoachTab isPro={isPro} isMobile={isMobile} onSubscribe={openPricing} />
      ) : (
        <Suspense fallback={<p style={{ color: color.muted, fontFamily: fontSans }}>Loading directory…</p>}>
          <CoachingDirectory isMobile={isMobile} isPro={isPro} onSubscribe={openPricing} />
        </Suspense>
      )}

      {showUpgrade && (
        <GrowthUpgradeModal trigger="coaching" onClose={() => setShowUpgrade(false)} onOpenPricing={openPricing} />
      )}
    </WorkspacePageShell>
  );
}

function MyCoachTab({ isPro, isMobile, onSubscribe }: { isPro: boolean; isMobile: boolean; onSubscribe: () => void }) {
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
      <ScoutBox padding={isMobile ? 20 : 24}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px" }}>
          You haven&apos;t followed any coaches yet. Browse the directory and tap <strong>+ Follow</strong> to save coaches here.
        </p>
        <Link href="/coaching" style={{ textDecoration: "none" }}>
          <ScoutPrimaryBtn>Browse coaches →</ScoutPrimaryBtn>
        </Link>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 40 }}>
      {coaches.map((c) => (
        <ScoutBox key={c.id} padding={isMobile ? 20 : 24}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
            <Link href={coachHref(c)}>
              <CoachAvatar name={c.displayName} photoUrl={c.photoUrl} size={60} />
            </Link>
            <div style={{ flex: 1 }}>
              <Link href={coachHref(c)} style={{ textDecoration: "none", color: "inherit" }}>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, color: color.ink, margin: 0 }}>{c.displayName}</p>
              </Link>
              <div style={{ marginTop: 4 }}>
                <CoachStarRating rating={c.avgRating} count={c.reviewCount} />
              </div>
              {c.headline && (
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: color.muted, marginTop: 6, marginBottom: 0 }}>{c.headline}</p>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href={coachHref(c)} style={{ textDecoration: "none" }}>
              <ScoutPrimaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>View profile</ScoutPrimaryBtn>
            </Link>
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
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
          Upcoming sessions
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
          No upcoming sessions scheduled. Book one to start your prep.
        </p>
      </ScoutBox>
    </div>
  );
}
