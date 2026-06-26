import { postedWithinDaysLabel } from "@/lib/job-posted-filter";
import { locationRadiusLabel } from "@/lib/job-location-radius";
import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { parseProfileLocationString, type ParsedProfileLocation } from "@/lib/profile-location";
import { profilePreferencesToFilters } from "@/lib/profile-preference-filters";

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

/** Profile-derived Hirebase filters for UI pre-fill (search filters panel — not auto-applied on API). */
export function profileDerivedSearchFilters(input: {
  profileLocation?: string | null;
  priorities?: string[];
  targetSalary?: string | null;
  employmentStatus?: string | null;
  jobTimeline?: string | null;
}): VectorSearchFilters {
  const fields = locationFieldsFromProfileString(input.profileLocation);
  const prefs = profilePreferencesToFilters({
    priorities: input.priorities ?? [],
    targetSalary: input.targetSalary,
    employmentStatus: input.employmentStatus,
    jobTimeline: input.jobTimeline,
    profileLocation: null, // location applied via structured fields below, not API auto-inject
  });

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

  const locationRadiusMiles = fields.city ? 50 : undefined;

  return {
    ...prefs,
    locations,
    locationRadiusMiles,
  };
}

function labelLocation(loc: NonNullable<VectorSearchFilters["locations"]>[number]): string {
  return [loc.city, loc.region, loc.country].filter(Boolean).join(", ") || "Any";
}

/** Human-readable active filter chips for the UI. */
export function describeActiveFilters(filters: VectorSearchFilters): string[] {
  const labels: string[] = [];
  if (filters.semanticQuery?.trim()) labels.push(`Search: ${filters.semanticQuery.trim()}`);
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
  return labels;
}

export function isEmptySearchFilters(filters: VectorSearchFilters): boolean {
  return describeActiveFilters(filters).length === 0;
}
