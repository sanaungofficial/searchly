/** Jobs shown in Open Roles recommended feed. */
export const RECOMMENDED_DISPLAY_COUNT = 15;

/** Extra ranked candidates kept client-side to backfill when a role is saved (no extra Hirebase call). */
export const RECOMMENDED_RESERVE_COUNT = 10;

/** Prefer this score when selecting display jobs; backfill below if needed. */
export const RECOMMENDED_PREFERRED_MIN_SCORE = 70;

/** Minimum match score hard floor — 0 = disabled (show all pulled results). */
export const RECOMMENDED_MATCH_SCORE_FLOOR = 0;

/** Max similar-job vsearch calls per feed refresh (search_type=job). */
export const RECOMMENDED_SIMILAR_JOB_SEED_COUNT = 3;

/** Max target titles to expand into related role families per refresh. */
export const RECOMMENDED_EXPANDED_ROLE_MAX_SEEDS = 2;

/** TTL for cached expanded role titles per user (ms). */
export const RECOMMENDED_EXPANDED_ROLE_CACHE_MS = 1000 * 60 * 60 * 24;

/** Max roles included in the daily match digest email. */
export const RECOMMENDED_DIGEST_EMAIL_MAX_JOBS = 3;

/** Minimum match score for digest emails — env override RECOMMENDED_DIGEST_MIN_SCORE. */
export function recommendedDigestMinScore(): number {
  const raw = process.env.RECOMMENDED_DIGEST_MIN_SCORE;
  const parsed = raw ? Number.parseInt(raw, 10) : 60;
  if (!Number.isFinite(parsed) || parsed < 0) return 60;
  return Math.min(parsed, 100);
}

/** Over-fetch before optional score floor so enough jobs survive filtering. */
export const RECOMMENDED_FETCH_POOL = 60;

/** Max jobs stored per user snapshot / API response (after tier ranking). */
export const RECOMMENDED_SNAPSHOT_MAX_JOBS = RECOMMENDED_DISPLAY_COUNT;

/** Minimum distinct company+title roles before we supplement with broad Hirebase results. */
export const RECOMMENDED_MIN_DISPLAY_ROLES = RECOMMENDED_DISPLAY_COUNT;

/** Supplement with broad Hirebase results when the feed has fewer than this many employers. */
export const RECOMMENDED_MIN_DISTINCT_COMPANIES = 3;

/** Max roles from the same employer in the Open Roles feed. */
export const RECOMMENDED_MAX_JOBS_PER_COMPANY = 2;

/** Cooldown between manual live refreshes — 0 disables rate limiting. */
export const RECOMMENDED_MANUAL_REFRESH_COOLDOWN_MS = 0;

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

export type RecommendedMatchMode =
  | "resume"
  | "profile_summary"
  | "tracked"
  | "profile_roles"
  | "broad";

export type RecommendedJobSnapshotPayload = {
  jobs: import("@/lib/vector-matched-job").VectorMatchedJob[];
  matchMode: RecommendedMatchMode;
  companyCount: number;
  trackedWithMatches: number;
  notice?: string;
};
