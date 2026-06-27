export type DashboardGoalCategory = "job_search" | "coaching" | "career" | "applications";

export type DashboardGoal = {
  id: string;
  category: DashboardGoalCategory;
  value: string;
  label: string;
  /** Month target as YYYY-MM */
  targetDate?: string | null;
  createdAt: string;
};

const TARGET_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function normalizeGoalTargetMonth(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 7);
  return TARGET_MONTH_RE.test(trimmed) ? trimmed : null;
}

export function formatGoalTargetDate(targetDate: string | null | undefined): string | null {
  const month = normalizeGoalTargetMonth(targetDate ?? null);
  if (!month) return null;
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export type DashboardGoalOption = {
  value: string;
  label: string;
  category: DashboardGoalCategory;
  profileSync?: {
    field: "careerMotivation" | "jobTimeline" | "employmentStatus";
    suggestedValue: string;
    prompt: string;
  };
};

export const DASHBOARD_GOAL_MAX = 3;

export const GOAL_WIZARD_CATEGORIES: {
  id: DashboardGoalCategory;
  title: string;
  description: string;
}[] = [
  {
    id: "job_search",
    title: "Find your next role",
    description: "Land a role, step up, pivot, or close an offer.",
  },
  {
    id: "coaching",
    title: "Work with a coach",
    description: "Interview prep, positioning, negotiation, and leadership transitions.",
  },
  {
    id: "applications",
    title: "Prepare for applications",
    description: "Resume, LinkedIn, portfolio, and application quality.",
  },
  {
    id: "career",
    title: "Plan your career",
    description: "Strategy, exploration, and building skills for what's next.",
  },
];

export const DASHBOARD_GOAL_OPTIONS: DashboardGoalOption[] = [
  { value: "land_new_role", label: "Land a new role in my target field", category: "job_search" },
  {
    value: "step_up",
    label: "Step up in level (promotion or bigger scope)",
    category: "job_search",
    profileSync: {
      field: "careerMotivation",
      suggestedValue: "Step up in level",
      prompt: "Add “Step up in level” to your profile motivation?",
    },
  },
  {
    value: "career_pivot",
    label: "Pivot to a different field or function",
    category: "job_search",
    profileSync: {
      field: "careerMotivation",
      suggestedValue: "A career pivot",
      prompt: "Add “A career pivot” to your profile motivation?",
    },
  },
  { value: "interview_performance", label: "Get better at interviews", category: "job_search" },
  { value: "negotiate_offer", label: "Negotiate an offer", category: "job_search" },
  { value: "positioning", label: "Sharpen my story and positioning", category: "coaching" },
  { value: "interview_coaching", label: "Interview prep with a coach", category: "coaching" },
  { value: "salary_negotiation", label: "Salary and offer negotiation", category: "coaching" },
  { value: "executive_transition", label: "Executive or leadership transition", category: "coaching" },
  { value: "resume_linkedin", label: "Fix my resume and LinkedIn", category: "applications" },
  {
    value: "application_strategy",
    label: "Improve how I apply (quality, volume, targeting)",
    category: "applications",
  },
  { value: "portfolio_build", label: "Build portfolio or work samples", category: "applications" },
  { value: "career_strategy", label: "Build a career plan", category: "career" },
  { value: "explore_paths", label: "Explore what's next", category: "career" },
  { value: "skill_growth", label: "Build skills for my next role", category: "career" },
];

const CATEGORY_LABELS: Record<DashboardGoalCategory, string> = {
  job_search: "Job search",
  coaching: "Coaching",
  applications: "Applications",
  career: "Career",
};

export function dashboardGoalCategoryLabel(category: DashboardGoalCategory): string {
  return CATEGORY_LABELS[category];
}

export function goalOptionsForCategory(category: DashboardGoalCategory): DashboardGoalOption[] {
  return DASHBOARD_GOAL_OPTIONS.filter((o) => o.category === category);
}

export function findDashboardGoalOption(value: string): DashboardGoalOption | undefined {
  return DASHBOARD_GOAL_OPTIONS.find((o) => o.value === value);
}

export function normalizeDashboardGoals(raw: unknown): DashboardGoal[] {
  if (!Array.isArray(raw)) return [];
  const out: DashboardGoal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const value = typeof row.value === "string" ? row.value : "";
    const option = findDashboardGoalOption(value);
    if (!option) continue;
    const targetDate = normalizeGoalTargetMonth(row.targetDate);
    out.push({
      id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
      category: option.category,
      value: option.value,
      label: option.label,
      ...(targetDate ? { targetDate } : {}),
      createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    });
    if (out.length >= DASHBOARD_GOAL_MAX) break;
  }
  return out;
}

export function recommendationPathForGoals(goals: DashboardGoal[]): string {
  if (goals.some((g) => g.category === "coaching")) return "/coaching";
  if (goals.some((g) => g.category === "applications")) return "/profile";
  if (goals.some((g) => g.category === "career")) return "/profile/career-strategy";
  return "/opportunities/pipeline";
}

export function recommendationLabelForGoals(goals: DashboardGoal[]): string {
  if (goals.some((g) => g.category === "coaching")) return "Find a coach";
  if (goals.some((g) => g.category === "applications")) return "Prep my materials";
  if (goals.some((g) => g.category === "career")) return "Work on my plan";
  return "Show me matching roles";
}

export function hasCoachingGoal(goals: DashboardGoal[]): boolean {
  return goals.some((g) => g.category === "coaching");
}

/** Typeform / cal.com link — set when ready; until then dashboard falls back to in-app request form. */
export const SALES_TEAM_FORM_URL =
  process.env.NEXT_PUBLIC_SALES_TEAM_FORM_URL?.trim() ||
  process.env.NEXT_PUBLIC_SALES_TYPEFORM_URL?.trim() ||
  null;

export function salesTeamFormUrl(): string | null {
  return SALES_TEAM_FORM_URL;
}

export function profileNeedsSyncForGoal(
  goalValue: string,
  profile: { careerMotivation?: string | null; jobTimeline?: string | null; employmentStatus?: string | null },
): DashboardGoalOption["profileSync"] | null {
  const option = findDashboardGoalOption(goalValue);
  if (!option?.profileSync) return null;
  const current = profile[option.profileSync.field];
  if (current === option.profileSync.suggestedValue) return null;
  return option.profileSync;
}
