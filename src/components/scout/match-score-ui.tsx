"use client";

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScoreExplainerLabel, ScoreExplainerPopover } from "@/components/scout/score-explainer-popover";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import { coachMatchTierExplanation, isLowQualityMatchReason, matchScoreStyle, matchScoreTier } from "@/lib/match-score";
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

/** Compact score for fit / alignment panels (directory cards). */
export function CompactMatchScore({ score, label }: { score: number; label: string }) {
  const style = matchScoreStyle(score);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
      <div
        style={{
          minWidth: 40,
          height: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: style.bg,
          border: `1.5px solid ${style.accent}`,
          borderRadius: 8,
        }}
      >
        <span style={{ fontFamily: fontMono, fontSize: 16, fontWeight: 700, color: style.accent, lineHeight: 1 }}>
          {score}
        </span>
      </div>
      <span style={{ fontFamily: fontSans, fontSize: 13, fontWeight: 700, color: style.accent, lineHeight: 1.2 }}>
        {label}
      </span>
    </div>
  );
}

function filterCoachMatchReasons(reasons: string[], max = 4): string[] {
  return reasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, max);
}

function CoachWhyFitPanel({
  score,
  label,
  reasons,
  matchedSkills,
}: {
  score: number;
  label: string;
  reasons: string[];
  matchedSkills: string[];
}) {
  const style = matchScoreStyle(score);

  return (
    <>
      <p
        style={{
          margin: "0 0 2px",
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: color.muted,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        Why this fit
      </p>
      <p style={{ margin: "0 0 12px", fontFamily: fontSans, fontSize: T.caption, color: color.stone, lineHeight: 1.45 }}>
        {coachMatchTierExplanation(score, label)}
      </p>
      {reasons.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          {reasons.map((reason) => (
            <li key={reason} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <span style={{ color: style.accent, fontSize: 13, lineHeight: "1.45", flexShrink: 0, fontWeight: 700 }}>→</span>
              <span style={{ fontFamily: fontSans, fontSize: T.bodySm, color: color.ink, lineHeight: 1.45 }}>{reason}</span>
            </li>
          ))}
        </ul>
      )}
      {matchedSkills.length > 0 && (
        <div style={{ marginTop: reasons.length > 0 ? 12 : 0 }}>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 600,
              color: color.muted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "0 0 7px",
            }}
          >
            Matched focus areas
          </p>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {matchedSkills.map((skill) => (
              <span
                key={skill}
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  fontSize: T.label,
                  fontWeight: 600,
                  color: style.accent,
                  background: style.bg,
                  border: `1px solid ${style.accent}40`,
                  borderRadius: 4,
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/** Hover popover on coach score badge — mirrors Opportunities `DiscoveryScoreBreakdownPopover`. */
export function CoachMatchBreakdownPopover({
  score,
  label,
  reasons,
  matchedSkills,
  align = "left",
  children,
}: {
  score: number;
  label: string;
  reasons: string[];
  matchedSkills?: string[];
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filteredReasons = filterCoachMatchReasons(reasons);
  const skills = matchedSkills?.slice(0, 6) ?? [];
  const hasBreakdown = filteredReasons.length > 0 || skills.length > 0;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    if (!hoverCapable) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  }, [clearCloseTimer, hoverCapable]);

  const show = useCallback(() => {
    if (!hoverCapable || !hasBreakdown) return;
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer, hasBreakdown, hoverCapable]);

  if (!hasBreakdown || score <= 0) {
    return <>{children}</>;
  }

  return (
    <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", verticalAlign: "middle" }}>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Coach fit score ${score} — hover for breakdown`}
            aria-expanded={open}
            onMouseEnter={show}
            onMouseLeave={scheduleClose}
            onClick={(e) => {
              e.stopPropagation();
              if (!hoverCapable) setOpen((v) => !v);
            }}
            style={{
              display: "inline-flex",
              padding: 0,
              background: "transparent",
              border: "none",
              cursor: hoverCapable ? "default" : "pointer",
              lineHeight: 0,
            }}
          >
            {children}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align={align === "right" ? "end" : "start"}
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          onMouseEnter={show}
          onMouseLeave={scheduleClose}
          className="rounded-[var(--scout-radius)] border-0 bg-transparent p-0 shadow-none outline-none"
          style={{
            width: 320,
            maxWidth: "min(320px, calc(100vw - 24px))",
            zIndex: 10000,
            background: surface.card,
            border: border.lineStrong,
            boxShadow: "4px 4px 0 rgba(17,17,17,0.08)",
            padding: "14px 16px 12px",
            borderRadius: "var(--scout-radius)",
          }}
        >
          <CoachWhyFitPanel score={score} label={label} reasons={filteredReasons} matchedSkills={skills} />
        </PopoverContent>
      </Popover>
    </span>
  );
}

/** Score badge + methodology eye + hover breakdown — matches Opportunities `DiscoveryScoreCluster`. */
export function CoachMatchScoreCluster({
  score,
  label,
  align = "right",
  job,
}: {
  score: number;
  label: string;
  align?: "left" | "right";
  job?: MatchScoreDisplayJob;
}) {
  if (score <= 0) return null;

  const badge = (
    <CoachMatchBreakdownPopover
      score={score}
      label={label}
      reasons={job?.matchReasons ?? []}
      matchedSkills={job?.matchedSkills}
      align={align}
    >
      <MatchScoreBadge score={score} label={label} />
    </CoachMatchBreakdownPopover>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", gap: 4, flexShrink: 0 }}>
      <ScoreExplainerPopover variant="coach-match" align={align} />
      {badge}
      <ScoreSourceHint />
    </div>
  );
}

function coachFitAssessmentSummary(score: number, label: string, omitScore = false): string {
  const tier = matchScoreTier(score);
  if (omitScore) {
    if (tier === "poor") return "Explore whether this coach still aligns with your goals";
    if (tier === "fair") return "Partial overlap with your goals and profile";
    return "Based on your goals and profile";
  }
  if (tier === "poor") {
    return `${label} · ${score}/100 — explore whether this coach still aligns with your goals`;
  }
  if (tier === "fair") {
    return `${label} · ${score}/100 — partial overlap with your goals and profile`;
  }
  return `${label} · ${score}/100 — based on your goals and profile`;
}

/** Coaching directory fit block — score visible, details on hover (Opportunities fit-score pattern). */
export function CoachFitAssessment({
  job,
  compact = false,
  showScore = false,
}: {
  job: MatchScoreDisplayJob;
  compact?: boolean;
  /** When true, score badge sits in the panel header (directory cards). */
  showScore?: boolean;
}) {
  const reasons = filterCoachMatchReasons(job.matchReasons, 4);
  const matchedSkills = job.matchedSkills?.slice(0, 6) ?? [];
  if (job.matchScore <= 0 || (reasons.length === 0 && matchedSkills.length === 0)) return null;

  const tier = matchScoreTier(job.matchScore);
  const isStretch = tier === "poor" || tier === "fair";
  const scoreStyle = matchScoreStyle(job.matchScore);

  const bg = isStretch ? "rgba(17,17,17,0.03)" : scoreStyle.bgSubtle;
  const accent = isStretch ? color.muted : scoreStyle.accent;
  const borderColor = isStretch ? border.line : `${scoreStyle.accent}40`;

  const scoreBadge = showScore ? (
    <CompactMatchScore score={job.matchScore} label={job.matchLabel} />
  ) : (
    <MatchScoreBadge score={job.matchScore} label={job.matchLabel} />
  );

  return (
    <div
      style={{
        marginTop: compact ? 8 : 12,
        padding: compact ? "10px 12px" : "14px 16px",
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: showScore ? "center" : "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontFamily: fontSans,
              fontSize: T.label,
              fontWeight: 700,
              color: accent,
              margin: 0,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            <ScoreExplainerLabel variant="coach-match">Alignment check</ScoreExplainerLabel>
          </p>
          <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "4px 0 0", lineHeight: 1.45 }}>
            {coachFitAssessmentSummary(job.matchScore, job.matchLabel, showScore)}
            {showScore ? " Hover the score for details." : ""}
          </p>
        </div>
        <CoachMatchBreakdownPopover
          score={job.matchScore}
          label={job.matchLabel}
          reasons={job.matchReasons}
          matchedSkills={job.matchedSkills}
          align="right"
        >
          {scoreBadge}
        </CoachMatchBreakdownPopover>
      </div>
    </div>
  );
}

export function MatchFitCallout({ job }: { job: MatchScoreDisplayJob }) {
  const reasons = job.matchReasons.filter((r) => r && !isLowQualityMatchReason(r)).slice(0, 3);
  if (!reasons.length || job.matchScore <= 0) return null;

  const tier = matchScoreTier(job.matchScore);
  const isStretch = tier === "poor" || tier === "fair";
  const score = matchScoreStyle(job.matchScore);
  const matchedSkills = job.matchedSkills?.slice(0, 6) ?? [];
  const bg = isStretch ? "rgba(17,17,17,0.04)" : score.bgSubtle;
  const accent = isStretch ? color.muted : score.accent;
  const borderColor = isStretch ? border.line : score.accent;

  return (
    <div
      style={{
        marginTop: 12,
        padding: "10px 12px",
        background: bg,
        borderLeft: `2px solid ${borderColor}`,
      }}
    >
      <p
        style={{
          fontFamily: fontSans,
          fontSize: T.label,
          fontWeight: 700,
          color: accent,
          margin: "0 0 4px",
          letterSpacing: "0.03em",
          textTransform: "uppercase",
        }}
      >
        Alignment check
      </p>
      <p style={{ fontFamily: fontSans, fontSize: T.caption, color: color.muted, margin: "0 0 10px", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 600, color: accent }}>{job.matchLabel}</span>
        {" "}· {job.matchScore}/100 · quick estimate from title/resume overlap
        {isStretch ? " — open the role and run Analyze with AI for a full read" : ""}
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
            <span aria-hidden style={{ flexShrink: 0, color: accent, fontWeight: 700, marginTop: 1 }}>
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
