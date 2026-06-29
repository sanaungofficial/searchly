"use client";

import { useEffect, useMemo, useState } from "react";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { ClientBookingDetailDrawer } from "@/components/scout/client-booking-detail-drawer";
import { ScoutBox } from "@/components/scout/scout-box";
import { useWorkspace } from "@/contexts/workspace-context";
import type { BookingRow } from "@/lib/booking-display";
import {
  bookingStatusColor,
  bookingStatusLabel,
  formatBookingWhen,
} from "@/lib/booking-display";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

function bookingTypeLabel(title: string | null): string {
  const t = title?.trim().toLowerCase() ?? "";
  if (t.includes("intro")) return "Intro";
  if (t.includes("trial")) return "Trial";
  return title?.trim() || "Coaching";
}

export function CoachingBookingsPanel({ isMobile = false }: { isMobile?: boolean }) {
  const { withClientScope } = useWorkspace();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(withClientScope("/api/bookings/me?upcoming=true&limit=50")).then((r) =>
        r.ok ? r.json() : { bookings: [] },
      ),
      fetch(withClientScope("/api/bookings/me?upcoming=false&limit=50")).then((r) =>
        r.ok ? r.json() : { bookings: [] },
      ),
    ])
      .then(([up, past]) => {
        const merged = [...(up.bookings ?? []), ...(past.bookings ?? [])] as BookingRow[];
        merged.sort((a, b) => b.startAt.localeCompare(a.startAt));
        setBookings(merged);
      })
      .catch(() => setBookings([]))
      .finally(() => setLoading(false));
  }, [withClientScope]);

  const upcomingCount = useMemo(
    () => bookings.filter((b) => new Date(b.startAt) >= new Date() && b.status !== "CANCELLED").length,
    [bookings],
  );

  if (loading) {
    return <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: 0 }}>Loading bookings…</p>;
  }

  return (
    <>
      <div style={{ marginBottom: isMobile ? 16 : 20 }}>
        <h1 style={{ ...displayTitleStyle(isMobile ? 22 : 26), margin: "0 0 8px" }}>Bookings</h1>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.55 }}>
          {upcomingCount > 0
            ? `${upcomingCount} upcoming · all meetings booked through Kimchi`
            : "All meetings booked through Kimchi — with any coach."}
        </p>
      </div>

      {bookings.length === 0 ? (
        <ScoutBox padding={isMobile ? 20 : 28} style={{ textAlign: "center" }}>
          <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, margin: 0, lineHeight: 1.55 }}>
            No bookings yet. Browse the coaching directory to book time with a coach.
          </p>
        </ScoutBox>
      ) : (
        <ScoutBox padding={0} style={{ overflow: "hidden" }}>
          {!isMobile && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 100px 100px",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "var(--scout-border)",
                background: surface.inset,
              }}
            >
              {["Coach", "Date & time", "Type", "Status"].map((h) => (
                <span
                  key={h}
                  style={{
                    fontFamily: fontMono,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: color.muted,
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          )}

          {bookings.map((b, i) => {
            const { date, time } = formatBookingWhen(b.startAt, b.endAt);
            const statusStyle = bookingStatusColor(b.status);
            const notesPreview = b.title?.trim() || null;

            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                style={{
                  display: isMobile ? "flex" : "grid",
                  gridTemplateColumns: isMobile ? undefined : "minmax(0, 1.4fr) minmax(0, 1fr) 100px 100px",
                  flexDirection: isMobile ? "column" : undefined,
                  gap: isMobile ? 8 : 12,
                  alignItems: isMobile ? "stretch" : "center",
                  width: "100%",
                  padding: isMobile ? "14px 16px" : "12px 16px",
                  background: "transparent",
                  border: "none",
                  borderBottom: i < bookings.length - 1 ? "var(--scout-border)" : undefined,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.12s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(26,58,47,0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <CoachAvatar name={b.coachName} photoUrl={b.coachPhotoUrl ?? null} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.ink, margin: 0 }}>
                      {b.coachName}
                    </p>
                    {notesPreview && isMobile && (
                      <p
                        style={{
                          fontFamily: fontSans,
                          fontSize: 12,
                          color: color.muted,
                          margin: "2px 0 0",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {notesPreview}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, margin: 0 }}>{date}</p>
                  <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "2px 0 0" }}>{time}</p>
                </div>

                {!isMobile && (
                  <span style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                    {bookingTypeLabel(b.title)}
                  </span>
                )}

                <span
                  style={{
                    alignSelf: isMobile ? "flex-start" : undefined,
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
              </button>
            );
          })}
        </ScoutBox>
      )}

      <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "10px 0 0", lineHeight: 1.5 }}>
        Tap a row for details, notes, and shared files.
      </p>

      {selectedId && (
        <ClientBookingDetailDrawer bookingId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
