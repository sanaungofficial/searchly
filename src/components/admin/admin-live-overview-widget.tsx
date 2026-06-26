"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ScoutBox } from "@/components/scout/scout-box";
import { border, color, fontSans, type as T } from "@/lib/typography";

type LiveOverview = {
  liveNowCount: number;
  activeAttendees: number;
  scheduledCount: number;
  totalRegistrations: number;
};

export function AdminLiveOverviewWidget() {
  const [overview, setOverview] = useState<LiveOverview | null>(null);

  useEffect(() => {
    fetch("/api/admin/live")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setOverview(d?.overview ?? null))
      .catch(() => {});
  }, []);

  if (!overview) return null;

  return (
    <ScoutBox padding={16} style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 700, color: color.muted, margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Live sessions
          </p>
          <p style={{ fontFamily: fontSans, fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: color.ink }}>
            {overview.liveNowCount > 0 ? (
              <span style={{ color: "#C4574A" }}>{overview.liveNowCount} live now</span>
            ) : (
              `${overview.scheduledCount} upcoming`
            )}
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0 }}>
            {overview.activeAttendees} in rooms · {overview.totalRegistrations} total RSVPs
          </p>
        </div>
        <Link
          href="/admin/live"
          style={{
            padding: "8px 14px",
            background: overview.liveNowCount > 0 ? "#C4574A" : color.forest,
            color: overview.liveNowCount > 0 ? "#fff" : color.gold,
            fontFamily: fontSans,
            fontSize: T.caption,
            fontWeight: 600,
            textDecoration: "none",
            border: border.lineStrong,
          }}
        >
          Manage →
        </Link>
      </div>
    </ScoutBox>
  );
}
