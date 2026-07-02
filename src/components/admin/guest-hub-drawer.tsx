"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CoachAvatar } from "@/components/scout/coach-avatar";
import { BookingsList } from "@/components/scout/bookings-list";
import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { ScoutBox } from "@/components/scout/scout-box";
import { useWorkspaceDrawerLayout } from "@/hooks/use-workspace-drawer-layout";
import type { GuestHubPayload } from "@/lib/coach-hub";
import { border, color, displayTitleStyle, fontMono, fontSans, surface } from "@/lib/typography";
import { DRAWER_BACKDROP_Z, DRAWER_Z } from "@/lib/z-layers";

const DRAWER_WIDTH = "min(1180px, calc(100vw - 16px))";

type GuestPreview = {
  userId: string | null;
  email: string;
  name: string | null;
};

type Props = {
  guest: GuestPreview;
  onClose: () => void;
  onOpenCoachHub?: (coachId: string) => void;
};

export function GuestHubDrawer({ guest, onClose, onOpenCoachHub }: Props) {
  const { isMobile, backdropStyle, panelStyle } = useWorkspaceDrawerLayout();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GuestHubPayload | null>(null);

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
    const q = guest.userId
      ? `userId=${encodeURIComponent(guest.userId)}`
      : `email=${encodeURIComponent(guest.email)}`;
    fetch(`/api/admin/guest-hub?${q}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load guest hub");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, [guest.userId, guest.email]);

  const displayName = data?.guest.name ?? guest.name ?? guest.email.split("@")[0];

  return (
    <>
      <div onClick={close} style={{ ...backdropStyle, background: "rgba(0,0,0,0.18)", zIndex: DRAWER_BACKDROP_Z }} />
      <div
        style={{
          ...panelStyle,
          width: isMobile ? "100vw" : DRAWER_WIDTH,
          maxWidth: isMobile ? "100vw" : "calc(100vw - 16px)",
          background: surface.page,
          zIndex: DRAWER_Z,
          boxShadow: isMobile ? "none" : "3px 3px 0 rgba(17,17,17,0.08)",
          transform: visible ? "translateX(0)" : "translateX(calc(100% + 16px))",
          transition: "transform 0.25s ease",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 28px",
            background: surface.card,
            borderBottom: "var(--scout-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ ...displayTitleStyle(20), margin: "0 0 4px" }}>{displayName}</h2>
            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>{guest.email}</p>
          </div>
          <button type="button" onClick={close} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? 16 : 28 }}>
          {loading && <p style={{ fontFamily: fontSans, color: color.muted }}>Loading guest hub…</p>}
          {error && <p style={{ fontFamily: fontSans, color: "#dc2626" }}>{error}</p>}
          {data && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Total sessions", value: data.stats.totalSessions },
                  { label: "Completed", value: data.stats.completedSessions },
                  { label: "Upcoming", value: data.stats.upcomingSessions },
                  { label: "Coaches", value: data.stats.uniqueCoaches },
                ].map(({ label, value }) => (
                  <ScoutBox key={label} padding="14px 16px">
                    <p style={{ margin: 0, fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted }}>
                      {label}
                    </p>
                    <p style={{ margin: "6px 0 0", fontFamily: fontSans, fontSize: 24, fontWeight: 600, color: color.forest }}>{value}</p>
                  </ScoutBox>
                ))}
              </div>

              {data.assignedCoaches.length > 0 && (
                <section style={{ marginBottom: 28 }}>
                  <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
                    Assigned coaches
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.assignedCoaches.map((c) => (
                      <ScoutBox key={c.coachProfileId} padding={16}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <CoachAvatar name={c.displayName} photoUrl={c.photoUrl} size={44} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                              {c.displayName}
                              {c.isInternal && <InternalCoachBadge compact />}
                            </p>
                            <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>
                              Assigned {new Date(c.assignedAt).toLocaleDateString()}
                            </p>
                          </div>
                          {onOpenCoachHub && (
                            <button
                              type="button"
                              onClick={() => onOpenCoachHub(c.coachProfileId)}
                              style={{ background: "none", border: "var(--scout-border)", padding: "8px 12px", fontFamily: fontSans, fontSize: 13, cursor: "pointer", color: color.forest }}
                            >
                              Expert hub
                            </button>
                          )}
                        </div>
                      </ScoutBox>
                    ))}
                  </div>
                </section>
              )}

              <section style={{ marginBottom: 28 }}>
                <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
                  Upcoming
                </p>
                <BookingsList bookings={data.upcomingBookings} emptyLabel="No upcoming sessions" />
              </section>

              <section style={{ marginBottom: 28 }}>
                <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
                  Past sessions
                </p>
                <BookingsList bookings={data.pastBookings} emptyLabel="No past sessions" />
              </section>

              {data.communications.length > 0 && (
                <section>
                  <p style={{ fontFamily: fontMono, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: color.muted, margin: "0 0 12px" }}>
                    Communications
                  </p>
                  <ScoutBox padding={0}>
                    {data.communications.map((c) => (
                      <div key={c.id} style={{ padding: "12px 14px", borderBottom: "var(--scout-border)" }}>
                        <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>{c.subject}</p>
                        <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                          {c.coachName ?? "Coach"} · {c.type} · {new Date(c.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </ScoutBox>
                </section>
              )}

              {data.guest.userId && (
                <p style={{ marginTop: 24, fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                  <Link href="/expert/clients" style={{ color: color.forest }}>Open in clients →</Link>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
