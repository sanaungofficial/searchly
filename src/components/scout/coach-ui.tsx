"use client";

import Link from "next/link";
import { CoachAvatar, CoachStarRating } from "@/components/scout/coach-avatar";
import { CoachFitAssessment, CoachMatchScoreCluster } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import type { CoachListItem } from "@/lib/coach-types";
import { COACH_MATCH_NEEDS_SIGNAL_HINT } from "@/lib/coach-goal-signals";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export function CoachRate({
  hourlyRate,
  isPro,
  onSubscribe,
}: {
  hourlyRate: number | null;
  isPro: boolean;
  onSubscribe: () => void;
}) {
  if (!hourlyRate) return null;
  if (isPro) {
    return (
      <span style={{ fontFamily: fontSans, fontSize: 14, color: color.forest, fontWeight: 600 }}>
        ${hourlyRate}<span style={{ fontWeight: 400, color: color.muted }}>/hr</span>
      </span>
    );
  }
  return (
    <span
      onClick={onSubscribe}
      title="Subscribe to see rate"
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", userSelect: "none" }}
    >
      <span style={{ fontFamily: fontSans, fontSize: 14, fontWeight: 600, color: color.forest, filter: "blur(4px)", pointerEvents: "none" }}>
        ${hourlyRate}/hr
      </span>
    </span>
  );
}

export function ProfileHintBanner({
  needsProfile,
  profileHint,
  isMobile,
}: {
  needsProfile: boolean;
  profileHint: string | null;
  isMobile: boolean;
}) {
  if (!needsProfile) return null;
  return (
    <ScoutBox
      padding={isMobile ? "14px 16px" : "16px 20px"}
      style={{ marginBottom: 20, background: "rgba(196,168,106,0.08)", border: border.lineStrong }}
    >
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: "0 0 8px", lineHeight: 1.55 }}>
        {profileHint ?? COACH_MATCH_NEEDS_SIGNAL_HINT}
      </p>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Link
          href="/dashboard"
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            color: color.forest,
            textDecoration: "none",
          }}
        >
          Add goals on Dashboard →
        </Link>
        <Link
          href="/profile/dream-role"
          style={{
            fontFamily: fontSans,
            fontSize: T.bodySm,
            fontWeight: 600,
            color: color.forest,
            textDecoration: "none",
          }}
        >
          Add target roles →
        </Link>
      </div>
    </ScoutBox>
  );
}

export function ProfileMyCoachCard({
  coach,
  loading,
  needsProfile,
  profileHint,
  isPro,
  isMobile,
  onSubscribe,
}: {
  coach: CoachListItem | null;
  loading: boolean;
  needsProfile: boolean;
  profileHint: string | null;
  isPro: boolean;
  isMobile: boolean;
  onSubscribe: () => void;
}) {
  if (loading) {
    return (
      <ScoutBox padding={isMobile ? 18 : 22} style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: 0 }}>Loading your coach match…</p>
      </ScoutBox>
    );
  }

  if (!coach) {
    return (
      <ScoutBox padding={isMobile ? 18 : 22} style={{ marginBottom: 24 }}>
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: color.muted, margin: "0 0 10px" }}>
          My Coach
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 10px", lineHeight: 1.55 }}>
          {needsProfile
            ? "Add goals on your Dashboard or target roles on Profile to get matched with a coach."
            : "Browse coaches to find someone who fits your goals."}
        </p>
        <Link href="/coaching" style={{ fontFamily: fontSans, fontSize: T.bodySm, fontWeight: 600, color: color.forest, textDecoration: "none" }}>
          Browse coaches →
        </Link>
      </ScoutBox>
    );
  }

  return (
    <ScoutBox padding={isMobile ? 18 : 22} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <p style={{ fontFamily: fontSans, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.8px", color: color.muted, margin: 0 }}>
          My Coach
        </p>
        <Link href="/coaching" style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, textDecoration: "none" }}>
          Browse all →
        </Link>
      </div>

      {needsProfile && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 14px", lineHeight: 1.5 }}>
          {profileHint ?? "Complete your profile for sharper coach matches."}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <CoachAvatar name={coach.displayName} photoUrl={coach.photoUrl} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 8 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: fontSans, fontSize: 16, fontWeight: 600, color: color.ink, margin: 0 }}>
                {coach.displayName}
              </p>
              <div style={{ marginTop: 4 }}>
                <CoachStarRating rating={coach.avgRating} count={coach.reviewCount} />
              </div>
              {(coach.currentRole || coach.headline) && (
                <p style={{ fontFamily: fontSans, fontSize: 14, color: color.muted, margin: "6px 0 0" }}>
                  {coach.currentRole}{coach.currentCompany ? ` · ${coach.currentCompany}` : coach.headline ? ` · ${coach.headline}` : ""}
                </p>
              )}
            </div>
            {(coach.matchScore ?? 0) > 0 && (
              <CoachMatchScoreCluster score={coach.matchScore!} label={coach.matchLabel ?? ""} align="right" />
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: coach.bio ? 12 : 0, alignItems: "center" }}>
            {coach.firms.slice(0, 2).map((f) => (
              <span key={f} style={{ fontFamily: fontSans, fontSize: 14, color: color.forest, fontWeight: 500 }}>{f}</span>
            ))}
            <CoachRate hourlyRate={coach.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} />
            {coach.location && (
              <span style={{ fontFamily: fontSans, fontSize: 14, color: color.muted }}>{coach.location}</span>
            )}
          </div>

          {coach.bio && (
            <p style={{ fontFamily: fontSans, fontSize: 14, color: color.stone, lineHeight: 1.65, margin: "0 0 12px" }}>
              {coach.bio.slice(0, 280)}{coach.bio.length > 280 ? "…" : ""}
            </p>
          )}

          {coach.specialties.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: (coach.matchScore ?? 0) > 0 ? 12 : 0 }}>
              {coach.specialties.slice(0, 4).map((s) => (
                <span key={s} style={{ padding: "5px 12px", background: "rgba(26,58,47,0.06)", fontFamily: fontSans, fontSize: 14, color: color.forest }}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {(coach.matchScore ?? 0) > 0 && (
            <CoachFitAssessment
              job={{
                matchScore: coach.matchScore!,
                matchLabel: coach.matchLabel ?? "",
                matchReasons: coach.matchReasons ?? [],
                matchedSkills: coach.matchedSkills,
              }}
            />
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
            {isPro && coach.calLink ? (
              <a href={coach.calLink} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <ScoutPrimaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>Book a session →</ScoutPrimaryBtn>
              </a>
            ) : (
              <ScoutSecondaryBtn onClick={onSubscribe} style={{ minHeight: isMobile ? 44 : undefined }}>
                Subscribe to book
              </ScoutSecondaryBtn>
            )}
            {coach.linkedinUrl && (
              <a
                href={coach.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "8px 16px",
                  background: surface.card,
                  color: color.forest,
                  border: border.lineStrong,
                  fontFamily: fontSans,
                  fontSize: T.bodySm,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  minHeight: isMobile ? 44 : undefined,
                }}
              >
                LinkedIn ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </ScoutBox>
  );
}
