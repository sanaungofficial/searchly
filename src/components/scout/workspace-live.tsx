"use client";

import { useState } from "react";
import { LIVE_SESSIONS } from "./workspace-data";

type LiveFilter = "all" | "live" | "week";

export function WorkspaceLive() {
  const [filter, setFilter] = useState<LiveFilter>("all");

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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F2EDE3",
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <div style={{ padding: "20px 32px 0", overflowY: "auto", flex: 1 }}>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Live with Second Ladder
        </p>
        <h1
          style={{
            fontFamily: "var(--font-cormorant), Georgia, serif",
            fontSize: 32,
            fontWeight: 500,
            fontStyle: "italic",
            color: "#1A1A1A",
            letterSpacing: "-0.3px",
            marginBottom: 24,
          }}
        >
          Real sessions, real coaches.
        </h1>

        {/* Featured weekly session */}
        <div
          style={{
            background: weekly.bgColor,
            borderRadius: 12,
            padding: 24,
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
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Weekly
            </span>
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
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
              fontFamily: "var(--font-cormorant), Georgia, serif",
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
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 14,
              fontWeight: 300,
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
                  fontFamily: "var(--font-dm-sans), system-ui",
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
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#FFFFFF",
                }}
              >
                {weekly.host}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  color: weekly.accentColor,
                  opacity: 0.7,
                }}
              >
                {weekly.hostRole} · ★ {weekly.hostRating}
              </p>
            </div>
          </div>
          <button
            style={{
              padding: "11px 22px",
              background: weekly.accentColor,
              color: weekly.bgColor,
              border: "none",
              borderRadius: 6,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reserve seat →
          </button>
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
                  borderRadius: 100,
                  fontFamily: "var(--font-dm-sans), system-ui",
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
            <div
              key={s.id}
              style={{
                background: "#FFFFFF",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ background: s.bgColor, padding: "16px 18px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span
                    style={{
                      padding: "2px 8px",
                      background: s.accentColor,
                      color: s.bgColor,
                      borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {s.isLive ? "● Live" : s.category}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
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
                    fontFamily: "var(--font-dm-sans), system-ui",
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
                    fontFamily: "var(--font-dm-sans), system-ui",
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
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 300,
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
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 12,
                      color: "#7A7268",
                    }}
                  >
                    {s.isLive ? `${s.registered} watching` : `${s.registered} registered`}
                  </span>
                  <button
                    style={{
                      padding: "6px 14px",
                      background: s.isLive ? "#C4574A" : "#1A3A2F",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    {s.isLive ? "Join now →" : "Reserve →"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
