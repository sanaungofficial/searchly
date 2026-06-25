/** Shared match-score colors and labels for pipeline + recommended jobs. */

export type MatchScoreTier = "excellent" | "strong" | "good" | "fair" | "poor";

export type MatchScoreStyle = {
  tier: MatchScoreTier;
  label: string;
  accent: string;
  bg: string;
  bgSubtle: string;
};

/** 90+ excellent · 75–89 strong · 60–74 good · 50–59 fair · below 50 stretch */
export function matchScoreTier(score: number): MatchScoreTier {
  if (score >= 90) return "excellent";
  if (score >= 75) return "strong";
  if (score >= 60) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

export function matchScoreStyle(score: number): MatchScoreStyle {
  const tier = matchScoreTier(score);
  switch (tier) {
    case "excellent":
      return { tier, label: "Excellent", accent: "#1A3A2F", bg: "rgba(26,58,47,0.14)", bgSubtle: "rgba(26,58,47,0.07)" };
    case "strong":
      return { tier, label: "Strong", accent: "#2A6B4A", bg: "rgba(42,107,74,0.14)", bgSubtle: "rgba(42,107,74,0.07)" };
    case "good":
      return { tier, label: "Good", accent: "#A89462", bg: "rgba(196,168,106,0.18)", bgSubtle: "rgba(196,168,106,0.1)" };
    case "fair":
      return { tier, label: "Fair", accent: "#C4844A", bg: "rgba(196,132,74,0.16)", bgSubtle: "rgba(196,132,74,0.09)" };
    case "poor":
      return { tier, label: "Stretch", accent: "#C4574A", bg: "rgba(196,87,74,0.14)", bgSubtle: "rgba(196,87,74,0.08)" };
  }
}

export function matchScoreColor(score: number): string {
  return matchScoreStyle(score).accent;
}

export function matchScoreLabelFor(score: number): string {
  return matchScoreStyle(score).label;
}

/** Drop useless keyword fallback lines (e.g. "0 of 0 key terms"). */
export function usableKeywordSummary(matched: number, total: number): string | null {
  if (total < 3 || matched <= 0) return null;
  const pct = Math.round((matched / total) * 100);
  if (pct < 25) return null;
  return `Your resume covers ${matched} of ${total} relevant terms from this posting (${pct}%).`;
}

/** Coach directory: profile ↔ coach keyword overlap (not a job posting). */
export function coachProfileKeywordSummary(matched: number, total: number): string | null {
  if (total < 3 || matched <= 0) return null;
  const pct = Math.round((matched / total) * 100);
  if (pct < 20) return null;
  return `Your profile shares ${matched} of ${total} focus areas with this coach (${pct}% overlap).`;
}

export function coachMatchTierExplanation(score: number, label: string): string {
  const tier = matchScoreTier(score);
  switch (tier) {
    case "excellent":
      return `${label} (${score}/100) — strong alignment with your goals, background, and target roles.`;
    case "strong":
      return `${label} (${score}/100) — clear overlap with your experience and what you're working toward.`;
    case "good":
      return `${label} (${score}/100) — meaningful overlap; worth exploring in an intro call.`;
    case "fair":
      return `${label} (${score}/100) — partial overlap; coach may still help on adjacent goals.`;
    case "poor":
      return `${label} (${score}/100) — different primary focus from your profile, but may still offer useful perspective.`;
  }
}

export function isLowQualityMatchReason(reason: string): boolean {
  if (/0 of 0 key terms/i.test(reason)) return true;
  const m = reason.match(/(\d+) of (\d+) key terms from the job description/i);
  if (m && Number(m[1]) === 0) return true;
  return false;
}
