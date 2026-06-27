import type { OnboardingCompanyPick } from "@/lib/onboarding-coach/types";

type SuggestRow = {
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  type: string | null;
};

export function suggestRowToPick(row: SuggestRow): OnboardingCompanyPick {
  return {
    catalogSlug: row.catalogSlug,
    name: row.name,
    website: row.website,
    careersUrl: row.careersUrl,
    type: row.type,
  };
}

/** Resolve a spoken or typed company name to a catalog/Hirebase pick. */
export async function resolveCompanyByName(query: string): Promise<OnboardingCompanyPick | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const res = await fetch(`/api/companies/suggest?q=${encodeURIComponent(q)}&limit=6`);
  if (!res.ok) return null;

  const rows = (await res.json()) as SuggestRow[];
  if (!rows.length) return null;

  const lower = q.toLowerCase();
  const exact = rows.find((r) => r.name.toLowerCase() === lower);
  const starts = rows.find((r) => r.name.toLowerCase().startsWith(lower));
  return suggestRowToPick(exact ?? starts ?? rows[0]!);
}
