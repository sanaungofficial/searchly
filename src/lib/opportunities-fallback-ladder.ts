import type { VectorSearchFilters } from "@/lib/vector-matched-job";

export type FallbackRelaxStep =
  | "location_radius"
  | "location_types"
  | "locations"
  | "date_posted"
  | "salary"
  | "experience_levels"
  | "years_of_experience"
  | "industries"
  | "subindustries"
  | "job_categories"
  | "company_types"
  | "job_types"
  | "visa";

/** Ordered relaxation — one dimension at a time until min results or exhausted. */
export const RECOMMENDED_FALLBACK_LADDER: FallbackRelaxStep[] = [
  "location_radius",
  "location_types",
  "locations",
  "date_posted",
  "salary",
  "years_of_experience",
  "experience_levels",
  "industries",
  "subindustries",
  "job_categories",
  "company_types",
  "job_types",
  "visa",
];

export function relaxFiltersOneStep(
  filters: VectorSearchFilters,
  step: FallbackRelaxStep,
): VectorSearchFilters {
  const out = { ...filters };
  switch (step) {
    case "location_radius":
      delete out.locationRadiusMiles;
      break;
    case "location_types":
      delete out.locationTypes;
      break;
    case "locations":
      delete out.locations;
      break;
    case "date_posted":
      delete out.datePostedFrom;
      delete out.datePostedWithinDays;
      break;
    case "salary":
      delete out.salaryFrom;
      delete out.salaryTo;
      break;
    case "years_of_experience":
      delete out.yearsFrom;
      delete out.yearsTo;
      break;
    case "experience_levels":
      delete out.experienceLevels;
      break;
    case "industries":
      delete out.industries;
      break;
    case "subindustries":
      delete out.subindustries;
      break;
    case "job_categories":
      delete out.jobCategories;
      break;
    case "company_types":
      delete out.companyTypes;
      delete out.companySizeBuckets;
      break;
    case "job_types":
      delete out.jobTypes;
      break;
    case "visa":
      delete out.visaSponsored;
      break;
  }
  return out;
}

export function nextRelaxedFilters(
  filters: VectorSearchFilters,
  completedSteps: FallbackRelaxStep[],
): { filters: VectorSearchFilters; step: FallbackRelaxStep } | null {
  for (const step of RECOMMENDED_FALLBACK_LADDER) {
    if (completedSteps.includes(step)) continue;
    const relaxed = relaxFiltersOneStep(filters, step);
    if (JSON.stringify(relaxed) !== JSON.stringify(filters)) {
      return { filters: relaxed, step };
    }
  }
  return null;
}
