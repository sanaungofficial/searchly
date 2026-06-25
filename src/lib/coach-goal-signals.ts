import type { DashboardGoal } from "@/lib/dashboard-goals";

/** Heuristic signals linking dashboard goals to coach profile fields (no AI). */
export type GoalCoachSignals = {
  keywords: string[];
  categoryHints: string[];
  specialtyHints: string[];
};

export const GOAL_COACH_SIGNALS: Record<string, GoalCoachSignals> = {
  land_new_role: {
    keywords: ["job search", "recruiting", "applications", "pipeline", "offer", "hiring", "role"],
    categoryHints: ["job", "search", "career", "interview"],
    specialtyHints: ["job search", "recruiting", "career transition", "placement"],
  },
  step_up: {
    keywords: ["promotion", "leadership", "executive", "senior", "level up", "management"],
    categoryHints: ["executive", "leadership", "career"],
    specialtyHints: ["leadership", "executive", "promotion", "management"],
  },
  career_pivot: {
    keywords: ["pivot", "transition", "career change", "reposition", "new industry"],
    categoryHints: ["career", "transition", "strategy"],
    specialtyHints: ["career transition", "pivot", "repositioning"],
  },
  interview_performance: {
    keywords: ["interview", "mock interview", "prep", "behavioral", "case interview"],
    categoryHints: ["interview"],
    specialtyHints: ["interview", "mock interview", "interview prep"],
  },
  negotiate_offer: {
    keywords: ["negotiation", "offer", "salary", "compensation", "counter"],
    categoryHints: ["negotiation", "compensation"],
    specialtyHints: ["negotiation", "salary", "compensation", "offer"],
  },
  positioning: {
    keywords: ["positioning", "story", "narrative", "brand", "personal brand", "pitch"],
    categoryHints: ["positioning", "career", "strategy"],
    specialtyHints: ["positioning", "personal brand", "story", "narrative"],
  },
  resume_linkedin: {
    keywords: ["resume", "linkedin", "profile", "cv", "headline", "summary"],
    categoryHints: ["resume", "linkedin", "profile"],
    specialtyHints: ["resume", "linkedin", "profile", "cv"],
  },
  interview_coaching: {
    keywords: ["interview", "coaching", "mock", "prep", "behavioral"],
    categoryHints: ["interview", "coaching"],
    specialtyHints: ["interview", "interview coaching", "mock interview"],
  },
  salary_negotiation: {
    keywords: ["salary", "negotiation", "compensation", "offer", "equity"],
    categoryHints: ["negotiation", "compensation"],
    specialtyHints: ["salary", "negotiation", "compensation"],
  },
  executive_transition: {
    keywords: ["executive", "leadership", "c-suite", "board", "vp", "director"],
    categoryHints: ["executive", "leadership"],
    specialtyHints: ["executive", "leadership", "c-suite", "management"],
  },
  career_strategy: {
    keywords: ["strategy", "plan", "roadmap", "goals", "long-term", "career path"],
    categoryHints: ["career", "strategy"],
    specialtyHints: ["career strategy", "planning", "roadmap"],
  },
  explore_paths: {
    keywords: ["explore", "options", "paths", "discovery", "clarity", "direction"],
    categoryHints: ["career", "strategy", "coaching"],
    specialtyHints: ["career exploration", "clarity", "options"],
  },
  skill_growth: {
    keywords: ["skills", "upskill", "learning", "development", "training", "certification"],
    categoryHints: ["skills", "development", "coaching"],
    specialtyHints: ["skills", "development", "upskill", "training"],
  },
};

type CoachGoalMatchInput = {
  category?: string | null;
  specialties: string[];
  clientSpecializations: string[];
};

function signalsForGoal(goal: DashboardGoal): GoalCoachSignals {
  const mapped = GOAL_COACH_SIGNALS[goal.value];
  if (mapped) return mapped;
  const words = goal.label.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  return { keywords: words, categoryHints: words.slice(0, 3), specialtyHints: words.slice(0, 4) };
}

function includesHint(text: string, hint: string): boolean {
  const h = hint.trim().toLowerCase();
  if (h.length < 3) return false;
  return text.includes(h);
}

export function goalTextForMatching(goals: DashboardGoal[]): string {
  const parts: string[] = [];
  for (const goal of goals) {
    parts.push(goal.label);
    const signals = signalsForGoal(goal);
    parts.push(...signals.keywords, ...signals.categoryHints, ...signals.specialtyHints);
  }
  return parts.join("\n");
}

export type CoachGoalMatchResult = {
  goalScore: number;
  goalReasons: string[];
  matchedGoalLabels: string[];
};

/** Score 0–100 from dashboard goals alone (heuristic, no AI). */
export function scoreCoachForGoals(
  coach: CoachGoalMatchInput,
  goals: DashboardGoal[],
  coachTextLower: string,
): CoachGoalMatchResult {
  if (!goals.length) {
    return { goalScore: 0, goalReasons: [], matchedGoalLabels: [] };
  }

  const categoryLower = (coach.category ?? "").toLowerCase();
  const specialtyLower = coach.specialties.map((s) => s.toLowerCase());
  const clientSpecLower = coach.clientSpecializations.map((s) => s.toLowerCase());
  const perGoalMax = 100 / goals.length;
  let total = 0;
  const goalReasons: string[] = [];
  const matchedGoalLabels: string[] = [];

  for (const goal of goals) {
    const signals = signalsForGoal(goal);
    let pts = 0;

    if (categoryLower && signals.categoryHints.some((h) => includesHint(categoryLower, h))) pts += 22;

    const specHits = signals.specialtyHints.filter(
      (h) => specialtyLower.some((s) => includesHint(s, h)) || clientSpecLower.some((s) => includesHint(s, h)),
    );
    pts += Math.min(28, specHits.length * 14);

    const keywordHits = signals.keywords.filter((k) => includesHint(coachTextLower, k));
    pts += Math.min(24, keywordHits.length * 8);

    const labelWords = goal.label.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
    const labelHits = labelWords.filter((w) => coachTextLower.includes(w));
    if (labelHits.length >= 2) pts += 12;
    else if (labelHits.length === 1) pts += 6;

    const goalPts = Math.min(perGoalMax, pts);
    total += goalPts;

    if (goalPts >= perGoalMax * 0.35) {
      matchedGoalLabels.push(goal.label);
      if (specHits[0]) {
        goalReasons.push(`Supports your goal “${goal.label}” — ${specHits[0]} coaching focus.`);
      } else if (keywordHits[0]) {
        goalReasons.push(`Supports your goal “${goal.label}” — strong overlap on ${keywordHits.slice(0, 2).join(", ")}.`);
      } else {
        goalReasons.push(`Aligned with your dashboard goal: ${goal.label}.`);
      }
    }
  }

  return {
    goalScore: Math.min(100, Math.round(total)),
    goalReasons: goalReasons.slice(0, 3),
    matchedGoalLabels,
  };
}

export function coachMatchScoringEligible(
  profileText: string,
  targetRoles: string[],
  goals: DashboardGoal[],
): boolean {
  if (goals.length > 0) return true;
  if (targetRoles.some((r) => r.trim().length >= 2)) return true;
  return profileText.trim().length >= 40;
}

export const COACH_MATCH_NEEDS_SIGNAL_HINT =
  "Add goals on your Dashboard or target roles / resume on Profile to unlock coach match scores.";
