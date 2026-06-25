"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LiveSessionView } from "@/lib/live-session-types";
import { EventInterestModal } from "@/components/scout/event-interest-modal";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { border, color, fontSans, type as T } from "@/lib/typography";

type Props = {
  isMobile: boolean;
};

const DASHBOARD_EVENT_LIMIT = 3;

export function DashboardEventsSection({ isMobile }: Props) {
  const router = useRouter();
  const [interestOpen, setInterestOpen] = useState(false);
  const [allSessions, setAllSessions] = useState<LiveSessionView[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/live/sessions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.sessions)) setAllSessions(d.sessions);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const sessions = useMemo(() => {
    const live = allSessions.filter((s) => s.isLive);
    const upcoming = allSessions
      .filter((s) => !s.isLive && s.status !== "ENDED" && s.status !== "CANCELLED")
      .slice(0, DASHBOARD_EVENT_LIMIT);
    return [...live, ...upcoming].slice(0, DASHBOARD_EVENT_LIMIT);
  }, [allSessions]);

  const showInterestCta = loaded && sessions.length === 0;

  return (
    <>
      <div style={{ marginBottom: isMobile ? 28 : 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
            <ScoutLabel>Upcoming events</ScoutLabel>
          </div>
          <button
            type="button"
            onClick={() => router.push("/live")}
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
            View all →
          </button>
        </div>

        {!loaded ? null : showInterestCta ? (
          <ScoutBox padding={isMobile ? "24px 20px" : "28px 24px"} style={{ textAlign: "center" }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, lineHeight: 1.6, margin: "0 0 16px" }}>
              No live sessions on the calendar right now. Tell us what topics you&apos;d like to see.
            </p>
            <ScoutPrimaryBtn onClick={() => setInterestOpen(true)} style={{ minHeight: 44 }}>
              Register interest →
            </ScoutPrimaryBtn>
          </ScoutBox>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => router.push(`/live/${session.id}`)}
                  style={{
                    textAlign: "left",
                    padding: 0,
                    border: border.line,
                    background: session.bgColor,
                    color: session.accentColor,
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ padding: isMobile ? "16px 16px" : "18px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                      {session.isLive && (
                        <span
                          style={{
                            padding: "3px 8px",
                            background: session.accentColor,
                            color: session.bgColor,
                            fontFamily: fontSans,
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                          }}
                        >
                          Live
                        </span>
                      )}
                      <span style={{ fontFamily: fontSans, fontSize: T.caption, opacity: 0.75 }}>
                        {session.startsIn}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: isMobile ? 18 : 20,
                        fontWeight: 500,
                        fontStyle: "italic",
                        color: "#fff",
                        margin: "0 0 8px",
                        lineHeight: 1.25,
                      }}
                    >
                      {session.title}
                    </p>
                    <p style={{ fontFamily: fontSans, fontSize: T.caption, opacity: 0.8, margin: 0 }}>
                      {session.host} · {session.time}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <ScoutSecondaryBtn onClick={() => setInterestOpen(true)} style={{ minHeight: 40 }}>
              Register interest in topics →
            </ScoutSecondaryBtn>
          </>
        )}
      </div>

      {interestOpen && <EventInterestModal onClose={() => setInterestOpen(false)} />}
    </>
  );
}
