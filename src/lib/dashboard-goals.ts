import { unifiedTargetRoles } from "@/lib/target-roles-unified";

export type DashboardGoalCategory = "job_search" | "coaching" | "career" | "applications";

export type DashboardGoal = {
  id: string;
  category: DashboardGoalCategory;
  value: string;
  label: string;
  /** Month target as YYYY-MM */
  targetDate?: string | null;
  /** Contextual follow-up answer — stored in profile JSON, not onboarding basics */
  followUpNote?: string | null;
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

/** Profile fields goals read from — never re-asked in the wizard. */
export type GoalProfileContext = {
  targetRoles: string[];
  prioritizedCategories: string[];
  deprioritizedCategories: string[];
  careerMotivation: string | null;
  jobTimeline: string | null;
  employmentStatus: string | null;
  priorities: string[];
};

export const GOALS_MATCHING_TAGLINE =
  "Tell us your goals so we can match you with the right resources and people.";

export const DASHBOARD_GOAL_MAX = 3;

/** Goals shown on dashboard home card before "See all". */
export const DASHBOARD_GOALS_CARD_PREVIEW = 2;

/** Wizard cards — aligned to matching use cases, not generic goal buckets. */
export type GoalWizardEntry = {
  key: string;
  category: DashboardGoalCategory;
  values: string[];
  title: string;
  description: string;
};

export const GOAL_WIZARD_ENTRIES: GoalWizardEntry[] = [
  {
    key: "transition",
    category: "job_search",
    values: ["career_pivot", "explore_paths"],
    title: "Career transition or pivot",
    description: "Switch field, function, or industry — we'll match coaches and resources for the shift.",
  },
  {
    key: "next_role",
    category: "job_search",
    values: ["land_new_role", "step_up", "negotiate_offer", "interview_performance"],
    title: "Land your next role",
    description: "Close an offer, step up, or move faster in your search.",
  },
  {
    key: "interview_positioning",
    category: "coaching",
    values: [
      "positioning",
      "interview_coaching",
      "salary_negotiation",
      "executive_transition",
      "resume_linkedin",
      "application_strategy",
      "portfolio_build",
    ],
    title: "Interview prep & positioning",
    description: "Sharpen your story, materials, and interview skills — matched coaches and templates.",
  },
  {
    key: "skill_learning",
    category: "career",
    values: ["skill_growth", "career_strategy"],
    title: "Build skills & learning",
    description: "Upskill for what's next — learning paths and coaches (more coming soon).",
  },
  {
    key: "networking",
    category: "career",
    values: ["build_network"],
    title: "Grow your network",
    description: "Connect with the right people — warm intros and events (coming soon).",
  },
];

/** @deprecated Use GOAL_WIZARD_ENTRIES — kept for any external imports */
export const GOAL_WIZARD_CATEGORIES = GOAL_WIZARD_ENTRIES.map((e) => ({
  id: e.category,
  title: e.title,
  description: e.description,
}));

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
  {
    value: "build_network",
    label: "Build relationships in my target space",
    category: "career",
  },
];

const CATEGORY_LABELS: Record<DashboardGoalCategory, string> = {
  job_search: "Role search",
  coaching: "Interview & positioning",
  applications: "Application materials",
  career: "Growth & learning",
};

export function dashboardGoalCategoryLabel(category: DashboardGoalCategory): string {
  return CATEGORY_LABELS[category];
}

export function goalOptionsForCategory(category: DashboardGoalCategory): DashboardGoalOption[] {
  return DASHBOARD_GOAL_OPTIONS.filter((o) => o.category === category);
}

export function goalOptionsForWizardEntry(
  entry: GoalWizardEntry,
  availableValues: Set<string>,
): DashboardGoalOption[] {
  return DASHBOARD_GOAL_OPTIONS.filter((o) => entry.values.includes(o.value) && availableValues.has(o.value));
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
    const followUpNote =
      typeof row.followUpNote === "string" && row.followUpNote.trim() ? row.followUpNote.trim() : null;
    out.push({
      id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
      category: option.category,
      value: option.value,
      label: option.label,
      ...(targetDate ? { targetDate } : {}),
      ...(followUpNote ? { followUpNote } : {}),
      createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    });
    if (out.length >= DASHBOARD_GOAL_MAX) break;
  }
  return out;
}

export function isCareerTransition(ctx: GoalProfileContext): boolean {
  return ctx.careerMotivation === "A career pivot";
}

export function isStepUpMotivation(ctx: GoalProfileContext): boolean {
  return ctx.careerMotivation === "Step up in level";
}

export function isActivelySearching(ctx: GoalProfileContext): boolean {
  return ctx.employmentStatus === "searching";
}

function roleSummary(ctx: GoalProfileContext, max = 2): string | null {
  const roles = ctx.targetRoles.map((r) => r.trim()).filter(Boolean).slice(0, max);
  if (!roles.length) return null;
  return roles.join(" or ");
}

export type WizardEntryDisplay = {
  title: string;
  description: string;
  suggested: boolean;
};

/** Contextual wizard card copy from onboarding/profile signals. */
export function wizardEntryDisplay(entry: GoalWizardEntry, ctx: GoalProfileContext): WizardEntryDisplay {
  const roles = roleSummary(ctx);

  if (entry.key === "transition" && isCareerTransition(ctx)) {
    return {
      title: "Transition to a new career",
      description: roles
        ? `You're pivoting toward ${roles} — tell us more so we can match the right support.`
        : "You're making a career change — tell us more so we can match resources and people.",
      suggested: true,
    };
  }

  if (entry.key === "next_role" && (isStepUpMotivation(ctx) || isActivelySearching(ctx))) {
    return {
      title: isStepUpMotivation(ctx) ? "Step up to your next level" : "Land your next role",
      description: roles
        ? `You're targeting ${roles} — we'll match roles, coaches, and resources to get you there.`
        : "Close an offer, step up, or move faster — matched to your profile.",
      suggested: true,
    };
  }

  if (entry.key === "interview_positioning" && ctx.priorities.some((p) => p.toLowerCase().includes("interview"))) {
    return {
      title: entry.title,
      description: "You flagged interview prep — we'll match coaches and materials for your target roles.",
      suggested: true,
    };
  }

  if (entry.key === "skill_learning" && ctx.prioritizedCategories.length > 0) {
    const cat = ctx.prioritizedCategories[0];
    return {
      title: entry.title,
      description: `You're focused on ${cat} — we'll suggest learning paths and coaches in that space.`,
      suggested: true,
    };
  }

  return { title: entry.title, description: entry.description, suggested: false };
}

/** Rank wizard entries — profile-suggested cards first. */
export function rankWizardEntries(
  entries: GoalWizardEntry[],
  ctx: GoalProfileContext,
  availableValues: Set<string>,
): GoalWizardEntry[] {
  return [...entries]
    .filter((e) => goalOptionsForWizardEntry(e, availableValues).length > 0)
    .sort((a, b) => {
      const aScore = wizardEntryDisplay(a, ctx).suggested ? 0 : 1;
      const bScore = wizardEntryDisplay(b, ctx).suggested ? 0 : 1;
      return aScore - bScore;
    });
}

/** Rank goal options within a wizard card using profile signals. */
export function rankGoalOptionsForProfile(
  options: DashboardGoalOption[],
  ctx: GoalProfileContext,
): DashboardGoalOption[] {
  const score = (opt: DashboardGoalOption): number => {
    if (opt.value === "career_pivot" && isCareerTransition(ctx)) return 0;
    if (opt.value === "step_up" && isStepUpMotivation(ctx)) return 0;
    if (opt.value === "land_new_role" && ctx.targetRoles.length > 0 && !isCareerTransition(ctx)) return 1;
    if (opt.value === "explore_paths" && isCareerTransition(ctx)) return 2;
    if (opt.value === "skill_growth" && ctx.prioritizedCategories.length > 0) return 1;
    return 5;
  };
  return [...options].sort((a, b) => score(a) - score(b));
}

export type GoalFollowUpChoice = { value: string; label: string };

export type GoalFollowUp = {
  prompt: string;
  choices: GoalFollowUpChoice[];
  optional: boolean;
};

/** One contextual follow-up — builds on profile data, never re-asks roles/categories. */
export function getGoalFollowUp(optionValue: string, ctx: GoalProfileContext): GoalFollowUp | null {
  const roles = roleSummary(ctx);

  switch (optionValue) {
    case "career_pivot":
      return {
        prompt: roles
          ? `Pivoting toward ${roles} — what's the hardest part right now?`
          : "What's the hardest part of your career change?",
        choices: [
          { value: "breaking_in", label: "Breaking into a new field" },
          { value: "translate_experience", label: "Translating my experience" },
          { value: "interview_story", label: "Telling a convincing story" },
          { value: "not_sure", label: "Still figuring it out" },
        ],
        optional: true,
      };
    case "land_new_role":
      return {
        prompt: roles
          ? `For ${roles}, what's your biggest blocker?`
          : "What's your biggest blocker in the search?",
        choices: [
          { value: "applications", label: "Getting interviews" },
          { value: "interviews", label: "Converting interviews" },
          { value: "offer", label: "Closing an offer" },
          { value: "timing", label: "Timing / urgency" },
        ],
        optional: true,
      };
    case "step_up":
      return {
        prompt: "What does stepping up look like for you?",
        choices: [
          { value: "scope", label: "Bigger scope, same track" },
          { value: "people", label: "People leadership" },
          { value: "senior_ic", label: "Senior IC / staff level" },
          { value: "executive", label: "Executive track" },
        ],
        optional: true,
      };
    case "interview_coaching":
    case "interview_performance":
      return {
        prompt: "Which interview format do you need most help with?",
        choices: [
          { value: "behavioral", label: "Behavioral / culture" },
          { value: "case", label: "Case / analytical" },
          { value: "technical", label: "Technical / system design" },
          { value: "executive", label: "Executive panel" },
        ],
        optional: true,
      };
    case "positioning":
      return {
        prompt: "Where do you need your story most?",
        choices: [
          { value: "resume", label: "Resume & LinkedIn" },
          { value: "intro", label: "Networking intros" },
          { value: "interview_opener", label: "Interview opener" },
          { value: "all", label: "All of the above" },
        ],
        optional: true,
      };
    case "skill_growth":
      if (ctx.prioritizedCategories.length > 0) {
        const choices = ctx.prioritizedCategories.slice(0, 4).map((c) => ({ value: c, label: c }));
        return {
          prompt: "Which skill area would unlock your next move?",
          choices,
          optional: true,
        };
      }
      return {
        prompt: "What type of skill would help most?",
        choices: [
          { value: "technical", label: "Technical / domain" },
          { value: "leadership", label: "Leadership & management" },
          { value: "communication", label: "Communication & presence" },
          { value: "business", label: "Business / strategy" },
        ],
        optional: true,
      };
    case "build_network":
      return {
        prompt: "Who would help most right now?",
        choices: [
          { value: "peers", label: "Peers in my target role" },
          { value: "hiring_managers", label: "Hiring managers" },
          { value: "alumni", label: "Alumni / former colleagues" },
          { value: "industry", label: "Industry leaders" },
        ],
        optional: true,
      };
    default:
      return null;
  }
}

export function followUpLabel(followUp: GoalFollowUp, choiceValue: string): string {
  return followUp.choices.find((c) => c.value === choiceValue)?.label ?? choiceValue;
}

export function recommendationPathForGoals(goals: DashboardGoal[]): string {
  if (goals.some((g) => g.category === "coaching" || g.value === "interview_performance")) return "/coaching";
  if (goals.some((g) => g.category === "applications")) return "/profile";
  if (goals.some((g) => g.category === "career")) return "/profile/career-strategy";
  return "/opportunities";
}

export function recommendationLabelForGoals(goals: DashboardGoal[]): string {
  if (goals.some((g) => g.category === "coaching" || g.value === "interview_performance")) {
    return "Find matched support";
  }
  if (goals.some((g) => g.category === "applications")) return "Improve my materials";
  if (goals.some((g) => g.category === "career" && g.value === "build_network")) {
    return "Explore events & people";
  }
  if (goals.some((g) => g.category === "career")) return "Build my plan";
  return "Show matching roles";
}

export function hasCoachingGoal(goals: DashboardGoal[]): boolean {
  return goals.some((g) => g.category === "coaching" || g.value === "interview_performance");
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

export function goalProfileContextFromProfile(profile: {
  targetRoles?: string[];
  prioritizedRoles?: string[];
  prioritizedCategories?: string[];
  deprioritizedCategories?: string[];
  careerMotivation?: string | null;
  jobTimeline?: string | null;
  employmentStatus?: string | null;
  priorities?: string[];
}): GoalProfileContext {
  return {
    targetRoles: unifiedTargetRoles({
      targetRoles: profile.targetRoles,
      prioritizedRoles: profile.prioritizedRoles,
    }),
    prioritizedCategories: profile.prioritizedCategories ?? [],
    deprioritizedCategories: profile.deprioritizedCategories ?? [],
    careerMotivation: profile.careerMotivation ?? null,
    jobTimeline: profile.jobTimeline ?? null,
    employmentStatus: profile.employmentStatus ?? null,
    priorities: profile.priorities ?? [],
  };
}
