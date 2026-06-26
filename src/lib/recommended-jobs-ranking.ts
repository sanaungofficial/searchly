import { RECOMMENDED_MATCH_SCORE_FLOOR } from "@/lib/recommended-jobs-config";
import { jobListingDedupeKey } from "@/lib/cached-job";
import { compareJobFreshness, isRecommendedFreshnessVisible } from "@/lib/job-posted-freshness";
import { matchScoreLabelFor } from "@/lib/match-score";
import {
  applyRoleTitlePreferenceToScore,
  hasRoleTitlePreferenceSignals,
  roleTitlePreferenceReasons,
  type RoleTitlePreferences,
} from "@/lib/role-title-preferences";
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

export function compareRecommendedMatchScore(a: VectorMatchedJob, b: VectorMatchedJob): number {
  if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
  const tierA = a.rankTier ?? 3;
  const tierB = b.rankTier ?? 3;
  if (tierA !== tierB) return tierA - tierB;
  if (a.isTrackedCompany !== b.isTrackedCompany) {
    return (b.isTrackedCompany ? 1 : 0) - (a.isTrackedCompany ? 1 : 0);
  }
  const freshnessCmp = compareJobFreshness(a.datePosted, b.datePosted);
  if (freshnessCmp !== 0) return freshnessCmp;
  return (a.vectorRank ?? 99) - (b.vectorRank ?? 99);
}

export function sortRecommendedJobs(jobs: VectorMatchedJob[]): VectorMatchedJob[] {
  return [...jobs].sort(compareRecommendedMatchScore);
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
  return sortRecommendedJobs(dedupeVectorMatchedJobs(floored)).slice(0, maxJobs);
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
