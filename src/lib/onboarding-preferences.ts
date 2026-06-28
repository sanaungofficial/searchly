/** Structured onboarding answers → profile fields used by job + coach matching. */

export type WorkArrangementId = "remote_only" | "hybrid_ok" | "onsite_ok" | "";

export type RelocationId = "local" | "domestic" | "international" | "";

export type VisaNeedId = "sponsored" | "authorized" | "unspecified" | "";

export const ONBOARDING_WORK_ARRANGEMENTS: { value: WorkArrangementId; label: string; hint: string }[] = [
  { value: "remote_only", label: "Remote only", hint: "Skip on-site and hybrid listings when possible." },
  { value: "hybrid_ok", label: "Hybrid is OK", hint: "Include hybrid and remote-friendly roles." },
  { value: "onsite_ok", label: "Open to on-site", hint: "Show all location types near your market." },
];

export const ONBOARDING_RELOCATION_OPTIONS: { value: RelocationId; label: string }[] = [
  { value: "local", label: "Stay in my current area" },
  { value: "domestic", label: "Open to relocating within my country" },
  { value: "international", label: "Open to relocating internationally" },
];

export const ONBOARDING_VISA_OPTIONS: { value: VisaNeedId; label: string }[] = [
  { value: "authorized", label: "Authorized to work — no sponsorship needed" },
  { value: "sponsored", label: "I need visa sponsorship" },
  { value: "unspecified", label: "Prefer not to say" },
];

export type OnboardingMatchingState = {
  targetMarket: string;
  fullyRemote: boolean;
  workArrangement: WorkArrangementId;
  relocation: RelocationId;
  visaNeed: VisaNeedId;
  targetSalary: string;
  jobTimeline: string;
  deprioritizedCategories: string[];
};

export function buildOnboardingPriorities(input: {
  workArrangement: WorkArrangementId;
  relocation: RelocationId;
  visaNeed: VisaNeedId;
  fullyRemote: boolean;
}): string[] {
  const out: string[] = [];

  if (input.fullyRemote || input.workArrangement === "remote_only") {
    out.push("Remote-first");
  } else if (input.workArrangement === "hybrid_ok") {
    out.push("Hybrid-friendly");
  }

  if (input.relocation === "domestic") {
    out.push("Open to relocating within my country");
  } else if (input.relocation === "international") {
    out.push("Open to relocating internationally");
  }

  if (input.visaNeed === "sponsored") {
    out.push("Need visa sponsorship");
  }

  return out;
}

export function relocationOpennessFromId(id: RelocationId): string | null {
  if (id === "domestic") return "Open to relocating within my country";
  if (id === "international") return "Open to relocating internationally";
  if (id === "local") return "Prefer to stay in my current area";
  return null;
}

export function workAuthorizationFromVisaNeed(id: VisaNeedId): string | null {
  if (id === "sponsored") return "Need visa sponsorship";
  if (id === "authorized") return "Authorized to work without sponsorship";
  return null;
}

export function buildOnboardingProfilePatch(state: OnboardingMatchingState): Record<string, unknown> {
  const targetMarket = state.fullyRemote ? null : state.targetMarket.trim() || null;

  return {
    targetMarket,
    jobTimeline: state.jobTimeline || null,
    targetSalary: state.targetSalary || null,
    priorities: buildOnboardingPriorities({
      workArrangement: state.workArrangement,
      relocation: state.relocation,
      visaNeed: state.visaNeed,
      fullyRemote: state.fullyRemote,
    }),
    relocationOpenness: relocationOpennessFromId(state.relocation),
    workAuthorization: workAuthorizationFromVisaNeed(state.visaNeed),
    deprioritizedCategories: state.deprioritizedCategories.slice(0, 10),
  };
}
