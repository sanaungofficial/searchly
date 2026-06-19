"use client";

import { useState } from "react";
import {
  WORK_EXP,
  EDUCATION_LIST,
  SKILLS_LIST,
  SKILLS_SUGGESTED,
  PROFILE_SUGGESTIONS,
  ROLE_ARCHETYPES,
  AVAILABLE_ROLES,
  UPSKILL_CATEGORIES,
} from "./workspace-data";
import { SparkleIcon } from "./workspace-icons";

type ProfileTab = "dreamrole" | "experience" | "skills" | "learning" | "assets";

export function WorkspaceProfile() {
  const [tab, setTab] = useState<ProfileTab>("dreamrole");
  const [dreamList, setDreamList] = useState<string[]>(["VP of Product", "Head of Product Operations"]);
  const [dreamSelectedId, setDreamSelectedId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [upskillProgress, setUpskillProgress] = useState<Record<number, "none" | "inprogress" | "completed">>({});

  const tabs: [ProfileTab, string][] = [
    ["dreamrole", "Dream Role"],
    ["experience", "Experience"],
    ["skills", "Skills"],
    ["learning", "Learning Path"],
    ["assets", "Resume Assets"],
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
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
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
            Sarah Chen · Senior PM · 8 yrs
          </p>
          <h1
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: 32,
              fontWeight: 500,
              fontStyle: "italic",
              color: "#1A1A1A",
              letterSpacing: "-0.3px",
            }}
          >
            Your profile, through Searchly&apos;s eyes.
          </h1>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 24,
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            paddingBottom: 0,
          }}
        >
          {tabs.map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderRadius: "6px 6px 0 0",
                  background: active ? "#1A3A2F" : "transparent",
                  color: active ? "#E8D5A3" : "#52493F",
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === "dreamrole" && (
          <DreamRoleTab
            dreamList={dreamList}
            setDreamList={setDreamList}
            dreamSelectedId={dreamSelectedId}
            setDreamSelectedId={setDreamSelectedId}
            adding={adding}
            setAdding={setAdding}
          />
        )}
        {tab === "experience" && <ExperienceTab />}
        {tab === "skills" && <SkillsTab />}
        {tab === "learning" && <LearningTab progress={upskillProgress} setProgress={setUpskillProgress} />}
        {tab === "assets" && <AssetsTab />}
      </div>
    </div>
  );
}

/* ── Dream Role tab ── */
function DreamRoleTab({
  dreamList,
  setDreamList,
  dreamSelectedId,
  setDreamSelectedId,
  adding,
  setAdding,
}: {
  dreamList: string[];
  setDreamList: (l: string[]) => void;
  dreamSelectedId: number | null;
  setDreamSelectedId: (n: number | null) => void;
  adding: boolean;
  setAdding: (b: boolean) => void;
}) {
  const skillsSet = new Set(SKILLS_LIST);
  const topMap: Record<number, string[]> = { 1: ["50%"], 2: ["28%", "72%"], 3: ["13%", "50%", "87%"] };
  const tps = topMap[dreamList.length] || topMap[3];

  const addRole = (title: string) => {
    if (dreamList.includes(title) || dreamList.length >= 3) {
      setAdding(false);
      return;
    }
    setDreamList([...dreamList, title]);
    setAdding(false);
    setDreamSelectedId(null);
  };
  const removeRole = (idx: number) => {
    setDreamList(dreamList.filter((_, i) => i !== idx));
    setDreamSelectedId(null);
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Selected dream-role detail */}
      {dreamSelectedId !== null && dreamList[dreamSelectedId] && (
        <DreamRoleDetail
          title={dreamList[dreamSelectedId]}
          skillsSet={skillsSet}
          onClose={() => setDreamSelectedId(null)}
        />
      )}

      {/* Dream role cards */}
      {dreamSelectedId === null && (
        <>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 11,
              color: "#52493F",
              marginBottom: 20,
              maxWidth: 580,
              lineHeight: 1.6,
            }}
          >
            Pick up to three roles you&apos;re aiming for. Searchly will measure the gap, surface roles that match, and
            build a learning path to bridge what&apos;s missing.
          </p>

          <div style={{ position: "relative", height: 220, marginBottom: 24 }}>
            {dreamList.map((title, i) => {
              const arch = ROLE_ARCHETYPES[title];
              if (!arch) return null;
              const matched = arch.requires.filter((r) => skillsSet.has(r));
              const needed = arch.requires.filter((r) => !skillsSet.has(r));
              const readiness = Math.round((matched.length / arch.requires.length) * 100);
              const rc = readiness >= 75 ? "#4A8B6A" : readiness >= 50 ? "#C4A86A" : "#A09890";
              return (
                <button
                  key={title}
                  onClick={() => setDreamSelectedId(i)}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${tps[i]}`,
                    transform: "translateX(-50%)",
                    width: 200,
                    background: "#FFFFFF",
                    borderRadius: 10,
                    padding: "16px 16px 14px",
                    border: `1.5px solid ${arch.color}30`,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: arch.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 600 }}>{readiness}%</span>
                  </div>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      marginBottom: 4,
                    }}
                  >
                    {title}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      color: rc,
                      marginBottom: 8,
                    }}
                  >
                    {readiness >= 75 ? "Strong foundation" : readiness >= 50 ? "Good progress" : "Building toward"}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 10,
                      color: "#7A7268",
                    }}
                  >
                    {arch.openRolesLabel}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRole(i);
                    }}
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#A09890",
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </button>
              );
            })}
          </div>

          {/* Add role */}
          <div>
            {!adding ? (
              dreamList.length < 3 && (
                <button
                  onClick={() => setAdding(true)}
                  style={{
                    padding: "10px 18px",
                    background: "transparent",
                    color: "#1A3A2F",
                    border: "1px solid rgba(26,58,47,0.2)",
                    borderRadius: 5,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  + Add a role
                </button>
              )
            ) : (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AVAILABLE_ROLES.filter((r) => !dreamList.includes(r)).map((r) => (
                  <button
                    key={r}
                    onClick={() => addRole(r)}
                    style={{
                      padding: "6px 14px",
                      background: "#FFFFFF",
                      border: "1px solid rgba(0,0,0,0.1)",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      color: "#1A1A1A",
                      cursor: "pointer",
                    }}
                  >
                    {r}
                  </button>
                ))}
                <button
                  onClick={() => setAdding(false)}
                  style={{
                    padding: "6px 12px",
                    background: "transparent",
                    border: "none",
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#A09890",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DreamRoleDetail({
  title,
  skillsSet,
  onClose,
}: {
  title: string;
  skillsSet: Set<string>;
  onClose: () => void;
}) {
  const arch = ROLE_ARCHETYPES[title];
  if (!arch) return null;
  const matched = arch.requires.filter((r) => skillsSet.has(r));
  const needed = arch.requires.filter((r) => !skillsSet.has(r));
  const readiness = Math.round((matched.length / arch.requires.length) * 100);
  return (
    <div style={{ paddingBottom: 40, animation: "fadeIn 0.3s ease both" }}>
      <button
        onClick={onClose}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "var(--font-dm-sans), system-ui",
          fontSize: 11,
          color: "#1A3A2F",
          padding: 0,
          marginBottom: 16,
        }}
      >
        ← Back to roles
      </button>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: 28,
          border: `2px solid ${arch.color}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.07)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: arch.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 600 }}>{readiness}%</span>
          </div>
          <div>
            <h2
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 28,
                fontWeight: 500,
                color: "#1A1A1A",
                fontStyle: "italic",
              }}
            >
              {title}
            </h2>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 11,
                color: "#7A7268",
                marginTop: 2,
              }}
            >
              {arch.openRolesLabel}
            </p>
          </div>
        </div>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 13,
            fontWeight: 300,
            color: "#52493F",
            lineHeight: 1.65,
            marginBottom: 22,
            textWrap: "pretty",
          }}
        >
          {arch.description}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 600,
                color: "#4A8B6A",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 10,
              }}
            >
              You have ({matched.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {matched.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "5px 11px",
                    background: "rgba(74,139,106,0.08)",
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#2D6B4A",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9,
                fontWeight: 600,
                color: "#C4A86A",
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: 10,
              }}
            >
              You&apos;ll need ({needed.length})
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {needed.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "5px 11px",
                    background: "rgba(196,168,106,0.1)",
                    borderRadius: 100,
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    color: "#7A6020",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>

        <button
          style={{
            padding: "12px 22px",
            background: "#1A3A2F",
            color: "#E8D5A3",
            border: "none",
            borderRadius: 6,
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <SparkleIcon /> Run Searchly gap analysis →
        </button>
      </div>
    </div>
  );
}

/* ── Experience tab ── */
function ExperienceTab() {
  return (
    <div style={{ paddingBottom: 40 }}>
      {WORK_EXP.map((w, i) => (
        <div
          key={i}
          style={{
            background: "#FFFFFF",
            borderRadius: 10,
            padding: "20px 24px",
            marginBottom: 12,
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 14,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              {w.role}
            </p>
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 11,
                color: "#A09890",
              }}
            >
              {w.period}
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              color: "#1A3A2F",
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            {w.company}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {w.bullets.map((b, j) => (
              <li
                key={j}
                style={{
                  display: "flex",
                  gap: 8,
                  marginBottom: 6,
                  fontFamily: "var(--font-dm-sans), system-ui",
                  fontSize: 12,
                  fontWeight: 300,
                  color: "#2A2218",
                  lineHeight: 1.55,
                }}
              >
                <span style={{ color: "#1A3A2F", flexShrink: 0 }}>•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 12,
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
            marginBottom: 12,
          }}
        >
          Education
        </p>
        {EDUCATION_LIST.map((e, i) => (
          <div key={i} style={{ marginBottom: i < EDUCATION_LIST.length - 1 ? 10 : 0 }}>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, fontWeight: 500, color: "#1A1A1A" }}>
              {e.school}
            </p>
            <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#7A7268" }}>
              {e.degree} · {e.period}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Skills tab ── */
function SkillsTab() {
  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 12,
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
            marginBottom: 12,
          }}
        >
          Your skills ({SKILLS_LIST.length})
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SKILLS_LIST.map((s) => (
            <span
              key={s}
              style={{
                padding: "6px 14px",
                background: "rgba(26,58,47,0.07)",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#1A3A2F",
                fontWeight: 500,
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#C4A86A",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <SparkleIcon /> Searchly suggests adding
        </p>
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 11,
            color: "#7A7268",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          These appear in 4 of your 5 target role descriptions.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SKILLS_SUGGESTED.map((s) => (
            <button
              key={s}
              style={{
                padding: "6px 14px",
                background: "rgba(196,168,106,0.1)",
                border: "1px dashed rgba(196,168,106,0.5)",
                borderRadius: 100,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#7A6020",
                cursor: "pointer",
              }}
            >
              + {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Learning Path tab ── */
function LearningTab({
  progress,
  setProgress,
}: {
  progress: Record<number, "none" | "inprogress" | "completed">;
  setProgress: (p: Record<number, "none" | "inprogress" | "completed">) => void;
}) {
  const doneCount = Object.values(progress).filter((v) => v === "completed").length;
  const total = UPSKILL_CATEGORIES.reduce((a, c) => a + c.items.length, 0);

  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#1A3A2F",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9,
              fontWeight: 600,
              color: "rgba(232,213,163,0.5)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: 4,
            }}
          >
            Your learning progress
          </p>
          <p
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontSize: 18,
              fontWeight: 500,
              color: "#E8D5A3",
            }}
          >
            {doneCount} of {total} complete
          </p>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `conic-gradient(#E8D5A3 ${(doneCount / total) * 360}deg, rgba(232,213,163,0.15) 0)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#1A3A2F",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: 14,
                fontWeight: 500,
                color: "#E8D5A3",
              }}
            >
              {Math.round((doneCount / total) * 100)}%
            </span>
          </div>
        </div>
      </div>

      {UPSKILL_CATEGORIES.map((cat) => (
        <div key={cat.title} style={{ marginBottom: 20 }}>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: 4,
            }}
          >
            {cat.title}
          </p>
          <p
            style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 10,
              color: "#7A7268",
              marginBottom: 10,
            }}
          >
            {cat.subtitle}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cat.items.map((item) => {
              const prog = progress[item.id] || "none";
              const statusLabel =
                prog === "completed" ? "Completed ✓" : prog === "inprogress" ? "In progress" : "Not started";
              const statusColor = prog === "completed" ? "#4A8B6A" : prog === "inprogress" ? "#C4A86A" : "#A09890";
              return (
                <div
                  key={item.id}
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 8,
                    padding: "14px 16px",
                    border: "1px solid rgba(0,0,0,0.06)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      background: item.platformColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#FFFFFF",
                      }}
                    >
                      {item.platformInitial}
                    </span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <p
                        style={{
                          fontFamily: "var(--font-dm-sans), system-ui",
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#1A1A1A",
                        }}
                      >
                        {item.name}
                      </p>
                      {item.scoutPick && (
                        <span
                          style={{
                            padding: "1px 7px",
                            background: "rgba(196,168,106,0.15)",
                            borderRadius: 100,
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 9,
                            color: "#7A6020",
                            fontWeight: 600,
                          }}
                        >
                          Searchly pick
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: "#7A7268",
                        marginBottom: 3,
                      }}
                    >
                      {item.platform} · {item.duration} · {item.credential}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-dm-sans), system-ui",
                        fontSize: 10,
                        color: statusColor,
                      }}
                    >
                      {statusLabel}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setProgress({
                        ...progress,
                        [item.id]:
                          prog === "none" ? "inprogress" : prog === "inprogress" ? "completed" : "inprogress",
                      })
                    }
                    style={{
                      padding: "7px 14px",
                      background: prog === "completed" ? "rgba(74,139,106,0.1)" : "#1A3A2F",
                      color: prog === "completed" ? "#4A8B6A" : "#E8D5A3",
                      border: "none",
                      borderRadius: 5,
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {prog === "completed" ? "Review →" : prog === "inprogress" ? "Complete →" : "Start →"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Resume Assets tab ── */
function AssetsTab() {
  const suggestions = PROFILE_SUGGESTIONS;
  return (
    <div style={{ paddingBottom: 40 }}>
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          marginBottom: 12,
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
            marginBottom: 12,
          }}
        >
          Resume versions
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(26,58,47,0.03)",
              borderRadius: 6,
              borderLeft: "2px solid #1A3A2F",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                fontWeight: 600,
                color: "#1A1A1A",
              }}
            >
              📄 Original Resume
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 10,
                color: "#7A7268",
                marginTop: 2,
              }}
            >
              Uploaded Jun 19, 2026
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 10,
          padding: "20px 24px",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui",
            fontSize: 9,
            fontWeight: 600,
            color: "#C4A86A",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <SparkleIcon /> Searchly&apos;s suggestions
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {suggestions.map((s) => {
            const pColor = s.priority === "high" ? "#C4574A" : s.priority === "medium" ? "#C4A86A" : "#A09890";
            const pBg =
              s.priority === "high"
                ? "rgba(196,87,74,0.08)"
                : s.priority === "medium"
                ? "rgba(196,168,106,0.1)"
                : "rgba(0,0,0,0.05)";
            return (
              <div
                key={s.id}
                style={{
                  padding: "12px 14px",
                  background: pBg,
                  borderRadius: 6,
                  borderLeft: `2px solid ${pColor}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 9,
                      fontWeight: 600,
                      color: pColor,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {s.priority} · {s.category}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    marginBottom: 4,
                  }}
                >
                  {s.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 11,
                    fontWeight: 300,
                    color: "#52493F",
                    lineHeight: 1.55,
                    marginBottom: 4,
                  }}
                >
                  {s.detail}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-dm-sans), system-ui",
                    fontSize: 10,
                    color: "#4A8B6A",
                    fontStyle: "italic",
                  }}
                >
                  → {s.impact}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
