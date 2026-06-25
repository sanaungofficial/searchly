"use client";

import { useState } from "react";
import Link from "next/link";
import { MatchFitCallout, MatchScoreBadge } from "@/components/scout/match-score-ui";
import { ScoutBox, ScoutPrimaryBtn, ScoutSecondaryBtn } from "@/components/scout/scout-box";
import type { MatchedCoach } from "@/lib/coach-match";
import { border, color, fontSans, surface, type as T } from "@/lib/typography";

export function coachInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function CoachAvatar({ coach, size }: { coach: MatchedCoach; size: number }) {
  const [imgError, setImgError] = useState(false);
  if (coach.photoUrl && !imgError) {
    return (
      <img
        src={coach.photoUrl}
        alt={coach.displayName}
        onError={() => setImgError(true)}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#1A3A2F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontSize: size * 0.33, fontWeight: 600, color: "#E8D5A3" }}>
        {coachInitials(coach.displayName)}
      </span>
    </div>
  );
}

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
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>
        ${hourlyRate}/hr
      </span>
    );
  }
  return (
    <span
      onClick={onSubscribe}
      title="Subscribe to see rate"
      style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", userSelect: "none" }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 500, color: "#1A3A2F", filter: "blur(4px)", pointerEvents: "none" }}>
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
      style={{ marginBottom: 14, background: "rgba(196,168,106,0.08)", border: border.lineStrong }}
    >
      <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, margin: "0 0 8px", lineHeight: 1.55 }}>
        {profileHint ?? "Add target roles or upload a resume to unlock coach match scores."}
      </p>
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
  coach: MatchedCoach | null;
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
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 10px" }}>
          My Coach
        </p>
        <p style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.muted, margin: "0 0 10px", lineHeight: 1.55 }}>
          {needsProfile
            ? "Add target roles or a resume to get matched with a coach."
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--scout-muted)", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>
          My Coach
        </p>
        <Link href="/coaching" style={{ fontFamily: fontSans, fontSize: T.caption, fontWeight: 600, color: color.forest, textDecoration: "none" }}>
          Browse all →
        </Link>
      </div>

      {needsProfile && (
        <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 12px", lineHeight: 1.5 }}>
          {profileHint ?? "Complete your profile for sharper coach matches."}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <CoachAvatar coach={coach} size={56} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                {coach.displayName}
              </p>
              <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)", margin: "4px 0 0" }}>
                {coach.currentRole}{coach.currentCompany ? ` · ${coach.currentCompany}` : ""}
              </p>
            </div>
            {coach.matchScore > 0 && (
              <MatchScoreBadge score={coach.matchScore} label={coach.matchLabel} />
            )}
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: coach.bio ? 12 : 0 }}>
            {coach.firms.slice(0, 2).map((f) => (
              <span key={f} style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F", fontWeight: 500 }}>{f}</span>
            ))}
            <CoachRate hourlyRate={coach.hourlyRate} isPro={isPro} onSubscribe={onSubscribe} />
            {coach.location && (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--scout-muted)" }}>{coach.location}</span>
            )}
          </div>

          {coach.bio && (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 400, color: "#52493F", lineHeight: 1.65, margin: "0 0 12px", textWrap: "pretty" } as React.CSSProperties}>
              {coach.bio.slice(0, 280)}{coach.bio.length > 280 ? "…" : ""}
            </p>
          )}

          {coach.specialties.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: coach.matchScore > 0 ? 12 : 0 }}>
              {coach.specialties.slice(0, 4).map((s) => (
                <span key={s} style={{ padding: "5px 12px", background: "rgba(26,58,47,0.06)", borderRadius: 0, fontFamily: "var(--font-ui)", fontSize: 14, color: "#1A3A2F" }}>
                  {s}
                </span>
              ))}
            </div>
          )}

          {coach.matchScore > 0 && (
            <MatchFitCallout
              job={{
                matchScore: coach.matchScore,
                matchLabel: coach.matchLabel,
                matchReasons: coach.matchReasons,
                matchedSkills: coach.matchedTags,
              }}
            />
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {isPro ? (
              <ScoutPrimaryBtn style={{ minHeight: isMobile ? 44 : undefined }}>Book a session →</ScoutPrimaryBtn>
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
