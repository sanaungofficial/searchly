import type { OnboardingCoachStep } from "@/lib/onboarding-coach/types";

export type {
  OnboardingCoachStep,
  OnboardingCoachStepKind,
  OnboardingCoachField,
  OnboardingCompanyPick,
  OnboardingJobSample,
} from "@/lib/onboarding-coach/types";

export const ONBOARDING_COACH_SEARCH_STEPS: OnboardingCoachStep[] = [
  {
    id: "motivation",
    field: "careerMotivation",
    question: "What's driving your move right now?",
    hint: "Comp, growth, balance, level-up, or a pivot — whatever's true.",
    confirmPrompt: "Does this capture what's driving your search?",
    options: [
      { value: "Higher compensation", label: "Higher compensation" },
      { value: "More interesting work", label: "More interesting work" },
      { value: "Better work-life balance", label: "Better work-life balance" },
      { value: "Step up in level", label: "Step up in level" },
      { value: "A career pivot", label: "A career pivot" },
    ],
  },
  {
    id: "timeline",
    field: "jobTimeline",
    question: "When do you want to be in a new role?",
    hint: "Rough timeline is fine — helps us prioritize what's worth your time.",
    confirmPrompt: "Does this timeline look right?",
    options: [
      { value: "asap", label: "As soon as possible" },
      { value: "3-6mo", label: "In the next 3–6 months" },
      { value: "open", label: "Whenever the right role appears" },
    ],
  },
];

export const ONBOARDING_COACH_PREFS_STEPS: OnboardingCoachStep[] = [
  {
    id: "current-salary",
    field: "currentSalary",
    question: "What's your current salary range?",
    hint: "Optional — skip anytime or use the dropdowns below.",
    confirmPrompt: "Does this current salary range look right?",
    optional: true,
    options: [
      { value: "Under $75K", label: "Under $75K" },
      { value: "$75K–$99K", label: "$75K–$99K" },
      { value: "$100K–$124K", label: "$100K–$124K" },
      { value: "$125K–$149K", label: "$125K–$149K" },
      { value: "$150K–$174K", label: "$150K–$174K" },
      { value: "$175K–$199K", label: "$175K–$199K" },
      { value: "$200K–$249K", label: "$200K–$249K" },
      { value: "$250K–$299K", label: "$250K–$299K" },
      { value: "$300K–$399K", label: "$300K–$399K" },
      { value: "$400K+", label: "$400K+" },
    ],
  },
  {
    id: "target-salary",
    field: "targetSalary",
    question: "What salary range are you aiming for next?",
    hint: "Optional — we'll use this to filter bad-fit listings.",
    confirmPrompt: "Does this target range look right?",
    optional: true,
    options: [
      { value: "Under $75K", label: "Under $75K" },
      { value: "$75K–$99K", label: "$75K–$99K" },
      { value: "$100K–$124K", label: "$100K–$124K" },
      { value: "$125K–$149K", label: "$125K–$149K" },
      { value: "$150K–$174K", label: "$150K–$174K" },
      { value: "$175K–$199K", label: "$175K–$199K" },
      { value: "$200K–$249K", label: "$200K–$249K" },
      { value: "$250K–$299K", label: "$250K–$299K" },
      { value: "$300K–$399K", label: "$300K–$399K" },
      { value: "$400K+", label: "$400K+" },
    ],
  },
  {
    id: "priorities",
    kind: "multi_add",
    field: "priorities",
    question: "What matters most in your next role?",
    followUpQuestion: "Anything else that matters in your next role?",
    hint: "One at a time — remote, hybrid, comp, growth, culture, or location.",
    confirmPrompt: "Should I add this as a priority?",
    optional: true,
    multiMax: 6,
    options: [
      { value: "Remote-first", label: "Remote-first" },
      { value: "Hybrid-friendly", label: "Hybrid-friendly" },
      { value: "Higher compensation", label: "Higher compensation" },
      { value: "Fast growth", label: "Fast growth" },
      { value: "Strong team culture", label: "Strong team culture" },
      { value: "Specific location", label: "Specific location" },
    ],
  },
];

export const ONBOARDING_COACH_ROLE_STEPS: OnboardingCoachStep[] = [
  {
    id: "target-roles",
    kind: "multi_add",
    field: "targetRoles",
    question: "What's a role you're targeting?",
    followUpQuestion: "Any other target roles?",
    hint: "Up to 3 titles — e.g. Product Manager, Director of Strategy.",
    confirmPrompt: "Add this target role?",
    optional: true,
    multiMax: 3,
  },
];

export const ONBOARDING_COACH_COMPANY_STEPS: OnboardingCoachStep[] = [
  {
    id: "target-companies",
    kind: "company",
    field: "company",
    question: "Name a company you want to watch.",
    followUpQuestion: "Any other companies to add?",
    hint: "Up to 5 — we'll scan their boards for roles that match your titles.",
    confirmPrompt: "Add this company to your watchlist?",
    optional: true,
    multiMax: 5,
  },
];

/** Full coach flow — one continuous voice conversation across onboarding screens. */
export const ONBOARDING_COACH_ALL_STEPS: OnboardingCoachStep[] = [
  ...ONBOARDING_COACH_SEARCH_STEPS,
  ...ONBOARDING_COACH_PREFS_STEPS,
  ...ONBOARDING_COACH_ROLE_STEPS,
  ...ONBOARDING_COACH_COMPANY_STEPS,
];

/** First global step index when the user lands on each coach-enabled onboarding screen. */
export const ONBOARDING_COACH_SCREEN_ANCHORS: Partial<Record<number, number>> = {
  1: 0,
  2: ONBOARDING_COACH_SEARCH_STEPS.length,
  4: ONBOARDING_COACH_SEARCH_STEPS.length + ONBOARDING_COACH_PREFS_STEPS.length,
  5:
    ONBOARDING_COACH_SEARCH_STEPS.length +
    ONBOARDING_COACH_PREFS_STEPS.length +
    ONBOARDING_COACH_ROLE_STEPS.length,
};

export const ONBOARDING_COACH_SCREENS = new Set(
  Object.keys(ONBOARDING_COACH_SCREEN_ANCHORS).map(Number),
);

export function labelForCoachValue(step: OnboardingCoachStep, raw: string): string {
  const match = step.options?.find((o) => o.value === raw || o.label === raw);
  return match?.label ?? raw;
}

export function coachStepByField(
  steps: OnboardingCoachStep[],
  field: string,
): OnboardingCoachStep | undefined {
  return steps.find((s) => s.field === field);
}

export function activeCoachQuestion(step: OnboardingCoachStep, multiCount: number): string {
  if (multiCount > 0 && step.followUpQuestion) return step.followUpQuestion;
  return step.question;
}
