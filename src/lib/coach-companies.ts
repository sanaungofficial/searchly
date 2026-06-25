import { normalizeCompanySlug } from "@/lib/company-catalog";

export type CoachCompanyRecord = {
  slug: string;
  name: string;
};

type CoachCompanySource = {
  firms: string[];
  currentCompany: string | null;
};

/** Unique company names/slugs from coach profiles (current company + past firms). */
export function collectCoachCompanyRecords(coaches: CoachCompanySource[]): CoachCompanyRecord[] {
  const map = new Map<string, CoachCompanyRecord>();

  for (const coach of coaches) {
    for (const raw of [...coach.firms, coach.currentCompany].filter(Boolean) as string[]) {
      const name = raw.trim();
      if (!name) continue;
      const slug = normalizeCompanySlug(name);
      if (!slug) continue;
      if (!map.has(slug)) map.set(slug, { slug, name });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function coachMatchesCompanySlug(coach: CoachCompanySource, slug: string): boolean {
  const target = slug.trim().toLowerCase();
  if (!target) return true;
  const names = [...coach.firms, coach.currentCompany].filter(Boolean) as string[];
  return names.some((n) => normalizeCompanySlug(n) === target || n.trim().toLowerCase() === target);
}

export function coachCompanyNameForSlug(coaches: CoachCompanySource[], slug: string): string | null {
  const target = slug.trim().toLowerCase();
  const records = collectCoachCompanyRecords(coaches);
  const hit = records.find((r) => r.slug === target);
  return hit?.name ?? null;
}
