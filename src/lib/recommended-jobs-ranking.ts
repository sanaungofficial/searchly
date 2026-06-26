import { RECOMMENDED_MATCH_SCORE_FLOOR } from "@/lib/recommended-jobs-config";
import { compareJobFreshness, isRecommendedFreshnessVisible } from "@/lib/job-posted-freshness";
import type { VectorMatchedJob } from "@/lib/vector-matched-job";

export type RecommendedRankTier = 1 | 2 | 3;

/** Tier 1: watchlist employer · Tier 2: top semantic fit · Tier 3: related / aspirational */
export function assignRankTier(job: VectorMatchedJob, isTrackedCompany: boolean): RecommendedRankTier {
  if (isTrackedCompany) return 1;
  if ((job.vectorRank ?? 99) <= 8) return 2;
  return 3;
}

export function applyRecommendedScoreFloor(
  jobs: VectorMatchedJob[],
  floor = RECOMMENDED_MATCH_SCORE_FLOOR,
): VectorMatchedJob[] {
  if (floor <= 0) return jobs;
  return jobs.filter((j) => j.matchScore >= floor);
}

export function sortRecommendedJobs(jobs: VectorMatchedJob[]): VectorMatchedJob[] {
  return [...jobs].sort((a, b) => {
    const tierA = a.rankTier ?? 3;
    const tierB = b.rankTier ?? 3;
    if (tierA !== tierB) return tierA - tierB;

    const freshnessCmp = compareJobFreshness(a.datePosted, b.datePosted);
    if (freshnessCmp !== 0) return freshnessCmp;

    if (a.isTrackedCompany !== b.isTrackedCompany) {
      return (b.isTrackedCompany ? 1 : 0) - (a.isTrackedCompany ? 1 : 0);
    }
    if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
    return (a.vectorRank ?? 99) - (b.vectorRank ?? 99);
  });
}

export function finalizeRecommendedJobs(
  jobs: VectorMatchedJob[],
  isTrackedFn: (job: VectorMatchedJob) => boolean,
  maxJobs: number,
  options?: { filterStale?: boolean },
): VectorMatchedJob[] {
  const enriched = jobs.map((job) => {
    const tracked = isTrackedFn(job);
    return {
      ...job,
      isTrackedCompany: tracked,
      rankTier: assignRankTier(job, tracked),
    };
  });

  const filterStale = options?.filterStale !== false;
  const freshnessFiltered = filterStale
    ? enriched.filter((job) => isRecommendedFreshnessVisible(job.datePosted))
    : enriched;
  const floored = applyRecommendedScoreFloor(freshnessFiltered);
  return sortRecommendedJobs(floored).slice(0, maxJobs);
}
