"use client";

import { coachMatchTierExplanation, isLowQualityMatchReason, matchScoreStyle, matchScoreTier } from "@/lib/match-score";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "@/components/scout/score-explainer-popover";
import { fontSans, fontMono, color, surface, border, type as T } from "@/lib/typography";

export type MatchScoreDisplayJob = {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills?: string[];
};

export function MatchScoreBadge({ score, label }: { score: number; label: string }) {
  const style = matchScoreStyle(score);
  return (
    <div style={{ textAlign: "center", flexShrink: 0 }}>
      <div
        style={{
          width: 52,
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: style.bg,
          border: `2px solid ${style.accent}`,
        }}
      >
        <span style={{ fontFamily: fontMono, fontSize: 20, fontWeight: 700, color: style.accent, lineHeight: 1 }}>
          {score}
        </span>
      </div>
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 600,
          color: style.accent,
          margin: "6px 0 0",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </p>
    </div>
  );
}

/** Small label under score badges — only shown after AI analysis. */
export function ScoreSourceHint({ usesAi = false }: { usesAi?: boolean }) {
  if (!usesAi) return null;
  return (
    <span
      style={{
        fontFamily: fontSans,
        fontSize: 10,
        fontWeight: 600,
        color: color.mutedLight,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      uses AI
    </span>
  );
}

/** Score badge + hover explainer — matches Opportunities recommended rows. */
export function CoachMatchScoreCluster({
  score,
  label,
  align = "right",
}: {
  score: number;
  label: string;
  align?: "left" | "right";
}) {
  if (score <= 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", gap: 4, flexShrink: 0 }}>
      <ScoreExplainerPopover variant="coach-match" align={align} />
      <MatchScoreBadge score={score} label={label} />
      <ScoreSourceHint />
    </div>
  );
}

function coachFitAssessmentSummary(score: number, label: string): string {
  const tier = matchScoreTier(score);
  if (tier === "poor") {
    return `${label} · ${score}/100 — explore whether this coach still aligns with your goals`;
  }
  if (tier === "fair") {
    return `${label} · ${score}/100 — partial overlap with your goals and profile`;
  }
  return `${label} · ${score}/100 — based on your goals and profile`;
}

/** Coaching directory fit block — honest label (not always "good fit"). */
export function CoachFitAssessment({
  job,
  compact = false,
}: {
  job: MatchScoreDisplayJob;
  compact?: boolean;
}) {
  const reasons = job.matchReasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, 3);
  if (!reasons.length || job.matchScore <= 0) return null;

  const tier = matchScoreTier(job.matchScore);
  const isStretch = tier === "poor" || tier === "fair";
  const score = matchScoreStyle(job.matchScore);
  const matchedSkills = job.matchedSkills?.slice(0, 5) ?? [];

  const bg = isStretch ? "rgba(17,17,17,0.04)" : score.bgSubtle;
  const accent = isStretch ? color.muted : score.accent;
  const borderColor = isStretch ? border.line : score.accent;

  return (
    <div
      style={{
        marginTop: compact ? 10 : 12,
        padding: compact ? "10px 12px" : "12px 14px",
        background: bg,
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: accent,
          margin: "0 0 4px",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        Alignment check
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 8px", lineHeight: 1.45 }}>
        {coachFitAssessmentSummary(job.matchScore, job.matchLabel)}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
        {reasons.map((reason) => (
          <li
            key={reason}
            style={{
              display: "flex",
              gap: 6,
              alignItems: "flex-start",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.ink,
              lineHeight: 1.45,
            }}
          >
            <span aria-hidden style={{ flexShrink: 0, color: accent, fontWeight: 700 }}>·</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      {matchedSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {matchedSkills.map((skill) => (
            <span
              key={skill}
              style={{
                padding: "2px 8px",
                background: isStretch ? surface.inset : score.bg,
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 500,
                color: accent,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchFitCallout({ job }: { job: MatchScoreDisplayJob }) {
  const reasons = job.matchReasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, 3);
  if (!reasons.length || job.matchScore <= 0) return null;

  const score = matchScoreStyle(job.matchScore);
  const matchedSkills = job.matchedSkills?.slice(0, 6) ?? [];

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: score.bgSubtle,
        borderLeft: `2px solid ${score.accent}`,
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: score.accent,
          margin: "0 0 4px",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        Alignment check
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, color: score.accent }}>{job.matchLabel}</span>
        {" "}· {job.matchScore}/100 from your profile
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {reasons.map((reason) => (
          <li
            key={reason}
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              fontFamily: fontSans,
              fontSize: T.caption,
              color: color.ink,
              lineHeight: 1.5,
            }}
          >
            <span aria-hidden style={{ flexShrink: 0, color: score.accent, fontWeight: 700, marginTop: 1 }}>
              →
            </span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      {matchedSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {matchedSkills.map((skill) => (
            <span
              key={skill}
              style={{
                padding: "3px 8px",
                background: score.bg,
                fontFamily: fontSans,
                fontSize: T.label,
                fontWeight: 500,
                color: score.accent,
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Job-drawer-style match block for coach profiles (green callout + explainer). */
export function CoachMatchSection({ job }: { job: MatchScoreDisplayJob }) {
  const reasons = job.matchReasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, 4);
  if (!reasons.length || job.matchScore <= 0) return null;

  const matchedSkills = job.matchedSkills?.slice(0, 8) ?? [];
  const tierLine = coachMatchTierExplanation(job.matchScore, job.matchLabel);

  return (
    <div
      style={{
        marginBottom: 22,
        padding: "16px 18px",
        background: "rgba(74,139,106,0.08)",
        border: "1px solid rgba(74,139,106,0.22)",
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.forest,
          margin: "0 0 8px",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        <ScoreExplainerLabel variant="coach-match">Alignment check</ScoreExplainerLabel>
      </p>
      <p style={{ fontFamily: fontSans, fontSize: 13, color: color.muted, margin: "0 0 10px", lineHeight: 1.45 }}>
        {tierLine}
      </p>
      <ul style={{ margin: 0, paddingLeft: 20, fontFamily: fontSans, fontSize: 14, color: color.ink, lineHeight: 1.55 }}>
        {reasons.map((reason) => (
          <li key={reason} style={{ marginBottom: 6 }}>{reason}</li>
        ))}
      </ul>
      {matchedSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {matchedSkills.map((skill) => (
            <span
              key={skill}
              style={{
                padding: "4px 10px",
                background: "rgba(74,139,106,0.14)",
                fontFamily: fontSans,
                fontSize: 12,
                color: "#2A4A3A",
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
