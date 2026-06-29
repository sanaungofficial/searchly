"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import type { CoachBookingSessionType } from "@/components/scout/coach-booking-modal";
import { SectionHeadingWithHelp, SectionHelpTip } from "@/components/scout/section-help-tip";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useWorkspace } from "@/contexts/workspace-context";
import type { CoachListItem } from "@/lib/coach-types";
import { bruddleHeadingStyle, color, fontSans, type as T } from "@/lib/typography";

type AssignedCoach = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  isInternal: boolean;
  hasNylasBooking: boolean;
};

type Props = {
  isMobile?: boolean;
  /** When false, renders nothing (e.g. expert dashboard). */
  enabled?: boolean;
};

function assignedCoachPreview(coach: AssignedCoach): CoachListItem {
  return {
    id: coach.coachProfileId,
    slug: coach.slug,
    displayName: coach.displayName,
    photoUrl: coach.photoUrl,
    headline: coach.headline,
    bio: null,
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
  };
}

export function AssignedCoachSummaryBox({ isMobile = false, enabled = true }: Props) {
  const router = useRouter();
  const { withClientScope, withClientReviewPath } = useWorkspace();
  const [assignedCoaches, setAssignedCoaches] = useState<AssignedCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);
  const [initialBookingType, setInitialBookingType] = useState<CoachBookingSessionType | null>(null);

  useEffect(() => {
    if (!enabled) {
      setAssignedCoaches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch(withClientScope("/api/coaching/assigned-coaches"))
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setAssignedCoaches(d.coaches ?? []))
      .catch(() => setAssignedCoaches([]))
      .finally(() => setLoading(false));
  }, [enabled, withClientScope]);

  const openCoachDrawer = useCallback(
    (coach: AssignedCoach, bookingType: CoachBookingSessionType | null = null) => {
      setInitialBookingType(bookingType);
      setDrawerCoach(assignedCoachPreview(coach));
    },
    [],
  );

  const closeDrawer = useCallback(() => {
    setDrawerCoach(null);
    setInitialBookingType(null);
  }, []);

  if (!enabled || loading) return null;

  const padding = isMobile ? "16px 18px" : "18px 20px";

  return (
    <>
      {assignedCoaches.length === 0 && (
        <ScoutBox padding={padding} style={{ borderStyle: "dashed", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <p style={{ ...bruddleHeadingStyle("h5"), margin: 0 }}>My coaches</p>
            <SectionHelpTip
              text="Your Kimchi coach works with you one-on-one. When someone is assigned to you, they'll show up here."
              label="About My coaches"
            />
          </div>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55, margin: 0 }}>
            No coach assigned yet. When your team adds one, they&apos;ll appear here.
          </p>
          <ScoutSecondaryBtn
            onClick={() => router.push(withClientReviewPath("/coaching/my-coaches"))}
            style={{ minHeight: 40, width: "100%" }}
          >
            View coaches
          </ScoutSecondaryBtn>
        </ScoutBox>
      )}

      {assignedCoaches.length > 0 && (
        <ScoutBox padding={padding} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <SectionHeadingWithHelp
            title="My coaches"
            help="Coaches assigned to work with you one-on-one."
          />
          {assignedCoaches.map((coach) => (
            <div
              key={coach.coachProfileId}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                paddingBottom: assignedCoaches.length > 1 ? 12 : 0,
                borderBottom: assignedCoaches.length > 1 ? "var(--scout-border)" : undefined,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
                    {coach.displayName}
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.45 }}>
                    {coach.headline?.slice(0, 80) ?? "Book your intro call to get started."}
                  </p>
                </div>
              </div>
              <ScoutPrimaryBtn
                onClick={() => openCoachDrawer(coach, coach.hasNylasBooking ? "intro" : null)}
                style={{ minHeight: 38, width: "100%" }}
              >
                {coach.hasNylasBooking ? "Book →" : "View →"}
              </ScoutPrimaryBtn>
            </div>
          ))}
        </ScoutBox>
      )}

      {drawerCoach && (
        <CoachDrawer
          slug={drawerCoach.slug ?? drawerCoach.id}
          preview={drawerCoach}
          onClose={closeDrawer}
          initialBookingType={initialBookingType}
        />
      )}
    </>
  );
}
