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
  headline: string;
  isProfessionalCoach: boolean;
  clientSpecializations: string[];
  photoUrl: string;
  displayName: string;
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
