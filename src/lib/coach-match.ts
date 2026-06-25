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

export function enrichCoachWithMatch<T extends CoachMatchInput>(
  coach: T,
  profileText: string,
  targetRoles: string[] = [],
): T & CoachMatchFields {
  const text = profileText.trim();
  if (!text) return { ...coach, ...EMPTY_MATCH };

  const description = coachProfileTextForMatch(coach);
  const fallback = fallbackJobMatch(description, text);
  const profileLower = text.toLowerCase();
  const keywordScore = Math.round(fallback.score * 10);
  const roleBoost = categoryBoost(coach.category, targetRoles, profileLower);

  const specialtyMatches = coach.specialties.filter((s) => profileLower.includes(s.toLowerCase()));
  const firmMatches = coach.firms.filter((f) => profileLower.includes(f.toLowerCase()));
  const matchedSkills = [...new Set([...specialtyMatches, ...firmMatches])].slice(0, 8);

  const matchScore = Math.min(100, Math.round(keywordScore * 0.7 + roleBoost + Math.min(matchedSkills.length * 4, 16)));

  const reasons: string[] = [];
  if (matchedSkills.length) {
    reasons.push(`Your background aligns with ${matchedSkills.slice(0, 4).join(", ")}.`);
  }
  const targetHit = targetRoles.find((role) =>
    coach.specialties.some((s) => s.toLowerCase().includes(role.trim().toLowerCase())) ||
    (coach.category ?? "").toLowerCase().includes(role.trim().toLowerCase()),
  );
  if (targetHit) reasons.push(`Strong fit for your goal: ${targetHit}.`);
  if (coach.category && reasons.length < 2) {
    reasons.push(`${coach.displayName} coaches in ${coach.category} — relevant to your search.`);
  }
  const keywordNote = coachProfileKeywordSummary(
    fallback.keywords.filter((k) => k.matched).length,
    fallback.keywords.length,
  );
  if (keywordNote && reasons.length < 3) reasons.push(keywordNote);
  if (!reasons.length) {
    reasons.push("Open this profile to see how this coach can help with your goals.");
  }

  return {
    ...coach,
    matchScore,
    matchLabel: matchScore > 0 ? matchScoreLabelFor(matchScore) : "",
    matchReasons: reasons.slice(0, 4),
    matchedSkills,
  };
}

export function enrichCoachesWithMatch<T extends CoachMatchInput>(
  coaches: T[],
  profileText: string,
  targetRoles: string[] = [],
): (T & CoachMatchFields)[] {
  if (!profileText.trim()) return coaches.map((c) => ({ ...c, ...EMPTY_MATCH }));
  return coaches
    .map((coach) => enrichCoachWithMatch(coach, profileText, targetRoles))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export function topMatchedCoach<T extends CoachMatchInput & CoachMatchFields>(
  coaches: T[],
): T | null {
  const scored = coaches.filter((coach) => coach.matchScore > 0);
  if (!scored.length) return null;
  return [...scored].sort((a, b) => b.matchScore - a.matchScore)[0] ?? null;
}
