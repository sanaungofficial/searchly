"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import type { JobMeta } from "@/hooks/useJobs";
import {
  INITIAL_SIGNALS,
  type KanbanCard,
  type SignalItem,
  type SignalsData,
} from "./workspace-data";
import { PlusIcon, RefreshIcon } from "./workspace-icons";
import { fontSans, fontMono, color, type as T } from "@/lib/typography";

const SECTION_LABEL: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: T.label,
  fontWeight: 600,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 14,
};

const STAT_LABEL: React.CSSProperties = {
  fontFamily: fontSans,
  fontSize: T.label,
  fontWeight: 600,
  color: color.muted,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 10,
};

function stageMeta(stage: KanbanCard["stage"]) {
  const stageLabel =
    stage === "saved"
      ? "Saved"
      : stage === "applied"
        ? "Applied"
        : stage === "interview"
          ? "Interviewing"
          : stage === "offer"
            ? "Offer"
            : stage;
  const stageColor =
    stage === "offer"
      ? "#1A3A2F"
      : stage === "interview"
        ? "#2D6B4A"
        : stage === "applied"
          ? "#5A8A6E"
          : "#8B9E8B";
  return { stageLabel, stageColor };
}

function formatDaysAgo(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

function ActivityFeedItem({
  card,
  isMobile,
  onNavigate,
}: {
  card: KanbanCard;
  isMobile: boolean;
  onNavigate: () => void;
}) {
  const { stageLabel, stageColor } = stageMeta(card.stage);
  const timeLabel = formatDaysAgo(card.days);

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={onNavigate}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "14px 16px",
          background: "#FFFFFF",
          borderRadius: 10,
          border: "1px solid #d6d3d1",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              flexShrink: 0,
              background: stageColor,
              marginTop: 6,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 15,
                color: "#1c1917",
                fontWeight: 600,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {card.company}
            </p>
            <p
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                color: "#57534e",
                margin: "4px 0 0",
                lineHeight: 1.4,
              }}
            >
              {card.role}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 18 }}>
          <span
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: T.label,
              color: stageColor,
              background: stageColor + "20",
              padding: "4px 10px",
              borderRadius: 100,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {stageLabel}
          </span>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 12,
              color: "#78716c",
            }}
          >
            {timeLabel}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onNavigate}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "14px 18px",
        background: "#FFFFFF",
        borderRadius: 10,
        border: "1px solid #d6d3d1",
        cursor: "pointer",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: stageColor }} />
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 15,
          color: "#1c1917",
          fontWeight: 500,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {card.company}
      </span>
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#c7c4bf" }}>·</span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 14,
          color: "#44403c",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 220,
        }}
      >
        {card.role}
      </span>
      <span
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: T.label,
          color: stageColor,
          background: stageColor + "20",
          padding: "3px 10px",
          borderRadius: 100,
          flexShrink: 0,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {stageLabel}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontSize: 13,
          color: "#78716c",
          flexShrink: 0,
        }}
      >
        {timeLabel}
      </span>
    </button>
  );
}

export function WorkspaceDashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
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

  const funnelStages: { key: keyof typeof pipeline; label: string }[] = [
    { key: "saved", label: "Saved" },
    { key: "applied", label: "Applied" },
    { key: "interview", label: "Interviewing" },
    { key: "offer", label: "Offer" },
  ];

  const headerPad = isMobile ? "12px 16px 12px 56px" : "12px 28px";
  const panelPad = isMobile ? "12px 16px" : "12px 28px";
  const contentPad = isMobile ? "20px 16px 40px" : "28px 32px 48px";
  const statValueSize = isMobile ? 36 : T.stat;
  const statCardPad = isMobile ? "16px 18px" : "20px 24px";

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

  const openAddPanel = () => setShowAddPanel(true);

  const jobAnalysisColumns =
    jobAnalysis?.description && jobAnalysis.requirements.length > 0
      ? isMobile
        ? "1fr"
        : "1fr 1fr"
      : "1fr";

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
      {/* Header bar — left padding clears mobile hamburger */}
      <div
        style={{
          padding: headerPad,
          borderBottom: "1px solid rgba(0,0,0,0.07)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 0, minWidth: 0 }}>
          <span
            style={{
              padding: isMobile ? "7px 0" : "7px 18px",
              fontFamily: "var(--font-ui)",
              fontSize: isMobile ? 15 : 13,
              fontWeight: 600,
              color: "#1A3A2F",
              borderBottom: "2px solid #1A3A2F",
            }}
          >
            Dashboard
          </span>
        </div>
        <button
          onClick={() => setShowAddPanel((p) => !p)}
          aria-expanded={showAddPanel}
          aria-label={showAddPanel ? "Close add job panel" : "Add job"}
          style={{
            padding: isMobile ? "10px 14px" : "7px 16px",
            minHeight: 44,
            background: "#1A3A2F",
            color: "#E8D5A3",
            border: "none",
            borderRadius: 5,
            fontFamily: "var(--font-ui)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            letterSpacing: "0.2px",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
          }}
        >
          <PlusIcon /> {isMobile && showAddPanel ? "Close" : "Add job"}
        </button>
      </div>

      {/* Add job panel */}
      {showAddPanel && (
        <div
          style={{
            padding: panelPad,
            background: "rgba(26,58,47,0.04)",
            borderBottom: "1px solid rgba(0,0,0,0.07)",
            animation: "fadeIn 0.2s ease both",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: 8,
              maxWidth: isMobile ? "none" : 560,
            }}
          >
            <input
              type="url"
              placeholder={
                isMobile
                  ? "Paste job listing URL…"
                  : "Paste a job listing URL — e.g. https://stripe.com/jobs/..."
              }
              value={addJobUrl}
              onChange={(e) => setAddJobUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAddJob()}
              style={{
                flex: 1,
                padding: "12px 12px",
                border: "1px solid rgba(26,58,47,0.2)",
                borderRadius: 6,
                background: "#FFFFFF",
                fontFamily: "var(--font-ui)",
                fontSize: 16,
                color: "#1A1A1A",
                minWidth: 0,
                width: "100%",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={submitAddJob}
              disabled={addJobLoading || !addJobUrl.trim()}
              style={{
                padding: "12px 18px",
                minHeight: 44,
                background: addJobUrl.trim() ? "#1A3A2F" : "rgba(26,58,47,0.35)",
                color: "#E8D5A3",
                border: "none",
                borderRadius: 6,
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                cursor: addJobUrl.trim() ? "pointer" : "not-allowed",
                flexShrink: 0,
                width: isMobile ? "100%" : undefined,
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
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#1A3A2F" }}>
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
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#C4574A" }}>
                {addJobError}
              </p>
            </div>
          )}

          {jobAnalysis && (
            <div style={{ padding: "20px 0 0", animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "#1A1A1A" }}>
                      {jobAnalysis.company ?? "Unknown company"}
                    </p>
                    {jobAnalysis.role && (
                      <>
                        <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#52493F" }}>·</span>
                        <p style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "#52493F" }}>{jobAnalysis.role}</p>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {jobAnalysis.location && (
                      <span style={{ padding: "3px 10px", background: "rgba(0,0,0,0.05)", borderRadius: 100, fontFamily: "var(--font-ui)", fontSize: 13, color: "#52493F" }}>
                        📍 {jobAnalysis.location}
                      </span>
                    )}
                    {jobAnalysis.salary && (
                      <span style={{ padding: "3px 10px", background: "rgba(74,139,106,0.1)", borderRadius: 100, fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: "#2D6B4A" }}>
                        {jobAnalysis.salary}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: jobAnalysisColumns, gap: 14, marginBottom: 14 }}>
                {jobAnalysis.description && (
                  <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p style={SECTION_LABEL}>Role Summary</p>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.65 }}>
                      {jobAnalysis.description}
                    </p>
                  </div>
                )}
                {jobAnalysis.requirements.length > 0 && (
                  <div style={{ background: "#FFFFFF", borderRadius: 8, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)" }}>
                    <p style={{ ...SECTION_LABEL, marginBottom: 10 }}>Key Requirements</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {jobAnalysis.requirements.map((r: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                          <span style={{ color: "#4A8B6A", fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#2A2218", lineHeight: 1.5 }}>{r}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={addToKanban}
                  style={{
                    padding: "12px 22px",
                    minHeight: 44,
                    background: "#1A3A2F",
                    color: "#E8D5A3",
                    border: "none",
                    borderRadius: 6,
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    flex: isMobile ? 1 : undefined,
                  }}
                >
                  + Add to pipeline
                </button>
                <button
                  onClick={dismissJobAnalysis}
                  style={{
                    padding: "12px 16px",
                    minHeight: 44,
                    background: "transparent",
                    color: "#a8a29e",
                    border: "none",
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main scrollable content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ padding: contentPad }}>

          {/* Pipeline */}
          <div style={{ marginBottom: isMobile ? 24 : 32 }}>
            <p style={SECTION_LABEL}>Your pipeline</p>

            {total === 0 ? (
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: 12,
                  padding: isMobile ? "24px 20px" : "20px 24px",
                  border: "1px solid #e7e5e4",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 13,
                    color: "#a8a29e",
                    marginBottom: isMobile ? 16 : 0,
                    lineHeight: 1.5,
                  }}
                >
                  No jobs tracked yet — add your first job to start building your pipeline.
                </p>
                {isMobile && (
                  <button
                    type="button"
                    onClick={openAddPanel}
                    style={{
                      padding: "12px 20px",
                      minHeight: 44,
                      background: "#1A3A2F",
                      color: "#E8D5A3",
                      border: "none",
                      borderRadius: 6,
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    + Add your first job
                  </button>
                )}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
                    gap: isMobile ? 10 : 12,
                    marginBottom: 20,
                  }}
                >
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
                          padding: statCardPad,
                        }}
                      >
                        <p style={STAT_LABEL}>{stage.label}</p>
                        <p
                          style={{
                            fontFamily: fontSans,
                            fontSize: statValueSize,
                            fontWeight: 600,
                            color: color.ink,
                            lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {count}
                        </p>
                        {rate !== null && (
                          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, marginTop: 4 }}>
                            {rate}% from previous
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {recentActivity.length > 0 && (
                  <div>
                    <p style={SECTION_LABEL}>Last 7 days</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 8 : 6 }}>
                      {recentActivity.slice(0, 6).map((card: KanbanCard) => (
                        <ActivityFeedItem
                          key={card.id}
                          card={card}
                          isMobile={isMobile}
                          onNavigate={() => router.push("/opportunities")}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Market signals */}
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "space-between",
                marginBottom: 14,
                gap: 12,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <p style={{ ...SECTION_LABEL, marginBottom: isMobile ? 0 : 14 }}>Kimchi signals · updated weekly</p>
              <button
                onClick={refreshSignals}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  color: "#1A3A2F",
                  padding: isMobile ? "8px 0" : 0,
                  minHeight: isMobile ? 44 : undefined,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <RefreshIcon /> Refresh →
              </button>
            </div>

            {signalsLoading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "14px 18px",
                  background: "#FFFFFF",
                  borderRadius: 12,
                  border: "1px solid #d6d3d1",
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#1A3A2F", animation: "pulse 1s ease infinite", flexShrink: 0 }} />
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "#1A3A2F" }}>
                  Kimchi is scanning the market…
                </p>
              </div>
            )}

            {signalsData && (
              <>
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: 12,
                    padding: isMobile ? "16px 18px" : "18px 22px",
                    marginBottom: 12,
                    border: "1px solid #d6d3d1",
                    borderLeft: "3px solid #1A3A2F",
                  }}
                >
                  <p style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontSize: 12, fontWeight: 600, color: "#57534e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                    This week&apos;s read
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: isMobile ? 20 : 24,
                      fontWeight: 600,
                      color: "#1c1917",
                      lineHeight: 1.4,
                    }}
                  >
                    {signalsData.headline}
                  </p>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    overflowX: "auto",
                    paddingBottom: 4,
                    marginLeft: isMobile ? -16 : 0,
                    marginRight: isMobile ? -16 : 0,
                    paddingLeft: isMobile ? 16 : 0,
                    paddingRight: isMobile ? 16 : 0,
                    scrollbarWidth: "none",
                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  {signalsData.signals.map((s: SignalItem, i: number) => {
                    const sentimentColor = s.sentiment === "positive" ? "#2D6B4A" : s.sentiment === "negative" ? "#8B3A3A" : "#7A6020";
                    const sentimentBg = s.sentiment === "positive" ? "rgba(45,107,74,0.08)" : s.sentiment === "negative" ? "rgba(139,58,58,0.08)" : "rgba(122,96,32,0.08)";
                    const typeLabel = s.type === "hiring_surge" ? "Hiring" : s.type === "hiring_freeze" ? "Freeze" : s.type === "funding" ? "Funding" : s.type === "role_demand" ? "Demand" : s.type === "salary" ? "Salary" : "Trend";
                    return (
                      <div
                        key={i}
                        style={{
                          flex: "none",
                          width: isMobile ? "min(85vw, 272px)" : 272,
                          background: "#FFFFFF",
                          borderRadius: 12,
                          padding: "18px 20px",
                          border: "1px solid #d6d3d1",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 100,
                              background: sentimentBg,
                              fontFamily: "ui-monospace, monospace",
                              fontSize: 13,
                              fontWeight: 700,
                              color: sentimentColor,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {typeLabel}
                          </span>
                          {s.company && (
                            <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, color: "#1A3A2F" }}>
                              {s.company}
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: isMobile ? 17 : 19,
                            fontWeight: 600,
                            color: "#1c1917",
                            marginBottom: 8,
                            lineHeight: 1.35,
                          }}
                        >
                          {s.title}
                        </p>
                        <p
                          style={{
                            fontFamily: "var(--font-ui)",
                            fontSize: 13,
                            color: "#2D6B4A",
                            lineHeight: 1.55,
                          }}
                        >
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
                gap: 12,
                marginTop: 20,
              }}
            >
              <div style={{ background: "#FFFFFF", borderRadius: 12, padding: isMobile ? "18px 20px" : "22px 24px", border: "1px solid #d6d3d1" }}>
                <p style={SECTION_LABEL}>Salary benchmark</p>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: isMobile ? 20 : 22,
                    fontWeight: 500,
                    fontStyle: "italic",
                    color: "#1c1917",
                    marginBottom: 8,
                  }}
                >
                  {signalsData.salaryBenchmark.role}
                </p>
                <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#44403c", lineHeight: 1.6 }}>
                  {signalsData.salaryBenchmark.note}
                </p>
              </div>

              <div style={{ background: "#FFFFFF", borderRadius: 12, padding: isMobile ? "18px 20px" : "22px 24px", border: "1px solid #d6d3d1" }}>
                <p style={SECTION_LABEL}>Skills in demand</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                  {signalsData.hotSkills.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "4px 12px",
                        background: "rgba(74,139,106,0.1)",
                        borderRadius: 100,
                        fontFamily: "var(--font-ui)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: "#2D6B4A",
                      }}
                    >
                      ↑ {s}
                    </span>
                  ))}
                </div>
                <p style={{ fontFamily: "ui-monospace, 'Courier New', monospace", fontSize: 12, fontWeight: 600, color: "#78716c", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                  Cooling
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {signalsData.coldSkills.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "4px 12px",
                        background: "rgba(160,152,144,0.12)",
                        borderRadius: 100,
                        fontFamily: "var(--font-ui)",
                        fontSize: 13,
                        color: "#57534e",
                      }}
                    >
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
