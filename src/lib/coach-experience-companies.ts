import { normalizeCompanySlug } from "@/lib/company-catalog";
import type { CoachListItem } from "@/lib/coach-types";

export type CoachExperienceCompany = {
  key: string;
  rawName: string;
  displayName: string;
  label: string;
  kind: "current" | "past";
};

export function cleanCoachCompanyName(raw: string): string {
  return raw.replace(/^ex[-\s]+/i, "").trim();
}

export function coachCompanyWorksLabel(raw: string, kind: "current" | "past"): string {
  const name = cleanCoachCompanyName(raw);
  return kind === "current" ? `Works at ${name}` : `Worked at ${name}`;
}

export function buildCoachExperienceCompanies(
  coach: Pick<CoachListItem, "currentCompany" | "firms">,
): CoachExperienceCompany[] {
  const pills: CoachExperienceCompany[] = [];
  const seen = new Set<string>();

  if (coach.currentCompany?.trim()) {
    const displayName = cleanCoachCompanyName(coach.currentCompany);
    const slug = normalizeCompanySlug(displayName);
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      pills.push({
        key: slug,
        rawName: coach.currentCompany,
        displayName,
        label: coachCompanyWorksLabel(coach.currentCompany, "current"),
        kind: "current",
      });
    }
  }

  for (const firm of coach.firms ?? []) {
    const displayName = cleanCoachCompanyName(firm);
    const slug = normalizeCompanySlug(displayName);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    pills.push({
      key: slug,
      rawName: firm,
      displayName,
      label: coachCompanyWorksLabel(firm, "past"),
      kind: "past",
    });
  }

  return pills;
}

export type CoachCompanyLookupMeta = {
  name: string;
  logoUrl: string | null;
  website: string | null;
  careersUrl: string | null;
};
