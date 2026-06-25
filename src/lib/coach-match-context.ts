import { normalizeDashboardGoals, type DashboardGoal } from "@/lib/dashboard-goals";
import { coachMatchScoringEligible, COACH_MATCH_NEEDS_SIGNAL_HINT } from "@/lib/coach-goal-signals";
import { profileTextForMatchReasons } from "@/lib/profile-vsearch-query";
import { findResumeAssetForUser } from "@/lib/resume-artifact";
import { mergeParsedWithReadback, normalizeParsedResumeData } from "@/lib/resume-parse";
import type { Profile } from "@prisma/client";

type ProfileRow = Pick<
  Profile,
  | "headline"
  | "targetRoles"
  | "resumeText"
  | "parsedData"
  | "readbackData"
  | "careerMotivation"
  | "priorities"
  | "employmentStatus"
  | "jobTimeline"
  | "targetSalary"
  | "dashboardGoals"
> | null;

export type CoachMatchUserContext = {
  profileText: string;
  targetRoles: string[];
  dashboardGoals: DashboardGoal[];
  scored: boolean;
  hint: string | null;
};

export async function buildCoachMatchUserContext(
  userId: string,
  profile: ProfileRow,
): Promise<CoachMatchUserContext> {
  const targetRoles = (profile?.targetRoles ?? []).slice(0, 20);
  const dashboardGoals = normalizeDashboardGoals(profile?.dashboardGoals);
  const parsedData = mergeParsedWithReadback(
    normalizeParsedResumeData(profile?.parsedData ?? null),
    profile?.readbackData,
  );

  let profileText =
    profileTextForMatchReasons({
      headline: profile?.headline,
      targetRoles,
      resumeText: profile?.resumeText,
      parsedData,
      careerMotivation: profile?.careerMotivation,
      priorities: profile?.priorities ?? [],
      employmentStatus: profile?.employmentStatus,
      jobTimeline: profile?.jobTimeline,
      targetSalary: profile?.targetSalary
        ? Number.parseFloat(profile.targetSalary.replace(/[^0-9.]/g, "")) || null
        : null,
    }) || "";

  if (!profileText.trim()) {
    const resumeAsset = await findResumeAssetForUser(userId);
    if (resumeAsset?.resumeText) profileText = resumeAsset.resumeText;
  }

  const scored = coachMatchScoringEligible(profileText, targetRoles, dashboardGoals);

  return {
    profileText,
    targetRoles,
    dashboardGoals,
    scored,
    hint: scored ? null : COACH_MATCH_NEEDS_SIGNAL_HINT,
  };
}
