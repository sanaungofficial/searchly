"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { CoachDrawer } from "@/components/scout/coach-drawer";
import type { CoachBookingSessionType } from "@/components/scout/coach-booking-modal";
import { SectionHeadingWithHelp, SectionHelpTip } from "@/components/scout/section-help-tip";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { useWorkspace } from "@/contexts/workspace-context";
import { formatBookingWhen } from "@/lib/coach-user-booking";
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

type BookedCoach = {
  bookingId: string;
  nylasBookingRef: string | null;
  startAt: string;
  endAt: string;
  status: string;
  title: string | null;
  coach: {
    id: string;
    slug: string | null;
    displayName: string;
    photoUrl: string | null;
    headline: string | null;
  };
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
  const [bookedCoach, setBookedCoach] = useState<BookedCoach | null>(null);
  const [assignedCoaches, setAssignedCoaches] = useState<AssignedCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerCoach, setDrawerCoach] = useState<CoachListItem | null>(null);
  const [initialBookingType, setInitialBookingType] = useState<CoachBookingSessionType | null>(null);

  useEffect(() => {
    if (!enabled) {
      setBookedCoach(null);
      setAssignedCoaches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const assignedPromise = fetch(withClientScope("/api/coaching/assigned-coaches"))
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setAssignedCoaches(d.coaches ?? []))
      .catch(() => setAssignedCoaches([]));

    const bookingPromise = fetch(withClientScope("/api/bookings/me?upcoming=true&limit=1"))
      .then((r) => (r.ok ? r.json() : null))
      .then(async (d) => {
        let row = d?.bookings?.[0];
        if (!row) {
          const pastRes = await fetch(withClientScope("/api/bookings/me?upcoming=false&limit=1"));
          const pastData = pastRes.ok ? await pastRes.json() : null;
          row = pastData?.bookings?.[0];
        }
        if (!row) {
          setBookedCoach(null);
          return;
        }
        setBookedCoach({
          bookingId: row.id,
          nylasBookingRef: row.nylasBookingRef ?? null,
          startAt: row.startAt,
          endAt: row.endAt,
          status: row.status,
          title: row.title ?? null,
          coach: {
            id: row.coachProfileId,
            slug: row.coachSlug ?? null,
            displayName: row.coachName,
            photoUrl: row.coachPhotoUrl ?? null,
            headline: null,
          },
        });
      })
      .catch(() => setBookedCoach(null));

    Promise.all([assignedPromise, bookingPromise]).finally(() => setLoading(false));
  }, [enabled, withClientScope]);

  const openCoachDrawer = useCallback(
    (coach: AssignedCoach | BookedCoach["coach"], bookingType: CoachBookingSessionType | null = null) => {
      const assigned =
        "coachProfileId" in coach
          ? coach
          : assignedCoaches.find((c) => c.coachProfileId === coach.id) ?? {
              coachProfileId: coach.id,
              displayName: coach.displayName,
              slug: coach.slug,
              photoUrl: coach.photoUrl,
              headline: coach.headline,
              isInternal: false,
              hasNylasBooking: false,
            };
      setInitialBookingType(bookingType);
      setDrawerCoach(assignedCoachPreview(assigned));
    },
    [assignedCoaches],
  );

  const closeDrawer = useCallback(() => {
    setDrawerCoach(null);
    setInitialBookingType(null);
  }, []);

  if (!enabled || loading) return null;

  const padding = isMobile ? "16px 18px" : "18px 20px";

  return (
    <>
      {!bookedCoach && assignedCoaches.length === 0 && (
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
            help="Your Kimchi coach works with you one-on-one."
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
                onClick={() =>
                  openCoachDrawer(coach, coach.hasNylasBooking ? "intro" : null)
                }
                style={{ minHeight: 38, width: "100%" }}
              >
                {coach.hasNylasBooking ? "Book →" : "View →"}
              </ScoutPrimaryBtn>
            </div>
          ))}
        </ScoutBox>
      )}

      {bookedCoach && (
        <ScoutBox padding={padding} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeadingWithHelp title="My coaches" help="Your Kimchi coach works with you one-on-one." />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <CoachAvatar name={bookedCoach.coach.displayName} photoUrl={bookedCoach.coach.photoUrl} size={44} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 4px" }}>
                {new Date(bookedCoach.startAt) >= new Date() ? "Upcoming session" : "Recent session"}
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.ink, margin: "0 0 4px" }}>
                {bookedCoach.coach.displayName}
              </p>
              <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>
                {new Date(bookedCoach.startAt) >= new Date()
                  ? formatBookingWhen(bookedCoach.startAt)
                  : `Last · ${formatBookingWhen(bookedCoach.startAt)}`}
              </p>
            </div>
          </div>
          <ScoutSecondaryBtn
            onClick={() => openCoachDrawer(bookedCoach.coach)}
            style={{ minHeight: 38, width: "100%" }}
          >
            View coach →
          </ScoutSecondaryBtn>
          {bookedCoach.nylasBookingRef && new Date(bookedCoach.startAt) >= new Date() && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => router.push(`/coaching/reschedule/${encodeURIComponent(bookedCoach.nylasBookingRef!)}`)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  color: color.forest,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={() => router.push(`/coaching/cancel/${encodeURIComponent(bookedCoach.nylasBookingRef!)}`)}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  color: color.muted,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                Cancel
              </button>
            </div>
          )}
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
