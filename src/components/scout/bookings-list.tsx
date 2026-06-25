"use client";

import { useRouter } from "next/navigation";
import type { BookingRow } from "@/lib/booking-display";
import { bookingStatusColor, bookingStatusLabel, formatBookingWhen } from "@/lib/booking-display";
import { border, color, fontMono, fontSans, type as T } from "@/lib/typography";

type Props = {
  bookings: BookingRow[];
  emptyMessage: string;
  showCoach?: boolean;
  showGuest?: boolean;
  onReschedule?: (bookingRef: string) => void;
};

export function BookingsList({ bookings, emptyMessage, showCoach = false, showGuest = true, onReschedule }: Props) {
  const router = useRouter();

  if (bookings.length === 0) {
    return (
      <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0, padding: "8px 0" }}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {bookings.map((b) => {
        const { date, time } = formatBookingWhen(b.startAt, b.endAt);
        const statusStyle = bookingStatusColor(b.status);
        return (
          <div
            key={b.id}
            style={{
              border: border.line,
              background: "#fff",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                {showCoach && (
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
                    {b.coachName}
                  </p>
                )}
                {showGuest && (b.guestName || b.guestEmail) && (
                  <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>
                    {b.guestName ?? b.guestEmail}
                  </p>
                )}
                <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                  {b.title ?? "Coaching session"}
                </p>
              </div>
              <span
                style={{
                  alignSelf: "flex-start",
                  fontSize: 11,
                  fontFamily: fontMono,
                  padding: "3px 8px",
                  background: statusStyle.bg,
                  color: statusStyle.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {bookingStatusLabel(b.status)}
              </span>
            </div>
            <p style={{ margin: "0 0 8px", fontFamily: fontSans, fontSize: 13, color: color.stone }}>
              {date} · {time}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {showCoach && b.coachSlug && (
                <button
                  type="button"
                  onClick={() => router.push(`/coaching/coach/${b.coachSlug}`)}
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
                  View coach
                </button>
              )}
              {b.nylasBookingRef && onReschedule && b.status !== "CANCELLED" && (
                <>
                  <button
                    type="button"
                    onClick={() => onReschedule(b.nylasBookingRef!)}
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
                    onClick={() => router.push(`/coaching/cancel/${encodeURIComponent(b.nylasBookingRef!)}`)}
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
        );
      })}
    </div>
  );
}
