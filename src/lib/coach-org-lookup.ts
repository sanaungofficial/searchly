import { getCatalogCompany, normalizeCompanySlug } from "@/lib/company-catalog";
import type { CompanyEnrichmentCache } from "@/lib/hirebase-company-sync";
import { isHirebaseConfigured, searchHirebaseCompanies } from "@/lib/hirebase";
import { prisma } from "@/lib/prisma";

export type CoachOrgLookupMeta = {
  name: string;
  logoUrl: string | null;
  website: string | null;
};

function logoFromIntelEnrichment(enrichment: unknown): string | null {
  const cache = enrichment as CompanyEnrichmentCache | null | undefined;
  return cache?.hirebase?.logo?.trim() || null;
}

function lookupKeyForName(name: string): string {
  return normalizeCompanySlug(name.trim()).toLowerCase();
}

export async function resolveCoachOrgLookups(names: string[]): Promise<Record<string, CoachOrgLookupMeta>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return {};

  const entries = unique.map((name) => ({ name, key: lookupKeyForName(name) })).filter((e) => e.key);
  const slugs = [...new Set(entries.map((e) => e.key))];
  const map: Record<string, CoachOrgLookupMeta> = {};

  const intelRows = await prisma.companyIntel.findMany({ where: { slug: { in: slugs } } });
  const intelBySlug = new Map(intelRows.map((row) => [row.slug.toLowerCase(), row]));

  for (const { name, key } of entries) {
    const catalog = getCatalogCompany(key);
    const intel = intelBySlug.get(key);
    const logoUrl = logoFromIntelEnrichment(intel?.enrichmentCache);
    map[key] = {
      name: catalog?.name ?? intel?.name ?? name,
      logoUrl: logoUrl ?? null,
      website: intel?.website ?? catalog?.website ?? null,
    };
  }

  if (!isHirebaseConfigured()) return map;

  for (const { name, key } of entries) {
    if (map[key]?.logoUrl) continue;
    try {
      const hits = await searchHirebaseCompanies(name, 3);
      const match =
        hits.find((h) => (h.company_slug ?? h.slug)?.toLowerCase() === key) ??
        hits.find((h) => h.company_name?.trim().toLowerCase() === name.toLowerCase()) ??
        hits[0];
      if (!match) continue;
      map[key] = {
        name: match.company_name?.trim() || map[key]?.name || name,
        logoUrl: match.company_logo ?? map[key]?.logoUrl ?? null,
        website: match.company_link ?? map[key]?.website ?? null,
      };
    } catch (err) {
      console.warn("[coach-org-lookup]", name, err);
    }
  }

  return map;
}
