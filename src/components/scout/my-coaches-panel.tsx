"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { BookingsList } from "@/components/scout/bookings-list";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, fontMono, fontSans, type as T } from "@/lib/typography";

type ClientCoachRow = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  photoUrl: string | null;
  headline: string | null;
  sessionCount: number;
  completedCount: number;
  upcomingCount: number;
  lastSessionAt: string | null;
  nextSessionAt: string | null;
  isInternal?: boolean;
  isAssigned?: boolean;
  upcomingBookings: Array<{
    id: string;
    coachName: string;
    coachSlug: string | null;
    guestName: string | null;
    guestEmail: string | null;
    title: string | null;
    location: string | null;
    startAt: string;
    endAt: string;
    status: string;
    nylasBookingRef: string | null;
  }>;
  pastBookings: Array<{
    id: string;
    coachName: string;
    coachSlug: string | null;
    guestName: string | null;
    guestEmail: string | null;
    title: string | null;
    location: string | null;
    startAt: string;
    endAt: string;
    status: string;
    nylasBookingRef: string | null;
  }>;
  communications: Array<{
    id: string;
    subject: string;
    bodyPreview: string | null;
    createdAt: string;
    type: string;
  }>;
};

export function MyCoachesPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [coaches, setCoaches] = useState<ClientCoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coaching/my-coaches")
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setCoaches(d.coaches ?? []))
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>Loading your coaches…</p>;
  }

  if (coaches.length === 0) {
    return (
      <ScoutBox padding={compact ? 16 : 20}>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.6 }}>
          Book a coach from the{" "}
          <button
            type="button"
            onClick={() => router.push("/coaching")}
            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: color.forest, cursor: "pointer", textDecoration: "underline" }}
          >
            coaching directory
          </button>{" "}
          — your sessions and updates will show up here.
        </p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: compact ? 12 : 16 }}>
      {coaches.map((coach) => {
        const expanded = expandedId === coach.coachProfileId;
        return (
          <ScoutBox key={coach.coachProfileId} padding={compact ? 16 : 20}>
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : coach.coachProfileId)}
              style={{
                width: "100%",
                display: "flex",
                gap: 12,
                alignItems: "center",
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={compact ? 40 : 48} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: compact ? 15 : 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {coach.displayName}
                  {coach.isInternal && <InternalCoachBadge compact />}
                </p>
                {coach.headline && (
                  <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted }}>{coach.headline}</p>
                )}
                <p style={{ margin: "6px 0 0", fontFamily: fontMono, fontSize: 11, color: color.stone }}>
                  {coach.isAssigned && coach.sessionCount === 0
                    ? "Assigned Kimchi coach — book your first session"
                    : `${coach.sessionCount} session${coach.sessionCount === 1 ? "" : "s"}${coach.upcomingCount > 0 ? ` · ${coach.upcomingCount} upcoming` : ""}`}
                </p>
              </div>
              <span style={{ fontFamily: fontSans, fontSize: 12, color: color.forest }}>{expanded ? "Hide" : "View"}</span>
            </button>

            {expanded && (
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: 16 }}>
                <div>
                  <p style={{ margin: "0 0 10px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                    Upcoming
                  </p>
                  <BookingsList
                    bookings={coach.upcomingBookings.map((b) => ({ ...b, coachName: coach.displayName }))}
                    emptyMessage="No upcoming sessions."
                    showCoach={false}
                    showGuest={false}
                    onReschedule={(ref) => router.push(`/coaching/reschedule/${encodeURIComponent(ref)}`)}
                  />
                </div>
                <div>
                  <p style={{ margin: "0 0 10px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                    Updates
                  </p>
                  {coach.communications.length === 0 ? (
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted }}>No booking updates yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {coach.communications.slice(0, 5).map((c) => (
                        <div key={c.id} style={{ border: border.line, padding: "10px 12px", background: "#fff" }}>
                          <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 13, fontWeight: 600 }}>{c.subject}</p>
                          {c.bodyPreview && (
                            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 12, color: color.muted }}>{c.bodyPreview}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {coach.slug && (
                    <button
                      type="button"
                      onClick={() => router.push(`/coaching/coach/${coach.slug}`)}
                      style={{ marginTop: 12, background: "none", border: "none", padding: 0, fontFamily: fontSans, fontSize: 13, color: color.forest, cursor: "pointer", textDecoration: "underline" }}
                    >
                      Book again →
                    </button>
                  )}
                </div>
              </div>
            )}
          </ScoutBox>
        );
      })}
    </div>
  );
}
