"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { MyCoachesPanel } from "@/components/scout/my-coaches-panel";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachListItem } from "@/lib/coach-types";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type AssignedCoach = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  isInternal: boolean;
  hasNylasBooking: boolean;
  assignedAt: string;
  notes: string | null;
};

export function ProfileCoachPanel({ isMobile = false }: { isMobile?: boolean }) {
  const router = useRouter();
  const { openPricing, userRole, isImpersonating } = useWorkspace();
  const canSelfAssignCoach = userRole === "USER" || isImpersonating;
  const [assigned, setAssigned] = useState<AssignedCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);

  useEffect(() => {
    fetch("/api/coaching/assigned-coaches")
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setAssigned(d.coaches ?? []))
      .catch(() => setAssigned([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { if (d.isPro) setIsPro(true); })
      .catch(() => {});
  }, []);

  const openCoach = useCallback((coach: AssignedCoach) => {
    setDrawerCoach({
      id: coach.coachProfileId,
      slug: coach.slug,
      displayName: coach.displayName,
      photoUrl: coach.photoUrl,
      headline: coach.headline,
      bio: null,
      aboutMe: null,
      currentRole: null,
      currentCompany: null,
      location: null,
      firms: [],
      schools: [],
      specialties: [],
      industries: [],
      clientSpecializations: [],
      hourlyRate: null,
      category: null,
      featured: false,
      isProfessionalCoach: true,
      isInternal: coach.isInternal,
      avgRating: null,
      reviewCount: 0,
      followerCount: 0,
      hasNylasBooking: coach.hasNylasBooking,
    });
  }, []);

  const goToCoachPage = (slug: string | null, id: string) => {
    if (slug) router.push(`/coaching/coach/${slug}`);
    else router.push(`/coaching?coach=${encodeURIComponent(id)}`);
  };

  const removeCoach = async (coachProfileId: string) => {
    const res = await fetch(
      `/api/coaching/coach-assignment?coachProfileId=${encodeURIComponent(coachProfileId)}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      const data = await res.json();
      setAssigned(data.coaches ?? []);
    }
  };

  return (
    <>
      <div style={{ paddingBottom: 40, paddingTop: 8 }}>
        <div style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h2 style={{ ...displayTitleStyle(isMobile ? 22 : 26), margin: "0 0 8px" }}>Coach</h2>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55, maxWidth: 560 }}>
            Your matched Kimchi coaches. Book intro calls, review sessions, and shared activity here.
          </p>
        </div>

        {loading && (
          <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>Loading your coaches…</p>
        )}

        {!loading && assigned.length === 0 && (
          <ScoutBox padding={isMobile ? 18 : 24}>
            <p style={{ fontFamily: fontSans, fontSize: 15, color: color.ink, fontWeight: 600, margin: "0 0 8px" }}>
              No coach assigned yet
            </p>
            <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
              When your Kimchi team assigns a coach, they&apos;ll appear here with booking and session details.
            </p>
            <ScoutSecondaryBtn onClick={() => router.push("/coaching")} style={{ minHeight: 40 }}>
              Browse coaching directory
            </ScoutSecondaryBtn>
          </ScoutBox>
        )}

        {!loading && assigned.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
            {assigned.map((coach) => (
              <ScoutBox key={coach.coachProfileId} padding={isMobile ? 16 : 20}>
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 52 : 56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontFamily: fontSans,
                        fontSize: 17,
                        fontWeight: 700,
                        margin: "0 0 6px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      {coach.displayName}
                      {coach.isInternal && <InternalCoachBadge compact />}
                    </p>
                    {coach.headline && (
                      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, margin: "0 0 8px", lineHeight: 1.5 }}>
                        {coach.headline}
                      </p>
                    )}
                    <p style={{ fontFamily: fontMono, fontSize: 11, color: color.muted, margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Matched {new Date(coach.assignedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    {coach.notes && (
                      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "8px 0 0", fontStyle: "italic" }}>
                        {coach.notes}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                      <ScoutPrimaryBtn onClick={() => openCoach(coach)} style={{ minHeight: 40, fontSize: 14 }}>
                        {coach.hasNylasBooking ? "View & book" : "View profile"}
                      </ScoutPrimaryBtn>
                      <ScoutSecondaryBtn onClick={() => goToCoachPage(coach.slug, coach.coachProfileId)} style={{ minHeight: 40, fontSize: 14 }}>
                        Open full page
                      </ScoutSecondaryBtn>
                      {canSelfAssignCoach && !coach.isInternal && (
                        <ScoutSecondaryBtn
                          onClick={() => removeCoach(coach.coachProfileId)}
                          style={{ minHeight: 40, fontSize: 14, color: color.muted }}
                        >
                          Remove coach
                        </ScoutSecondaryBtn>
                      )}
                    </div>
                  </div>
                </div>
              </ScoutBox>
            ))}
          </div>
        )}

        <div>
          <p
            style={{
              fontFamily: fontMono,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: color.muted,
              margin: "0 0 12px",
            }}
          >
            Sessions & activity
          </p>
          <div style={{ border: border.line, background: surface.card, padding: isMobile ? 16 : 20 }}>
            <MyCoachesPanel compact={isMobile} />
          </div>
        </div>
      </div>

      {drawerCoach && (
        <CoachDrawer
          slug={drawerCoach.slug ?? drawerCoach.id}
          preview={drawerCoach}
          onClose={() => setDrawerCoach(null)}
          isPro={isPro}
          onSubscribe={openPricing}
        />
      )}
    </>
  );
}
