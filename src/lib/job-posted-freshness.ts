/** Freshness tiers from Hirebase `date_posted` — apply within 48h for best odds. */

export type JobFreshnessLevel = "fresh" | "warm" | "stale" | "unknown";

export type JobFreshness = {
  level: JobFreshnessLevel;
  hoursSince: number | null;
  daysSince: number | null;
  /** Short label for cards, e.g. "Posted 6h ago" */
  cardLabel: string;
  /** Tooltip / detail line */
  detailLabel: string;
  /** Lower = fresher — use for sorting */
  sortRank: number;
  /** Hide from default recommended feed when true (>72h without date) */
  isStale: boolean;
};

const MS_HOUR = 1000 * 60 * 60;
const MS_DAY = MS_HOUR * 24;

export const FRESHNESS_FRESH_HOURS = 24;
export const FRESHNESS_WARM_HOURS = 72;
/** Teaching point: best response rate within ~48h — used in copy, not tier boundary. */
export const FRESHNESS_APPLY_WITHIN_HOURS = 48;

export const FRESHNESS_COLORS: Record<JobFreshnessLevel, { dot: string; text: string; bg: string }> = {
  fresh: { dot: "#2A6B4A", text: "#2A6B4A", bg: "rgba(42,107,74,0.1)" },
  warm: { dot: "#C4A86A", text: "#8A7340", bg: "rgba(196,168,106,0.14)" },
  stale: { dot: "#C4574A", text: "#C4574A", bg: "rgba(196,87,74,0.1)" },
  unknown: { dot: "#9CA3AF", text: "#6B7280", bg: "rgba(107,114,128,0.1)" },
};

function parsePostedDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatRelativeHours(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

function absolutePostedLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function levelFromHours(hours: number): JobFreshnessLevel {
  if (hours <= FRESHNESS_FRESH_HOURS) return "fresh";
  if (hours <= FRESHNESS_WARM_HOURS) return "warm";
  return "stale";
}

function sortRankForLevel(level: JobFreshnessLevel): number {
  switch (level) {
    case "fresh":
      return 0;
    case "warm":
      return 1;
    case "stale":
      return 2;
    default:
      return 3;
  }
}

export function getJobFreshness(datePosted: string | null | undefined): JobFreshness {
  const date = parsePostedDate(datePosted);
  if (!date) {
    return {
      level: "unknown",
      hoursSince: null,
      daysSince: null,
      cardLabel: "Posted date unknown",
      detailLabel: "Posting date not available from Hirebase",
      sortRank: sortRankForLevel("unknown"),
      isStale: false,
    };
  }

  const hoursSince = Math.max(0, (Date.now() - date.getTime()) / MS_HOUR);
  const daysSince = Math.floor(hoursSince / 24);
  const level = levelFromHours(hoursSince);
  const relative = formatRelativeHours(hoursSince);
  const absolute = absolutePostedLabel(date);

  return {
    level,
    hoursSince,
    daysSince,
    cardLabel: `Posted ${relative}`,
    detailLabel: `${absolute} · ${relative}`,
    sortRank: sortRankForLevel(level),
    isStale: level === "stale",
  };
}

export function daysSincePosted(datePosted: string | null | undefined): number | null {
  const date = parsePostedDate(datePosted);
  if (!date) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / MS_DAY));
}

export function compareJobFreshness(
  aPosted: string | null | undefined,
  bPosted: string | null | undefined,
): number {
  const a = getJobFreshness(aPosted);
  const b = getJobFreshness(bPosted);
  if (a.sortRank !== b.sortRank) return a.sortRank - b.sortRank;
  const aHours = a.hoursSince ?? Number.POSITIVE_INFINITY;
  const bHours = b.hoursSince ?? Number.POSITIVE_INFINITY;
  return aHours - bHours;
}

/** Default recommended feed: drop roles older than 72h when we have a posted date. */
export function isRecommendedFreshnessVisible(datePosted: string | null | undefined): boolean {
  const freshness = getJobFreshness(datePosted);
  if (freshness.level === "unknown") return true;
  return !freshness.isStale;
}
