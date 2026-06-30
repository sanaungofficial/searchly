import type { ListingExclusionPrefs } from "@/lib/opportunities-exclusion-filters";
import { parseProfileLocationString, resolveProfileLocation } from "@/lib/profile-location";
import { profilePreferencesToFilters } from "@/lib/profile-preference-filters";
import {
  defaultLocationAllInCountry,
  explicitExperienceLevelsFromProfile,
} from "@/lib/recommended-filter-utils";
import {
  hirebaseLevelsFromJobrightLabels,
  hirebaseCompanyTypesFromStages,
  type SearchPreferences,
} from "@/lib/search-preferences";
import { HIREBASE_JOB_TYPES, type VectorSearchFilters } from "@/lib/vector-matched-job";

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

export type ProfileSearchContext = {
  profileLocation?: string | null;
  targetMarket?: string | null;
  priorities?: string[];
  experienceLevel?: string | null;
  targetRoles?: string[];
  prioritizedCategories?: string[];
  searchPreferences?: SearchPreferences;
};

/** Map onboarding / profile priorities → Hirebase location_types. */
export function locationTypesFromPriorities(priorities: string[]): string[] {
  const lower = (priorities ?? []).map((p) => p.toLowerCase());
  const locationTypes: string[] = [];
  if (lower.some((p) => p.includes("remote"))) locationTypes.push("Remote");
  if (lower.some((p) => p.includes("hybrid"))) locationTypes.push("Hybrid");
  if (lower.some((p) => p.includes("in-person") || p.includes("on-site") || p.includes("onsite"))) {
    locationTypes.push("In-Person");
  }
  if (!locationTypes.length) return ["Remote", "Hybrid", "In-Person"];
  return locationTypes;
}

/** Default all four Hirebase job types when profile does not narrow employment. */
export function defaultJobTypesFromProfile(): string[] {
  return [...HIREBASE_JOB_TYPES];
}

export function exclusionPrefsFromSearchPreferences(
  prefs: SearchPreferences | undefined,
): ListingExclusionPrefs {
  const p = prefs ?? {};
  return {
    excludedJobTitles: p.excludedJobTitles,
    excludedIndustries: p.excludedIndustries,
    excludedSkills: p.excludedSkills,
    excludedCompanies: p.excludedCompanies,
    excludeSecurityClearance: p.excludeSecurityClearance,
    excludeUsCitizenOnly: p.excludeUsCitizenOnly,
    excludeStaffingAgency: p.excludeStaffingAgency,
  };
}

/**
 * Canonical profile-driven Hirebase filters — used for the recommended feed and as
 * the default pre-fill for the filter bar.
 */
export function profileSearchConstraints(input: ProfileSearchContext): VectorSearchFilters {
  const searchPreferences = input.searchPreferences ?? {};
  const resolvedLocation = resolveProfileLocation({
    parsedLocation: input.profileLocation,
    targetMarket: input.targetMarket,
  });
  const parsed = parseProfileLocationString(resolvedLocation);
  const country = parsed?.country?.trim();

  const jobCategories = uniqueTrimmed(input.prioritizedCategories ?? []);
  const experienceLevels =
    explicitExperienceLevelsFromProfile(input.experienceLevel) ??
    (searchPreferences.experienceLevelLabels?.length
      ? hirebaseLevelsFromJobrightLabels(searchPreferences.experienceLevelLabels)
      : undefined);

  const profilePrefs = profilePreferencesToFilters({
    priorities: input.priorities,
    profileLocation: resolvedLocation,
    workAuthorization: undefined,
    targetSalary: undefined,
    employmentStatus: undefined,
    jobTimeline: undefined,
  });

  const locations = country
    ? [{ country, city: undefined, region: undefined }]
    : undefined;

  const companyTypes = searchPreferences.companyStages?.length
    ? hirebaseCompanyTypesFromStages(searchPreferences.companyStages)
    : undefined;

  return {
    jobCategories: jobCategories.length ? jobCategories : undefined,
    customJobFunctions: searchPreferences.customJobFunctions?.length
      ? searchPreferences.customJobFunctions
      : undefined,
    experienceLevels: searchPreferences.openToAllExperience ? undefined : experienceLevels,
    locations,
    locationTypes: profilePrefs.locationTypes ?? locationTypesFromPriorities(input.priorities ?? []),
    jobTypes: defaultJobTypesFromProfile(),
    visaSponsored: profilePrefs.visaSponsored,
    salaryFrom: searchPreferences.openToAllSalary ? undefined : profilePrefs.salaryFrom,
    datePostedWithinDays: profilePrefs.datePostedWithinDays,
    industries: searchPreferences.industries,
    companyTypes,
  };
}

export type MandatorySearchValidation = {
  valid: boolean;
  missing: string[];
};

/** Mandatory fields before the Search button is enabled / API accepts a user search. */
export function validateMandatorySearchFilters(
  _filters: VectorSearchFilters,
  _options?: { openToAllExperience?: boolean },
): MandatorySearchValidation {
  // Temporarily disabled — allow search/refresh with partial profile filters.
  return { valid: true, missing: [] };
}

/** Merge user-applied filter overrides onto profile defaults (user wins on set fields). */
export function mergeUserSearchOverrides(
  profileDefaults: VectorSearchFilters,
  userFilters: VectorSearchFilters,
): VectorSearchFilters {
  return {
    ...profileDefaults,
    ...userFilters,
    jobCategories: userFilters.jobCategories?.length
      ? userFilters.jobCategories
      : profileDefaults.jobCategories,
    customJobFunctions: userFilters.customJobFunctions?.length
      ? userFilters.customJobFunctions
      : profileDefaults.customJobFunctions,
    jobTypes: userFilters.jobTypes?.length ? userFilters.jobTypes : profileDefaults.jobTypes,
    locationTypes: userFilters.locationTypes?.length
      ? userFilters.locationTypes
      : profileDefaults.locationTypes,
    experienceLevels: userFilters.experienceLevels?.length
      ? userFilters.experienceLevels
      : profileDefaults.experienceLevels,
    locations: userFilters.locations?.length ? userFilters.locations : profileDefaults.locations,
    semanticQuery: userFilters.semanticQuery?.trim() || profileDefaults.semanticQuery,
  };
}

export function profileLocationAllInCountry(
  searchPreferences: SearchPreferences | undefined,
  country: string | undefined,
): boolean {
  return defaultLocationAllInCountry(searchPreferences, country);
}
