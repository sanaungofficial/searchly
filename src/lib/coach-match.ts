import type { DashboardGoal } from "@/lib/dashboard-goals";
import { goalTextForMatching, scoreCoachForGoals } from "@/lib/coach-goal-signals";
import { fallbackJobMatch } from "@/lib/resume-match";
import { coachProfileKeywordSummary, matchScoreLabelFor } from "@/lib/match-score";

export type CoachMatchFields = {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedSkills: string[];
};

type CoachMatchInput = {
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  aboutMe?: string | null;
  category?: string | null;
  specialties: string[];
  firms: string[];
  schools: string[];
  industries: string[];
  clientSpecializations?: string[];
  currentRole?: string | null;
  currentCompany?: string | null;
};

const EMPTY_MATCH: CoachMatchFields = {
  matchScore: 0,
  matchLabel: "",
  matchReasons: [],
  matchedSkills: [],
};

export function coachProfileTextForMatch(coach: CoachMatchInput): string {
  return [
    coach.displayName,
    coach.headline,
    coach.category,
    coach.currentRole,
    coach.currentCompany,
    coach.aboutMe,
    coach.bio,
    ...coach.specialties,
    ...(coach.clientSpecializations ?? []),
    ...coach.firms,
    ...coach.schools,
    ...coach.industries,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

function categoryBoost(category: string | null | undefined, targetRoles: string[], profileLower: string): number {
  if (!category) return 0;
  const catLower = category.toLowerCase();
  for (const role of targetRoles) {
    const r = role.trim().toLowerCase();
    if (r.length >= 3 && (catLower.includes(r) || r.includes(catLower.split(" ")[0] ?? ""))) return 14;
  }
  if (profileLower.includes(catLower)) return 8;
  return 0;
}

function isSubstantialProfile(profileText: string, targetRoles: string[]): boolean {
  if (targetRoles.some((r) => r.trim().length >= 2)) return true;
  return profileText.trim().length >= 40;
}

function computeProfileMatchScore(
  coach: CoachMatchInput,
  profileText: string,
  targetRoles: string[],
): { profileScore: number; profileReasons: string[]; matchedSkills: string[] } {
  const description = coachProfileTextForMatch(coach);
  const fallback = fallbackJobMatch(description, profileText);
  const profileLower = profileText.toLowerCase();
  const keywordScore = Math.round(fallback.score * 10);
  const roleBoost = categoryBoost(coach.category, targetRoles, profileLower);

  const specialtyMatches = coach.specialties.filter((s) => profileLower.includes(s.toLowerCase()));
  const firmMatches = coach.firms.filter((f) => profileLower.includes(f.toLowerCase()));
  const matchedSkills = [...new Set([...specialtyMatches, ...firmMatches])].slice(0, 8);

  const profileScore = Math.min(
    100,
    Math.round(keywordScore * 0.7 + roleBoost + Math.min(matchedSkills.length * 4, 16)),
  );

  const profileReasons: string[] = [];
  if (matchedSkills.length) {
    profileReasons.push(`Your background aligns with ${matchedSkills.slice(0, 4).join(", ")}.`);
  }
  const targetHit = targetRoles.find((role) =>
    coach.specialties.some((s) => s.toLowerCase().includes(role.trim().toLowerCase())) ||
    (coach.category ?? "").toLowerCase().includes(role.trim().toLowerCase()),
  );
  if (targetHit) profileReasons.push(`Strong fit for your target role: ${targetHit}.`);
  if (coach.category && profileReasons.length < 2) {
    profileReasons.push(`${coach.displayName} coaches in ${coach.category} — relevant to your profile.`);
  }
  const keywordNote = coachProfileKeywordSummary(
    fallback.keywords.filter((k) => k.matched).length,
    fallback.keywords.length,
  );
  if (keywordNote && profileReasons.length < 3) profileReasons.push(keywordNote);

  return { profileScore, profileReasons, matchedSkills };
}

function computeGoalMatchScore(
  coach: CoachMatchInput,
  goals: DashboardGoal[],
  coachTextLower: string,
): { goalScore: number; goalReasons: string[]; matchedGoalLabels: string[] } {
  const direct = scoreCoachForGoals(
    {
      category: coach.category,
      specialties: coach.specialties,
      clientSpecializations: coach.clientSpecializations ?? [],
    },
    goals,
    coachTextLower,
  );

  if (direct.goalScore > 0) return direct;

  const goalBlob = goalTextForMatching(goals);
  const fallback = fallbackJobMatch(coachProfileTextForMatch(coach), goalBlob);
  const goalScore = Math.min(100, Math.round(fallback.score * 10));
  const goalReasons =
    goalScore >= 35 && goals.length
      ? [`Your dashboard goals overlap with this coach's focus areas.`]
      : [];

  return { goalScore, goalReasons, matchedGoalLabels: direct.matchedGoalLabels };
}

function mergeMatchReasons(
  goalReasons: string[],
  profileReasons: string[],
  hasGoals: boolean,
  hasProfile: boolean,
): string[] {
  const reasons: string[] = [];
  if (hasGoals) reasons.push(...goalReasons);
  if (hasProfile) reasons.push(...profileReasons);
  if (!reasons.length) {
    reasons.push("Open this profile to see how this coach can help with your goals.");
  }
  return reasons.slice(0, 4);
}

export function enrichCoachWithMatch<T extends CoachMatchInput>(
  coach: T,
  profileText: string,
  targetRoles: string[] = [],
  dashboardGoals: DashboardGoal[] = [],
): T & CoachMatchFields {
  const hasProfile = isSubstantialProfile(profileText, targetRoles);
  const hasGoals = dashboardGoals.length > 0;
  if (!hasProfile && !hasGoals) return { ...coach, ...EMPTY_MATCH };

  const coachTextLower = coachProfileTextForMatch(coach).toLowerCase();

  const profilePart = hasProfile
    ? computeProfileMatchScore(coach, profileText, targetRoles)
    : { profileScore: 0, profileReasons: [] as string[], matchedSkills: [] as string[] };

  const goalPart = hasGoals
    ? computeGoalMatchScore(coach, dashboardGoals, coachTextLower)
    : { goalScore: 0, goalReasons: [] as string[], matchedGoalLabels: [] as string[] };

  let matchScore: number;
  if (hasGoals && hasProfile) {
    matchScore = Math.round(goalPart.goalScore * 0.55 + profilePart.profileScore * 0.45);
  } else if (hasGoals) {
    matchScore = goalPart.goalScore;
  } else {
    matchScore = profilePart.profileScore;
  }

  const matchReasons = mergeMatchReasons(
    goalPart.goalReasons,
    profilePart.profileReasons,
    hasGoals,
    hasProfile,
  );

  return {
    ...coach,
    matchScore,
    matchLabel: matchScore > 0 ? matchScoreLabelFor(matchScore) : "",
    matchReasons,
    matchedSkills: profilePart.matchedSkills,
  };
}

export function enrichCoachesWithMatch<T extends CoachMatchInput>(
  coaches: T[],
  profileText: string,
  targetRoles: string[] = [],
  dashboardGoals: DashboardGoal[] = [],
): (T & CoachMatchFields)[] {
  const hasProfile = isSubstantialProfile(profileText, targetRoles);
  const hasGoals = dashboardGoals.length > 0;
  if (!hasProfile && !hasGoals) return coaches.map((c) => ({ ...c, ...EMPTY_MATCH }));

  return coaches
    .map((coach) => enrichCoachWithMatch(coach, profileText, targetRoles, dashboardGoals))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function topMatchedCoach<T extends CoachMatchInput & CoachMatchFields>(
  coaches: T[],
): T | null {
  const scored = coaches.filter((coach) => coach.matchScore > 0);
  if (!scored.length) return null;
  return [...scored].sort((a, b) => b.matchScore - a.matchScore)[0] ?? null;
}
