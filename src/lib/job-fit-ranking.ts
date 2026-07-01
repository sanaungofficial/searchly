import {
  RECOMMENDED_DISPLAY_COUNT,
  RECOMMENDED_MAX_JOBS_PER_COMPANY,
  RECOMMENDED_PREFERRED_MIN_SCORE,
} from "@/lib/recommended-jobs-config";
import type { RecommendedFetchLane } from "@/lib/recommended-jobs-fallback";
import {
  jobCategoryMatchesPattern,
  jobTitleMatchesRolePattern,
  profileRoleTitlesForMatch,
  type RoleTitlePreferences,
} from "@/lib/role-title-preferences";
import type { ParsedResumeData } from "@/lib/resume-parse";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

export type JobFitTier = "S" | "A" | "B" | "C" | "D" | "E";

/** Lower numeric rank = higher priority in sort. */
export const FIT_TIER_RANK: Record<JobFitTier, number> = {
  S: 1,
  A: 2,
  B: 3,
  C: 4,
  D: 5,
  E: 6,
};

/** Map S–E tiers onto legacy 1–3 rankTier for older sort paths. */
export function fitTierToLegacyRankTier(tier: JobFitTier): 1 | 2 | 3 {
  if (tier === "S" || tier === "A") return 1;
  if (tier === "B" || tier === "C") return 2;
  return 3;
}

const SKILLS_OVERLAP_MIN_RATIO = 0.2;
const SKILLS_OVERLAP_MIN_COUNT = 2;

export function extractProfileSkills(
  parsedData: ParsedResumeData | null | undefined,
  additionalSkills: string[] = [],
): string[] {
  const fromParsed = [
    ...(parsedData?.skills ?? []),
    ...(parsedData?.tools ?? []),
    ...(parsedData?.skillGroups ?? []).flatMap((group) => group.skills),
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const skill of [...fromParsed, ...additionalSkills]) {
    const trimmed = skill.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out.slice(0, 80);
}

function normalizeSkill(value: string): string {
  return value.trim().toLowerCase();
}

function skillMatchesProfile(jobSkill: string, profileSkills: string[]): boolean {
  const needle = normalizeSkill(jobSkill);
  if (!needle || needle.length < 2) return false;
  return profileSkills.some((profileSkill) => {
    const hay = normalizeSkill(profileSkill);
    if (!hay) return false;
    return hay.includes(needle) || needle.includes(hay);
  });
}

export function computeJobSkillsOverlap(
  jobSkills: string[],
  profileSkills: string[],
): { matchedSkills: string[]; overlapRatio: number; overlapCount: number } {
  const uniqueJobSkills = [...new Set(jobSkills.map((s) => s.trim()).filter(Boolean))];
  const matchedSkills = uniqueJobSkills.filter((skill) => skillMatchesProfile(skill, profileSkills));
  const overlapCount = matchedSkills.length;
  const overlapRatio = uniqueJobSkills.length ? overlapCount / uniqueJobSkills.length : 0;
  return { matchedSkills, overlapRatio, overlapCount };
}

function jobMatchesAnyRole(title: string, roles: string[]): boolean {
  return roles.some((role) => jobTitleMatchesRolePattern(title, role));
}

function jobMatchesTargetRole(title: string, preferences: RoleTitlePreferences): boolean {
  const targets = preferences.targetRoles ?? [];
  return targets.length > 0 && jobMatchesAnyRole(title, targets);
}

function hasMeaningfulSkillsOverlap(overlapCount: number, overlapRatio: number): boolean {
  return overlapCount >= SKILLS_OVERLAP_MIN_COUNT || overlapRatio >= SKILLS_OVERLAP_MIN_RATIO;
}

export function assignJobFitTier(input: {
  job: VectorMatchedJob;
  isTrackedCompany: boolean;
  fetchLane?: RecommendedFetchLane;
  roleTitlePreferences: RoleTitlePreferences;
  profileSkills: string[];
}): JobFitTier {
  const { job, isTrackedCompany, fetchLane, roleTitlePreferences, profileSkills } = input;
  const title = job.title;
  const categories = [...(job.tags ?? [])];
  const roleMatch = jobMatchesTargetRole(title, roleTitlePreferences);
  const jobSkillPool = [...(job.skills ?? []), ...(job.technologies ?? [])];
  const { overlapCount, overlapRatio } = computeJobSkillsOverlap(jobSkillPool, profileSkills);
  const skillsOverlap = hasMeaningfulSkillsOverlap(overlapCount, overlapRatio);

  if (isTrackedCompany && roleMatch && skillsOverlap) return "S";
  if (isTrackedCompany && roleMatch) return "A";
  if (roleMatch && (job.vectorRank ?? 99) <= 8) return "A";

  if (fetchLane === "resume_vsearch" || fetchLane === "profile_summary") {
    if ((job.vectorRank ?? 99) <= 15) return "B";
  }

  if (
    fetchLane === "profile_roles" ||
    fetchLane === "expanded_roles" ||
    fetchLane === "similar_job"
  ) {
    return "C";
  }

  const prioritizedCategories = roleTitlePreferences.prioritizedCategories ?? [];
  if (
    prioritizedCategories.some((category) => jobCategoryMatchesPattern(categories, category))
  ) {
    return "D";
  }

  if (fetchLane === "broad") return "E";
  if (roleMatch) return "C";
  return "E";
}

export function compareJobFitTier(a: JobFitTier, b: JobFitTier): number {
  return FIT_TIER_RANK[a] - FIT_TIER_RANK[b];
}

export function compareRecommendedByFit(a: VectorMatchedJob, b: VectorMatchedJob): number {
  const tierA = a.fitTier ?? "E";
  const tierB = b.fitTier ?? "E";
  const tierCmp = compareJobFitTier(tierA, tierB);
  if (tierCmp !== 0) return tierCmp;

  if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;

  const legacyA = a.rankTier ?? fitTierToLegacyRankTier(tierA);
  const legacyB = b.rankTier ?? fitTierToLegacyRankTier(tierB);
  if (legacyA !== legacyB) return legacyA - legacyB;

  if (Boolean(a.isTrackedCompany) !== Boolean(b.isTrackedCompany)) {
    return (b.isTrackedCompany ? 1 : 0) - (a.isTrackedCompany ? 1 : 0);
  }

  return (a.vectorRank ?? 99) - (b.vectorRank ?? 99);
}

export function sortRecommendedJobsByFit(jobs: VectorMatchedJob[]): VectorMatchedJob[] {
  return [...jobs].sort(compareRecommendedByFit);
}

/** Prefer scores >= preferredMin; backfill so the feed is never empty. Cap roles per employer. */
export function selectDisplayJobs(
  jobs: VectorMatchedJob[],
  options?: { displayCount?: number; preferredMinScore?: number; maxJobsPerCompany?: number },
): VectorMatchedJob[] {
  const displayCount = options?.displayCount ?? RECOMMENDED_DISPLAY_COUNT;
  const preferredMinScore = options?.preferredMinScore ?? RECOMMENDED_PREFERRED_MIN_SCORE;
  const maxJobsPerCompany = options?.maxJobsPerCompany ?? RECOMMENDED_MAX_JOBS_PER_COMPANY;
  if (!jobs.length) return [];

  const sorted = sortRecommendedJobsByFit(jobs);
  const preferred = sorted.filter((job) => job.matchScore >= preferredMinScore);
  const pool = preferred.length >= displayCount ? preferred : sorted;

  const selected: VectorMatchedJob[] = [];
  const companyCounts = new Map<string, number>();

  for (const job of pool) {
    if (selected.length >= displayCount) break;
    const companyKey = job.companyName.trim().toLowerCase() || "unknown";
    const count = companyCounts.get(companyKey) ?? 0;
    if (count >= maxJobsPerCompany) continue;
    companyCounts.set(companyKey, count + 1);
    selected.push(job);
  }

  if (selected.length >= displayCount) return selected.slice(0, displayCount);

  const selectedKeys = new Set(selected.map((job) => `${job.companyName}:${job.title}:${job.url}`));
  for (const job of sorted) {
    if (selected.length >= displayCount) break;
    const key = `${job.companyName}:${job.title}:${job.url}`;
    if (selectedKeys.has(key)) continue;
    const companyKey = job.companyName.trim().toLowerCase() || "unknown";
    const count = companyCounts.get(companyKey) ?? 0;
    if (count >= maxJobsPerCompany) continue;
    companyCounts.set(companyKey, count + 1);
    selectedKeys.add(key);
    selected.push(job);
  }

  return selected.slice(0, displayCount);
}

export function enrichJobsWithFitTiers(
  jobs: VectorMatchedJob[],
  input: {
    isTrackedFn: (job: VectorMatchedJob) => boolean;
    roleTitlePreferences: RoleTitlePreferences;
    profileSkills: string[];
    fetchLaneByKey?: Map<string, RecommendedFetchLane>;
  },
): VectorMatchedJob[] {
  return jobs.map((job) => {
    const key = `${job.companyName}:${job.title}:${job.url ?? ""}`;
    const fetchLane = input.fetchLaneByKey?.get(key) ?? job.fetchLane;
    const isTrackedCompany = input.isTrackedFn(job);
    const fitTier = assignJobFitTier({
      job,
      isTrackedCompany,
      fetchLane,
      roleTitlePreferences: input.roleTitlePreferences,
      profileSkills: input.profileSkills,
    });
    return {
      ...job,
      isTrackedCompany,
      fitTier,
      fetchLane,
      rankTier: fitTierToLegacyRankTier(fitTier),
    };
  });
}
