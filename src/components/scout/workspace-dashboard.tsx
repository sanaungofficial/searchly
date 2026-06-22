"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/hooks/useJobs";
import {
  INITIAL_SIGNALS,
  type KanbanCard,
  type SignalItem,
  type SignalsData,
} from "./workspace-data";
import { PlusIcon, RefreshIcon } from "./workspace-icons";

export function WorkspaceDashboard() {
  const { kanbanCards, addJob } = useWorkspace();

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addJobUrl, setAddJobUrl] = useState("");
  const [addJobLoading, setAddJobLoading] = useState(false);
  const [jobAnalysis, setJobAnalysis] = useState<null | {
    company: string | null;
    role: string | null;
    location: string | null;
    salary: string | null;
    description: string | null;
    requirements: string[];
  }>(null);
  const [addJobError, setAddJobError] = useState<string | null>(null);

  const [signalsData, setSignalsData] = useState<SignalsData | null>(INITIAL_SIGNALS);
  const [signalsLoading, setSignalsLoading] = useState(false);

  const pipeline = {
    saved: kanbanCards.filter((c) => c.stage === "saved").length,
    applied: kanbanCards.filter((c) => c.stage === "applied").length,
    interview: kanbanCards.filter((c) => c.stage === "interview").length,
    offer: kanbanCards.filter((c) => c.stage === "offer").length,
    closed: kanbanCards.filter((c) => c.stage === "closed").length,
  };

  const total = pipeline.saved + pipeline.applied + pipeline.interview + pipeline.offer;
  const recentActivity = kanbanCards
    .filter((c) => c.days <= 7 && c.stage !== "closed")
    .sort((a, b) => a.days - b.days);

  const funnelStages: { key: keyof typeof pipeline; label: string; color: string }[] = [
    { key: "saved", label: "Saved", color: "#8B9E8B" },
    { key: "applied", label: "Applied", color: "#5A8A6E" },
    { key: "interview", label: "Interviewing", color: "#2D6B4A" },
    { key: "offer", label: "Offer", color: "#1A3A2F" },
  ];

  function convRate(from: number, to: number) {
    if (from === 0) return null;
    return Math.round((to / from) * 100);
  }

  const submitAddJob = async () => {
    const url = addJobUrl.trim();
    if (!url) return;
    setAddJobLoading(true);
    setJobAnalysis(null);
    setAddJobError(null);
    try {
      const res = await fetch("/api/ai/parse-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddJobError(data.error ?? "Could not analyze this URL.");
      } else {
        setJobAnalysis(data);
      }
    } catch {
      setAddJobError("Network error. Please try again.");
    } finally {
      setAddJobLoading(false);
    }
  };

  const addToKanban = async () => {
    if (!jobAnalysis) return;
    const company = jobAnalysis.company ?? "Unknown Company";
    const role = jobAnalysis.role ?? "Unknown Role";
    const meta: JobMeta = {
      location: jobAnalysis.location,
      salary: jobAnalysis.salary,
      description: jobAnalysis.description,
      requirements: jobAnalysis.requirements,
    };
    await addJob(company, role, addJobUrl.trim() || undefined, meta);
    setShowAddPanel(false);
    setJobAnalysis(null);
    setAddJobUrl("");
    setAddJobError(null);
  };

  const dismissJobAnalysis = () => {
    setJobAnalysis(null);
    setAddJobError(null);
  };

  const refreshSignals = () => {
    setSignalsLoading(true);
    setSignalsData(null);
    window.setTimeout(() => {
      setSignalsData(INITIAL_SIGNALS);
      setSignalsLoading(false);
    }, 1500);
  };

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
      {/* Header bar */}
      <div
        style={{
          padding: "12px 28px",
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", gap: 0 }}>
          <span
            style={{
              padding: "7px 18px",
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 13,
              fontWeight: 600,
              color: "#1A3A2F",
              borderBottom: "2px solid #1A3A2F",
            }}
          >
            Dashboard
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setShowAddPanel((p) => !p)}
            style={{
              padding: "7px 16px",
              background: "#1A3A2F",
              color: "#E8D5A3",
              border: "none",
              borderRadius: 5,
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 11,
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.2px",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <PlusIcon /> Add job
          </button>
        </div>
      </div>

      {/* Add job panel */}
      {showAddPanel && (
        <div
          style={{
            padding: "12px 28px",
            background: "rgba(26,58,47,0.04)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            animation: "fadeIn 0.2s ease both",
          }}
        >
          <div style={{ display: "flex", gap: 8, maxWidth: 560 }}>
            <input
              type="url"
              placeholder="Paste a job listing URL — e.g. https://stripe.com/jobs/..."
              value={addJobUrl}
              onChange={(e) => setAddJobUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAddJob()}
              style={{
                flex: 1,
                padding: "9px 12px",
                border: "1px solid rgba(26,58,47,0.2)",
                borderRadius: 6,
                background: "#FFFFFF",
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                color: "#1A1A1A",
                minWidth: 0,
              }}
            />
            <button
              onClick={submitAddJob}
              style={{
                padding: "9px 18px",
                background: "#1A3A2F",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 6,
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 12,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Search →
            </button>
          </div>

          {addJobLoading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#1A3A2F",
                  animation: "pulse 1s ease infinite",
                }}
              />
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>
                Kimchi is analyzing this listing…
              </p>
            </div>
          )}

          {addJobError && (
            <div
              style={{
                marginTop: 10,
                padding: "10px 14px",
                background: "rgba(196,87,74,0.06)",
                borderRadius: 6,
                border: "1px solid rgba(196,87,74,0.15)",
              }}
            >
              <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#C4574A" }}>
                {addJobError}
              </p>
            </div>
          )}

          {jobAnalysis && (
            <div style={{ padding: "20px 0 0", animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>
                      {jobAnalysis.company ?? "Unknown company"}
                    </p>
                    {jobAnalysis.role && (
                      <>
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F" }}>·</span>
                        <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#52493F" }}>{jobAnalysis.role}</p>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {jobAnalysis.location && (
                      <span style={{ padding: "3px 10px", background: "rgba(0,0,0,0.05)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#52493F" }}>
                        📍 {jobAnalysis.location}
                      </span>
                    )}
                    {jobAnalysis.salary && (
                      <span style={{ padding: "3px 10px", background: "rgba(74,139,106,0.1)", borderRadius: 100, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#2D6B4A" }}>
                        {jobAnalysis.salary}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: jobAnalysis.description && jobAnalysis.requirements.length > 0 ? "1fr 1fr" : "1fr", gap: 14, marginBottom: 14 }}>
                {jobAnalysis.description && (
                  <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                      Role Summary
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.65, textWrap: "pretty" }}>
                      {jobAnalysis.description}
                    </p>
                  </div>
                )}
                {jobAnalysis.requirements.length > 0 && (
                  <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600, color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                      Key Requirements
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {jobAnalysis.requirements.map((r: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                          <span style={{ color: "#4A8B6A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, fontWeight: 300, color: "#2A2218", lineHeight: 1.5 }}>{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={addToKanban}
                  style={{ padding: "10px 22px", background: "#1A3A2F", color: "#E8D5A3", border: "none", borderRadius: 6, fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  + Add to pipeline
                </button>
                <button
                  onClick={dismissJobAnalysis}
                  style={{ padding: "10px 16px", background: "transparent", color: "#A09890", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, cursor: "pointer" }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ padding: "24px 32px 48px" }}>

          {/* Pipeline funnel strip */}
          <div style={{ marginBottom: 28 }}>
            <p style={{
              fontFamily: "var(--font-dm-sans), system-ui",
              fontSize: 9, fontWeight: 500, color: "#A09890",
              letterSpacing: "1.1px", textTransform: "uppercase", marginBottom: 12,
            }}>
              Your pipeline
            </p>

            {total === 0 ? (
              <div style={{
                background: "rgba(26,58,47,0.04)", borderRadius: 10, padding: "20px 24px",
                border: "1px solid rgba(26,58,47,0.08)", textAlign: "center",
              }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#A09890" }}>
                  No jobs tracked yet — add your first job above to start building your pipeline.
                </p>
              </div>
            ) : (
              <>
                {/* Funnel chips row */}
                <div style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 16 }}>
                  {funnelStages.map((stage, idx) => {
                    const count = pipeline[stage.key];
                    const prevCount = idx === 0 ? null : pipeline[funnelStages[idx - 1].key];
                    const rate = prevCount !== null ? convRate(prevCount, count) : null;
                    const isLast = idx === funnelStages.length - 1;
                    return (
                      <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                        {idx > 0 && (
                          <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            padding: "0 6px", flexShrink: 0,
                          }}>
                            <span style={{ fontSize: 10, color: "#C5B9AF", lineHeight: 1 }}>→</span>
                            {rate !== null && (
                              <span style={{
                                fontFamily: "var(--font-dm-sans), system-ui",
                                fontSize: 8, color: "#A09890", marginTop: 2, whiteSpace: "nowrap",
                              }}>
                                {rate}%
                              </span>
                            )}
                          </div>
                        )}
                        <div style={{
                          flex: 1, background: "#FFFFFF",
                          borderRadius: isLast ? "0 8px 8px 0" : idx === 0 ? "8px 0 0 8px" : 0,
                          border: "1px solid rgba(0,0,0,0.07)",
                          borderLeft: idx > 0 ? "none" : "1px solid rgba(0,0,0,0.07)",
                          padding: "14px 16px", textAlign: "center",
                        }}>
                          <div style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 22, fontWeight: 700, color: stage.color, lineHeight: 1,
                          }}>
                            {count}
                          </div>
                          <div style={{
                            fontFamily: "var(--font-dm-sans), system-ui",
                            fontSize: 10, color: "#A09890", marginTop: 4, fontWeight: 500,
                          }}>
                            {stage.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {pipeline.closed > 0 && (
                    <div style={{ display: "flex", alignItems: "center", marginLeft: 10, flexShrink: 0 }}>
                      <div style={{
                        background: "rgba(0,0,0,0.04)", borderRadius: 20,
                        padding: "6px 12px", border: "1px solid rgba(0,0,0,0.06)",
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ fontSize: 10 }}>❌</span>
                        <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#A09890" }}>
                          {pipeline.closed} archived
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7-day activity feed */}
                {recentActivity.length > 0 && (
                  <div>
                    <p style={{
                      fontFamily: "var(--font-dm-sans), system-ui",
                      fontSize: 9, fontWeight: 500, color: "#A09890",
                      letterSpacing: "1.1px", textTransform: "uppercase", marginBottom: 8,
                    }}>
                      Last 7 days
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {recentActivity.slice(0, 6).map((card: KanbanCard) => {
                        const stageLabel = card.stage === "saved" ? "Saved" : card.stage === "applied" ? "Applied" : card.stage === "interview" ? "Interviewing" : card.stage === "offer" ? "Offer" : card.stage;
                        const stageColor = card.stage === "offer" ? "#1A3A2F" : card.stage === "interview" ? "#2D6B4A" : card.stage === "applied" ? "#5A8A6E" : "#8B9E8B";
                        return (
                          <div key={card.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "8px 12px", background: "#FFFFFF",
                            borderRadius: 7, border: "1px solid rgba(0,0,0,0.06)",
                          }}>
                            <div style={{
                              width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: stageColor,
                            }} />
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 12, color: "#1A1A1A", fontWeight: 500, flex: 1, minWidth: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {card.company}
                            </span>
                            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#52493F" }}>·</span>
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 11, color: "#52493F",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180,
                            }}>
                              {card.role}
                            </span>
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 10, color: stageColor,
                              background: `${stageColor}14`,
                              padding: "2px 8px", borderRadius: 100, flexShrink: 0, fontWeight: 500,
                            }}>
                              {stageLabel}
                            </span>
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 10, color: "#A09890", flexShrink: 0, marginLeft: 4,
                            }}>
                              {card.days === 0 ? "today" : card.days === 1 ? "1d ago" : `${card.days}d ago`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Market signals strip */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <p style={{
                fontFamily: "var(--font-dm-sans), system-ui",
                fontSize: 9, fontWeight: 500, color: "#A09890",
                letterSpacing: "1.1px", textTransform: "uppercase",
              }}>
                Kimchi signals · updated weekly
              </p>
              <button
                onClick={refreshSignals}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#1A3A2F",
                  padding: 0, display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <RefreshIcon /> Refresh →
              </button>
            </div>

            {signalsLoading && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
                background: "#FFFFFF", borderRadius: 9, border: "1px solid rgba(0,0,0,0.06)",
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%", background: "#1A3A2F",
                  animation: "pulse 1s ease infinite", flexShrink: 0,
                }} />
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#1A3A2F" }}>
                  Kimchi is scanning the market…
                </p>
              </div>
            )}

            {signalsData && (
              <>
                <div style={{
                  background: "#FFFFFF", borderRadius: 9, padding: "14px 18px", marginBottom: 10,
                  border: "1px solid rgba(0,0,0,0.06)", borderLeft: "3px solid #1A3A2F",
                  borderLeftWidth: 3, borderLeftColor: "#1A3A2F",
                }}>
                  <p style={{
                    fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600,
                    color: "#A09890", textTransform: "uppercase", letterSpacing: "1.1px", marginBottom: 6,
                  }}>
                    This week&apos;s read
                  </p>
                  <p style={{
                    fontFamily: "var(--font-cormorant), Georgia, serif",
                    fontSize: 18, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.45, textWrap: "pretty",
                  }}>
                    {signalsData.headline}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
                  {signalsData.signals.map((s: SignalItem, i: number) => {
                    const sentimentColor = s.sentiment === "positive" ? "#2D6B4A" : s.sentiment === "negative" ? "#8B3A3A" : "#7A6020";
                    const sentimentBg = s.sentiment === "positive" ? "rgba(45,107,74,0.08)" : s.sentiment === "negative" ? "rgba(139,58,58,0.08)" : "rgba(122,96,32,0.08)";
                    const typeLabel = s.type === "hiring_surge" ? "↑ Hiring" : s.type === "hiring_freeze" ? "↓ Freeze" : s.type === "funding" ? "$ Funding" : s.type === "role_demand" ? "⬆ Demand" : s.type === "salary" ? "$ Salary" : "◎ Trend";
                    return (
                      <div key={i} style={{
                        flex: "none", width: 240, background: "#FFFFFF", borderRadius: 9,
                        padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
                          <span style={{
                            padding: "2px 8px", borderRadius: 100, background: sentimentBg,
                            fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 700,
                            color: sentimentColor, textTransform: "uppercase",
                          }}>
                            {typeLabel}
                          </span>
                          {s.company && (
                            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 600, color: "#1A3A2F" }}>
                              {s.company}
                            </span>
                          )}
                        </div>
                        <p style={{
                          fontFamily: "var(--font-cormorant), Georgia, serif",
                          fontSize: 15, fontWeight: 600, color: "#1A1A1A", marginBottom: 5, lineHeight: 1.4, textWrap: "pretty",
                        }}>
                          {s.title}
                        </p>
                        <p style={{
                          fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10,
                          fontWeight: 300, color: "#4A8B6A", lineHeight: 1.5,
                        }}>
                          → {s.actionable}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Salary benchmark + hot/cold skills */}
          {signalsData && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 20 }}>
              <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "16px 18px", border: "1px solid rgba(0,0,0,0.06)" }}>
                <p style={{
                  fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600,
                  color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8,
                }}>
                  Salary benchmark
                </p>
                <p style={{
                  fontFamily: "var(--font-cormorant), Georgia, serif",
                  fontSize: 16, fontWeight: 500, fontStyle: "italic", color: "#1A1A1A", marginBottom: 4,
                }}>
                  {signalsData.salaryBenchmark.role}
                </p>
                <p style={{
                  fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11,
                  fontWeight: 300, color: "#52493F", lineHeight: 1.55, textWrap: "pretty",
                }}>
                  {signalsData.salaryBenchmark.note}
                </p>
              </div>

              <div style={{ background: "#FFFFFF", borderRadius: 10, padding: "16px 18px", border: "1px solid rgba(0,0,0,0.06)" }}>
                <p style={{
                  fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600,
                  color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8,
                }}>
                  Skills in demand
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
                  {signalsData.hotSkills.map((s) => (
                    <span key={s} style={{
                      padding: "3px 10px", background: "rgba(74,139,106,0.1)", borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, fontWeight: 500, color: "#2D6B4A",
                    }}>
                      ↑ {s}
                    </span>
                  ))}
                </div>
                <p style={{
                  fontFamily: "var(--font-dm-sans), system-ui", fontSize: 9, fontWeight: 600,
                  color: "#A09890", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6,
                }}>
                  Cooling
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {signalsData.coldSkills.map((s) => (
                    <span key={s} style={{
                      padding: "3px 10px", background: "rgba(160,152,144,0.12)", borderRadius: 100,
                      fontFamily: "var(--font-dm-sans), system-ui", fontSize: 10, color: "#7A7268",
                    }}>
                      ↓ {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
