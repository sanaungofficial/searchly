"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LiveSessionView } from "@/lib/live-session-types";
import { ScoutBox, ScoutPrimaryBtn } from "@/components/scout/scout-box";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, bruddleHeadingStyle, color, fontSans, type as T } from "@/lib/typography";

type PublicSession = LiveSessionView & { publicPath?: string };

export function PublicLiveCatalog() {
  const isMobile = useIsMobile();
  const [sessions, setSessions] = useState<PublicSession[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/live/public/sessions");
      const data = (await res.json().catch(() => ({}))) as { sessions?: PublicSession[] };
      setSessions(data.sessions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: isMobile ? "24px 16px 48px" : "40px 24px 64px" }}>
      <header style={{ marginBottom: 28 }}>
        <h1 style={{ ...bruddleHeadingStyle(isMobile ? "h4" : "h3"), margin: "0 0 8px", color: color.forest }}>
          Live webinars
        </h1>
        <p style={{ margin: 0, fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.55 }}>
          Free career workshops and live sessions from Second Ladder coaches — register with your email, no account needed.
        </p>
      </header>

      {loading ? (
        <p style={{ fontFamily: fontSans, color: color.muted }}>Loading sessions…</p>
      ) : sessions.length === 0 ? (
        <ScoutBox padding={24}>
          <p style={{ margin: 0, fontFamily: fontSans, color: color.muted }}>No upcoming webinars yet. Check back soon.</p>
        </ScoutBox>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/live/${s.legacyNumericId ?? s.id}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <ScoutBox padding={20}>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {s.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.coverImageUrl}
                      alt=""
                      style={{ width: 96, height: 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 96,
                        height: 64,
                        background: s.bgColor,
                        color: s.accentColor,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: fontSans,
                        fontSize: 12,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      LIVE
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 11, fontWeight: 600, color: color.forest, textTransform: "uppercase" }}>
                      {s.isLive ? "Live now" : s.startsIn} · {s.format === "BROADCAST" ? "Broadcast" : "Interactive"}
                    </p>
                    <p style={{ margin: "0 0 6px", fontFamily: fontSans, fontSize: 18, fontWeight: 600, color: color.ink }}>{s.title}</p>
                    <p style={{ margin: "0 0 4px", fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                      {s.date} · {s.time}
                    </p>
                    <p style={{ margin: 0, fontFamily: fontSans, fontSize: 13, color: color.stone }}>Hosted by {s.host}</p>
                  </div>
                </div>
              </ScoutBox>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
