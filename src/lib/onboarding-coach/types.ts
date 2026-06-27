import type { VoiceAgentFieldName } from "@/lib/voice-intake";

export type OnboardingCompanyPick = {
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
};

export type OnboardingCoachStepKind = "field" | "multi_add" | "company";

export type OnboardingCoachField = VoiceAgentFieldName | "company";

export type OnboardingCoachStep = {
  id: string;
  kind?: OnboardingCoachStepKind;
  field: OnboardingCoachField;
  question: string;
  /** Shown after first item in multi_add steps */
  followUpQuestion?: string;
  hint?: string;
  confirmPrompt?: string;
  options?: Array<{ value: string; label: string }>;
  optional?: boolean;
  multiMax?: number;
};

export type OnboardingJobSample = {
  title: string;
  companyName: string;
  location: string | null;
  matchLabel: string | null;
  matchScore: number | null;
};
