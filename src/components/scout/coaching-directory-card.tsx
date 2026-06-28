"use client";

import { InternalCoachBadge } from "@/components/scout/internal-coach-badge";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CompanyLogo } from "@/components/scout/company-logo";
import { CoachFitAssessment } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import { bioSnippet } from "@/lib/coach-directory";
import {
  buildCoachExperienceCompanies,
  cleanCoachCompanyName,
  coachCompanyWorksLabel,
  type CoachCompanyLookupMeta,
} from "@/lib/coach-experience-companies";
import { matchScoreTier } from "@/lib/match-score";
import type { CoachListItem } from "@/lib/coach-types";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export type CoachCompanyLookupItem = CoachCompanyLookupMeta;

function CoachCompanyPill({
  rawName,
  label,
  lookup,
}: {
  rawName: string;
  label: string;
  lookup?: CoachCompanyLookupItem;
}) {
  const displayName = cleanCoachCompanyName(rawName);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px 4px 5px",
        background: surface.inset,
        border: "var(--scout-border)",
        borderRadius: 999,
        fontFamily: fontSans,
        fontSize: 12,
        fontWeight: 600,
        color: color.stone,
        lineHeight: 1.3,
      }}
    >
      <CompanyLogo
        name={lookup?.name ?? displayName}
        logoUrl={lookup?.logoUrl}
        website={lookup?.website}
        size={22}
        borderRadius={11}
      />
      <span>{label}</span>
    </span>
  );
}

function CoachBadgePill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "forest" | "gold" | "mint";
}) {
  const tones = {
    neutral: { bg: surface.inset, color: color.stone, border: "var(--scout-border)" },
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
        padding: "5px 10px",
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        fontFamily: fontSans,
        fontSize: 12,
        fontWeight: 600,
        color: t.color,
        lineHeight: 1.3,
      }}
    >
      {label}
    </span>
  );
}

function cardPrimaryLine(coach: CoachListItem): string | null {
  const headline = coach.headline?.trim();
  if (headline) return headline;
  return coach.currentRole?.trim() || null;
}

/** One muted line under the headline — skip when bio repeats the headline or role. */
function cardSecondaryLine(coach: CoachListItem, primary: string | null): string | null {
  const raw = coach.bio?.trim();
  if (!raw) return null;
  const snippet = bioSnippet(raw, 96);
  if (!snippet) return null;
  if (!primary) return snippet;

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const p = norm(primary);
  const b = norm(snippet);
  if (b.startsWith(p) || p.startsWith(b.slice(0, Math.min(b.length, 48)))) return null;
  return snippet;
}

function WorkingTogetherBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        background: "rgba(26,58,47,0.1)",
        border: "1px solid rgba(26,58,47,0.2)",
        fontFamily: fontSans,
        fontSize: 11,
        fontWeight: 700,
        color: color.forest,
        lineHeight: 1.3,
      }}
    >
      Working together
    </span>
  );
}

function FavoriteBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: 999,
        background: "rgba(74,139,106,0.14)",
        border: "1px solid rgba(74,139,106,0.28)",
        fontFamily: fontSans,
        fontSize: 11,
        fontWeight: 700,
        color: "#2A5A45",
        lineHeight: 1.3,
      }}
    >
      Highly rated
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
  isMyCoach = false,
  canSelfAssignCoach = false,
  canAdminAssignCoach = false,
  onToggleMyCoach,
  companyLookup = {},
}: {
  coach: CoachListItem;
  isMobile: boolean;
  isPro: boolean;
  onSubscribe: () => void;
  onFollow: (coach: CoachListItem) => void;
  following: boolean;
  onOpenCoach: (coach: CoachListItem) => void;
  isMyCoach?: boolean;
  canSelfAssignCoach?: boolean;
  canAdminAssignCoach?: boolean;
  onToggleMyCoach?: (coach: CoachListItem) => void;
  companyLookup?: Record<string, CoachCompanyLookupItem>;
}) {
  const matchScore = coach.matchScore ?? 0;
  const tier = matchScore > 0 ? matchScoreTier(matchScore) : null;
  const showTopBorder = tier === "excellent" || tier === "strong" || tier === "good";

  const companyPills = buildCoachExperienceCompanies(coach).slice(0, 3);
  const isFavorite = (coach.avgRating ?? 0) >= 4.7 && (coach.reviewCount ?? 0) >= 8;
  const primaryLine = cardPrimaryLine(coach);
  const secondaryLine = cardSecondaryLine(coach, primaryLine);

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
        padding={isMobile ? "14px 16px" : "16px 20px"}
        style={{
          ...(showTopBorder ? { borderTop: `2px solid ${color.forest}` } : {}),
          transition: "box-shadow 0.15s ease",
        }}
      >
        <div style={{ display: "flex", gap: isMobile ? 12 : 16, alignItems: "flex-start" }}>
          <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={isMobile ? 56 : 64} rounded />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                lineHeight: 1.2,
                minWidth: 0,
              }}
            >
              <span style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 700, color: color.ink }}>
                {coach.displayName}
              </span>
              {coach.isInternal && <InternalCoachBadge compact />}
              <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
              {isMyCoach && <WorkingTogetherBadge />}
              {isFavorite && <FavoriteBadge />}
              {coach.featured && <CoachBadgePill label="Featured" tone="gold" />}
              {coach.isProfessionalCoach && <CoachBadgePill label="Top expert" tone="gold" />}
            </div>

            {primaryLine && (
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: 13,
                  fontWeight: 500,
                  color: color.stone,
                  lineHeight: 1.45,
                  margin: "4px 0 0",
                }}
              >
                {primaryLine}
              </p>
            )}

            {secondaryLine && (
              <p
                style={{
                  fontFamily: fontSans,
                  fontSize: 13,
                  color: color.stone,
                  lineHeight: 1.45,
                  margin: "2px 0 0",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {secondaryLine}
              </p>
            )}

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: primaryLine || secondaryLine ? 8 : 6 }}>
              {companyPills.map((pill) => (
                <CoachCompanyPill
                  key={pill.key}
                  rawName={pill.rawName}
                  label={pill.label}
                  lookup={companyLookup[pill.key]}
                />
              ))}
              {(coach.specialties ?? []).slice(0, 2).map((s) => (
                <CoachBadgePill key={s} label={s} tone="neutral" />
              ))}
            </div>

            {matchScore > 0 && (
              <div onClick={(e) => e.stopPropagation()}>
                <CoachFitAssessment
                  compact
                  showScore
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
                marginTop: 12,
                paddingTop: 12,
                borderTop: "var(--scout-border)",
                flexWrap: "wrap",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                {coach.hourlyRate ? (
                  <RateDisplay rate={coach.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} />
                ) : coach.requiresAssignment ? (
                  <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest }}>Included</span>
                ) : null}
                {coach.location && (
                  <span style={{ fontFamily: fontSans, fontSize: 12, color: color.muted }}>{coach.location}</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {canSelfAssignCoach && onToggleMyCoach && (
                  isMyCoach || (!coach.isInternal && !coach.requiresAssignment) || canAdminAssignCoach ? (
                    <ScoutSecondaryBtn
                      onClick={() => onToggleMyCoach(coach)}
                      style={{
                        minHeight: 38,
                        fontSize: 13,
                        padding: "8px 14px",
                        ...(isMyCoach
                          ? { borderColor: color.forest, color: color.forest, fontWeight: 600 }
                          : {}),
                      }}
                    >
                      {isMyCoach
                        ? "Remove from my coaches"
                        : canAdminAssignCoach && (coach.isInternal || coach.requiresAssignment)
                          ? "Assign coach"
                          : "Add as my coach"}
                    </ScoutSecondaryBtn>
                  ) : (
                    <span
                      style={{
                        fontFamily: fontSans,
                        fontSize: 12,
                        color: color.muted,
                        padding: "8px 4px",
                        lineHeight: 1.4,
                      }}
                    >
                      Assigned by your team
                    </span>
                  )
                )}
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
