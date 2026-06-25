"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LIVE_SESSIONS } from "./workspace-data";
import { ScoutBox, ScoutPrimaryBtn } from "./scout-box";
import { WorkspacePageShell } from "./workspace-page-shell";
import { useIsMobile } from "@/hooks/use-mobile";
import { border, color, fontSans, type as T } from "@/lib/typography";

type LiveFilter = "all" | "live" | "week";

export function WorkspaceLive() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [filter, setFilter] = useState<LiveFilter>("all");

  const openSession = (sessionId: number) => {
    router.push(`/live/${sessionId}`);
  };

  const filters: [LiveFilter, string][] = [
    ["all", "All sessions"],
    ["live", "Live now"],
    ["week", "This week"],
  ];

  const weekly = LIVE_SESSIONS.find((s) => s.isMiraWeekly) || LIVE_SESSIONS[0];
  const liveNow = LIVE_SESSIONS.filter((s) => s.isLive);
  const upcoming = LIVE_SESSIONS.filter((s) => !s.isMiraWeekly && !s.isLive);

  const visible = (() => {
    if (filter === "live") return liveNow;
    if (filter === "week") return upcoming;
    return [...liveNow, ...upcoming];
  })();

  return (
    <WorkspacePageShell
      isMobile={isMobile}
      label="Live with Second Ladder"
      mobileBarTitle="Live"
      title="Real sessions, real coaches."
    >
        {/* Featured weekly session */}
        <div
          style={{
            background: weekly.bgColor,
            border: border.lineStrong,
            padding: isMobile ? 20 : 24,
            marginBottom: 20,
            color: weekly.accentColor,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <span
              style={{
                padding: "3px 10px",
                background: weekly.accentColor,
                color: weekly.bgColor,
                borderRadius: 0,
                fontFamily: "var(--font-ui)",
                fontSize: 12,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Weekly
            </span>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: weekly.accentColor,
                opacity: 0.6,
              }}
            >
              {weekly.startsIn}
            </span>
          </div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              fontWeight: 500,
              fontStyle: "italic",
              color: "#FFFFFF",
              lineHeight: 1.2,
              marginBottom: 10,
            }}
          >
            {weekly.title}
          </h2>
          <p
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 400,
              color: weekly.accentColor,
              opacity: 0.85,
              lineHeight: 1.6,
              marginBottom: 16,
              maxWidth: 600,
              textWrap: "pretty",
            }}
          >
            {weekly.description}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: weekly.accentColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: weekly.bgColor,
                }}
              >
                {weekly.hostInitials}
              </span>
            </div>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#FFFFFF",
                }}
              >
                {weekly.host}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 12,
                  color: weekly.accentColor,
                  opacity: 0.7,
                }}
              >
                {weekly.hostRole} · ★ {weekly.hostRating}
              </p>
            </div>
          </div>
          <ScoutPrimaryBtn
            onClick={() => openSession(weekly.id)}
            style={{
              background: weekly.accentColor,
              color: weekly.bgColor,
              border: border.lineStrong,
              minHeight: isMobile ? 44 : undefined,
            }}
          >
            Reserve seat →
          </ScoutPrimaryBtn>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {filters.map(([id, label]) => {
            const active = filter === id;
            const bg = id === "live" && active ? "#C4574A" : active ? "#1A3A2F" : "rgba(0,0,0,0.05)";
            const color = id === "live" && active ? "#FFFFFF" : active ? "#E8D5A3" : "#52493F";
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  padding: "6px 14px",
                  background: bg,
                  color,
                  border: "none",
                  borderRadius: 0,
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Sessions grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
            paddingBottom: 40,
          }}
        >
          {visible.map((s) => (
            <ScoutBox key={s.id} padding={0} style={{ overflow: "hidden" }}>
              <div style={{ background: s.bgColor, padding: "16px 18px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      background: s.accentColor,
                      color: s.bgColor,
                      borderRadius: 0,
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {s.isLive ? "● Live" : s.category}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                      color: s.accentColor,
                      opacity: 0.7,
                    }}
                  >
                    {s.startsIn}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    lineHeight: 1.3,
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    color: s.accentColor,
                    opacity: 0.7,
                  }}
                >
                  with {s.host} · ★ {s.hostRating}
                </p>
              </div>
              <div style={{ padding: "12px 18px 14px" }}>
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#52493F",
                    lineHeight: 1.55,
                    marginBottom: 12,
                    textWrap: "pretty",
                  }}
                >
                  {s.description}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                      color: "var(--scout-muted)",
                    }}
                  >
                    {s.isLive ? `${s.registered} watching` : `${s.registered} registered`}
                  </span>
                  <ScoutPrimaryBtn
                    onClick={() => openSession(s.id)}
                    style={{
                      padding: "6px 14px",
                      background: s.isLive ? "#C4574A" : color.forest,
                      color: s.isLive ? "#FFFFFF" : color.gold,
                      minHeight: isMobile ? 40 : undefined,
                      fontSize: T.bodySm,
                    }}
                  >
                    {s.isLive ? "Join now →" : "Reserve →"}
                  </ScoutPrimaryBtn>
                </div>
              </div>
            </ScoutBox>
          ))}
        </div>
    </WorkspacePageShell>
  );
}
