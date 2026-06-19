"use client";

import { useState } from "react";
import { COACHES } from "./workspace-data";

type CoachingTab = "mycoach" | "coaches";

export function WorkspaceCoaching() {
  const [tab, setTab] = useState<CoachingTab>("mycoach");

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
            fontSize: 10,
            fontWeight: 500,
            color: "#A09890",
            letterSpacing: "1.1px",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          1:1 coaching
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
          Talk to someone who&apos;s done it.
        </h1>

        {/* Tab bar */}
        <div
          style={{
            display: "inline-flex",
            gap: 3,
            background: "rgba(0,0,0,0.05)",
            padding: 3,
            borderRadius: 7,
            marginBottom: 24,
          }}
        >
          {([
            ["mycoach", "My Coach"],
            ["coaches", "Find a Coach"],
          ] as [CoachingTab, string][]).map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: "7px 18px",
                  border: "none",
                  borderRadius: 5,
                  background: active ? "#FFFFFF" : "transparent",
                  color: active ? "#1A1A1A" : "#7A7268",
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "mycoach" ? <MyCoachTab /> : <CoachSearchTab />}
      </div>
    </div>
  );
}

function MyCoachTab() {
  const featured = COACHES[2]; // Rachel Torres — ex-Meta PM coach
  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: 24,
          border: "1px solid rgba(0,0,0,0.06)",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "#1A3A2F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 20,
                fontWeight: 600,
                color: "#E8D5A3",
              }}
            >
              {featured.initials}
            </span>
          </div>
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 16,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              {featured.name}
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#7A7268",
                marginTop: 2,
                marginBottom: 6,
              }}
            >
              {featured.role}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  color: "#4A8B6A",
                }}
              >
                ★ {featured.rating.toFixed(1)} ({featured.reviewCount})
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  color: "#7A7268",
                }}
              >
                {featured.minutes.toLocaleString()} min coached
              </span>
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  color: "#1A3A2F",
                  fontWeight: 500,
                }}
              >
                ${featured.rate}/hr
              </span>
            </div>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            fontWeight: 300,
            color: "#52493F",
            lineHeight: 1.65,
            marginBottom: 16,
            textWrap: "pretty",
          }}
        >
          {featured.bio}
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {featured.specialties.map((s) => (
            <span
              key={s}
              style={{
                padding: "5px 12px",
                background: "rgba(26,58,47,0.06)",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                color: "#1A3A2F",
              }}
            >
              {s}
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            style={{
              padding: "11px 22px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 6,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Book a session →
          </button>
          <button
            style={{
              padding: "11px 18px",
              background: "transparent",
              color: "#1A3A2F",
              border: "1px solid rgba(26,58,47,0.2)",
              borderRadius: 6,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Send message
          </button>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "18px 24px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#A09890",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 10,
          }}
        >
          Upcoming sessions
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            color: "#7A7268",
          }}
        >
          No upcoming sessions scheduled. Book one to start your prep.
        </p>
      </div>
    </div>
  );
}

function CoachSearchTab() {
  const [filter, setFilter] = useState("");
  const filtered = COACHES.filter(
    (c) =>
      !filter ||
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.workedAt.some((w) => w.toLowerCase().includes(filter.toLowerCase())) ||
      c.specialties.some((s) => s.toLowerCase().includes(filter.toLowerCase())),
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      <input
        type="text"
        placeholder="Search by name, company, or specialty…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 460,
          padding: "10px 14px",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 6,
          background: "#FFFFFF",
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 12,
          color: "#1A1A1A",
          marginBottom: 16,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((c) => (
          <div
            key={c.id}
            style={{
              background: "#FFFFFF",
              borderRadius: 10,
              padding: "18px 22px",
              border: "1px solid rgba(0,0,0,0.06)",
              display: "flex",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#1A3A2F",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#E8D5A3",
                }}
              >
                {c.initials}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1A1A1A",
                    }}
                  >
                    {c.name}{" "}
                    {c.featured && (
                      <span
                        style={{
                          marginLeft: 6,
                          padding: "1px 7px",
                          background: "rgba(196,168,106,0.15)",
                          borderRadius: 100,
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 9,
                          color: "#7A6020",
                          fontWeight: 600,
                        }}
                      >
                        Featured
                      </span>
                    )}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      color: "#7A7268",
                    }}
                  >
                    {c.role}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#1A3A2F",
                    }}
                  >
                    ${c.rate}
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: "#A09890",
                        fontWeight: 400,
                      }}
                    >
                      /hr
                    </span>
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      color: c.available === "Today" ? "#4A8B6A" : "#A09890",
                    }}
                  >
                    Available {c.available}
                  </p>
                </div>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 11,
                  fontWeight: 300,
                  color: "#52493F",
                  lineHeight: 1.55,
                  marginBottom: 10,
                  textWrap: "pretty",
                }}
              >
                {c.bio}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {c.specialties.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "4px 10px",
                      background: "rgba(26,58,47,0.06)",
                      borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      color: "#1A3A2F",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 10,
                  color: "#A09890",
                }}
              >
                <span>★ {c.rating.toFixed(1)} ({c.reviewCount} reviews)</span>
                <span>·</span>
                <span>{c.workedAt.join(", ")}</span>
                <span>·</span>
                <span>{c.studiedAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
