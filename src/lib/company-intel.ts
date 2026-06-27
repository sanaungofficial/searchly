import { prisma } from "@/lib/prisma";
import type { CompanyIntel, TrackedCompany } from "@prisma/client";
import { getCatalogCompany, normalizeCompanySlug, type CatalogCompany } from "@/lib/company-catalog";
import type { HirebaseCompany } from "@/lib/hirebase";

export type CompanySuggestItem = {
  id: string | null;
  catalogSlug: string;
  name: string;
  website: string | null;
  careersUrl: string | null;
  logoUrl: string | null;
  type: string | null;
  source: "catalog" | "intel" | "hirebase";
};

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
    jobsCache: tracked.jobsCache,
    lastJobsFetchedAt: tracked.lastJobsFetchedAt,
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
  const name = input.name.trim();
  if (!slug) {
    throw new Error("Company name must contain at least one letter or number.");
  }

  async function findExisting(): Promise<CompanyIntel | null> {
    const bySlug = await prisma.companyIntel.findUnique({ where: { slug } });
    if (bySlug) return bySlug;
    if (name) {
      return prisma.companyIntel.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
    }
    return null;
  }

  const existing = await findExisting();
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

  try {
    return await prisma.companyIntel.create({
      data: {
        name,
        slug,
        website: input.website ?? null,
        careersUrl: input.careersUrl ?? null,
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "P2002") {
      const retry = await findExisting();
      if (retry) return retry;
    }
    throw err;
  }
}

export async function resolveCompanyIntelFromInput(body: {
  name?: string;
  companyIntelId?: string;
  catalogSlug?: string;
  website?: string | null;
  careersUrl?: string | null;
}): Promise<CompanyIntel | null> {
  const catalog = body.catalogSlug ? getCatalogCompany(body.catalogSlug) : undefined;
  if (catalog) {
    return findOrCreateCompanyIntel({
      name: catalog.name,
      slug: catalog.slug,
      website: catalog.website,
      careersUrl: catalog.careersUrl,
    });
  }

  if (body.catalogSlug?.trim() && body.name?.trim()) {
    return findOrCreateCompanyIntel({
      name: body.name.trim(),
      slug: body.catalogSlug.trim(),
      website: body.website,
      careersUrl: body.careersUrl,
    });
  }

  if (body.companyIntelId) {
    const intel = await prisma.companyIntel.findUnique({ where: { id: body.companyIntelId } });
    if (intel) return intel;
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

export function catalogToSuggestItem(company: CatalogCompany, intelId?: string): CompanySuggestItem {
  return {
    id: intelId ?? null,
    catalogSlug: company.slug,
    name: company.name,
    website: company.website ?? null,
    careersUrl: company.careersUrl ?? null,
    logoUrl: null,
    type: company.type ?? null,
    source: "catalog",
  };
}

export function hirebaseToSuggestItem(company: HirebaseCompany): CompanySuggestItem {
  const slug =
    company.company_slug?.trim() ||
    company.slug?.trim() ||
    normalizeCompanySlug(company.company_name ?? "");
  const type = company.industries?.[0] ?? company.subindustries?.[0] ?? null;
  return {
    id: null,
    catalogSlug: slug,
    name: company.company_name?.trim() || slug,
    website: company.company_link ?? null,
    careersUrl: null,
    logoUrl: company.company_logo?.trim() || null,
    type,
    source: "hirebase",
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
