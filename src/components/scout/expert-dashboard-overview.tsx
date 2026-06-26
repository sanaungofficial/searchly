"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";
import { EXPERT_WORKSPACE_NAV } from "@/lib/staff-portal";

type HubPayload = {
  stats?: {
    upcomingSessions?: number;
    activeClients?: number;
    sessionsThisMonth?: number;
  };
  upcomingBookings?: Array<{
    id: string;
    title: string | null;
    startAt: string;
    guestName: string | null;
    guestEmail: string | null;
  }>;
};

export function ExpertDashboardOverview({ isMobile = false }: { isMobile?: boolean }) {
  const [hub, setHub] = useState<HubPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/coach/hub")
      .then(async (r) => (r.ok ? r.json() : null))
      .then(setHub)
      .catch(() => setHub(null))
      .finally(() => setLoading(false));
  }, []);

  const stats = hub?.stats;
  const upcoming = hub?.upcomingBookings?.slice(0, 4) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ScoutBox padding={isMobile ? "16px 18px" : "18px 22px"}>
        <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Expert workspace
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 16px", lineHeight: 1.55 }}>
          Your client requests, offerings, and ops — switch back to job seeker view anytime from the header.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXPERT_WORKSPACE_NAV.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              style={{
                fontFamily: fontSans,
                fontSize: 13,
                fontWeight: 600,
                color: color.forest,
                textDecoration: "none",
                padding: "8px 14px",
                border: border.line,
                borderRadius: "var(--scout-radius)",
                background: surface.card,
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </ScoutBox>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 12 }}>
        {[
          { label: "Upcoming sessions", value: loading ? "…" : String(stats?.upcomingSessions ?? 0) },
          { label: "Active clients", value: loading ? "…" : String(stats?.activeClients ?? 0) },
          { label: "Sessions this month", value: loading ? "…" : String(stats?.sessionsThisMonth ?? 0) },
        ].map((stat) => (
          <ScoutBox key={stat.label} padding={16}>
            <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: "0 0 6px" }}>{stat.label}</p>
            <p style={{ fontFamily: fontSans, fontSize: 28, fontWeight: 600, color: color.forest, margin: 0 }}>{stat.value}</p>
          </ScoutBox>
        ))}
      </div>

      <ScoutBox padding={isMobile ? "16px 18px" : "18px 22px"}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <p style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 600, color: color.ink, margin: 0 }}>Upcoming sessions</p>
          <Link href="/expert/ops?section=bookings" style={{ fontFamily: fontSans, fontSize: 13, color: color.forest, fontWeight: 600 }}>
            All bookings →
          </Link>
        </div>
        {loading ? (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: 0 }}>Loading…</p>
        ) : upcoming.length === 0 ? (
          <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 12px" }}>No upcoming sessions scheduled.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {upcoming.map((b) => (
              <div key={b.id} style={{ padding: "10px 12px", border: border.line, borderRadius: "var(--scout-radius)", background: surface.inset }}>
                <p style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, margin: "0 0 4px", color: color.stone }}>
                  {b.title ?? "Session"}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: 12, color: color.muted, margin: 0 }}>
                  {new Date(b.startAt).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  {" · "}
                  {b.guestName ?? b.guestEmail ?? "Client"}
                </p>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
          <Link href="/expert/ops?section=clients" style={{ textDecoration: "none" }}>
            <ScoutPrimaryBtn type="button">View clients</ScoutPrimaryBtn>
          </Link>
          <Link href="/expert/inbox" style={{ textDecoration: "none" }}>
            <ScoutSecondaryBtn type="button">Open inbox</ScoutSecondaryBtn>
          </Link>
        </div>
      </ScoutBox>
    </div>
  );
}
