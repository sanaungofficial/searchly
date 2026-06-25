/** Formatting helpers for Top Echelon network job display fields. */

export type CompensationType = "hourly" | "salary" | null;

export type CompensationBand =
  | "hourly"
  | "under_100k"
  | "100k_150k"
  | "150k_200k"
  | "200k_plus";

export const COMPENSATION_BAND_LABELS: Record<CompensationBand, string> = {
  hourly: "Hourly",
  under_100k: "Under $100K",
  "100k_150k": "$100K – $150K",
  "150k_200k": "$150K – $200K",
  "200k_plus": "$200K+",
};

function readPayType(raw: { compensation_type?: unknown; pay_type?: unknown; salary_type?: unknown }): string | null {
  for (const key of ["compensation_type", "pay_type", "salary_type"] as const) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim().toLowerCase();
  }
  return null;
}

export function inferCompensationType(
  min: number | null | undefined,
  max: number | null | undefined,
  jobType: string | null,
  payTypeHint?: string | null
): CompensationType {
  if (payTypeHint) {
    if (/hour|hr|hourly/.test(payTypeHint)) return "hourly";
    if (/salary|annual|year|yr/.test(payTypeHint)) return "salary";
  }

  const values = [min, max].filter((v): v is number => v != null);
  if (values.length === 0) return null;

  const peak = Math.max(...values);
  const job = jobType?.toLowerCase() ?? "";

  if (job.includes("contract") && peak <= 500) return "hourly";
  if (peak > 0 && peak < 500) return "hourly";
  return "salary";
}

function formatHourlyAmount(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `$${display}/hr`;
}

function formatSalaryAmount(n: number): string {
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
}

export function formatCompensationLabel(
  min: number | null | undefined,
  max: number | null | undefined,
  jobType: string | null,
  payTypeHint?: string | null
): string | null {
  if (min == null && max == null) return null;

  const type = inferCompensationType(min, max, jobType, payTypeHint);
  const fmt = type === "hourly" ? formatHourlyAmount : formatSalaryAmount;

  if (min != null && max != null && min !== max) return `${fmt(min)} – ${fmt(max)}`;
  return fmt(min ?? max!);
}

export function formatCompensationFromRaw(
  raw: {
    minimum_compensation?: number | null;
    minimumCompensation?: number | null;
    maximum_compensation?: number | null;
    maximumCompensation?: number | null;
    job_type?: string | null;
    jobType?: string | null;
    compensation_type?: unknown;
    pay_type?: unknown;
    salary_type?: unknown;
  }
): string | null {
  const min = (raw.minimum_compensation ?? raw.minimumCompensation) as number | null | undefined;
  const max = (raw.maximum_compensation ?? raw.maximumCompensation) as number | null | undefined;
  const jobType = ((raw.job_type ?? raw.jobType) as string | null) ?? null;
  return formatCompensationLabel(min, max, jobType, readPayType(raw));
}

export function compensationBand(
  min: number | null | undefined,
  max: number | null | undefined,
  jobType: string | null,
  payTypeHint?: string | null
): CompensationBand | null {
  if (min == null && max == null) return null;

  const type = inferCompensationType(min, max, jobType, payTypeHint);
  if (type === "hourly") return "hourly";

  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  const top = Math.max(lo, hi);

  if (top < 100_000) return "under_100k";
  if (lo >= 200_000) return "200k_plus";
  if (lo >= 150_000 || top >= 180_000) return "150k_200k";
  if (lo >= 100_000 || top >= 120_000) return "100k_150k";
  return "under_100k";
}

export function formatNetworkStatus(status: string | null | undefined): string | null {
  if (!status?.trim()) return null;
  return status
    .trim()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

export function formatSharedRelative(iso: string | null): string {
  if (!iso) return "";
  const days = daysSince(iso);
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

/** Human-readable share date for cards and drawer. */
export function formatNetworkSharedDate(iso: string | null): {
  dateLabel: string;
  relativeLabel: string;
  cardLabel: string;
} {
  if (!iso) {
    return { dateLabel: "Not shared", relativeLabel: "", cardLabel: "Share date unknown" };
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return { dateLabel: "Unknown", relativeLabel: "", cardLabel: "Share date unknown" };
  }

  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const relativeLabel = formatSharedRelative(iso);
  const cardLabel = relativeLabel ? `Shared ${dateLabel} · ${relativeLabel}` : `Shared ${dateLabel}`;

  return { dateLabel, relativeLabel, cardLabel };
}

export function extractIndustries(raw: { industries?: unknown }): string[] {
  if (!Array.isArray(raw.industries)) return [];
  return [...new Set(raw.industries.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean))].sort();
}
