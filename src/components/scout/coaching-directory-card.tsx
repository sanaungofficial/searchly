"use client";

import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CoachFitAssessment, CoachMatchScoreCluster } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { bioSnippet } from "@/lib/coach-directory";
import { matchScoreTier } from "@/lib/match-score";
import type { CoachListItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

function CoachMetaPill({
  icon,
  label,
  tone = "neutral",
}: {
  icon: string;
  label: string;
  tone?: "neutral" | "forest" | "gold" | "mint";
}) {
  const tones = {
    neutral: { bg: surface.inset, color: color.stone, border: border.line },
    forest: { bg: "rgba(26,58,47,0.08)", color: color.forest, border: "rgba(26,58,47,0.15)" },
    gold: { bg: "rgba(196,168,106,0.14)", color: "#7A6020", border: "rgba(196,168,106,0.35)" },
    mint: { bg: "rgba(74,139,106,0.12)", color: "#2A5A45", border: "rgba(74,139,106,0.25)" },
  };
  const t = tones[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        fontFamily: fontSans,
        fontSize: 12,
        fontWeight: 600,
        color: t.color,
        lineHeight: 1.3,
      }}
    >
      <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </span>
  );
}

function RateDisplay({ rate, isPro, onSubscribe }: { rate: number; isPro: boolean; onSubscribe: () => void }) {
  if (isPro) {
    return (
      <span style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, color: color.ink }}>
        ${rate}<span style={{ fontWeight: 500, color: color.muted, fontSize: 14 }}>/hr</span>
      </span>
    );
  }
  return (
    <span onClick={onSubscribe} title="Subscribe to see rate" style={{ cursor: "pointer", userSelect: "none" }}>
      <span style={{ fontFamily: fontSans, fontSize: 15, fontWeight: 700, filter: "blur(5px)", pointerEvents: "none" }}>${rate}</span>
      <span style={{ fontSize: 14, color: color.muted, filter: "blur(5px)", pointerEvents: "none" }}>/hr</span>
    </span>
  );
}

export function CoachingDirectoryCard({
  coach,
  isMobile,
  isPro,
  onSubscribe,
  onFollow,
  following,
  onOpenCoach,
}: {
  coach: CoachListItem;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onFollow: (coach: CoachListItem) => void;
  following: boolean;
  onOpenCoach: (coach: CoachListItem) => void;
}) {
  const matchScore = coach.matchScore ?? 0;
  const tier = matchScore > 0 ? matchScoreTier(matchScore) : null;
  const showTopBorder = tier === "excellent" || tier === "strong" || tier === "good";

  const companyLabel = coach.currentCompany
    ? `Works at ${coach.currentCompany}`
    : coach.firms[0]
      ? `Experience at ${coach.firms[0]}`
      : null;

  const isFavorite = (coach.avgRating ?? 0) >= 4.7 && (coach.reviewCount ?? 0) >= 8;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenCoach(coach)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenCoach(coach);
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <ScoutBox
        padding={isMobile ? "16px 18px" : "18px 22px"}
        style={{
          border: coach.featured ? border.lineStrong : border.line,
          borderTop: showTopBorder ? `2px solid ${color.forest}` : undefined,
        }}
      >
        <div style={{ display: "flex", gap: isMobile ? 14 : 18, alignItems: "flex-start" }}>
          <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 52 : 56} rounded />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 700, color: color.ink, margin: 0, lineHeight: 1.3 }}>
                  {coach.displayName}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 6 }}>
                  <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
                  {coach.currentRole && (
                    <span style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>
                      {coach.currentRole}
                    </span>
                  )}
                </div>
              </div>
              {matchScore > 0 && (
                <CoachMatchScoreCluster score={matchScore} label={coach.matchLabel ?? ""} align="right" />
              )}
            </div>

            {coach.headline && (
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: 14,
                  fontWeight: 600,
                  color: color.ink,
                  lineHeight: 1.45,
                  margin: "10px 0 0",
                }}
              >
                {coach.headline}
              </p>
            )}

            {coach.bio && (
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: 13,
                  color: color.stone,
                  lineHeight: 1.55,
                  margin: "6px 0 0",
                }}
              >
                {bioSnippet(coach.bio, 140)}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {companyLabel && <CoachMetaPill icon="🏢" label={companyLabel} tone="forest" />}
              {coach.isProfessionalCoach && <CoachMetaPill icon="🏆" label="Top expert" tone="gold" />}
              {isFavorite && <CoachMetaPill icon="✦" label="Highly rated" tone="mint" />}
              {coach.featured && <CoachMetaPill icon="★" label="Featured" tone="gold" />}
              {coach.firms.slice(1, 3).map((f) => (
                <CoachMetaPill key={f} icon="◆" label={f} tone="neutral" />
              ))}
              {coach.specialties.slice(0, 2).map((s) => (
                <CoachMetaPill key={s} icon="◎" label={s} tone="neutral" />
              ))}
            </div>

            {matchScore > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <CoachFitAssessment
                  compact
                  job={{
                    matchScore,
                    matchLabel: coach.matchLabel ?? "",
                    matchReasons: coach.matchReasons ?? [],
                    matchedSkills: coach.matchedSkills,
                  }}
                />
              </div>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginTop: 14,
                flexWrap: "wrap",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {coach.hourlyRate ? <RateDisplay rate={coach.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} /> : null}
                {coach.location && (
                  <span style={{ fontFamily: fontSans, fontSize: 13, color: color.muted }}>{coach.location}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <ScoutSecondaryBtn onClick={() => onFollow(coach)} style={{ minHeight: 38, fontSize: 13, padding: "8px 14px" }}>
                  {following ? "Following" : "+ Follow"}
                </ScoutSecondaryBtn>
                <ScoutPrimaryBtn onClick={() => onOpenCoach(coach)} style={{ minHeight: 38, fontSize: 13, padding: "8px 16px" }}>
                  {isPro ? "Free intro call" : "View profile"}
                </ScoutPrimaryBtn>
              </div>
            </div>
          </div>
        </div>
      </ScoutBox>
    </div>
  );
}
