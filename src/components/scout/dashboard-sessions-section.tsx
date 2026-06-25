"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BookingRow } from "@/lib/booking-display";
import { BookingsList } from "@/components/scout/bookings-list";
import { ScoutBox, ScoutLabel } from "@/components/scout/scout-box";
import { color, fontSans, type as T } from "@/lib/typography";

type Props = {
  isMobile: boolean;
  isPro: boolean;
};

export function DashboardSessionsSection({ isMobile, isPro }: Props) {
  const router = useRouter();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isPro) {
      setLoaded(true);
      return;
    }
    fetch("/api/bookings/me?upcoming=true&limit=3")
      .then((r) => (r.ok ? r.json() : { bookings: [] }))
      .then((d) => setBookings(d.bookings ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [isPro]);

  if (!loaded) return null;

  return (
    <div style={{ marginBottom: isMobile ? 28 : 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
          <ScoutLabel>My coaching sessions</ScoutLabel>
        </div>
        {isPro && bookings.length > 0 && (
          <button
            type="button"
            onClick={() => router.push("/coaching")}
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
            Book another →
          </button>
        )}
      </div>

      {!isPro ? (
        <ScoutBox padding={isMobile ? "20px 18px" : "24px 22px"}>
          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.6 }}>
            Subscribe to book coaching sessions and see upcoming appointments here.
          </p>
        </ScoutBox>
      ) : (
        <ScoutBox padding={isMobile ? "16px 16px" : "18px 20px"}>
          <BookingsList
            bookings={bookings}
            emptyMessage="No upcoming sessions. Browse the coaching directory to book time with a coach."
            showCoach
            showGuest={false}
            onReschedule={(ref) => router.push(`/coaching/reschedule/${encodeURIComponent(ref)}`)}
          />
        </ScoutBox>
      )}
    </div>
  );
}
