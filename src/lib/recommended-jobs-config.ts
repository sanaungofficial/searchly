/** Minimum match score to show in feed — 0 = disabled (show all pulled results). */
export const RECOMMENDED_MATCH_SCORE_FLOOR = 0;

/** Over-fetch before optional score floor so enough jobs survive filtering. */
export const RECOMMENDED_FETCH_POOL = 60;

/** Max jobs stored per user snapshot / API response. */
export const RECOMMENDED_SNAPSHOT_MAX_JOBS = 20;

/** Cooldown between manual live refreshes (rate limit Hirebase credits). */
export const RECOMMENDED_MANUAL_REFRESH_COOLDOWN_MS = 4 * 60 * 60 * 1000;

/** Users processed per cron run — set RECOMMENDED_CRON_USER_LIMIT=5 to test on a few accounts. */
export function recommendedCronUserLimit(): number {
  const raw = process.env.RECOMMENDED_CRON_USER_LIMIT;
  const parsed = raw ? Number.parseInt(raw, 10) : 50;
  if (!Number.isFinite(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 200);
}

export function utcSnapshotDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export type RecommendedMatchMode = "resume" | "profile_summary" | "tracked" | "profile_roles";

export type RecommendedJobSnapshotPayload = {
  jobs: import("@/lib/vector-matched-job").VectorMatchedJob[];
  matchMode: RecommendedMatchMode;
  companyCount: number;
  trackedWithMatches: number;
  notice?: string;
};
