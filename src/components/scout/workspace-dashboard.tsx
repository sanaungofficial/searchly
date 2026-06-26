"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { isStaffPortalRole } from "@/lib/staff-portal";
import { GrowthWelcomeModal } from "@/components/scout/growth-welcome-modal";
import { DashboardHomeTop } from "@/components/scout/dashboard-home-top";
import { type KanbanCard } from "./workspace-data";
import { ScoutBox, ScoutLabel } from "./scout-box";
import { WorkspaceContent, WorkspaceScroll } from "./workspace-content";
import { fontSans, fontMono, color, surface, border, displayTitleStyle, type as T } from "@/lib/typography";

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
    borderRadius: "var(--scout-radius)",
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
          borderRadius: "var(--scout-radius)",
          boxShadow: "var(--scout-shadow-card)",
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
        borderRadius: "var(--scout-radius)",
        boxShadow: "var(--scout-shadow-card)",
        cursor: "pointer",
        textAlign: "left",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <div style={{ width: 8, height: 8, flexShrink: 0, borderRadius: "50%", background: stageColor }} />
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
  const { kanbanCards, showSeekerDashboard } = useWorkspace();
  const showJobSeekerPipeline = showSeekerDashboard;
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

  const statValueSize = isMobile ? 36 : T.stat;
  const statCardPad = isMobile ? "16px 18px" : "20px 24px";

  function convRate(from: number, to: number) {
    if (from === 0) return null;
    return Math.round((to / from) * 100);
  }

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
      <WorkspaceScroll>
        <WorkspaceContent>
          <DashboardHomeTop isMobile={isMobile} />

          {showJobSeekerPipeline && (
            <div style={{ borderTop: border.line, paddingTop: isMobile ? 24 : 32, marginBottom: isMobile ? 24 : 32 }}>
              <ScoutLabel>Your saved jobs</ScoutLabel>

              {total === 0 ? (
                <ScoutBox style={{ marginTop: 10, textAlign: "center" }} padding={isMobile ? "24px 20px" : "20px 24px"}>
                  <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0, lineHeight: 1.5 }}>
                    No jobs tracked yet — browse recommended roles or add jobs from Opportunities.
                  </p>
                </ScoutBox>
              ) : (
                <>
                  {total > 0 && (
                    <ScoutBox stack padding={statCardPad} style={{ marginTop: 10, marginBottom: 20 }}>
                      <ScoutLabel>Active roles</ScoutLabel>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
                        <span style={displayTitleStyle(isMobile ? 40 : 48, { lineHeight: 1 })}>
                          {total}
                        </span>
                        <span style={displayTitleStyle(20, { color: color.muted, lineHeight: 1.1 })}>saved</span>
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
          )}
        </WorkspaceContent>
      </WorkspaceScroll>
      {showWelcome && <GrowthWelcomeModal onClose={() => setShowWelcome(false)} />}
    </div>
  );
}
