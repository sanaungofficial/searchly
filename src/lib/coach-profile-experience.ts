import { cleanCoachCompanyName, buildCoachExperienceCompanies } from "@/lib/coach-experience-companies";
import { normalizeCompanySlug } from "@/lib/company-catalog";
import type { CoachListItem } from "@/lib/coach-types";

export type CoachProfileExperienceEntry = {
  id: string;
  title: string | null;
  company: string;
  dateLabel: string | null;
  lookupKey: string;
};

export type CoachProfileEducationEntry = {
  id: string;
  school: string;
  degree: string | null;
  lookupKey: string;
};

export function parseCoachSchoolEntry(raw: string): { school: string; degree: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { school: "", degree: null };
  const parts = trimmed.split(/\s*[—–-]\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { school: parts[0]!, degree: parts.slice(1).join(" — ") };
  }
  return { school: trimmed, degree: null };
}

export function buildCoachProfileExperienceEntries(
  coach: Pick<CoachListItem, "currentRole" | "currentCompany" | "firms">,
): CoachProfileExperienceEntry[] {
  const entries: CoachProfileExperienceEntry[] = [];
  const currentCompany = coach.currentCompany?.trim();
  const currentRole = coach.currentRole?.trim();
  const currentSlug = currentCompany ? normalizeCompanySlug(cleanCoachCompanyName(currentCompany)) : "";

  if (currentRole || currentCompany) {
    entries.push({
      id: "current",
      title: currentRole || null,
      company: currentCompany ? cleanCoachCompanyName(currentCompany) : "",
      dateLabel: "Present",
      lookupKey: currentSlug,
    });
  }

  const experienceCompanies = buildCoachExperienceCompanies(coach);
  for (const company of experienceCompanies) {
    if (company.kind === "current") continue;
    entries.push({
      id: company.key,
      title: null,
      company: company.displayName,
      dateLabel: null,
      lookupKey: company.key,
    });
  }

  return entries.filter((entry) => entry.title || entry.company);
}

export function buildCoachProfileEducationEntries(schools: string[]): CoachProfileEducationEntry[] {
  return schools
    .map((raw) => {
      const parsed = parseCoachSchoolEntry(raw);
      if (!parsed.school) return null;
      return {
        id: normalizeCompanySlug(parsed.school) || parsed.school.toLowerCase(),
        school: parsed.school,
        degree: parsed.degree,
        lookupKey: normalizeCompanySlug(parsed.school),
      };
    })
    .filter((entry): entry is CoachProfileEducationEntry => Boolean(entry));
}

export function orgNamesForCoachProfileLookups(
  experience: CoachProfileExperienceEntry[],
  education: CoachProfileEducationEntry[],
): string[] {
  const names = new Set<string>();
  for (const entry of experience) {
    if (entry.company) names.add(entry.company);
  }
  for (const entry of education) {
    names.add(entry.school);
  }
  return Array.from(names);
}
