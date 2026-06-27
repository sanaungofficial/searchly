"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { bookingStatusColor, bookingStatusLabel, formatBookingWhen } from "@/lib/booking-display";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, fontMono, fontSans } from "@/lib/typography";

function activityLabel(type: string): string {
  switch (type) {
    case "GUEST_CONFIRMATION":
      return "Session confirmed";
    case "CANCELLATION":
    case "SESSION_CANCELLED":
      return "Session cancelled";
    case "SESSION_RESCHEDULED":
      return "Session rescheduled";
    case "SESSION_BOOKED":
      return "Session booked";
    case "COACH_ASSIGNED":
      return "Coach matched";
    default:
      return "Update";
  }
}

function activityWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

type CoachBooking = {
  id: string;
  coachProfileId: string;
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
};

type ActivityItem = {
  id: string;
  subject: string;
  bodyPreview: string | null;
  createdAt: string;
  type: string;
  coachName: string;
};

type ClientCoachRow = {
  coachProfileId: string;
  displayName: string;
  slug: string | null;
  upcomingBookings: CoachBooking[];
  communications: Array<{
    id: string;
    subject: string;
    bodyPreview: string | null;
    createdAt: string;
    type: string;
  }>;
};

function sessionTitle(title: string | null): string {
  const trimmed = title?.trim();
  if (!trimmed) return "Coaching session";
  return trimmed;
}

function ClientSessionRow({
  booking,
  onReschedule,
  onCancel,
}: {
  booking: CoachBooking;
  onReschedule: (ref: string) => void;
  onCancel: (ref: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { date, time } = formatBookingWhen(booking.startAt, booking.endAt);
  const statusStyle = bookingStatusColor(booking.status);
  const title = sessionTitle(booking.title);

  return (
    <ScoutBox padding={0} style={{ overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 12,
          alignItems: "center",
          padding: "12px 14px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, lineHeight: 1.4 }}>
            {title}
          </p>
        </div>
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.stone, lineHeight: 1.45 }}>
            {date}
          </p>
          <p style={{ margin: "2px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.45 }}>
            {time} · with {booking.coachName}
          </p>
        </div>
      </button>

      {open && (
        <div style={{ borderTop: border.line, padding: "12px 14px 14px", background: "rgba(26,58,47,0.02)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
            <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
              {date} · {time}
            </p>
            <span
              style={{
                fontSize: 11,
                fontFamily: fontMono,
                padding: "3px 8px",
                background: statusStyle.bg,
                color: statusStyle.color,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {bookingStatusLabel(booking.status)}
            </span>
          </div>
          <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 13, color: color.forest }}>
            With {booking.coachName}
          </p>
          {booking.location && (
            <p style={{ margin: "0 0 10px", fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.5 }}>
              {booking.location}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {booking.nylasBookingRef && booking.status !== "CANCELLED" && (
              <>
                <button
                  type="button"
                  onClick={() => onReschedule(booking.nylasBookingRef!)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: fontSans,
                    fontSize: 13,
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
                  onClick={() => onCancel(booking.nylasBookingRef!)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontFamily: fontSans,
                    fontSize: 13,
                    color: color.muted,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: 3,
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </ScoutBox>
  );
}

export function MyCoachesPanel({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { withClientScope } = useWorkspace();
  const [coaches, setCoaches] = useState<ClientCoachRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(withClientScope("/api/coaching/my-coaches"))
      .then((r) => (r.ok ? r.json() : { coaches: [] }))
      .then((d) => setCoaches(d.coaches ?? []))
      .catch(() => setCoaches([]))
      .finally(() => setLoading(false));
  }, [withClientScope]);

  const upcomingSessions = useMemo(() => {
    return coaches
      .flatMap((coach) =>
        coach.upcomingBookings.map((b) => ({
          ...b,
          coachName: coach.displayName,
          coachSlug: coach.slug,
          coachProfileId: coach.coachProfileId,
        })),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [coaches]);

  const activity = useMemo(() => {
    const items: ActivityItem[] = coaches.flatMap((coach) =>
      coach.communications.map((c) => ({
        ...c,
        coachName: coach.displayName,
      })),
    );
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  }, [coaches]);

  if (loading) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>Loading sessions…</p>;
  }

  const hasSessions = upcomingSessions.length > 0;
  const hasActivity = activity.length > 0;

  if (!hasSessions && !hasActivity) {
    return (
      <ScoutBox padding={compact ? 16 : 20}>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.6 }}>
          No upcoming sessions yet. Book from your matched coach above or the{" "}
          <button
            type="button"
            onClick={() => router.push("/coaching")}
            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: color.forest, cursor: "pointer", textDecoration: "underline" }}
          >
            coaching directory
          </button>
          .
        </p>
      </ScoutBox>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: compact ? 20 : 24 }}>
      <div>
        <p style={{ margin: "0 0 10px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
          Upcoming sessions
        </p>
        {!hasSessions ? (
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.55 }}>
            No upcoming sessions scheduled.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcomingSessions.map((booking) => (
              <ClientSessionRow
                key={booking.id}
                booking={booking}
                onReschedule={(ref) => router.push(`/coaching/reschedule/${encodeURIComponent(ref)}`)}
                onCancel={(ref) => router.push(`/coaching/cancel/${encodeURIComponent(ref)}`)}
              />
            ))}
          </div>
        )}
        <p style={{ margin: "10px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.5 }}>
          Tap a session for details, reschedule, or cancel.
        </p>
      </div>

      <div>
        <p style={{ margin: "0 0 10px", fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
          Activity
        </p>
        {!hasActivity ? (
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted, lineHeight: 1.55 }}>
            Booking confirmations and shared updates will appear here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {activity.map((item) => (
              <ScoutBox key={item.id} flat padding="10px 12px">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                  <p style={{ margin: 0, fontFamily: fontMono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: color.forest }}>
                    {activityLabel(item.type)}
                  </p>
                  <span style={{ fontFamily: fontMono, fontSize: 10, color: color.stone, flexShrink: 0 }}>
                    {activityWhen(item.createdAt)}
                  </span>
                </div>
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: color.forest }}>
                  {item.subject}
                </p>
                {item.bodyPreview && (
                  <p style={{ margin: "4px 0 0", fontFamily: fontSans, fontSize: 12, color: color.muted, lineHeight: 1.45 }}>
                    {item.bodyPreview}
                  </p>
                )}
                <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 11, color: color.stone }}>
                  with {item.coachName}
                </p>
              </ScoutBox>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
