import type { VectorSearchFilters } from "@/lib/vector-matched-job";

function parseSalaryNumber(raw: string | null | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const digits = raw.replace(/[^0-9.]/g, "");
  if (!digits) return undefined;
  const n = Number.parseFloat(digits);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 1000) return Math.round(n * 1000);
  return Math.round(n);
}

function mergeUnique<T>(a: T[] | undefined, b: T[]): T[] {
  const set = new Set(a ?? []);
  for (const item of b) set.add(item);
  return [...set];
}

/** Map profile preferences into Hirebase / listing filters (merged with user filters). */
export function profilePreferencesToFilters(profile: {
  priorities?: string[];
  targetSalary?: string | null;
  employmentStatus?: string | null;
  jobTimeline?: string | null;
  workAuthorization?: string | null;
  profileLocation?: string | null;
}): VectorSearchFilters {
  const out: VectorSearchFilters = {};
  const priorities = (profile.priorities ?? []).map((p) => p.toLowerCase());
  void profile.profileLocation; // location handled via post-filter + UI search filters

  const locationTypes: string[] = [];
  if (priorities.some((p) => p.includes("remote"))) locationTypes.push("Remote");
  if (priorities.some((p) => p.includes("hybrid"))) locationTypes.push("Hybrid");
  if (priorities.some((p) => p.includes("in-person") || p.includes("on-site") || p.includes("onsite"))) {
    locationTypes.push("In-Person");
  }
  if (locationTypes.length) out.locationTypes = locationTypes;

  const workAuth = (profile.workAuthorization ?? "").toLowerCase();
  if (
    priorities.some((p) => p.includes("visa") || p.includes("sponsorship")) ||
    workAuth.includes("visa") ||
    workAuth.includes("sponsorship")
  ) {
    out.visaSponsored = true;
  }

  const salaryFrom = parseSalaryNumber(profile.targetSalary);
  if (salaryFrom) out.salaryFrom = salaryFrom;

  const timeline = (profile.jobTimeline ?? "").toLowerCase();
  if (timeline.includes("asap") || timeline.includes("immediately") || timeline.includes("now")) {
    out.datePostedWithinDays = 14;
  } else if (timeline === "3-6mo" || timeline.includes("3-6")) {
    out.datePostedWithinDays = 90;
  } else if (timeline.includes("month")) {
    out.datePostedWithinDays = 30;
  }

  const employment = (profile.employmentStatus ?? "").toLowerCase();
  if (employment.includes("contract") || employment.includes("freelance")) {
    out.jobTypes = ["Contract"];
  } else if (employment.includes("part")) {
    out.jobTypes = ["Part Time"];
  }

  return out;
}

/** User POST filters win; profile prefs fill gaps only. */
export function mergeProfileAndRequestFilters(
  profilePrefs: VectorSearchFilters,
  requestFilters: VectorSearchFilters,
): VectorSearchFilters {
  return {
    ...profilePrefs,
    ...requestFilters,
    locationTypes: requestFilters.locationTypes?.length
      ? requestFilters.locationTypes
      : profilePrefs.locationTypes,
    jobTypes: requestFilters.jobTypes?.length ? requestFilters.jobTypes : profilePrefs.jobTypes,
    visaSponsored: requestFilters.visaSponsored === true ? true : profilePrefs.visaSponsored,
    salaryFrom: requestFilters.salaryFrom ?? profilePrefs.salaryFrom,
    salaryTo: requestFilters.salaryTo ?? profilePrefs.salaryTo,
    datePostedFrom: requestFilters.datePostedFrom ?? profilePrefs.datePostedFrom,
    datePostedWithinDays: requestFilters.datePostedWithinDays ?? profilePrefs.datePostedWithinDays,
    locationRadiusMiles: requestFilters.locationRadiusMiles ?? profilePrefs.locationRadiusMiles,
    locations: requestFilters.locations?.length ? requestFilters.locations : profilePrefs.locations,
    jobTitles: requestFilters.jobTitles?.length
      ? requestFilters.jobTitles
      : profilePrefs.jobTitles,
    keywords: mergeUnique(profilePrefs.keywords, requestFilters.keywords ?? []),
  };
}

/** Filters that often zero out Hirebase results when combined with role/resume search. */
export function relaxRestrictiveFilters(filters: VectorSearchFilters): VectorSearchFilters {
  const {
    salaryFrom: _sf,
    salaryTo: _st,
    datePostedFrom: _dp,
    datePostedWithinDays: _dwd,
    locations: _loc,
    locationTypes: _lt,
    locationRadiusMiles: _lr,
    ...rest
  } = filters;
  return rest;
}

export function hasRestrictiveListingFilters(filters: VectorSearchFilters): boolean {
  return (
    filters.salaryFrom != null ||
    filters.salaryTo != null ||
    Boolean(filters.datePostedFrom?.trim()) ||
    (filters.datePostedWithinDays != null && filters.datePostedWithinDays > 0) ||
    Boolean(filters.locations?.length) ||
    Boolean(filters.locationTypes?.length) ||
    (filters.locationRadiusMiles != null && filters.locationRadiusMiles > 0)
  );
}

/** True when the client is asking for the default daily feed (no custom filters). */
export function isDefaultRecommendedFilters(filters: VectorSearchFilters): boolean {
  const keys: (keyof VectorSearchFilters)[] = [
    "semanticQuery",
    "companyName",
    "companySlug",
    "jobTitles",
    "keywords",
    "industries",
    "subindustries",
    "jobCategories",
    "jobTypes",
    "experienceLevels",
    "companySizeBuckets",
    "locationTypes",
    "locations",
    "datePostedFrom",
    "datePostedWithinDays",
    "locationRadiusMiles",
    "visaSponsored",
    "salaryFrom",
    "salaryTo",
    "yearsFrom",
    "yearsTo",
    "jobSlug",
    "jobBoard",
    "minScore",
    "offset",
  ];

  for (const key of keys) {
    const val = filters[key];
    if (val == null) continue;
    if (Array.isArray(val) && val.length === 0) continue;
    if (typeof val === "string" && !val.trim()) continue;
    if (typeof val === "boolean" && !val) continue;
    return false;
  }

  const page = filters.page ?? 1;
  if (page > 1) return false;

  return true;
}
