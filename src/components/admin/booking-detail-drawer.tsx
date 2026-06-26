"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { ScoutBox } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatBookingWhen, bookingStatusColor } from "@/lib/booking-display";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

const DRAWER_WIDTH = "min(720px, calc(100vw - 16px))";

type BookingDetail = {
  id: string;
  coachProfileId: string;
  coachName: string;
  coachSlug: string | null;
  coachEmail: string | null;
  coachPhotoUrl: string | null;
  coachIsInternal: boolean;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  title: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  status: string;
  nylasBookingRef: string | null;
  durationMinutes: number;
  createdAt: string;
};

type Comm = {
  id: string;
  type: string;
  subject: string;
  bodyPreview: string | null;
  createdAt: string;
};

type Props = {
  bookingId: string;
  onClose: () => void;
  onOpenGuestHub?: (guest: { userId: string | null; email: string; name: string | null }) => void;
  onOpenCoachHub?: (coachId: string) => void;
};

export function BookingDetailDrawer({ bookingId, onClose, onOpenGuestHub, onOpenCoachHub }: Props) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [communications, setCommunications] = useState<Comm[]>([]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/bookings/${bookingId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load booking");
        return r.json();
      })
      .then((d) => {
        setBooking(d.booking);
        setCommunications(d.communications ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [bookingId]);

  return (
    <>
      <div onClick={close} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.18)", zIndex: 60 }} />
      <div
        style={{
          position: "fixed",
          top: isMobile ? 0 : 8,
          right: isMobile ? 0 : 8,
          bottom: isMobile ? 0 : 8,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          zIndex: 70,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 20px",
            background: surface.card,
            borderBottom: border.line,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h2 style={{ ...displayTitleStyle(18), margin: 0 }}>Booking detail</h2>
          <button type="button" onClick={close} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 24 }}>
          {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading…</p>}
          {error && <p style={{ fontFamily: fontSans, color: "#dc2626" }}>{error}</p>}
          {booking && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
                <CoachAvatar name={booking.coachName} photoUrl={booking.coachPhotoUrl} size={52} />
                <div>
                  <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
                    {booking.title ?? "Coaching session"}
                  </p>
                  <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "6px 0 0", lineHeight: 1.5 }}>
                    {formatBookingWhen(booking.startAt, booking.endAt).date} · {formatBookingWhen(booking.startAt, booking.endAt).time} · {booking.durationMinutes} min
                  </p>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
                <Row label="Status">
                  <span style={{ color: bookingStatusColor(booking.status).color, fontWeight: 600 }}>
                    {booking.status.toLowerCase()}
                  </span>
                </Row>
                <Row label="Coach">
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {booking.coachName}
                    {booking.coachIsInternal && <InternalCoachBadge compact />}
                    {onOpenCoachHub && (
                      <button
                        type="button"
                        onClick={() => onOpenCoachHub(booking.coachProfileId)}
                        style={{ background: "none", border: "none", padding: 0, color: color.forest, cursor: "pointer", fontFamily: fontSans, fontSize: 13, textDecoration: "underline" }}
                      >
                        Expert hub →
                      </button>
                    )}
                    {booking.coachSlug && (
                      <Link href={`/admin/coaches/${booking.coachProfileId}`} style={{ fontFamily: fontSans, fontSize: 13, color: color.forest }}>
                        Admin →
                      </Link>
                    )}
                  </span>
                </Row>
                <Row label="Guest">
                  <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {booking.guestName ?? "—"}
                    {booking.guestEmail && (
                      <span style={{ color: color.muted, fontSize: 13 }}>{booking.guestEmail}</span>
                    )}
                    {onOpenGuestHub && booking.guestEmail && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenGuestHub({
                            userId: booking.userId,
                            email: booking.guestEmail!,
                            name: booking.guestName,
                          })
                        }
                        style={{ background: "none", border: "none", padding: 0, color: color.forest, cursor: "pointer", fontFamily: fontSans, fontSize: 13, textDecoration: "underline" }}
                      >
                        Guest hub →
                      </button>
                    )}
                  </span>
                </Row>
                {booking.location && <Row label="Location">{booking.location}</Row>}
                {booking.nylasBookingRef && <Row label="Nylas ref">{booking.nylasBookingRef}</Row>}
              </div>

              {communications.length > 0 && (
                <div>
                  <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
                    Communications
                  </p>
                  <ScoutBox padding={0}>
                    {communications.map((c) => (
                      <div key={c.id} style={{ padding: "12px 14px", borderBottom: border.line }}>
                        <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{c.subject}</p>
                        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                          {c.type} · {new Date(c.createdAt).toLocaleString()}
                        </p>
                        {c.bodyPreview && (
                          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.stone, margin: "6px 0 0", lineHeight: 1.5 }}>
                            {c.bodyPreview}
                          </p>
                        )}
                      </div>
                    ))}
                  </ScoutBox>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 12, alignItems: "start" }}>
      <span style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
        {label}
      </span>
      <span style={{ fontFamily: fontSans, fontSize: 14 }}>{children}</span>
    </div>
  );
}
