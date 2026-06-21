"use client";

import { useState } from "react";
import { MY_CONTACTS, DISCOVERED_MEMBERS, type NetworkPerson } from "./workspace-data";

type Filter = "all" | "hivemind" | "first" | "second";

export function WorkspaceNetwork() {
  const [filter, setFilter] = useState<Filter>("all");
  const [hiveMindOn, setHiveMindOn] = useState(false);

  const all: NetworkPerson[] = [...MY_CONTACTS, ...DISCOVERED_MEMBERS];
  const filtered = all.filter((p) => {
    if (filter === "hivemind") return p.hiveMind;
    if (filter === "first") return p.degree === "1st";
    if (filter === "second") return p.degree === "2nd";
    return true;
  });

  const filters: [Filter, string][] = [
    ["all", "All"],
    ["hivemind", "Hive Mind"],
    ["first", "1st degree"],
    ["second", "2nd degree"],
  ];

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
          Your network
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
          Who can open the door.
        </h1>

        {/* Hive Mind toggle */}
        <div
          style={{
            background: "#FFFFFF",
            borderRadius: 10,
            padding: "14px 18px",
            marginBottom: 16,
            border: "1px solid rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 14,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              Hive Mind referrals
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 13,
                color: "#7A7268",
                marginTop: 2,
              }}
            >
              Opt in to earn referral fees from Second Ladder members.
            </p>
          </div>
          <button
            onClick={() => setHiveMindOn((p) => !p)}
            style={{
              width: 44,
              height: 24,
              borderRadius: 100,
              background: hiveMindOn ? "#4A8B6A" : "rgba(0,0,0,0.12)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: hiveMindOn ? 21 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#FFFFFF",
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {filters.map(([id, label]) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  padding: "6px 14px",
                  background: active ? "#1A3A2F" : "rgba(0,0,0,0.05)",
                  color: active ? "#E8D5A3" : "#52493F",
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

        {/* People grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 12, paddingBottom: 40 }}>
          {filtered.map((p) => {
            const degreeColor = p.degree === "1st" ? "#4A8B6A" : p.degree === "2nd" ? "#C4A86A" : "#A09890";
            const degreeLabel = p.degree === "platform" ? "Platform" : `${p.degree} degree`;
            const warmthDot = p.warmth === "hot" ? "#4A8B6A" : p.warmth === "warm" ? "#C4A86A" : "#A09890";
            const warmthBg =
              p.warmth === "hot"
                ? "rgba(74,139,106,0.07)"
                : p.warmth === "warm"
                ? "rgba(196,168,106,0.07)"
                : "rgba(0,0,0,0.04)";
            const hmSuccessColor = p.hmSuccessRate >= 90 ? "#4A8B6A" : p.hmSuccessRate >= 80 ? "#C4A86A" : "#A09890";

            return (
              <div
                key={p.id}
                style={{
                  background: "#FFFFFF",
                  borderRadius: 10,
                  padding: "16px 18px",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
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
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#E8D5A3",
                      }}
                    >
                      {p.initials}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 14,
                          fontWeight: 600,
                          color: "#1A1A1A",
                        }}
                      >
                        {p.name}
                      </p>
                      <span
                        style={{
                          padding: "1px 7px",
                          background: `${degreeColor}15`,
                          color: degreeColor,
                          borderRadius: 100,
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {degreeLabel}
                      </span>
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 13,
                        color: "#7A7268",
                      }}
                    >
                      {p.role} · {p.company}
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "3px 8px",
                      background: warmthBg,
                      borderRadius: 100,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: warmthDot,
                      }}
                    />
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        color: "#52493F",
                        textTransform: "capitalize",
                      }}
                    >
                      {p.warmth}
                    </span>
                  </div>
                </div>

                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 300,
                    color: "#52493F",
                    lineHeight: 1.5,
                    marginBottom: 10,
                    textWrap: "pretty",
                  }}
                >
                  {p.note}
                </p>

                {p.hiveMind && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "rgba(74,139,106,0.05)",
                      borderRadius: 6,
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#4A8B6A",
                          textTransform: "uppercase",
                          letterSpacing: "1px",
                        }}
                      >
                        Hive Mind
                      </span>
                      {p.hmVerified && (
                        <span
                          style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 11,
                            color: "#4A8B6A",
                          }}
                        >
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 14,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 12,
                        color: "#52493F",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-mono), monospace",
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#1A3A2F",
                          }}
                        >
                          {p.hmOpenRoles}
                        </p>
                        <p style={{ color: "#A09890" }}>open slots</p>
                      </div>
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-mono), monospace",
                            fontSize: 14,
                            fontWeight: 500,
                            color: "#1A3A2F",
                          }}
                        >
                          {p.hmFee || "—"}
                        </p>
                        <p style={{ color: "#A09890" }}>commission</p>
                      </div>
                      <div>
                        <p
                          style={{
                            fontFamily: "var(--font-dm-mono), monospace",
                            fontSize: 14,
                            fontWeight: 500,
                            color: hmSuccessColor,
                          }}
                        >
                          {p.hmSuccessRate}%
                        </p>
                        <p style={{ color: "#A09890" }}>success</p>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    style={{
                      padding: "7px 14px",
                      background: "#1A3A2F",
                      color: "#E8D5A3",
                      border: "none",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      flex: 1,
                    }}
                  >
                    {p.degree === "1st" ? "Reach out" : "Request intro"}
                  </button>
                  {p.hiveMind && (
                    <button
                      style={{
                        padding: "7px 14px",
                        background: "#4A8B6A",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: 5,
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        flex: 1,
                      }}
                    >
                      Request referral
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
