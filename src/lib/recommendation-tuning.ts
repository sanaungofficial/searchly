import type { DashboardGoal } from "@/lib/dashboard-goals";
import { resolveProfileLocation } from "@/lib/profile-location";

export type MatchingTuningGapId =
  | "target_roles"
  | "location"
  | "work_mode"
  | "relocation"
  | "visa"
  | "salary"
  | "timeline"
  | "primary_goal"
  | "resume";

export type MatchingTuningGap = {
  id: MatchingTuningGapId;
  label: string;
  actionLabel: string;
  weight: number;
};

export type RecommendationTuningInput = {
  targetRoles?: string[];
  targetMarket?: string | null;
  parsedData?: { location?: string | null; workExperience?: unknown[] } | null;
  priorities?: string[];
  relocationOpenness?: string | null;
  workAuthorization?: string | null;
  targetSalary?: string | null;
  jobTimeline?: string | null;
  dashboardGoals?: DashboardGoal[];
  resumeUrl?: string | null;
};

const WEIGHTS: Record<MatchingTuningGapId, number> = {
  target_roles: 18,
  location: 14,
  work_mode: 10,
  relocation: 6,
  visa: 6,
  salary: 12,
  timeline: 8,
  primary_goal: 10,
  resume: 8,
};

function hasWorkMode(priorities: string[]): boolean {
  const lower = priorities.map((p) => p.toLowerCase());
  return lower.some(
    (p) =>
      p.includes("remote") ||
      p.includes("hybrid") ||
      p.includes("on-site") ||
      p.includes("onsite"),
  );
}

function hasLocation(input: RecommendationTuningInput): boolean {
  const resolved = resolveProfileLocation({
    parsedLocation: input.parsedData?.location,
    targetMarket: input.targetMarket,
  });
  if (resolved?.trim()) return true;
  return (input.priorities ?? []).some((p) => p.toLowerCase().includes("remote-first"));
}

const GAP_CATALOG: Record<MatchingTuningGapId, Omit<MatchingTuningGap, "id">> = {
  target_roles: {
    label: "Target roles",
    actionLabel: "Add the roles you're going for",
    weight: WEIGHTS.target_roles,
  },
  location: {
    label: "Location",
    actionLabel: "Where do you want to work?",
    weight: WEIGHTS.location,
  },
  work_mode: {
    label: "Work arrangement",
    actionLabel: "Remote, hybrid, or in-office?",
    weight: WEIGHTS.work_mode,
  },
  relocation: {
    label: "Relocation",
    actionLabel: "Would you move for the right role?",
    weight: WEIGHTS.relocation,
  },
  visa: {
    label: "Work authorization",
    actionLabel: "Do you need visa sponsorship?",
    weight: WEIGHTS.visa,
  },
  salary: {
    label: "Target salary",
    actionLabel: "What's your target pay range?",
    weight: WEIGHTS.salary,
  },
  timeline: {
    label: "Search timeline",
    actionLabel: "When are you hoping to land something?",
    weight: WEIGHTS.timeline,
  },
  primary_goal: {
    label: "Primary goal",
    actionLabel: "Add a goal so we can match you with resources",
    weight: WEIGHTS.primary_goal,
  },
  resume: {
    label: "Resume",
    actionLabel: "Upload your resume",
    weight: WEIGHTS.resume,
  },
};

/** Fixed display order for dashboard action items (highest-impact first). */
export const MATCHING_TUNING_ITEM_ORDER: MatchingTuningGapId[] = [
  "target_roles",
  "location",
  "work_mode",
  "salary",
  "primary_goal",
  "timeline",
  "resume",
  "relocation",
  "visa",
];

export type MatchingTuningItem = MatchingTuningGap & { complete: boolean };

/** All tuning items in fixed order — completed items stay visible for strikethrough UI. */
export function recommendationTuningItems(input: RecommendationTuningInput): MatchingTuningItem[] {
  const openGapIds = new Set(recommendationTuningGaps(input).map((g) => g.id));
  return MATCHING_TUNING_ITEM_ORDER.map((id) => ({
    id,
    ...GAP_CATALOG[id],
    complete: !openGapIds.has(id),
  }));
}

export function recommendationTuningGaps(input: RecommendationTuningInput): MatchingTuningGap[] {
  const gaps: MatchingTuningGap[] = [];
  const roles = (input.targetRoles ?? []).filter(Boolean);
  const priorities = input.priorities ?? [];

  if (roles.length === 0) {
    gaps.push({ id: "target_roles", ...GAP_CATALOG.target_roles });
  }

  if (!hasLocation(input)) {
    gaps.push({ id: "location", ...GAP_CATALOG.location });
  }

  if (!hasWorkMode(priorities)) {
    gaps.push({ id: "work_mode", ...GAP_CATALOG.work_mode });
  }

  if (!input.relocationOpenness?.trim()) {
    gaps.push({ id: "relocation", ...GAP_CATALOG.relocation });
  }

  if (!input.workAuthorization?.trim()) {
    gaps.push({ id: "visa", ...GAP_CATALOG.visa });
  }

  if (!input.targetSalary?.trim()) {
    gaps.push({ id: "salary", ...GAP_CATALOG.salary });
  }

  if (!input.jobTimeline?.trim()) {
    gaps.push({ id: "timeline", ...GAP_CATALOG.timeline });
  }

  if (!(input.dashboardGoals ?? []).length) {
    gaps.push({ id: "primary_goal", ...GAP_CATALOG.primary_goal });
  }

  if (!input.resumeUrl?.trim() && !(input.parsedData?.workExperience ?? []).length) {
    gaps.push({ id: "resume", ...GAP_CATALOG.resume });
  }

  return gaps.sort((a, b) => b.weight - a.weight);
}

export function recommendationTuningPct(input: RecommendationTuningInput): number {
  const gaps = recommendationTuningGaps(input);
  const total = Object.values(WEIGHTS).reduce((sum, w) => sum + w, 0);
  const missing = gaps.reduce((sum, g) => sum + g.weight, 0);
  return Math.max(0, Math.min(100, Math.round(((total - missing) / total) * 100)));
}

export const GOALS_WIZARD_DISMISSED_KEY = "kimchi:goals-wizard-dismissed";

export function isGoalsWizardDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(GOALS_WIZARD_DISMISSED_KEY) === "1";
}

export function dismissGoalsWizard(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GOALS_WIZARD_DISMISSED_KEY, "1");
}
