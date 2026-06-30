import type { CachedJob } from "@/lib/cached-job";
import type { HirebaseJob } from "@/lib/hirebase";
import type { SearchPreferences } from "@/lib/search-preferences";

export type ListingExclusionPrefs = Pick<
  SearchPreferences,
  | "excludedJobTitles"
  | "excludedIndustries"
  | "excludedSkills"
  | "excludedCompanies"
  | "excludeSecurityClearance"
  | "excludeUsCitizenOnly"
  | "excludeStaffingAgency"
>;

function haystack(cached: CachedJob, companyName: string, raw?: HirebaseJob): string {
  return [
    cached.title,
    companyName,
    cached.location,
    cached.department,
    cached.jobSummary,
    cached.description,
    ...(cached.skills ?? []),
    ...(cached.industries ?? []),
    ...(cached.subindustries ?? []),
    raw?.company_data?.type,
    raw?.company_data?.description_summary,
    ...(raw?.company_data?.industries ?? []),
    ...(raw?.company_data?.subindustries ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAnyTerm(hay: string, terms: string[] | undefined): boolean {
  if (!terms?.length) return false;
  return terms.some((term) => {
    const t = term.trim().toLowerCase();
    return t.length >= 2 && hay.includes(t);
  });
}

/** Client-side exclusion pass — Hirebase has no negative filter API for these fields. */
export function jobMatchesExclusionPrefs(
  cached: CachedJob,
  companyName: string,
  prefs: ListingExclusionPrefs,
  raw?: HirebaseJob,
): boolean {
  const hay = haystack(cached, companyName, raw);

  if (matchesAnyTerm(hay, prefs.excludedJobTitles)) return false;

  const industryHay = [
    ...(cached.industries ?? []),
    ...(cached.subindustries ?? []),
    ...(raw?.company_data?.industries ?? []),
    ...(raw?.company_data?.subindustries ?? []),
  ]
    .join(" ")
    .toLowerCase();
  if (matchesAnyTerm(industryHay || hay, prefs.excludedIndustries)) return false;

  if (matchesAnyTerm(hay, prefs.excludedSkills)) return false;

  const companyHay = companyName.toLowerCase();
  if (prefs.excludedCompanies?.some((c) => companyHay.includes(c.trim().toLowerCase()))) return false;

  if (prefs.excludeStaffingAgency) {
    const agency =
      raw?.recruiter_agency === true ||
      raw?.company_data?.is_recruiting_agency === true ||
      raw?.company_data?.is_3rd_party_agency === true ||
      /\b(staffing|recruiting agency|talent agency)\b/i.test(hay);
    if (agency) return false;
  }

  if (prefs.excludeSecurityClearance && /\b(security clearance|clearance required|ts\/sci|top secret)\b/i.test(hay)) {
    return false;
  }

  if (prefs.excludeUsCitizenOnly && /\b(us citizen only|u\.s\. citizen only|citizens only)\b/i.test(hay)) {
    return false;
  }

  return true;
}

export function applyExclusionPrefsToSources<T extends { cached: CachedJob; companyName: string; raw?: HirebaseJob }>(
  sources: T[],
  prefs: ListingExclusionPrefs | undefined,
): T[] {
  if (!prefs) return sources;
  const hasAny =
    prefs.excludedJobTitles?.length ||
    prefs.excludedIndustries?.length ||
    prefs.excludedSkills?.length ||
    prefs.excludedCompanies?.length ||
    prefs.excludeSecurityClearance ||
    prefs.excludeUsCitizenOnly ||
    prefs.excludeStaffingAgency;
  if (!hasAny) return sources;
  return sources.filter((s) => jobMatchesExclusionPrefs(s.cached, s.companyName, prefs, s.raw));
}
