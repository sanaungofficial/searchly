import type { VectorSearchFilters } from "@/lib/vector-matched-job";
import { COMPANY_STAGE_TO_HIREBASE_TYPE } from "@/lib/opportunities-filter-mapping";

/** Extended job-search prefs stored in Profile.parsedData.searchPreferences (no schema change). */
export type SearchPreferences = {
  /** Flat industry + subindustry labels from onboarding / All Filters. */
  industries?: string[];
  excludedJobTitles?: string[];
  excludedIndustries?: string[];
  excludedSkills?: string[];
  excludedCompanies?: string[];
  roleTypes?: ("IC" | "Manager")[];
  companyStages?: ("Early" | "Growth" | "Late" | "Public")[];
  excludeSecurityClearance?: boolean;
  excludeUsCitizenOnly?: boolean;
  excludeStaffingAgency?: boolean;
  openToAllSalary?: boolean;
  openToAllExperience?: boolean;
  /** JobRight-style experience level labels the user confirmed. */
  experienceLevelLabels?: string[];
  /** User-created job functions not in Hirebase taxonomy — merged into vsearch semantic query. */
  customJobFunctions?: string[];
  /** When true, location filter is country-wide (no city/region). */
  locationAllInCountry?: boolean;
  opportunitiesPrefConfirmedAt?: string | null;
};

export const JOBRIGHT_EXPERIENCE_LEVELS = [
  { id: "intern", label: "Intern / New Grad", hirebase: ["Entry", "Junior"] as const },
  { id: "entry", label: "Entry Level", hirebase: ["Entry"] as const },
  { id: "mid", label: "Mid Level", hirebase: ["Mid"] as const },
  { id: "senior", label: "Senior Level", hirebase: ["Senior"] as const },
  { id: "lead", label: "Lead / Staff", hirebase: ["Senior"] as const },
  { id: "director", label: "Director / Executive", hirebase: ["Executive"] as const },
] as const;

export const COMPANY_STAGE_OPTIONS = ["Early", "Growth", "Late", "Public"] as const;

export function parseSearchPreferences(raw: unknown): SearchPreferences {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const strList = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const items = v.map((x) => String(x).trim()).filter(Boolean);
    return items.length ? items : undefined;
  };
  return {
    industries: strList(o.industries),
    excludedJobTitles: strList(o.excludedJobTitles),
    excludedIndustries: strList(o.excludedIndustries),
    excludedSkills: strList(o.excludedSkills),
    excludedCompanies: strList(o.excludedCompanies),
    roleTypes: strList(o.roleTypes)?.filter((r): r is "IC" | "Manager" => r === "IC" || r === "Manager"),
    companyStages: strList(o.companyStages)?.filter(
      (s): s is "Early" | "Growth" | "Late" | "Public" =>
        (COMPANY_STAGE_OPTIONS as readonly string[]).includes(s),
    ),
    excludeSecurityClearance: o.excludeSecurityClearance === true,
    excludeUsCitizenOnly: o.excludeUsCitizenOnly === true,
    excludeStaffingAgency: o.excludeStaffingAgency === true,
    openToAllSalary: o.openToAllSalary === true,
    openToAllExperience: o.openToAllExperience === true,
    experienceLevelLabels: strList(o.experienceLevelLabels),
    customJobFunctions: strList(o.customJobFunctions),
    locationAllInCountry: o.locationAllInCountry === true,
    opportunitiesPrefConfirmedAt:
      typeof o.opportunitiesPrefConfirmedAt === "string" ? o.opportunitiesPrefConfirmedAt : null,
  };
}

export function hirebaseLevelsFromJobrightLabels(labels: string[]): string[] {
  const out = new Set<string>();
  for (const label of labels) {
    const match = JOBRIGHT_EXPERIENCE_LEVELS.find(
      (l) => l.label.toLowerCase() === label.trim().toLowerCase() || l.id === label.trim().toLowerCase(),
    );
    if (match) {
      for (const hb of match.hirebase) out.add(hb);
    }
  }
  return [...out];
}

export function hirebaseCompanyTypesFromStages(stages: string[]): string[] {
  const out = new Set<string>();
  for (const stage of stages) {
    const mapped = COMPANY_STAGE_TO_HIREBASE_TYPE[stage.trim()];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

export function mergeSearchPreferencesIntoFilters(
  prefs: SearchPreferences,
  filters: VectorSearchFilters,
): VectorSearchFilters {
  const out = { ...filters };

  if (prefs.excludedJobTitles?.length) {
    const existing = out.keywords ?? [];
    out.keywords = [...existing, ...prefs.excludedJobTitles.map((t) => `-${t}`)];
  }

  if (prefs.companyStages?.length && !out.companyTypes?.length) {
    const types = hirebaseCompanyTypesFromStages(prefs.companyStages);
    if (types.length) out.companyTypes = types;
  }

  if (prefs.experienceLevelLabels?.length && !out.experienceLevels?.length) {
    const levels = hirebaseLevelsFromJobrightLabels(prefs.experienceLevelLabels);
    if (levels.length) out.experienceLevels = levels;
  }

  if (prefs.openToAllSalary) {
    delete out.salaryFrom;
    delete out.salaryTo;
  }

  if (prefs.openToAllExperience) {
    delete out.yearsFrom;
    delete out.yearsTo;
    delete out.experienceLevels;
  }

  return out;
}

export function searchPreferencesFromParsedData(parsedData: unknown): SearchPreferences {
  if (!parsedData || typeof parsedData !== "object") return {};
  const sp = (parsedData as { searchPreferences?: unknown }).searchPreferences;
  return parseSearchPreferences(sp);
}

export function patchParsedDataSearchPreferences(
  parsedData: Record<string, unknown> | null | undefined,
  patch: Partial<SearchPreferences>,
): Record<string, unknown> {
  const base =
    parsedData && typeof parsedData === "object" ? { ...parsedData } : ({} as Record<string, unknown>);
  const current = parseSearchPreferences(base.searchPreferences);
  base.searchPreferences = { ...current, ...patch };
  return base;
}

function joinList(items: string[] | undefined): string {
  return (items ?? []).join(", ");
}

function splitList(value: string): string[] {
  return value.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
}

/** Map stored searchPreferences onto the filter form (extended fields). */
export function applySearchPreferencesToFilterForm<
  T extends {
    excludedJobTitles: string;
    excludedIndustries: string;
    excludedSkills: string;
    excludedCompany: string;
    skills: string;
    roleTypes: Set<string>;
    companyStages: Set<string>;
    excludeSecurityClearance: boolean;
    excludeUsCitizenOnly: boolean;
    excludeStaffingAgency: boolean;
    openToAllSalary: boolean;
    openToAllExperience: boolean;
    experienceLevels: Set<string>;
    customJobFunctions?: string[];
    locationAllInCountry?: boolean;
  },
>(form: T, prefs: SearchPreferences): T {
  const next = { ...form };
  if (prefs.industries?.length) next.industries = joinList(prefs.industries);
  if (prefs.excludedJobTitles?.length) next.excludedJobTitles = joinList(prefs.excludedJobTitles);
  if (prefs.excludedIndustries?.length) next.excludedIndustries = joinList(prefs.excludedIndustries);
  if (prefs.excludedSkills?.length) next.excludedSkills = joinList(prefs.excludedSkills);
  if (prefs.excludedCompanies?.length) next.excludedCompany = joinList(prefs.excludedCompanies);
  if (prefs.roleTypes?.length) next.roleTypes = new Set(prefs.roleTypes);
  if (prefs.companyStages?.length) next.companyStages = new Set(prefs.companyStages);
  if (prefs.excludeSecurityClearance) next.excludeSecurityClearance = true;
  if (prefs.excludeUsCitizenOnly) next.excludeUsCitizenOnly = true;
  if (prefs.excludeStaffingAgency) next.excludeStaffingAgency = true;
  if (prefs.openToAllSalary) next.openToAllSalary = true;
  if (prefs.openToAllExperience) next.openToAllExperience = true;
  if (prefs.experienceLevelLabels?.length) {
    const levels = hirebaseLevelsFromJobrightLabels(prefs.experienceLevelLabels);
    if (levels.length) next.experienceLevels = new Set(levels);
  }
  if (prefs.customJobFunctions?.length) next.customJobFunctions = [...prefs.customJobFunctions];
  if (prefs.locationAllInCountry) next.locationAllInCountry = true;
  return next;
}

/** Extract extended prefs from filter form for profile storage. */
export function searchPreferencesFromFilterForm(form: {
  excludedJobTitles: string;
  excludedIndustries: string;
  excludedSkills: string;
  excludedCompany: string;
  skills: string;
  roleTypes: Set<string>;
  companyStages: Set<string>;
  excludeSecurityClearance: boolean;
  excludeUsCitizenOnly: boolean;
  excludeStaffingAgency: boolean;
  openToAllSalary: boolean;
  openToAllExperience: boolean;
  experienceLevels: Set<string>;
  customJobFunctions?: string[];
  locationAllInCountry?: boolean;
}): SearchPreferences {
  const excludedJobTitles = splitList(form.excludedJobTitles);
  const industrySelections = splitList(form.industries);
  const excludedIndustries = splitList(form.excludedIndustries);
  const excludedSkills = splitList(form.excludedSkills);
  const excludedCompanies = splitList(form.excludedCompany);
  const roleTypes = [...form.roleTypes].filter((r): r is "IC" | "Manager" => r === "IC" || r === "Manager");
  const companyStages = [...form.companyStages].filter(
    (s): s is "Early" | "Growth" | "Late" | "Public" =>
      (COMPANY_STAGE_OPTIONS as readonly string[]).includes(s),
  );

  const experienceLevelLabels = JOBRIGHT_EXPERIENCE_LEVELS.filter(({ hirebase }) =>
    hirebase.some((hb) => form.experienceLevels.has(hb)),
  ).map(({ label }) => label);

  return {
    industries: industrySelections.length ? industrySelections : undefined,
    excludedJobTitles: excludedJobTitles.length ? excludedJobTitles : undefined,
    excludedIndustries: excludedIndustries.length ? excludedIndustries : undefined,
    excludedSkills: excludedSkills.length ? excludedSkills : undefined,
    excludedCompanies: excludedCompanies.length ? excludedCompanies : undefined,
    roleTypes: roleTypes.length ? roleTypes : undefined,
    companyStages: companyStages.length ? companyStages : undefined,
    excludeSecurityClearance: form.excludeSecurityClearance || undefined,
    excludeUsCitizenOnly: form.excludeUsCitizenOnly || undefined,
    excludeStaffingAgency: form.excludeStaffingAgency || undefined,
    openToAllSalary: form.openToAllSalary || undefined,
    openToAllExperience: form.openToAllExperience || undefined,
    experienceLevelLabels: experienceLevelLabels.length ? experienceLevelLabels : undefined,
    customJobFunctions: form.customJobFunctions?.length ? form.customJobFunctions : undefined,
    locationAllInCountry: form.locationAllInCountry || undefined,
  };
}

export function emptyExtendedFilterFields() {
  return {
    excludedCompany: "",
    excludedIndustries: "",
    excludedSkills: "",
    excludedJobTitles: "",
    skills: "",
    companyStages: new Set<string>(),
    roleTypes: new Set<string>(),
    excludeSecurityClearance: false,
    excludeUsCitizenOnly: false,
    excludeStaffingAgency: false,
    openToAllSalary: false,
    openToAllExperience: false,
    customJobFunctions: [] as string[],
    locationAllInCountry: false,
  };
}

/** @deprecated use emptyExtendedFilterFields() */
export const EMPTY_EXTENDED_FILTER_FORM = emptyExtendedFilterFields();
