import { postedWithinDaysLabel } from "@/lib/job-posted-filter";
import { locationRadiusLabel } from "@/lib/job-location-radius";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { HIREBASE_EXPERIENCE_LEVELS } from "@/lib/vector-matched-job";
import { parseProfileLocationString, resolveProfileLocation, type ParsedProfileLocation } from "@/lib/profile-location";
import {
  hirebaseLevelsFromJobrightLabels,
  type SearchPreferences,
} from "@/lib/search-preferences";

export const HIREBASE_FILTER_COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Germany",
  "France",
  "Australia",
  "India",
  "Singapore",
] as const;

export const HIREBASE_FILTER_US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
] as const;

export function formatProfileLocation(parsed: ParsedProfileLocation): string {
  const parts = [parsed.city, parsed.region, parsed.country].filter(Boolean);
  return parts.join(", ");
}

/** True when profile or filter country is Canada (for location UX ordering). */
export function isCanadianLocationCountry(country: string | null | undefined): boolean {
  const norm = country?.trim().toLowerCase() ?? "";
  return norm === "canada" || norm === "ca";
}

export function locationFieldsFromProfileString(raw: string | null | undefined): {
  city: string;
  region: string;
  country: string;
  display: string;
} {
  const parsed = parseProfileLocationString(raw);
  if (!parsed) {
    return { city: "", region: "", country: "", display: "" };
  }
  return {
    city: parsed.city ?? "",
    region: parsed.region ?? "",
    country: parsed.country ?? "",
    display: formatProfileLocation(parsed),
  };
}

export const YEARS_OF_EXPERIENCE_OPTIONS = [
  { label: "Any experience", yearsFrom: "", yearsTo: "" },
  { label: "0–2 years", yearsFrom: "0", yearsTo: "2" },
  { label: "2–5 years", yearsFrom: "2", yearsTo: "5" },
  { label: "5–10 years", yearsFrom: "5", yearsTo: "10" },
  { label: "10+ years", yearsFrom: "10", yearsTo: "" },
] as const;

export const RECOMMENDED_SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "match", label: "Best match" },
] as const;

export type RecommendedSortOption = (typeof RECOMMENDED_SORT_OPTIONS)[number]["value"];

function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

/** Map an explicit profile/onboarding experience level to Hirebase levels — exact match only. */
export function explicitExperienceLevelsFromProfile(raw: string | null | undefined): string[] | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const match = HIREBASE_EXPERIENCE_LEVELS.find((level) => level.toLowerCase() === trimmed.toLowerCase());
  return match ? [match] : undefined;
}

/** Profile-derived Hirebase filters — UI pre-fill for the filter panel; not auto-applied on the default feed API. */
export function profileDerivedSearchFilters(input: {
  profileLocation?: string | null;
  targetMarket?: string | null;
  workAuthorization?: string | null;
  priorities?: string[];
  targetSalary?: string | null;
  employmentStatus?: string | null;
  jobTimeline?: string | null;
  experienceLevel?: string | null;
  targetRoles?: string[];
  prioritizedRoles?: string[];
  prioritizedCategories?: string[];
  searchPreferences?: SearchPreferences;
}): VectorSearchFilters {
  const resolvedLocation = resolveProfileLocation({
    parsedLocation: input.profileLocation,
    targetMarket: input.targetMarket,
  });
  const fields = locationFieldsFromProfileString(resolvedLocation);

  const roleTitles = uniqueTrimmed([
    ...(input.prioritizedRoles ?? []),
    ...(input.targetRoles ?? []),
  ]);
  const jobCategories = uniqueTrimmed(input.prioritizedCategories ?? []);
  const experienceLevels =
    explicitExperienceLevelsFromProfile(input.experienceLevel) ??
    (input.searchPreferences?.experienceLevelLabels?.length
      ? hirebaseLevelsFromJobrightLabels(input.searchPreferences.experienceLevelLabels)
      : undefined);

  const locations =
    fields.city || fields.region || fields.country
      ? [
          {
            city: fields.city || undefined,
            region: fields.region || undefined,
            country: fields.country || undefined,
          },
        ]
      : undefined;

  return {
    jobTitles: roleTitles.length ? roleTitles : undefined,
    jobCategories: jobCategories.length ? jobCategories : undefined,
    experienceLevels: experienceLevels?.length ? experienceLevels : undefined,
    locations,
  };
}

function labelLocation(loc: NonNullable<VectorSearchFilters["locations"]>[number]): string {
  return [loc.city, loc.region, loc.country].filter(Boolean).join(", ") || "Any";
}

/** Human-readable active filter chips for the UI. */
export function describeActiveFilters(filters: VectorSearchFilters): string[] {
  const labels: string[] = [];
  if (filters.semanticQuery?.trim()) labels.push(`Search: ${filters.semanticQuery.trim()}`);
  if (filters.customJobFunctions?.length) {
    labels.push(`Job function: ${filters.customJobFunctions.join(", ")}`);
  }
  if (filters.jobTitles?.length) labels.push(`Titles: ${filters.jobTitles.join(", ")}`);
  if (filters.keywords?.length) labels.push(`Keywords: ${filters.keywords.join(", ")}`);
  if (filters.companyName?.trim()) labels.push(`Company: ${filters.companyName.trim()}`);
  if (filters.locations?.length) {
    labels.push(`Location: ${filters.locations.map(labelLocation).join(" · ")}`);
  }
  if (filters.locationTypes?.length) labels.push(`Work: ${filters.locationTypes.join(", ")}`);
  if (filters.jobTypes?.length) labels.push(`Type: ${filters.jobTypes.join(", ")}`);
  if (filters.experienceLevels?.length) labels.push(`Level: ${filters.experienceLevels.join(", ")}`);
  if (filters.companySizeBuckets?.length) labels.push(`Company size: ${filters.companySizeBuckets.join(", ")}`);
  if (filters.industries?.length) labels.push(`Industry: ${filters.industries.join(", ")}`);
  if (filters.visaSponsored) labels.push("Visa sponsorship");
  if (filters.salaryFrom != null) labels.push(`Salary from $${filters.salaryFrom.toLocaleString()}`);
  if (filters.datePostedWithinDays != null && filters.datePostedWithinDays > 0) {
    labels.push(`Posted ${postedWithinDaysLabel(filters.datePostedWithinDays).toLowerCase()}`);
  } else if (filters.datePostedFrom?.trim()) {
    labels.push(`Posted since ${filters.datePostedFrom.trim()}`);
  }
  if (filters.locationRadiusMiles != null && filters.locationRadiusMiles > 0) {
    labels.push(locationRadiusLabel(filters.locationRadiusMiles));
  }
  if (filters.jobCategories?.length) labels.push(`Categories: ${filters.jobCategories.join(", ")}`);
  if (filters.yearsFrom != null || filters.yearsTo != null) {
    const from = filters.yearsFrom ?? 0;
    const to = filters.yearsTo != null ? `${filters.yearsTo}` : "+";
    labels.push(`Experience: ${from}–${to} years`);
  }
  return labels;
}

export function yearsExperienceLabel(yearsFrom: string, yearsTo: string): string {
  const opt = YEARS_OF_EXPERIENCE_OPTIONS.find(
    (o) => o.yearsFrom === yearsFrom && o.yearsTo === yearsTo,
  );
  if (opt) return opt.label;
  if (yearsFrom && yearsTo) return `${yearsFrom}–${yearsTo} years`;
  if (yearsFrom) return `${yearsFrom}+ years`;
  return "Years of experience";
}

/** Compact pill label for a list of values — "First item +N". */
export function multiValuePillLabel(items: string[], fallback: string): string {
  const trimmed = items.map((i) => i.trim()).filter(Boolean);
  if (!trimmed.length) return fallback;
  if (trimmed.length === 1) return trimmed[0]!;
  return `${trimmed[0]} +${trimmed.length - 1}`;
}

export function isEmptySearchFilters(filters: VectorSearchFilters): boolean {
  return describeActiveFilters(filters).length === 0;
}
