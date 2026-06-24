import type { CachedJob } from "@/lib/cached-job";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";

function haystackForJob(cached: CachedJob, companyName: string): string {
  return [
    cached.title,
    companyName,
    cached.location,
    cached.department,
    cached.jobSummary,
    cached.description,
    cached.jobType,
    cached.seniority,
    cached.experienceLevel,
    ...(cached.skills ?? []),
    ...(cached.tags ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesLocationTypes(cached: CachedJob, locationTypes: string[]): boolean {
  const loc = (cached.location ?? "").toLowerCase();
  return locationTypes.some((type) => {
    const t = type.toLowerCase();
    if (t.includes("remote")) return cached.remote === true || loc.includes("remote");
    if (t.includes("hybrid")) return loc.includes("hybrid");
    if (t.includes("in-person") || t.includes("onsite")) {
      return cached.remote === false || loc.includes("in-person") || loc.includes("on-site") || loc.includes("onsite");
    }
    return loc.includes(t);
  });
}

function matchesLocations(cached: CachedJob, filters: VectorSearchFilters["locations"]): boolean {
  if (!filters?.length) return true;
  const loc = (cached.location ?? "").toLowerCase();
  return filters.some((entry) => {
    const parts = [entry.city, entry.region, entry.country].filter(Boolean).map((p) => p!.toLowerCase());
    return parts.some((p) => loc.includes(p));
  });
}

function matchesList(values: string[] | undefined, haystack: string): boolean {
  if (!values?.length) return true;
  const normalized = values.map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (!normalized.length) return true;
  return normalized.some((v) => haystack.includes(v));
}

/** Client-side filter pass for cached company jobs (and post-filter after Hirebase fetch). */
export function jobMatchesListingFilters(
  cached: CachedJob,
  companyName: string,
  filters: VectorSearchFilters,
): boolean {
  if (filters.companyName?.trim()) {
    const q = filters.companyName.trim().toLowerCase();
    if (!companyName.toLowerCase().includes(q)) return false;
  }

  const hay = haystackForJob(cached, companyName);

  if (filters.jobTitles?.length && !matchesList(filters.jobTitles, hay)) return false;
  if (filters.keywords?.length && !matchesList(filters.keywords, hay)) return false;

  if (!matchesLocations(cached, filters.locations)) return false;
  if (filters.locationTypes?.length && !matchesLocationTypes(cached, filters.locationTypes)) return false;

  if (filters.jobTypes?.length) {
    const jt = (cached.jobType ?? "").toLowerCase();
    if (!filters.jobTypes.some((t) => jt.includes(t.toLowerCase()))) return false;
  }

  if (filters.experienceLevels?.length) {
    const level = `${cached.seniority ?? ""} ${cached.experienceLevel ?? ""}`.toLowerCase();
    if (!filters.experienceLevels.some((e) => level.includes(e.toLowerCase()))) return false;
  }

  if (filters.visaSponsored === true && cached.visaSponsored !== true) return false;

  if (filters.datePostedFrom?.trim() && cached.datePosted) {
    const posted = new Date(cached.datePosted);
    const from = new Date(filters.datePostedFrom);
    if (!Number.isNaN(posted.getTime()) && !Number.isNaN(from.getTime()) && posted < from) return false;
  }

  if (filters.jobBoard?.trim()) {
    const board = (cached.jobBoard ?? "").toLowerCase();
    if (!board.includes(filters.jobBoard.trim().toLowerCase())) return false;
  }

  if (filters.industries?.length && cached.tags?.length) {
    const tags = cached.tags.join(" ").toLowerCase();
    if (!matchesList(filters.industries, tags)) return false;
  }

  if (filters.jobCategories?.length) {
    const cat = `${cached.department ?? ""} ${(cached.tags ?? []).join(" ")}`.toLowerCase();
    if (!matchesList(filters.jobCategories, cat)) return false;
  }

  return true;
}

export function applyListingFiltersToSources<T extends { cached: CachedJob; companyName: string }>(
  sources: T[],
  filters: VectorSearchFilters | undefined,
): T[] {
  if (!filters) return sources;
  const hasFilter =
    filters.companyName ||
    filters.jobTitles?.length ||
    filters.keywords?.length ||
    filters.locations?.length ||
    filters.locationTypes?.length ||
    filters.jobTypes?.length ||
    filters.experienceLevels?.length ||
    filters.visaSponsored ||
    filters.datePostedFrom ||
    filters.jobBoard ||
    filters.industries?.length ||
    filters.jobCategories?.length;

  if (!hasFilter) return sources;

  return sources.filter((s) => jobMatchesListingFilters(s.cached, s.companyName, filters));
}
