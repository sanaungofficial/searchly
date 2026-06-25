"use client";

import { isLowQualityMatchReason, matchScoreStyle } from "@/lib/match-score";
import { fontSans, fontMono, color, type as T } from "@/lib/typography";

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
        Why you&apos;re a good fit
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
