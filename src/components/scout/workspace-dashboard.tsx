"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import type { JobMeta } from "@/hooks/useJobs";
import { GrowthWelcomeModal } from "@/components/scout/growth-welcome-modal";
import {
  INITIAL_SIGNALS,
  type KanbanCard,
  type SignalItem,
  type SignalsData,
} from "./workspace-data";
import { PlusIcon, RefreshIcon } from "./workspace-icons";
import { ScoutBox, ScoutDisplayTitle, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "./scout-box";
import { fontSans, fontMono, fontDisplay, color, surface, border, type as T } from "@/lib/typography";

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

  const stageBadge: React.CSSProperties = {
    fontFamily: fontMono,
    fontSize: T.label,
    color: stageColor,
    background: surface.inset,
    padding: "4px 10px",
    border: border.line,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

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
          background: surface.card,
          border: border.line,
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
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, fontWeight: 600, margin: 0, lineHeight: 1.3 }}>
              {card.company}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0", lineHeight: 1.4 }}>
              {card.role}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, paddingLeft: 18 }}>
          <span style={stageBadge}>{stageLabel}</span>
          <span style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted }}>{timeLabel}</span>
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
        background: surface.card,
        border: border.line,
        cursor: "pointer",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ width: 8, height: 8, flexShrink: 0, background: stageColor }} />
      <span style={{ fontFamily: fontSans, fontSize: T.body, color: color.ink, fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {card.company}
      </span>
      <span style={{ fontFamily: fontSans, fontSize: T.label, color: color.mutedLight }}>·</span>
      <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
        {card.role}
      </span>
      <span style={{ ...stageBadge, flexShrink: 0, padding: "3px 10px" }}>{stageLabel}</span>
      <span style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, flexShrink: 0 }}>{timeLabel}</span>
    </button>
  );
}

export function WorkspaceDashboard() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { kanbanCards, addJob } = useWorkspace();
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      setShowWelcome(true);
      params.delete("upgraded");
      const next = params.toString();
      const path = window.location.pathname + (next ? `?${next}` : "");
      window.history.replaceState({}, "", path);
    }
  }, []);

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
  const panelPad = isMobile ? "12px 16px 12px 56px" : "12px 28px";
  const contentPad = isMobile ? "24px 16px 40px 56px" : "32px 36px 48px";
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
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: surface.page,
        animation: "fadeIn 0.3s ease both",
      }}
    >
      <div
        style={{
          padding: headerPad,
          borderBottom: border.line,
          background: surface.card,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <ScoutLabel>Dashboard</ScoutLabel>
        <ScoutPrimaryBtn
          onClick={() => setShowAddPanel((p) => !p)}
          style={{ minHeight: 44, padding: isMobile ? "10px 14px" : "8px 16px" }}
        >
          <PlusIcon /> {isMobile && showAddPanel ? "Close" : "Add job"}
        </ScoutPrimaryBtn>
      </div>

      {showAddPanel && (
        <div
          style={{
            padding: panelPad,
            background: surface.inset,
            borderBottom: border.line,
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
                border: border.line,
                borderRadius: 0,
                background: surface.card,
                fontFamily: fontSans,
                fontSize: isMobile ? 16 : T.bodySm,
                color: color.ink,
                minWidth: 0,
                width: "100%",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
            <ScoutPrimaryBtn
              onClick={submitAddJob}
              disabled={addJobLoading || !addJobUrl.trim()}
              style={{ minHeight: 44, width: isMobile ? "100%" : undefined }}
            >
              Search →
            </ScoutPrimaryBtn>
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
              <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest }}>
                Kimchi is analyzing this listing…
              </p>
            </div>
          )}

          {addJobError && (
            <ScoutBox style={{ marginTop: 10, borderColor: "rgba(196,87,74,0.25)" }} padding="10px 14px">
              <p style={{ fontFamily: fontSans, fontSize: T.label, color: "#C4574A", margin: 0 }}>{addJobError}</p>
            </ScoutBox>
          )}

          {jobAnalysis && (
            <div style={{ padding: "20px 0 0", animation: "fadeIn 0.3s ease both" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                    <p style={{ fontFamily: fontSans, fontSize: T.body, fontWeight: 600, color: color.ink, margin: 0 }}>
                      {jobAnalysis.company ?? "Unknown company"}
                    </p>
                    {jobAnalysis.role && (
                      <>
                        <span style={{ fontFamily: fontSans, fontSize: T.label, color: color.muted }}>·</span>
                        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>{jobAnalysis.role}</p>
                      </>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {jobAnalysis.location && (
                      <span style={{ padding: "3px 10px", background: surface.inset, border: border.line, fontFamily: fontSans, fontSize: T.caption, color: color.stone }}>
                        📍 {jobAnalysis.location}
                      </span>
                    )}
                    {jobAnalysis.salary && (
                      <span style={{ padding: "3px 10px", background: surface.inset, border: border.line, fontFamily: fontSans, fontSize: T.caption, fontWeight: 500, color: color.forest }}>
                        {jobAnalysis.salary}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: jobAnalysisColumns, gap: 14, marginBottom: 14 }}>
                {jobAnalysis.description && (
                  <ScoutBox padding="14px 16px">
                    <ScoutLabel>Role summary</ScoutLabel>
                    <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.65, margin: "8px 0 0" }}>
                      {jobAnalysis.description}
                    </p>
                  </ScoutBox>
                )}
                {jobAnalysis.requirements.length > 0 && (
                  <ScoutBox padding="14px 16px">
                    <ScoutLabel>Key requirements</ScoutLabel>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
                      {jobAnalysis.requirements.map((r: string, i: number) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                          <span style={{ color: color.forest, fontSize: 12, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.5, margin: 0 }}>{r}</p>
                        </div>
                      ))}
                    </div>
                  </ScoutBox>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ScoutPrimaryBtn onClick={addToKanban} style={{ minHeight: 44, flex: isMobile ? 1 : undefined }}>
                  + Add to pipeline
                </ScoutPrimaryBtn>
                <ScoutSecondaryBtn onClick={dismissJobAnalysis} style={{ minHeight: 44 }}>
                  Dismiss
                </ScoutSecondaryBtn>
              </div>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div style={{ padding: contentPad, maxWidth: 1120, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>

          <div style={{ marginBottom: isMobile ? 24 : 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 8, height: 8, background: color.forest, display: "inline-block", flexShrink: 0 }} />
              <ScoutLabel>Overview</ScoutLabel>
            </div>
            <ScoutDisplayTitle size={isMobile ? 28 : 36} style={{ marginBottom: 10 }}>
              Your job search at a glance
            </ScoutDisplayTitle>
            <p style={{ fontFamily: fontSans, fontSize: T.body, color: color.muted, maxWidth: 520, lineHeight: 1.6, margin: 0 }}>
              Pipeline counts, recent activity, and weekly market signals — white boxes on cream, same as Opportunities.
            </p>
          </div>

          <div style={{ marginBottom: isMobile ? 24 : 32 }}>
            <ScoutLabel>Your pipeline</ScoutLabel>

            {total === 0 ? (
              <ScoutBox style={{ marginTop: 10, textAlign: "center" }} padding={isMobile ? "24px 20px" : "20px 24px"}>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, marginBottom: isMobile ? 16 : 0, lineHeight: 1.5 }}>
                  No jobs tracked yet — add your first job to start building your pipeline.
                </p>
                {isMobile && (
                  <ScoutPrimaryBtn onClick={openAddPanel} style={{ marginTop: 16, minHeight: 44 }}>
                    + Add your first job
                  </ScoutPrimaryBtn>
                )}
              </ScoutBox>
            ) : (
              <>
                {total > 0 && (
                  <ScoutBox stack padding={statCardPad} style={{ marginTop: 10, marginBottom: 20 }}>
                    <ScoutLabel>Active roles</ScoutLabel>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                      <span style={{ fontFamily: fontDisplay, fontSize: isMobile ? 40 : 48, fontWeight: 600, color: color.ink, lineHeight: 1 }}>
                        {total}
                      </span>
                      <span style={{ fontFamily: fontDisplay, fontSize: 20, color: color.muted }}>in pipeline</span>
                    </div>
                  </ScoutBox>
                )}
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
                      <ScoutBox key={stage.key} padding={statCardPad}>
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
                      </ScoutBox>
                    );
                  })}
                </div>

                {recentActivity.length > 0 && (
                  <div>
                    <div style={{ marginTop: 4, marginBottom: 10 }}>
                      <ScoutLabel>Last 7 days</ScoutLabel>
                    </div>
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

          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                display: "flex",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "space-between",
                marginBottom: 10,
                gap: 12,
                flexDirection: isMobile ? "column" : "row",
              }}
            >
              <ScoutLabel>Kimchi signals · updated weekly</ScoutLabel>
              <button
                onClick={refreshSignals}
                style={{
                  background: "none",
                  border: border.line,
                  cursor: "pointer",
                  fontFamily: fontSans,
                  fontSize: T.caption,
                  fontWeight: 600,
                  color: color.forest,
                  padding: isMobile ? "10px 14px" : "6px 12px",
                  minHeight: isMobile ? 44 : undefined,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <RefreshIcon /> Refresh
              </button>
            </div>

            {signalsLoading && (
              <ScoutBox padding="14px 18px">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: color.forest, animation: "pulse 1s ease infinite", flexShrink: 0 }} />
                  <p style={{ fontFamily: fontSans, fontSize: T.label, color: color.forest, margin: 0 }}>
                    Kimchi is scanning the market…
                  </p>
                </div>
              </ScoutBox>
            )}

            {signalsData && (
              <>
                <ScoutBox stack padding={isMobile ? "16px 18px" : "18px 22px"} style={{ marginBottom: 12 }}>
                  <ScoutLabel>This week&apos;s read</ScoutLabel>
                  <p
                    style={{
                      fontFamily: fontDisplay,
                      fontSize: isMobile ? 20 : 24,
                      fontWeight: 500,
                      fontVariationSettings: '"opsz" 72, "WONK" 1',
                      color: color.ink,
                      lineHeight: 1.4,
                      margin: "10px 0 0",
                    }}
                  >
                    {signalsData.headline}
                  </p>
                </ScoutBox>
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
                    const typeLabel = s.type === "hiring_surge" ? "Hiring" : s.type === "hiring_freeze" ? "Freeze" : s.type === "funding" ? "Funding" : s.type === "role_demand" ? "Demand" : s.type === "salary" ? "Salary" : "Trend";
                    return (
                      <ScoutBox
                        key={i}
                        padding="18px 20px"
                        style={{ flex: "none", width: isMobile ? "min(85vw, 272px)" : 272 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "2px 8px",
                              background: surface.inset,
                              border: border.line,
                              fontFamily: fontMono,
                              fontSize: T.caption,
                              fontWeight: 700,
                              color: sentimentColor,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            {typeLabel}
                          </span>
                          {s.company && (
                            <span style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest }}>
                              {s.company}
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            fontFamily: fontDisplay,
                            fontSize: isMobile ? 17 : 19,
                            fontWeight: 500,
                            fontVariationSettings: '"opsz" 72, "WONK" 1',
                            color: color.ink,
                            marginBottom: 8,
                            lineHeight: 1.35,
                          }}
                        >
                          {s.title}
                        </p>
                        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.forest, lineHeight: 1.55, margin: 0 }}>
                          → {s.actionable}
                        </p>
                      </ScoutBox>
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
              <ScoutBox padding={isMobile ? "18px 20px" : "22px 24px"}>
                <ScoutLabel>Salary benchmark</ScoutLabel>
                <p
                  style={{
                    fontFamily: fontDisplay,
                    fontSize: isMobile ? 20 : 22,
                    fontWeight: 500,
                    fontVariationSettings: '"opsz" 72, "WONK" 1',
                    color: color.ink,
                    margin: "8px 0",
                  }}
                >
                  {signalsData.salaryBenchmark.role}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.stone, lineHeight: 1.6, margin: 0 }}>
                  {signalsData.salaryBenchmark.note}
                </p>
              </ScoutBox>

              <ScoutBox padding={isMobile ? "18px 20px" : "22px 24px"}>
                <ScoutLabel>Skills in demand</ScoutLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
                  {signalsData.hotSkills.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "4px 12px",
                        background: surface.inset,
                        border: border.line,
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        fontWeight: 500,
                        color: color.forest,
                      }}
                    >
                      ↑ {s}
                    </span>
                  ))}
                </div>
                <ScoutLabel>Cooling</ScoutLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {signalsData.coldSkills.map((s) => (
                    <span
                      key={s}
                      style={{
                        padding: "4px 12px",
                        background: surface.inset,
                        border: border.line,
                        fontFamily: fontSans,
                        fontSize: T.caption,
                        color: color.muted,
                      }}
                    >
                      ↓ {s}
                    </span>
                  ))}
                </div>
              </ScoutBox>
            </div>
          )}

        </div>
      </div>
      {showWelcome && <GrowthWelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
