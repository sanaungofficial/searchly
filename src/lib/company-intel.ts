import { prisma } from "@/lib/prisma";
import type { CompanyIntel, TrackedCompany } from "@prisma/client";
import { getCatalogCompany, normalizeCompanySlug, type CatalogCompany } from "@/lib/company-catalog";

export async function backfillIntelWebsitesFromCatalog(): Promise<{ updated: number; skipped: number }> {
  const rows = await prisma.companyIntel.findMany({ where: { website: null } });
  let updated = 0;
  let skipped = 0;

  for (const intel of rows) {
    const catalog = getCatalogCompany(intel.slug);
    if (!catalog?.website) {
      skipped++;
      continue;
    }
    await prisma.companyIntel.update({
      where: { id: intel.id },
      data: {
        website: catalog.website,
        careersUrl: intel.careersUrl ?? catalog.careersUrl ?? null,
      },
    });
    updated++;
  }

  return { updated, skipped };
}

export type TrackedCompanyView = TrackedCompany & {
  companyIntelId: string | null;
};

export function mergeTrackedWithIntel(
  tracked: TrackedCompany,
  intel: CompanyIntel | null | undefined
): TrackedCompany {
  if (!intel) return tracked;

  const catalog = getCatalogCompany(intel.slug);

  return {
    ...tracked,
    website: tracked.website ?? intel.website ?? catalog?.website ?? null,
    careersUrl: tracked.careersUrl ?? intel.careersUrl ?? catalog?.careersUrl ?? null,
    jobsCache: intel.jobsCache ?? tracked.jobsCache,
    lastJobsFetchedAt: intel.lastJobsFetchedAt ?? tracked.lastJobsFetchedAt,
    enrichmentCache: intel.enrichmentCache ?? tracked.enrichmentCache,
    enrichmentFetchedAt: intel.enrichmentFetchedAt ?? tracked.enrichmentFetchedAt,
  };
}

export async function findOrCreateCompanyIntel(input: {
  name: string;
  slug?: string;
  website?: string | null;
  careersUrl?: string | null;
}): Promise<CompanyIntel> {
  const slug = (input.slug ?? normalizeCompanySlug(input.name)).trim();
  if (!slug) {
    throw new Error("Company name must contain at least one letter or number.");
  }

  const existing = await prisma.companyIntel.findUnique({ where: { slug } });
  if (existing) {
    const needsUpdate =
      (!existing.website && input.website) ||
      (!existing.careersUrl && input.careersUrl);

    if (needsUpdate) {
      return prisma.companyIntel.update({
        where: { id: existing.id },
        data: {
          website: existing.website ?? input.website ?? null,
          careersUrl: existing.careersUrl ?? input.careersUrl ?? null,
        },
      });
    }
    return existing;
  }

  return prisma.companyIntel.create({
    data: {
      name: input.name.trim(),
      slug,
      website: input.website ?? null,
      careersUrl: input.careersUrl ?? null,
    },
  });
}

export async function resolveCompanyIntelFromInput(body: {
  name?: string;
  companyIntelId?: string;
  catalogSlug?: string;
  website?: string | null;
  careersUrl?: string | null;
}): Promise<CompanyIntel | null> {
  if (body.companyIntelId) {
    const intel = await prisma.companyIntel.findUnique({ where: { id: body.companyIntelId } });
    if (intel) return intel;
  }

  const catalog = body.catalogSlug ? getCatalogCompany(body.catalogSlug) : undefined;
  if (catalog) {
    return findOrCreateCompanyIntel({
      name: catalog.name,
      slug: catalog.slug,
      website: catalog.website,
      careersUrl: catalog.careersUrl,
    });
  }

  if (body.name?.trim()) {
    const slug = normalizeCompanySlug(body.name);
    const catalogMatch = getCatalogCompany(slug);
    if (catalogMatch) {
      return findOrCreateCompanyIntel({
        name: catalogMatch.name,
        slug: catalogMatch.slug,
        website: catalogMatch.website,
        careersUrl: catalogMatch.careersUrl,
      });
    }

    return findOrCreateCompanyIntel({
      name: body.name.trim(),
      website: body.website,
      careersUrl: body.careersUrl,
    });
  }

  return null;
}

export function catalogToSuggestItem(company: CatalogCompany, intelId?: string) {
  return {
    id: intelId ?? null,
    catalogSlug: company.slug,
    name: company.name,
    website: company.website ?? null,
    careersUrl: company.careersUrl ?? null,
    type: company.type ?? null,
    source: "catalog" as const,
  };
}

export async function syncTrackedFromIntel(trackedId: string, intel: CompanyIntel): Promise<TrackedCompany> {
  return prisma.trackedCompany.update({
    where: { id: trackedId },
    data: {
      companyIntelId: intel.id,
      name: intel.name,
      website: intel.website,
      careersUrl: intel.careersUrl,
      jobsCache: intel.jobsCache ?? undefined,
      lastJobsFetchedAt: intel.lastJobsFetchedAt,
      enrichmentCache: intel.enrichmentCache ?? undefined,
      enrichmentFetchedAt: intel.enrichmentFetchedAt,
    },
  });
}

export function getEffectiveCareersUrl(tracked: TrackedCompany, intel?: CompanyIntel | null): string | null {
  const careersUrl = tracked.careersUrl ?? intel?.careersUrl ?? null;
  if (careersUrl) return careersUrl;
  const website = tracked.website ?? intel?.website ?? null;
  if (!website) return null;
  return website.replace(/\/$/, "") + "/careers";
}

export function getIntelCareersUrl(intel: Pick<CompanyIntel, "careersUrl" | "website">): string | null {
  if (intel.careersUrl?.trim()) return intel.careersUrl.trim();
  if (!intel.website?.trim()) return null;
  return intel.website.replace(/\/$/, "") + "/careers";
}
