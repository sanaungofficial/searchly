import type { IntakeParseResult } from "@/lib/career-strategy";

const ONBOARDING_MOTIVATIONS = [
  "Higher compensation",
  "More interesting work",
  "Better work-life balance",
  "Step up in level",
  "A career pivot",
] as const;

const ONBOARDING_TIMELINES = ["asap", "3-6mo", "open"] as const;

const ONBOARDING_PRIORITIES = [
  "Remote-first",
  "Hybrid-friendly",
  "Higher compensation",
  "Fast growth",
  "Strong team culture",
  "Specific location",
] as const;

const SALARY_RANGES = [
  "Under $75K",
  "$75K–$99K",
  "$100K–$124K",
  "$125K–$149K",
  "$150K–$174K",
  "$175K–$199K",
  "$200K–$249K",
  "$250K–$299K",
  "$300K–$399K",
  "$400K+",
] as const;

export type VoiceIntakeOnboardingFields = {
  careerMotivation: string;
  jobTimeline: string;
  currentSalary: string;
  targetSalary: string;
  priorities: string[];
  targetRoles: string[];
  strategyIntakeNotes: string;
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function pickClosestOption(input: string | null | undefined, options: readonly string[]): string {
  if (!input?.trim()) return "";
  const needle = normalizeText(input);
  const exact = options.find((option) => normalizeText(option) === needle);
  if (exact) return exact;

  const contains = options.find(
    (option) => needle.includes(normalizeText(option)) || normalizeText(option).includes(needle),
  );
  if (contains) return contains;

  if (needle.includes("asap") || needle.includes("as soon")) return "asap";
  if (needle.includes("3") && needle.includes("6")) return "3-6mo";
  if (needle.includes("whenever") || needle.includes("no rush") || needle.includes("open")) return "open";

  return "";
}

function pickSalaryRange(input: string | null | undefined): string {
  if (!input?.trim()) return "";
  const needle = normalizeText(input);
  const exact = SALARY_RANGES.find((range) => normalizeText(range) === needle);
  if (exact) return exact;

  const numeric = needle.replace(/[^0-9.k]/g, "");
  if (!numeric) return "";

  const matched = SALARY_RANGES.find((range) => {
    const rangeNorm = normalizeText(range);
    return needle.includes(rangeNorm) || rangeNorm.includes(numeric);
  });
  return matched ?? "";
}

function pickMotivation(input: string | null | undefined): string {
  if (!input?.trim()) return "";
  const needle = normalizeText(input);
  const exact = ONBOARDING_MOTIVATIONS.find((option) => normalizeText(option) === needle);
  if (exact) return exact;

  if (needle.includes("pay") || needle.includes("comp") || needle.includes("salary")) {
    return "Higher compensation";
  }
  if (needle.includes("balance") || needle.includes("burnout") || needle.includes("hours")) {
    return "Better work-life balance";
  }
  if (needle.includes("pivot") || needle.includes("switch") || needle.includes("new field")) {
    return "A career pivot";
  }
  if (needle.includes("level") || needle.includes("promotion") || needle.includes("step up")) {
    return "Step up in level";
  }
  if (needle.includes("interesting") || needle.includes("impact") || needle.includes("mission")) {
    return "More interesting work";
  }

  return "";
}

function pickPriorities(values: string[] | undefined): string[] {
  if (!values?.length) return [];
  const picked = new Set<string>();
  for (const value of values) {
    const exact = ONBOARDING_PRIORITIES.find((option) => normalizeText(option) === normalizeText(value));
    if (exact) {
      picked.add(exact);
      continue;
    }
    const fuzzy = ONBOARDING_PRIORITIES.find((option) => {
      const needle = normalizeText(value);
      const hay = normalizeText(option);
      return needle.includes(hay) || hay.includes(needle);
    });
    if (fuzzy) picked.add(fuzzy);
  }
  return [...picked];
}

export type VoiceAgentFieldName =
  | "careerMotivation"
  | "jobTimeline"
  | "currentSalary"
  | "targetSalary"
  | "priorities"
  | "targetRoles";

export type VoiceAgentFieldPatch = Partial<
  Pick<VoiceIntakeOnboardingFields, VoiceAgentFieldName>
> & {
  priorities?: string[];
  targetRoles?: string[];
};

export function applyVoiceAgentField(
  field: VoiceAgentFieldName,
  rawValue: string,
): VoiceAgentFieldPatch {
  const value = rawValue.trim();
  if (!value) return {};

  switch (field) {
    case "careerMotivation":
      return { careerMotivation: pickMotivation(value) || value };
    case "jobTimeline":
      return { jobTimeline: pickClosestOption(value, ONBOARDING_TIMELINES) || value };
    case "currentSalary":
      return { currentSalary: pickSalaryRange(value) || value };
    case "targetSalary":
      return { targetSalary: pickSalaryRange(value) || value };
    case "priorities": {
      const picked = pickPriorities([value]);
      return picked.length ? { priorities: picked } : { priorities: [value] };
    }
    case "targetRoles":
      return { targetRoles: [value].filter(Boolean) };
    default:
      return {};
  }
}

export function buildVoiceIntakeNotes(transcript: string, result: IntakeParseResult): string {
  const header = `[Voice intake ${new Date().toISOString()}]`;
  const summary = result.summary?.trim();
  const context = result.intakeContext
    ? `\n\nContext:\n${JSON.stringify(result.intakeContext, null, 2)}`
    : "";
  return `${header}\n${summary ? `${summary}\n\n` : ""}${transcript.trim()}${context}`.slice(0, 24000);
}

export function mapVoiceIntakeToOnboarding(
  transcript: string,
  result: IntakeParseResult,
): VoiceIntakeOnboardingFields {
  const { proposed } = result;
  const timeline = pickClosestOption(proposed.jobTimeline, ONBOARDING_TIMELINES);

  return {
    careerMotivation: pickMotivation(proposed.careerMotivation),
    jobTimeline: timeline,
    currentSalary: pickSalaryRange(proposed.currentSalary),
    targetSalary: pickSalaryRange(proposed.targetSalary),
    priorities: pickPriorities(proposed.priorities),
    targetRoles: (proposed.targetRoles ?? []).map((role) => role.trim()).filter(Boolean).slice(0, 3),
    strategyIntakeNotes: buildVoiceIntakeNotes(transcript, result),
  };
}
