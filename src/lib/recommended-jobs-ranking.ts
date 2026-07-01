import {
  RECOMMENDED_DISPLAY_COUNT,
  RECOMMENDED_MATCH_SCORE_FLOOR,
  RECOMMENDED_PREFERRED_MIN_SCORE,
  RECOMMENDED_RESERVE_COUNT,
} from "@/lib/recommended-jobs-config";
import { filterOutPipelineJobs, vectorMatchedJobDedupeKey } from "@/lib/pipeline-job-dedupe";
import { jobListingDedupeKey } from "@/lib/cached-job";
import { compareJobFreshness, isRecommendedFreshnessVisible } from "@/lib/job-posted-freshness";
import {
  enrichJobsWithFitTiers,
  selectDisplayJobs,
  sortRecommendedJobsByFit,
  compareRecommendedByFit,
  extractProfileSkills,
} from "@/lib/job-fit-ranking";
import { matchScoreLabelFor } from "@/lib/match-score";
import type { RecommendedFetchLane } from "@/lib/recommended-jobs-fallback";
import {
  applyRoleTitlePreferenceToScore,
  hasRoleTitlePreferenceSignals,
  roleTitlePreferenceReasons,
  type RoleTitlePreferences,
} from "@/lib/role-title-preferences";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

export type RecommendedRankTier = 1 | 2 | 3;

export function applyRecommendedScoreFloor(
  jobs: VectorMatchedJob[],
  floor = RECOMMENDED_MATCH_SCORE_FLOOR,
): VectorMatchedJob[] {
  if (floor <= 0) return jobs;
  return jobs.filter((j) => j.matchScore >= floor);
}

export function compareRecommendedMatchScore(a: VectorMatchedJob, b: VectorMatchedJob): number {
  return compareRecommendedByFit(a, b);
}

export function sortRecommendedJobs(jobs: VectorMatchedJob[]): VectorMatchedJob[] {
  return sortRecommendedJobsByFit(jobs);
}

export function dedupeVectorMatchedJobs(jobs: VectorMatchedJob[]): VectorMatchedJob[] {
  const byKey = new Map<string, VectorMatchedJob>();
  for (const job of jobs) {
    const key = jobListingDedupeKey({
      companyName: job.companyName,
      title: job.title,
      url: job.url,
    });
    if (!key) continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, job);
      continue;
    }
    if (job.matchScore !== existing.matchScore) {
      if (job.matchScore > existing.matchScore) byKey.set(key, job);
      continue;
    }
    if (compareJobFreshness(job.datePosted, existing.datePosted) < 0) {
      byKey.set(key, job);
    }
  }
  return [...byKey.values()];
}

export type RankRecommendedJobsOptions = {
  filterStale?: boolean;
  roleTitlePreferences?: RoleTitlePreferences;
  profileSkills?: string[];
  fetchLaneByKey?: Map<string, RecommendedFetchLane>;
  preferredMinScore?: number;
};

function prepareRankedRecommendedJobs(
  jobs: VectorMatchedJob[],
  isTrackedFn: (job: VectorMatchedJob) => boolean,
  options?: RankRecommendedJobsOptions,
): VectorMatchedJob[] {
  const filterStale = options?.filterStale !== false;
  const freshnessFiltered = filterStale
    ? jobs.filter((job) => isRecommendedFreshnessVisible(job.datePosted))
    : jobs;
  const floored = applyRecommendedScoreFloor(freshnessFiltered);
  const deduped = dedupeVectorMatchedJobs(floored);

  return enrichJobsWithFitTiers(deduped, {
    isTrackedFn,
    roleTitlePreferences: options?.roleTitlePreferences ?? {},
    profileSkills: options?.profileSkills ?? [],
    fetchLaneByKey: options?.fetchLaneByKey,
  });
}

/** Full ranked pool from Hirebase fetch — before display/reserve split. */
export function rankRecommendedJobPool(
  jobs: VectorMatchedJob[],
  isTrackedFn: (job: VectorMatchedJob) => boolean,
  options?: RankRecommendedJobsOptions,
): VectorMatchedJob[] {
  return sortRecommendedJobsByFit(prepareRankedRecommendedJobs(jobs, isTrackedFn, options));
}

export function splitRecommendedDisplayAndReserve(
  rankedJobs: VectorMatchedJob[],
  pipelineKeys: Set<string>,
  options?: {
    displayCount?: number;
    reserveCount?: number;
    preferredMinScore?: number;
  },
): { jobs: VectorMatchedJob[]; reserveJobs: VectorMatchedJob[] } {
  const displayCount = options?.displayCount ?? RECOMMENDED_DISPLAY_COUNT;
  const reserveCount = options?.reserveCount ?? RECOMMENDED_RESERVE_COUNT;
  const preferredMinScore = options?.preferredMinScore ?? RECOMMENDED_PREFERRED_MIN_SCORE;
  const available = filterOutPipelineJobs(rankedJobs, pipelineKeys);
  const jobs = selectDisplayJobs(available, { displayCount, preferredMinScore });
  const usedKeys = new Set(jobs.map((job) => vectorMatchedJobDedupeKey(job)));
  const reserveJobs = available
    .filter((job) => !usedKeys.has(vectorMatchedJobDedupeKey(job)))
    .slice(0, reserveCount);
  return { jobs, reserveJobs };
}

export function finalizeRecommendedJobs(
  jobs: VectorMatchedJob[],
  isTrackedFn: (job: VectorMatchedJob) => boolean,
  maxJobs: number,
  options?: RankRecommendedJobsOptions,
): VectorMatchedJob[] {
  const tiered = prepareRankedRecommendedJobs(jobs, isTrackedFn, options);
  const displayCount = Math.min(maxJobs, RECOMMENDED_DISPLAY_COUNT);
  return selectDisplayJobs(tiered, {
    displayCount,
    preferredMinScore: options?.preferredMinScore ?? RECOMMENDED_PREFERRED_MIN_SCORE,
  });
}

function isStaleRolePreferenceReason(reason: string): boolean {
  return (
    reason.includes("deprioritized") ||
    reason.includes("prioritized role") ||
    reason.includes("target role") ||
    reason.includes("Category boost") ||
    reason.includes("Sorted lower")
  );
}

/** Re-apply current profile role preferences to scored jobs (snapshot-safe). */
export function applyRoleTitlePreferencesToMatchedJobs(
  jobs: VectorMatchedJob[],
  preferences: RoleTitlePreferences,
): VectorMatchedJob[] {
  if (!jobs.length || !hasRoleTitlePreferenceSignals(preferences)) {
    return jobs;
  }

  const updated = jobs.map((job) => {
    const categories = job.tags ?? [];
    const base = job.baseMatchScore ?? job.matchScore;
    const { matchScore, adjustment } = applyRoleTitlePreferenceToScore(
      base,
      job.title,
      preferences,
      categories,
    );

    const prefReasons = roleTitlePreferenceReasons(adjustment);
    const otherReasons = job.matchReasons.filter((r) => !isStaleRolePreferenceReason(r));
    const filteredOther =
      adjustment.deprioritizedMatch || adjustment.deprioritizedCategoryMatch
        ? otherReasons.filter((r) => !r.includes("matches your career targets"))
        : otherReasons;

    return {
      ...job,
      baseMatchScore: base,
      matchScore,
      matchLabel: matchScoreLabelFor(matchScore),
      matchReasons: [...prefReasons, ...filteredOther].slice(0, 4),
    };
  });

  return sortRecommendedJobs(updated);
}
