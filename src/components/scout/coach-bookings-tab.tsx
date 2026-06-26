"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { BookingRow } from "@/lib/booking-display";
import { BookingsList } from "@/components/scout/bookings-list";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, displayTitleStyle, fontSans } from "@/lib/typography";

export function CoachBookingsTab() {
  const [upcoming, setUpcoming] = useState<BookingRow[]>([]);
  const [past, setPast] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/coach/bookings?upcoming=true&limit=20").then((r) => (r.ok ? r.json() : { bookings: [] })),
      fetch("/api/coach/bookings?upcoming=false&limit=20").then((r) => (r.ok ? r.json() : { bookings: [] })),
    ])
      .then(([up, down]) => {
        setUpcoming(
          (up.bookings ?? []).map((b: BookingRow) => ({
            ...b,
            coachName: "Guest",
          })),
        );
        setPast(
          (down.bookings ?? []).map((b: BookingRow) => ({
            ...b,
            coachName: "Guest",
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: color.muted, fontSize: 14, padding: "24px 0" }}>Loading bookings…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <h1 style={{ ...displayTitleStyle(28), margin: "0 0 8px" }}>Calendar</h1>
          <p style={{ margin: 0, fontFamily: fontSans, fontSize: 14, color: color.muted, lineHeight: 1.6 }}>
            Sessions booked through Kimchi and your connected Google or Outlook calendar.
          </p>
        </div>
        <Link
          href="/dashboard/availability"
          style={{
            fontFamily: fontSans,
            fontSize: 14,
            fontWeight: 600,
            color: color.forest,
            textDecoration: "none",
            padding: "10px 16px",
            border: border.line,
            background: "#fff",
            flexShrink: 0,
          }}
        >
          Edit availability
        </Link>
      </div>

      <ScoutBox padding={20}>
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Upcoming
        </p>
        <BookingsList
          bookings={upcoming.map((b) => ({ ...b, coachName: b.guestName ?? b.guestEmail ?? "Guest" }))}
          emptyMessage="No upcoming sessions."
          showGuest
          showCoach={false}
        />
      </ScoutBox>

      <ScoutBox padding={20}>
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, color: color.forest, margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Past
        </p>
        <BookingsList
          bookings={past.map((b) => ({ ...b, coachName: b.guestName ?? b.guestEmail ?? "Guest" }))}
          emptyMessage="No past sessions yet."
          showGuest
          showCoach={false}
        />
      </ScoutBox>
    </div>
  );
}
