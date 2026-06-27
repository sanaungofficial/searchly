import type { VoiceAgentFieldName } from "@/lib/voice-intake";

export type OnboardingCoachField = VoiceAgentFieldName;

export type OnboardingCoachStep = {
  id: string;
  field: OnboardingCoachField;
  question: string;
  hint?: string;
  /** Shown on confirm card */
  confirmPrompt?: string;
  options?: Array<{ value: string; label: string }>;
  optional?: boolean;
};

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
    field: "priorities",
    question: "What matters most in your next role?",
    hint: "Pick one at a time — remote, hybrid, comp, growth, culture, or location.",
    confirmPrompt: "Should I add this as a priority?",
    optional: true,
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
