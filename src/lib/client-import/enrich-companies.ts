import { isHirebaseConfigured, resolveHirebaseCompanySlug, searchHirebaseCompanies } from "@/lib/hirebase";
import { normalizeCompanySlug } from "@/lib/company-catalog";
import type { SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";

export type EnrichedImportCompany = SuggestedTrackedCompany & {
  hirebaseSlug?: string | null;
  website?: string | null;
  careersUrl?: string | null;
  apiLinked: boolean;
};

/** Lightweight Hirebase name/slug resolution for bulk import (no intel row creation). */
export async function enrichImportCompany(name: string): Promise<EnrichedImportCompany> {
  const base: EnrichedImportCompany = {
    name: name.trim(),
    priority: "MEDIUM",
    apiLinked: false,
  };
  if (!name.trim()) return base;

  if (!isHirebaseConfigured()) return base;

  try {
    const hirebaseSlug = await resolveHirebaseCompanySlug(name);
    if (!hirebaseSlug) return base;

    const hits = await searchHirebaseCompanies(name, 3);
    const match =
      hits.find((h) => (h.company_slug ?? h.slug) === hirebaseSlug) ??
      hits.find((h) => h.company_name?.toLowerCase() === name.toLowerCase()) ??
      hits[0];

    return {
      ...base,
      name: match?.company_name?.trim() || base.name,
      website: match?.company_link ?? null,
      hirebaseSlug: hirebaseSlug ?? normalizeCompanySlug(name),
      apiLinked: true,
    };
  } catch (err) {
    console.warn("[enrichImportCompany]", name, err);
    return base;
  }
}

export async function enrichImportCompanies(names: string[]): Promise<Map<string, EnrichedImportCompany>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const map = new Map<string, EnrichedImportCompany>();
  for (const name of unique) {
    try {
      const enriched = await enrichImportCompany(name);
      map.set(name.toLowerCase(), enriched);
    } catch (err) {
      console.warn("[enrichImportCompanies]", name, err);
      map.set(name.toLowerCase(), { name, priority: "MEDIUM", apiLinked: false });
    }
  }
  return map;
}
