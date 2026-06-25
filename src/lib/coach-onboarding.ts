/** Helpers for coach onboarding completion and profile assembly. */

import type { CoachClientTierId, CoachExperienceLevel } from "./coach-categories";

export type CoachOnboardingDraft = {
  goal: "career" | "school" | "test";
  category: string;
  linkedinUrl: string;
  experienceLevel: CoachExperienceLevel | "";
  specialties: string[];
  industryYears: number | null;
  clientTier: CoachClientTierId | "";
  qualifications: string;
  whyCoach: string;
  headline: string;
  isProfessionalCoach: boolean;
  clientSpecializations: string[];
  photoUrl: string;
  displayName: string;
  hourlyRate: number | null;
  calLink: string;
};

export function coachOnboardingBio(draft: Pick<
  CoachOnboardingDraft,
  "experienceLevel" | "category" | "industryYears" | "clientTier" | "qualifications" | "isProfessionalCoach"
>): string {
  const parts: string[] = [];
  if (draft.experienceLevel) parts.push(`Experience level: ${draft.experienceLevel}`);
  if (draft.category && draft.industryYears != null) {
    parts.push(`${draft.industryYears} ${draft.industryYears === 1 ? "year" : "years"} in ${draft.category}`);
  }
  if (draft.clientTier) {
    const tierLabels: Record<CoachClientTierId, string> = {
      new: "Just getting started (no clients yet)",
      beginner: "1–10 people coached",
      some: "11–25 people coached",
      experienced: "26–99 people coached",
      expert: "100+ people coached",
    };
    parts.push(`Coaching experience: ${tierLabels[draft.clientTier]}`);
  }
  if (draft.isProfessionalCoach) parts.push("Professional coach");
  const header = parts.length ? `${parts.join("\n")}\n\n` : "";
  return `${header}${draft.qualifications.trim()}`.trim();
}

export function coachOnboardingAboutMe(draft: Pick<CoachOnboardingDraft, "qualifications">): string {
  return draft.qualifications.trim();
}

export function isCoachProfileOnboardingComplete(profile: {
  category: string | null;
  headline: string | null;
  bio: string | null;
  displayName: string;
} | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.displayName?.trim() &&
      profile.category?.trim() &&
      profile.headline?.trim() &&
      profile.bio?.trim(),
  );
}

export type CoachOnboardingPhase = "questionnaire" | "vouches" | "portal";

export function coachOnboardingPhase(input: {
  questionnaireComplete: boolean;
  profileStatus: string | null;
}): CoachOnboardingPhase {
  if (!input.questionnaireComplete) return "questionnaire";
  if (input.profileStatus === "ACTIVE") return "portal";
  return "vouches";
}

export function coachVouchUrl(coachProfileId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.kimchi.so";
  return `${base.replace(/\/$/, "")}/vouch/${coachProfileId}`;
}

export function coachVouchShareMessage(displayName: string, vouchUrl: string): string {
  return `Hi! I'm applying to coach on Kimchi and would love a quick vouch from you about our work together. It only takes a minute:

${vouchUrl}

Thanks!
${displayName}`;
}
