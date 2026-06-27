"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { type KanbanCard } from "@/components/scout/workspace-data";
import { ScoutBox, ScoutLabel, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import {
  readOnboardingFinishPayload,
  type OnboardingFinishPayload,
} from "@/lib/onboarding-finish";
import { border, color, displayTitleStyle, fontMono, fontSans, surface, type as T } from "@/lib/typography";

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

function convRate(from: number, to: number) {
  if (from === 0) return null;
  return Math.round((to / from) * 100);
}

type Props = {
  isMobile: boolean;
};

export function DashboardGetStarted({ isMobile }: Props) {
  const router = useRouter();
  const { kanbanCards, withClientReviewPath } = useWorkspace();
  const [finishPayload, setFinishPayload] = useState<OnboardingFinishPayload | null>(null);

  useEffect(() => {
    setFinishPayload(readOnboardingFinishPayload());
  }, []);

  const pipeline = useMemo(
    () => ({
      saved: kanbanCards.filter((c) => c.stage === "saved").length,
      applied: kanbanCards.filter((c) => c.stage === "applied").length,
      interview: kanbanCards.filter((c) => c.stage === "interview").length,
      offer: kanbanCards.filter((c) => c.stage === "offer").length,
    }),
    [kanbanCards],
  );

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

  const finishJobLabel =
    finishPayload?.jobTitle &&
    `${finishPayload.jobTitle}${finishPayload.company ? ` @ ${finishPayload.company}` : ""}`;

  return (
    <div
      style={{
        borderTop: border.line,
        paddingTop: isMobile ? 24 : 32,
        paddingBottom: isMobile ? 24 : 32,
        marginTop: isMobile ? 8 : 0,
      }}
    >
      <ScoutLabel>{total === 0 ? "Get started" : "Your pipeline"}</ScoutLabel>

      {finishPayload && (finishPayload.primaryAssetId || finishPayload.jobId || finishJobLabel) && (
        <ScoutBox
          padding={isMobile ? "16px 18px" : "18px 22px"}
          style={{
            marginTop: 12,
            marginBottom: 16,
            background: "rgba(74,139,106,0.06)",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            gap: 14,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: "0 0 6px" }}>
              {finishJobLabel ? "Pick up where onboarding left off" : "Your resume is ready"}
            </p>
            <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.55 }}>
              {finishJobLabel
                ? `Continue with ${finishJobLabel} — run a match or add it to your pipeline.`
                : "Open your resume to run a job match or tailor it for a role you're targeting."}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 8, flexShrink: 0 }}>
            {finishPayload.jobId && (
              <ScoutSecondaryBtn
                onClick={() => router.push(`/opportunities?job=${encodeURIComponent(finishPayload.jobId!)}`)}
                style={{ minHeight: 40, whiteSpace: "nowrap" }}
              >
                View role
              </ScoutSecondaryBtn>
            )}
            <ScoutPrimaryBtn
              onClick={() =>
                router.push(
                  withClientReviewPath(
                    finishPayload.primaryAssetId
                      ? "/profile/assets?open=primary"
                      : "/profile/assets",
                  ),
                )
              }
              style={{ minHeight: 40, whiteSpace: "nowrap" }}
            >
              {finishJobLabel ? "Run match →" : "Open resume →"}
            </ScoutPrimaryBtn>
          </div>
        </ScoutBox>
      )}

      {total === 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: isMobile ? 10 : 12,
            marginTop: 12,
          }}
        >
          {[
            {
              title: "Find roles",
              body: "Browse recommended jobs matched to your profile and goals.",
              cta: "Browse opportunities",
              onClick: () => router.push(withClientReviewPath("/opportunities")),
              primary: true,
            },
            {
              title: "Track a job",
              body: "Save a role you're interested in and move it through your pipeline.",
              cta: "Go to pipeline",
              onClick: () => router.push(withClientReviewPath("/opportunities")),
              primary: false,
            },
            {
              title: "Upload resume",
              body: "Power skill matching, tailoring, and coach recommendations.",
              cta: "Add resume",
              onClick: () => router.push(withClientReviewPath("/profile/assets")),
              primary: false,
            },
          ].map((card) => (
            <ScoutBox key={card.title} padding={isMobile ? "18px 16px" : "20px 20px"} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 700, color: color.ink, margin: "0 0 6px" }}>
                  {card.title}
                </p>
                <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: 0, lineHeight: 1.55 }}>
                  {card.body}
                </p>
              </div>
              {card.primary ? (
                <ScoutPrimaryBtn onClick={card.onClick} style={{ minHeight: 40, width: "100%" }}>
                  {card.cta}
                </ScoutPrimaryBtn>
              ) : (
                <ScoutSecondaryBtn onClick={card.onClick} style={{ minHeight: 40, width: "100%" }}>
                  {card.cta}
                </ScoutSecondaryBtn>
              )}
            </ScoutBox>
          ))}
        </div>
      ) : (
        <>
          <ScoutBox stack padding={statCardPad} style={{ marginTop: 12, marginBottom: 20 }}>
            <ScoutLabel>Active roles</ScoutLabel>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <span style={displayTitleStyle(isMobile ? 40 : 48, { lineHeight: 1 })}>{total}</span>
              <span style={displayTitleStyle(20, { color: color.muted, lineHeight: 1.1 })}>in pipeline</span>
            </div>
          </ScoutBox>

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
              const prevCount = idx === 0 ? null : pipeline[funnelStages[idx - 1]!.key];
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
                {recentActivity.slice(0, 6).map((card) => (
                  <ActivityFeedItem
                    key={card.id}
                    card={card}
                    isMobile={isMobile}
                    onNavigate={() => router.push(withClientReviewPath("/opportunities"))}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
