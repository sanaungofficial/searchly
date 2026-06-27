import type { DashboardGoal } from "@/lib/dashboard-goals";
import { resolveProfileLocation } from "@/lib/profile-location";

export type MatchingTuningGapId =
  | "target_roles"
  | "priority_role"
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
  prioritizedRoles?: string[];
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
  priority_role: 8,
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

export function recommendationTuningGaps(input: RecommendationTuningInput): MatchingTuningGap[] {
  const gaps: MatchingTuningGap[] = [];
  const roles = (input.targetRoles ?? []).filter(Boolean);
  const priorities = input.priorities ?? [];

  if (roles.length === 0) {
    gaps.push({
      id: "target_roles",
      label: "Target roles",
      actionLabel: "Add the roles you're going for",
      weight: WEIGHTS.target_roles,
    });
  } else if (roles.length >= 2 && !(input.prioritizedRoles ?? []).some((r) => roles.includes(r))) {
    gaps.push({
      id: "priority_role",
      label: "Top priority role",
      actionLabel: "Pick your top-priority role",
      weight: WEIGHTS.priority_role,
    });
  }

  if (!hasLocation(input)) {
    gaps.push({
      id: "location",
      label: "Location",
      actionLabel: "Where do you want to work?",
      weight: WEIGHTS.location,
    });
  }

  if (!hasWorkMode(priorities)) {
    gaps.push({
      id: "work_mode",
      label: "Work arrangement",
      actionLabel: "Remote, hybrid, or in-office?",
      weight: WEIGHTS.work_mode,
    });
  }

  if (!input.relocationOpenness?.trim()) {
    gaps.push({
      id: "relocation",
      label: "Relocation",
      actionLabel: "Would you move for the right role?",
      weight: WEIGHTS.relocation,
    });
  }

  if (!input.workAuthorization?.trim()) {
    gaps.push({
      id: "visa",
      label: "Work authorization",
      actionLabel: "Do you need visa sponsorship?",
      weight: WEIGHTS.visa,
    });
  }

  if (!input.targetSalary?.trim()) {
    gaps.push({
      id: "salary",
      label: "Target salary",
      actionLabel: "What's your target pay range?",
      weight: WEIGHTS.salary,
    });
  }

  if (!input.jobTimeline?.trim()) {
    gaps.push({
      id: "timeline",
      label: "Search timeline",
      actionLabel: "When are you hoping to land something?",
      weight: WEIGHTS.timeline,
    });
  }

  if (!(input.dashboardGoals ?? []).length) {
    gaps.push({
      id: "primary_goal",
      label: "Primary goal",
      actionLabel: "Add a goal so we know what you're after",
      weight: WEIGHTS.primary_goal,
    });
  }

  if (!input.resumeUrl?.trim() && !(input.parsedData?.workExperience ?? []).length) {
    gaps.push({
      id: "resume",
      label: "Resume",
      actionLabel: "Upload your resume",
      weight: WEIGHTS.resume,
    });
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
