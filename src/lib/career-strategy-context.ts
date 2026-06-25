import type { Profile, TrackedCompany, User } from "@prisma/client";
import { interpolate } from "@/lib/prompts";

export type StrategyContextInput = {
  user: Pick<User, "name" | "email">;
  profile: Profile;
  trackedCompanies: TrackedCompany[];
  intakeNotes?: string | null;
};

export function buildStrategyPromptContext(input: StrategyContextInput): Record<string, string> {
  const { user, profile, trackedCompanies, intakeNotes } = input;
  const parsed = (profile.parsedData ?? {}) as {
    location?: string;
    skills?: string[];
    workExperience?: { title?: string; company?: string }[];
  };

  const workArrangement = (profile.priorities ?? []).filter((p) =>
    ["Remote-first", "Hybrid-friendly", "Specific location"].includes(p),
  );

  const readback = profile.readbackData as {
    picture?: string;
    strengths?: string[];
    honestNote?: string;
    targetRoles?: { role: string; fit: string }[];
  } | null;

  const companiesSummary =
    trackedCompanies.length > 0
      ? trackedCompanies
          .slice(0, 25)
          .map(
            (c) =>
              `- ${c.name}${c.priority ? ` (${c.priority} priority)` : ""}${c.candidateEdge ? `: edge — ${c.candidateEdge}` : ""}`,
          )
          .join("\n")
      : "No companies on watchlist yet.";

  const experienceSummary = (parsed.workExperience ?? [])
    .slice(0, 6)
    .map((w) => `${w.title ?? "Role"} at ${w.company ?? "Company"}`)
    .join("; ");

  return {
    candidateName: user.name ?? user.email.split("@")[0] ?? "Candidate",
    resumeSlice: (profile.resumeText ?? "").slice(0, 8000),
    targetRoles: (profile.targetRoles ?? []).join(", ") || "Not set",
    targetSalary: profile.targetSalary ?? "Not set",
    currentSalary: profile.currentSalary ?? "Not set",
    employmentStatus: profile.employmentStatus ?? "Not set",
    jobTimeline: profile.jobTimeline ?? "Not set",
    careerMotivation: profile.careerMotivation ?? "Not set",
    priorities: (profile.priorities ?? []).join(", ") || "Not set",
    targetMarket: profile.targetMarket ?? parsed.location ?? "Not set",
    currentLocation: parsed.location ?? "Not set",
    relocationOpenness: profile.relocationOpenness ?? "Not set",
    workAuthorization: profile.workAuthorization ?? "Not set",
    securityClearance: profile.securityClearance ?? "Not set",
    searchDuration: profile.searchDuration ?? "Not set",
    positioningStatement: profile.positioningStatement ?? "Not set",
    headline: profile.headline ?? "Not set",
    summary: profile.summary ?? "Not set",
    workArrangement: workArrangement.join(", ") || "Not specified",
    declaredSkills: (parsed.skills ?? []).slice(0, 40).join(", ") || "Not listed",
    experienceSummary: experienceSummary || "Not available",
    readbackPicture: readback?.picture ?? "",
    readbackStrengths: (readback?.strengths ?? []).join("; "),
    readbackHonestNote: readback?.honestNote ?? "",
    readbackSuggestedRoles: (readback?.targetRoles ?? [])
      .map((r) => `${r.role} (${r.fit})`)
      .join(", "),
    trackedCompaniesSummary: companiesSummary,
    intakeNotes: (intakeNotes ?? profile.strategyIntakeNotes ?? "").slice(0, 24000) || "None provided",
  };
}

export function fillStrategyPrompt(
  template: string,
  input: StrategyContextInput,
): string {
  return interpolate(template, buildStrategyPromptContext(input));
}

export function fillIntakePrompt(template: string, notes: string, existingContext: StrategyContextInput): string {
  const ctx = buildStrategyPromptContext(existingContext);
  return interpolate(template, {
    ...ctx,
    intakeNotes: notes.slice(0, 24000),
  });
}
