import { isHirebaseConfigured, resolveHirebaseCompanySlug, searchHirebaseCompanies } from "@/lib/hirebase";
import { hydrateIntelFromHirebase, normalizeWebsiteUrl } from "@/lib/hirebase-company-sync";
import { resolveCompanyIntelFromInput } from "@/lib/company-intel";
import { normalizeCompanySlug } from "@/lib/company-catalog";
import type { SuggestedTrackedCompany } from "@/lib/intake-tracked-companies";

export type EnrichedImportCompany = SuggestedTrackedCompany & {
  hirebaseSlug?: string | null;
  website?: string | null;
  careersUrl?: string | null;
  apiLinked: boolean;
};

/** Resolve company via catalog + Hirebase API so watchlist rows link to intel/Hirebase when possible. */
export async function enrichImportCompany(name: string): Promise<EnrichedImportCompany> {
  const base: EnrichedImportCompany = {
    name: name.trim(),
    priority: "MEDIUM",
    apiLinked: false,
  };
  if (!name.trim()) return base;

  let hirebaseSlug: string | null = null;
  let website: string | null = null;

  if (isHirebaseConfigured()) {
    try {
      hirebaseSlug = await resolveHirebaseCompanySlug(name);
      if (hirebaseSlug) {
        const hits = await searchHirebaseCompanies(name, 3);
        const match =
          hits.find((h) => (h.company_slug ?? h.slug) === hirebaseSlug) ??
          hits.find((h) => h.company_name?.toLowerCase() === name.toLowerCase()) ??
          hits[0];
        website = match?.company_link ?? null;
        base.apiLinked = true;
        base.hirebaseSlug = hirebaseSlug;
        base.website = website;
        if (match?.company_name) base.name = match.company_name;
      }
    } catch (err) {
      console.warn("[enrichImportCompany] hirebase", name, err);
    }
  }

  const intel = await resolveCompanyIntelFromInput({
    name: base.name,
    catalogSlug: hirebaseSlug ?? normalizeCompanySlug(name),
    website,
  });

  if (intel) {
    const hydrated = await hydrateIntelFromHirebase(intel, {
      slugHint: hirebaseSlug ?? intel.slug,
      website: website ?? intel.website,
      force: false,
    });
    const enrichmentWebsite =
      hydrated.enrichmentCache &&
      typeof hydrated.enrichmentCache === "object" &&
      !Array.isArray(hydrated.enrichmentCache)
        ? normalizeWebsiteUrl((hydrated.enrichmentCache as { websiteUrl?: string | null }).websiteUrl)
        : null;

    return {
      ...base,
      name: hydrated.name,
      website: hydrated.website ?? enrichmentWebsite ?? website,
      careersUrl: hydrated.careersUrl,
      hirebaseSlug: hirebaseSlug ?? hydrated.slug,
      apiLinked: base.apiLinked || !!hydrated.enrichmentCache,
    };
  }

  return base;
}

export async function enrichImportCompanies(names: string[]): Promise<Map<string, EnrichedImportCompany>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const map = new Map<string, EnrichedImportCompany>();
  for (const name of unique) {
    const enriched = await enrichImportCompany(name);
    map.set(name.toLowerCase(), enriched);
  }
  return map;
}
