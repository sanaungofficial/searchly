import type { CachedJob } from "@/lib/cached-job";
import { resolveDatePostedFrom } from "@/lib/job-posted-filter";
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
  const locationType = (cached.locationType ?? "").toLowerCase();
  return locationTypes.some((type) => {
    const t = type.toLowerCase();
    if (t.includes("remote")) {
      return cached.remote === true || locationType.includes("remote") || loc.includes("remote");
    }
    if (t.includes("hybrid")) {
      return locationType.includes("hybrid") || loc.includes("hybrid");
    }
    if (t.includes("in-person") || t.includes("onsite")) {
      return (
        cached.remote === false ||
        locationType.includes("in-person") ||
        locationType.includes("on-site") ||
        locationType.includes("onsite") ||
        loc.includes("in-person") ||
        loc.includes("on-site") ||
        loc.includes("onsite")
      );
    }
    return locationType.includes(t) || loc.includes(t);
  });
}

function matchesCountryInLocationHaystack(jobHay: string, country: string): boolean {
  const norm = country.trim().toLowerCase();
  if (
    norm === "us" ||
    norm === "usa" ||
    norm === "u.s." ||
    norm === "u.s.a." ||
    norm === "united states" ||
    norm === "united states of america"
  ) {
    return (
      jobHay.includes("united states") ||
      jobHay.includes(" usa") ||
      jobHay.includes(", us") ||
      jobHay.endsWith(" us") ||
      /\b(us|usa|u\.s\.)\b/.test(jobHay)
    );
  }
  return jobHay.includes(norm);
}

function matchesLocations(cached: CachedJob, filters: VectorSearchFilters["locations"]): boolean {
  if (!filters?.length) return true;
  const loc = (cached.location ?? "").toLowerCase();
  return filters.some((entry) => {
    const city = entry.city?.trim().toLowerCase();
    const region = entry.region?.trim().toLowerCase();
    const country = entry.country?.trim();
    const countryOnly = Boolean(country) && !city && !region;

    if (countryOnly && country) {
      return matchesCountryInLocationHaystack(loc, country);
    }

    const parts = [entry.city, entry.region, entry.country].filter(Boolean).map((p) => p!.toLowerCase());
    return parts.some((p) => loc.includes(p));
  });
}

function inferHirebaseExperienceLevels(cached: CachedJob): Set<string> {
  const text = `${cached.seniority ?? ""} ${cached.experienceLevel ?? ""} ${cached.title ?? ""}`.toLowerCase();
  const levels = new Set<string>();
  if (/\b(intern|new grad|graduate|co-op|coop)\b/.test(text)) {
    levels.add("Entry");
    levels.add("Junior");
  }
  if (/\b(entry|associate|junior|jr\.?)\b/.test(text)) {
    levels.add("Entry");
    levels.add("Junior");
  }
  if (/\bmid[- ]?level\b|\bmid\b/.test(text)) levels.add("Mid");
  if (/\b(senior|sr\.?)\b/.test(text) && !/\b(junior|associate|jr\.?)\b/.test(text)) levels.add("Senior");
  if (/\b(lead|staff|principal)\b/.test(text)) levels.add("Senior");
  if (/\b(director|executive|vp|vice president|c-level|chief)\b/.test(text)) levels.add("Executive");

  for (const token of ["entry", "junior", "mid", "senior", "executive"]) {
    if (text.includes(token)) levels.add(token.charAt(0).toUpperCase() + token.slice(1));
  }
  return levels;
}

function matchesExperienceLevels(cached: CachedJob, experienceLevels: string[]): boolean {
  const allowed = new Set(experienceLevels.map((e) => e.trim().toLowerCase()).filter(Boolean));
  if (!allowed.size) return true;

  const inferred = inferHirebaseExperienceLevels(cached);
  for (const level of inferred) {
    if (allowed.has(level.toLowerCase())) return true;
  }

  const hay = `${cached.seniority ?? ""} ${cached.experienceLevel ?? ""}`.toLowerCase();
  return experienceLevels.some((e) => hay.includes(e.toLowerCase()));
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
  raw?: import("@/lib/hirebase").HirebaseJob,
): boolean {
  if (filters.companyName?.trim()) {
    const q = filters.companyName.trim().toLowerCase();
    if (!companyName.toLowerCase().includes(q)) return false;
  }

  const hay = haystackForJob(cached, companyName);

  if (filters.jobTitles?.length && !matchesList(filters.jobTitles, hay)) return false;
  if (filters.keywords?.length && !matchesList(filters.keywords, hay)) return false;

  if (filters.semanticQuery?.trim()) {
    const terms = filters.semanticQuery
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    if (terms.length && !terms.every((term) => hay.includes(term))) return false;
  }

  if (!matchesLocations(cached, filters.locations)) return false;
  if (filters.locationTypes?.length && !matchesLocationTypes(cached, filters.locationTypes)) return false;

  if (filters.jobTypes?.length) {
    const jt = (cached.jobType ?? "").toLowerCase();
    if (!filters.jobTypes.some((t) => jt.includes(t.toLowerCase()))) return false;
  }

  if (filters.experienceLevels?.length) {
    if (!matchesExperienceLevels(cached, filters.experienceLevels)) return false;
  }

  if (filters.visaSponsored === true && cached.visaSponsored !== true) return false;

  if (filters.datePostedFrom?.trim() || filters.datePostedWithinDays) {
    const fromIso = resolveDatePostedFrom(filters);
    if (fromIso && cached.datePosted) {
      const posted = new Date(cached.datePosted);
      const from = new Date(fromIso);
      if (!Number.isNaN(posted.getTime()) && !Number.isNaN(from.getTime()) && posted < from) return false;
    }
  }

  if (filters.jobBoard?.trim()) {
    const board = (cached.jobBoard ?? "").toLowerCase();
    if (!board.includes(filters.jobBoard.trim().toLowerCase())) return false;
  }

  if (filters.industries?.length) {
    const industryHay = [
      ...(cached.industries ?? []),
      ...(cached.subindustries ?? []),
      ...(cached.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();
    if (!matchesList(filters.industries, industryHay || hay)) return false;
  }

  if (filters.subindustries?.length) {
    const subHay = [...(cached.subindustries ?? []), ...(cached.industries ?? [])].join(" ").toLowerCase();
    if (!matchesList(filters.subindustries, subHay || hay)) return false;
  }

  if (filters.jobCategories?.length) {
    const cat = `${cached.department ?? ""} ${(cached.tags ?? []).join(" ")}`.toLowerCase();
    if (!matchesList(filters.jobCategories, cat)) return false;
  }

  if (filters.companyTypes?.length && raw?.company_data?.type) {
    const ctype = raw.company_data.type.toLowerCase();
    if (!filters.companyTypes.some((t) => ctype.includes(t.toLowerCase()))) return false;
  }

  return true;
}

export function applyListingFiltersToSources<
  T extends { cached: CachedJob; companyName: string; raw?: import("@/lib/hirebase").HirebaseJob },
>(sources: T[], filters: VectorSearchFilters | undefined): T[] {
  if (!filters) return sources;
  const hasFilter =
    filters.companyName ||
    filters.semanticQuery?.trim() ||
    filters.jobTitles?.length ||
    filters.keywords?.length ||
    filters.locations?.length ||
    filters.locationTypes?.length ||
    filters.jobTypes?.length ||
    filters.experienceLevels?.length ||
    filters.companyTypes?.length ||
    filters.visaSponsored ||
    filters.datePostedFrom ||
    filters.datePostedWithinDays ||
    filters.jobBoard ||
    filters.industries?.length ||
    filters.jobCategories?.length;

  if (!hasFilter) return sources;

  return sources.filter((s) => jobMatchesListingFilters(s.cached, s.companyName, filters, s.raw));
}
