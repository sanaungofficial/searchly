"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import type { JobMeta } from "@/hooks/useJobs";
import {
  type KanbanCard,
} from "./workspace-data";
import { PlusIcon } from "./workspace-icons";

// Shared label style matching admin dashboard: font-mono, xs, uppercase, stone-400
const SECTION_LABEL: React.CSSProperties = {
  fontFamily: "ui-monospace, 'Courier New', monospace",
  fontSize: 11,
  fontWeight: 500,
  color: "#a8a29e",
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  marginBottom: 12,
};

// Matching admin StatCard value: Playfair, 3xl, stone-800
const STAT_VALUE: React.CSSProperties = {
  fontFamily: "var(--font-playfair), Georgia, serif",
  fontSize: 34,
  fontWeight: 600,
  color: "#1c1917",
  lineHeight: 1,
};

// Matching admin StatCard label
const STAT_LABEL: React.CSSProperties = {
  fontFamily: "ui-monospace, 'Courier New', monospace",
  fontSize: 10,
  fontWeight: 500,
  color: "#a8a29e",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginTop: 6,
};

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

  const funnelStages: { key: keyof typeof pipeline; label: string }[] = [
    { key: "saved", label: "Saved" },
    { key: "applied", label: "Applied" },
    { key: "interview", label: "Interviewing" },
    { key: "offer", label: "Offer" },
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

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#F7F5F2",
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
                    <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 600, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 8 }}>
                      Role Summary
                    </p>
                    <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#2A2218", lineHeight: 1.65 }}>
                      {jobAnalysis.description}
                    </p>
                  </div>
                )}
                {jobAnalysis.requirements.length > 0 && (
                  <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, fontWeight: 600, color: "#a8a29e", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 10 }}>
                      Key Requirements
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {jobAnalysis.requirements.map((r: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                          <span style={{ color: "#4A8B6A", fontSize: 11, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#2A2218", lineHeight: 1.5 }}>{r}</p>
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
                  style={{ padding: "10px 16px", background: "transparent", color: "#a8a29e", border: "none", fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, cursor: "pointer" }}
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
        <div style={{ padding: "28px 32px 48px" }}>

          {/* Pipeline — admin StatCard style */}
          <div style={{ marginBottom: 32 }}>
            <p style={SECTION_LABEL}>Your pipeline</p>

            {total === 0 ? (
              <div style={{
                background: "#FFFFFF", borderRadius: 12, padding: "20px 24px",
                border: "1px solid #e7e5e4", textAlign: "center",
              }}>
                <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 13, color: "#a8a29e" }}>
                  No jobs tracked yet — add your first job above to start building your pipeline.
                </p>
              </div>
            ) : (
              <>
                {/* 4-column stat card grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
                  {funnelStages.map((stage, idx) => {
                    const count = pipeline[stage.key];
                    const prevCount = idx === 0 ? null : pipeline[funnelStages[idx - 1].key];
                    const rate = prevCount !== null ? convRate(prevCount, count) : null;
                    return (
                      <div
                        key={stage.key}
                        style={{
                          background: "#FFFFFF",
                          borderRadius: 12,
                          border: "1px solid #e7e5e4",
                          padding: "20px 24px",
                        }}
                      >
                        <p style={STAT_LABEL}>{stage.label}</p>
                        <p style={STAT_VALUE}>{count}</p>
                        {rate !== null && (
                          <p style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 11, color: "#a8a29e", marginTop: 4 }}>
                            {rate}% from previous
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 7-day activity feed */}
                {recentActivity.length > 0 && (
                  <div>
                    <p style={SECTION_LABEL}>Last 7 days</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {recentActivity.slice(0, 6).map((card: KanbanCard) => {
                        const stageLabel = card.stage === "saved" ? "Saved" : card.stage === "applied" ? "Applied" : card.stage === "interview" ? "Interviewing" : card.stage === "offer" ? "Offer" : card.stage;
                        const stageColor = card.stage === "offer" ? "#1A3A2F" : card.stage === "interview" ? "#2D6B4A" : card.stage === "applied" ? "#5A8A6E" : "#8B9E8B";
                        return (
                          <div key={card.id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", background: "#FFFFFF",
                            borderRadius: 8, border: "1px solid #e7e5e4",
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, background: stageColor }} />
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 13, color: "#1c1917", fontWeight: 500, flex: 1, minWidth: 0,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {card.company}
                            </span>
                            <span style={{ fontFamily: "var(--font-dm-sans), system-ui", fontSize: 12, color: "#a8a29e" }}>·</span>
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 12, color: "#57534e",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180,
                            }}>
                              {card.role}
                            </span>
                            <span style={{
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 10, color: stageColor,
                              background: stageColor + "18",
                              padding: "2px 8px", borderRadius: 100, flexShrink: 0, fontWeight: 500,
                              textTransform: "uppercase", letterSpacing: "0.05em",
                            }}>
                              {stageLabel}
                            </span>
                            <span style={{
                              fontFamily: "var(--font-dm-sans), system-ui",
                              fontSize: 11, color: "#a8a29e", flexShrink: 0,
                            }}>
                              {card.days === 0 ? "today" : card.days === 1 ? "1d ago" : card.days + "d ago"}
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


        </div>
      </div>
    </div>
  );
}
