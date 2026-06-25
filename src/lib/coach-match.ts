import { fallbackJobMatch } from "@/lib/resume-match";
import {
  isLowQualityMatchReason,
  matchScoreLabelFor,
  usableKeywordSummary,
} from "@/lib/match-score";
import type { ParsedResumeData } from "@/lib/resume-parse";

export type CoachForMatch = {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  currentRole: string | null;
  currentCompany: string | null;
  location: string | null;
  linkedinUrl: string | null;
  lelandUrl: string | null;
  photoUrl: string | null;
  firms: string[];
  schools: string[];
  specialties: string[];
  industries: string[];
  hourlyRate: number | null;
  category: string | null;
  featured: boolean;
};

export type CoachMatchFields = {
  matchScore: number;
  matchLabel: string;
  matchReasons: string[];
  matchedTags: string[];
  gapTags: string[];
  matchRank?: number;
};

export type MatchedCoach = CoachForMatch & CoachMatchFields;

export type CoachMatchProfileContext = {
  resumeText: string;
  targetRoles: string[];
  parsedData: ParsedResumeData | null;
  priorities: string[];
  careerMotivation?: string | null;
  strategyIntakeNotes?: string | null;
};

export type CoachMatchFilters = {
  specialty?: string;
  firm?: string;
  industry?: string;
  location?: string;
  maxHourlyRate?: number;
};

export const COACH_MATCH_MAX_RESULTS = 20;

function vectorRankScore(rank: number, total: number): number {
  if (total <= 1) return 92;
  const spread = Math.min(total - 1, 19);
  return Math.max(58, Math.round(94 - ((rank - 1) * 32) / Math.max(spread, 1)));
}

export function coachProfileTextForMatch(coach: CoachForMatch): string {
  const parts = [
    coach.headline,
    coach.bio,
    coach.currentRole ? `Role: ${coach.currentRole}` : null,
    coach.currentCompany ? `Company: ${coach.currentCompany}` : null,
    coach.category ? `Category: ${coach.category}` : null,
    coach.location ? `Location: ${coach.location}` : null,
    coach.specialties.length ? `Specialties: ${coach.specialties.join(", ")}` : null,
    coach.industries.length ? `Industries: ${coach.industries.join(", ")}` : null,
    coach.firms.length ? `Firms: ${coach.firms.join(", ")}` : null,
    coach.schools.length ? `Schools: ${coach.schools.join(", ")}` : null,
  ].filter(Boolean);
  return parts.join("\n\n").slice(0, 2000);
}

function buildProfileText(ctx: CoachMatchProfileContext): string {
  const rolesLine = ctx.targetRoles.map((r) => r.trim()).filter(Boolean).join(", ");
  const prioritiesLine = ctx.priorities.map((p) => p.trim()).filter(Boolean).join(", ");
  return [
    ctx.resumeText.trim(),
    rolesLine ? `Target roles: ${rolesLine}` : null,
    prioritiesLine ? `Priorities: ${prioritiesLine}` : null,
    ctx.careerMotivation?.trim(),
    ctx.strategyIntakeNotes?.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function tokensOverlap(a: string, b: string): boolean {
  const left = normalizeToken(a);
  const right = normalizeToken(b);
  if (!left || !right) return false;
  return left.includes(right) || right.includes(left);
}

function findOverlaps(source: string[], targets: string[]): string[] {
  return targets.filter((target) =>
    source.some((item) => tokensOverlap(item, target)),
  );
}

function userCompanies(parsed: ParsedResumeData | null): string[] {
  return (parsed?.workExperience ?? []).map((entry) => entry.company.trim()).filter(Boolean);
}

function userSchools(parsed: ParsedResumeData | null): string[] {
  return (parsed?.education ?? []).map((entry) => entry.school.trim()).filter(Boolean);
}

function userSkills(parsed: ParsedResumeData | null): string[] {
  const flat = parsed?.skills ?? [];
  const grouped = (parsed?.skillGroups ?? []).flatMap((group) => group.skills);
  return [...new Set([...flat, ...grouped].map((s) => s.trim()).filter(Boolean))];
}

function userLocation(parsed: ParsedResumeData | null): string | null {
  return parsed?.location?.trim() || null;
}

function titleRoleBoost(coach: CoachForMatch, targetRoles: string[]): number {
  const haystack = [coach.currentRole, coach.headline, coach.bio]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  for (const role of targetRoles) {
    const trimmed = role.trim().toLowerCase();
    if (trimmed.length >= 3 && haystack.includes(trimmed)) return 12;
  }
  return 0;
}

function specialtyBoost(coach: CoachForMatch, ctx: CoachMatchProfileContext, profileLower: string): number {
  const roleHits = findOverlaps(ctx.targetRoles, coach.specialties);
  const profileHits = coach.specialties.filter((specialty) =>
    profileLower.includes(normalizeToken(specialty)),
  );
  const hits = [...new Set([...roleHits, ...profileHits])];
  return Math.min(15, hits.length * 5);
}

function industryBoost(coach: CoachForMatch, ctx: CoachMatchProfileContext, profileLower: string): number {
  const skills = userSkills(ctx.parsedData);
  const hits = coach.industries.filter(
    (industry) =>
      profileLower.includes(normalizeToken(industry)) ||
      skills.some((skill) => tokensOverlap(skill, industry)),
  );
  return Math.min(12, hits.length * 4);
}

function firmSchoolBoost(coach: CoachForMatch, parsed: ParsedResumeData | null): number {
  const firmHits = findOverlaps(userCompanies(parsed), coach.firms);
  const schoolHits = findOverlaps(userSchools(parsed), coach.schools);
  return Math.min(10, firmHits.length * 4 + schoolHits.length * 3);
}

function locationBoost(coach: CoachForMatch, parsed: ParsedResumeData | null): number {
  const userLoc = userLocation(parsed);
  const coachLoc = coach.location?.trim();
  if (!userLoc || !coachLoc) return 0;
  const userLower = userLoc.toLowerCase();
  const coachLower = coachLoc.toLowerCase();
  if (userLower.includes(coachLower) || coachLower.includes(userLower)) return 6;
  const userParts = userLower.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  const coachParts = coachLower.split(/[,/]/).map((p) => p.trim()).filter(Boolean);
  if (userParts.some((part) => coachParts.some((other) => tokensOverlap(part, other)))) return 4;
  return 0;
}

function categoryBoost(coach: CoachForMatch, profileLower: string): number {
  const category = coach.category?.trim().toLowerCase();
  if (!category) return 0;
  if (profileLower.includes(category)) return 5;
  if (category.includes("executive") && /executive|vp|director|chief/.test(profileLower)) return 5;
  if (category.includes("transition") && /transition|pivot|career change/.test(profileLower)) return 5;
  return 0;
}

const EMPTY_MATCH: CoachMatchFields = {
  matchScore: 0,
  matchLabel: "",
  matchReasons: [],
  matchedTags: [],
  gapTags: [],
};

export function applyCoachMatchFilters(
  coaches: MatchedCoach[],
  filters: CoachMatchFilters,
): MatchedCoach[] {
  return coaches.filter((coach) => {
    if (filters.specialty && !coach.specialties.includes(filters.specialty)) return false;
    if (filters.firm && !coach.firms.includes(filters.firm)) return false;
    if (filters.industry && !coach.industries.includes(filters.industry)) return false;
    if (filters.location) {
      const needle = filters.location.toLowerCase();
      if (!(coach.location ?? "").toLowerCase().includes(needle)) return false;
    }
    if (filters.maxHourlyRate != null) {
      if (coach.hourlyRate == null || coach.hourlyRate > filters.maxHourlyRate) return false;
    }
    return true;
  });
}

export function enrichCoachesWithMatch(
  coaches: CoachForMatch[],
  ctx: CoachMatchProfileContext,
): MatchedCoach[] {
  const profileText = buildProfileText(ctx);
  if (!profileText || !coaches.length) {
    return coaches.map((coach) => ({ ...coach, ...EMPTY_MATCH }));
  }

  const profileLower = profileText.toLowerCase();
  const ranked = coaches
    .map((coach) => {
      const fallback = fallbackJobMatch(coachProfileTextForMatch(coach), profileText);
      const keywordScore = Math.round(fallback.score * 10);
      const structuredBoost =
        specialtyBoost(coach, ctx, profileLower) +
        industryBoost(coach, ctx, profileLower) +
        firmSchoolBoost(coach, ctx.parsedData) +
        locationBoost(coach, ctx.parsedData) +
        categoryBoost(coach, profileLower) +
        titleRoleBoost(coach, ctx.targetRoles);
      return { coach, fallback, keywordScore, structuredBoost };
    })
    .sort((a, b) => b.keywordScore + b.structuredBoost - (a.keywordScore + a.structuredBoost));

  const matched = ranked.map(({ coach, fallback, keywordScore, structuredBoost }, index) => {
    const rank = index + 1;
    const rankScore = vectorRankScore(rank, ranked.length);
    const matchScore = Math.min(
      100,
      Math.round(rankScore * 0.5 + keywordScore * 0.35 + structuredBoost * 0.15),
    );

    const specialtyMatches = findOverlaps(ctx.targetRoles, coach.specialties).concat(
      coach.specialties.filter((specialty) => profileLower.includes(normalizeToken(specialty))),
    );
    const industryMatches = coach.industries.filter((industry) =>
      profileLower.includes(normalizeToken(industry)),
    );
    const firmMatches = findOverlaps(userCompanies(ctx.parsedData), coach.firms);
    const schoolMatches = findOverlaps(userSchools(ctx.parsedData), coach.schools);
    const keywordMatches = fallback.keywords.filter((k) => k.matched).map((k) => k.text);
    const matchedTags = [
      ...new Set([
        ...specialtyMatches,
        ...industryMatches,
        ...firmMatches,
        ...schoolMatches,
        ...keywordMatches,
      ]),
    ].slice(0, 8);
    const gapTags = coach.specialties
      .filter((specialty) => !matchedTags.some((tag) => tokensOverlap(tag, specialty)))
      .slice(0, 4);

    const reasons: string[] = [];
    if (specialtyMatches.length) {
      reasons.push(
        `Their coaching focus on ${[...new Set(specialtyMatches)].slice(0, 3).join(", ")} aligns with your goals.`,
      );
    }
    const titleMatch = ctx.targetRoles.find((role) => {
      const trimmed = role.trim().toLowerCase();
      const haystack = [coach.currentRole, coach.headline, coach.bio]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return trimmed.length >= 3 && haystack.includes(trimmed);
    });
    if (titleMatch) {
      reasons.push(`They have experience relevant to your target role: ${titleMatch}.`);
    }
    if (firmMatches.length) {
      reasons.push(`Shared background at ${firmMatches.slice(0, 2).join(", ")}.`);
    }
    if (schoolMatches.length) {
      reasons.push(`School overlap: ${schoolMatches.slice(0, 2).join(", ")}.`);
    }
    if (industryMatches.length) {
      reasons.push(`Industry fit: ${industryMatches.slice(0, 3).join(", ")}.`);
    }
    const keywordNote =
      usableKeywordSummary(
        fallback.keywords.filter((k) => k.matched).length,
        fallback.keywords.length,
      ) ??
      (fallback.summaryNote && !isLowQualityMatchReason(fallback.summaryNote)
        ? fallback.summaryNote
        : null);
    if (keywordNote && reasons.length < 2) reasons.push(keywordNote);
    if (!reasons.length) {
      reasons.push(
        "This coach surfaced from your profile — review their background to see if they're the right fit.",
      );
    }

    return {
      ...coach,
      matchScore,
      matchLabel: matchScoreLabelFor(matchScore),
      matchReasons: reasons.slice(0, 4),
      matchedTags,
      gapTags,
      matchRank: rank,
    };
  });

  return matched.slice(0, COACH_MATCH_MAX_RESULTS);
}

export function topMatchedCoach(coaches: MatchedCoach[]): MatchedCoach | null {
  const scored = coaches.filter((coach) => coach.matchScore > 0);
  if (!scored.length) return null;
  return [...scored].sort((a, b) => b.matchScore - a.matchScore)[0] ?? null;
}
