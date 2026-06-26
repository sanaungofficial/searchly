"use client";

import { useEffect, useState } from "react";
import { BookingDetailDrawer } from "@/components/admin/booking-detail-drawer";
import { CoachHubDrawer } from "@/components/admin/coach-hub-drawer";
import { GuestHubDrawer } from "@/components/admin/guest-hub-drawer";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

type BookingRow = {
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
};

type GuestPreview = {
  userId: string | null;
  email: string;
  name: string | null;
};

function formatWhen(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const date = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const time = `${s.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – ${e.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return { date, time };
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [guestHub, setGuestHub] = useState<GuestPreview | null>(null);
  const [coachHubId, setCoachHubId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load bookings");
        return r.json();
      })
      .then((d) => setBookings(d.bookings ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 style={{ ...displayTitleStyle(28), margin: "0 0 20px" }}>Bookings</h1>

      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 20px" }}>
        Coaching sessions booked through Nylas Scheduler. Click a row for details, guest hub, or coach hub.
      </p>

      {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading bookings…</p>}
      {error && <p style={{ fontFamily: fontSans, color: "#dc2626" }}>{error}</p>}

      {!loading && !error && bookings.length === 0 && (
        <ScoutBox padding={24}>
          <p style={{ fontFamily: fontSans, fontSize: 15, color: color.muted, margin: 0 }}>
            No bookings yet. Once coaches connect calendars and seekers book sessions, they will appear here.
          </p>
        </ScoutBox>
      )}

      {!loading && bookings.length > 0 && (
        <ScoutBox padding={0} style={{ overflow: "hidden" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 1fr 1fr 1fr 100px",
              gap: 12,
              padding: "12px 16px",
              borderBottom: border.line,
              fontFamily: fontMono,
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: color.muted,
            }}
          >
            <span>When</span>
            <span>Coach</span>
            <span>Guest</span>
            <span>Session</span>
            <span>Status</span>
          </div>
          {bookings.map((b) => {
            const when = formatWhen(b.startAt, b.endAt);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedBookingId(b.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.2fr 1fr 1fr 1fr 100px",
                  gap: 12,
                  padding: "14px 16px",
                  alignItems: "start",
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  borderBottom: border.line,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div>
                  <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: 0 }}>{when.date}</p>
                  <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "2px 0 0" }}>{when.time}</p>
                </div>
                <p style={{ fontFamily: fontSans, fontSize: 14, margin: 0 }}>{b.coachName}</p>
                <div>
                  <p style={{ fontFamily: fontSans, fontSize: 14, margin: 0 }}>{b.guestName ?? "—"}</p>
                  {b.guestEmail && (
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0" }}>{b.guestEmail}</p>
                  )}
                </div>
                <div>
                  <p style={{ fontFamily: fontSans, fontSize: 14, margin: 0 }}>{b.title ?? "Coaching session"}</p>
                  {b.location && (
                    <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0", wordBreak: "break-all" }}>
                      {b.location}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: fontMono,
                    fontSize: 11,
                    textTransform: "uppercase",
                    color: b.status === "CANCELLED" ? "#dc2626" : color.forest,
                  }}
                >
                  {b.status.toLowerCase()}
                </span>
              </button>
            );
          })}
        </ScoutBox>
      )}

      {selectedBookingId && (
        <BookingDetailDrawer
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onOpenGuestHub={(guest) => {
            setSelectedBookingId(null);
            setGuestHub(guest);
          }}
          onOpenCoachHub={(coachId) => {
            setSelectedBookingId(null);
            setCoachHubId(coachId);
          }}
        />
      )}

      {guestHub && (
        <GuestHubDrawer
          guest={guestHub}
          onClose={() => setGuestHub(null)}
          onOpenCoachHub={(coachId) => {
            setGuestHub(null);
            setCoachHubId(coachId);
          }}
        />
      )}

      {coachHubId && (
        <CoachHubDrawer
          coachId={coachHubId}
          onClose={() => setCoachHubId(null)}
        />
      )}
    </div>
  );
}
