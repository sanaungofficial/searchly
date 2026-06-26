import type { VectorSearchFilters } from "@/lib/vector-matched-job";

export const POSTED_WITHIN_OPTIONS = [
  { days: 7, label: "Last week" },
  { days: 14, label: "Last 2 weeks" },
  { days: 30, label: "Last month" },
  { days: 90, label: "Last 3 months" },
] as const;

const MS_DAY = 1000 * 60 * 60 * 24;

export function datePostedFromForWithinDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.max(1, Math.floor(days)));
  return d.toISOString().slice(0, 10);
}

export function postedWithinDaysLabel(days: number): string {
  const match = POSTED_WITHIN_OPTIONS.find((opt) => opt.days === days);
  if (match) return match.label;
  if (days === 1) return "Last 24 hours";
  if (days < 7) return `Last ${days} days`;
  if (days < 30) return `Last ${Math.round(days / 7)} weeks`;
  return `Last ${Math.round(days / 30)} months`;
}

export function resolveDatePostedFrom(filters: VectorSearchFilters): string | undefined {
  if (filters.datePostedWithinDays != null && filters.datePostedWithinDays > 0) {
    return datePostedFromForWithinDays(filters.datePostedWithinDays);
  }
  const raw = filters.datePostedFrom?.trim();
  return raw || undefined;
}

/** Map legacy ISO date or within-days back to form select value. */
export function postedWithinDaysFormValue(filters: VectorSearchFilters): string {
  if (filters.datePostedWithinDays != null && filters.datePostedWithinDays > 0) {
    return String(filters.datePostedWithinDays);
  }
  const raw = filters.datePostedFrom?.trim();
  if (!raw) return "";
  const from = new Date(raw);
  if (Number.isNaN(from.getTime())) return "";
  const days = Math.max(1, Math.round((Date.now() - from.getTime()) / MS_DAY));
  for (const opt of POSTED_WITHIN_OPTIONS) {
    if (Math.abs(days - opt.days) <= 2) return String(opt.days);
  }
  return "";
}

export function normalizePostedDateFilters(filters: VectorSearchFilters): VectorSearchFilters {
  const datePostedFrom = resolveDatePostedFrom(filters);
  const { datePostedWithinDays: _within, ...rest } = filters;
  return {
    ...rest,
    datePostedFrom,
    datePostedWithinDays: filters.datePostedWithinDays,
  };
}
