import { prisma } from "@/lib/prisma";
import type { CompanyIntel, TrackedCompany } from "@prisma/client";
import { TOP_50_CATALOG, type CatalogCompany } from "@/lib/company-catalog";
import { findOrCreateCompanyIntel } from "@/lib/company-intel";
import {
  fetchHirebaseCompanyProfile,
  isHirebaseConfigured,
  type HirebaseCompanyProfile,
} from "@/lib/hirebase";

export type HirebaseEnrichmentMeta = {
  slug: string;
  logo: string | null;
  linkedinLink: string | null;
  jobBoard: string | null;
  subindustries: string[];
  totalOpenJobs: number | null;
  syncedAt: string;
};

export type CompanyEnrichmentCache = {
  description?: string | null;
  founded?: string | null;
  headquarters?: string | null;
  employeeCount?: string | null;
  industry?: string | null;
  fundingStage?: string | null;
  totalFunding?: string | null;
  keyInvestors?: string[];
  leadership?: Array<{ name: string; title: string }>;
  recentNews?: Array<{ title: string; date: string; summary: string }>;
  glassdoorRating?: string | null;
  websiteUrl?: string | null;
  subindustries?: string[];
  services?: string[];
  companyType?: string | null;
  isRecruitingAgency?: boolean | null;
  hirebaseProfile?: HirebaseCompanyProfile | null;
  hirebase?: HirebaseEnrichmentMeta;
  _primarySource?: "hirebase" | "ai";
};

export type HirebaseCompanySyncResult = {
  catalogSlug: string;
  name: string;
  ok: boolean;
  intelId?: string;
  hirebaseSlug?: string;
  jobBoard?: string | null;
  totalOpenJobs?: number | null;
  linkedinLink?: string | null;
  industries?: string[];
  error?: string;
};

function formatEmployeeRange(range: HirebaseCompanyProfile["size_range"]): string | null {
  if (!range) return null;
  const { min, max } = range;
  if (min != null && max != null) return `${min.toLocaleString()}–${max.toLocaleString()}`;
  if (min != null) return `${min.toLocaleString()}+`;
  if (max != null) return `Up to ${max.toLocaleString()}`;
  return null;
}

export function normalizeWebsiteUrl(link: string | null | undefined): string | null {
  if (!link?.trim()) return null;
  const trimmed = link.trim();
  if (trimmed.startsWith("http")) return trimmed;
  return `https://${trimmed}`;
}

export function enrichmentFromHirebaseProfile(profile: HirebaseCompanyProfile): CompanyEnrichmentCache {
  const syncedAt = new Date().toISOString();
  return {
    description: profile.description_summary,
    employeeCount: formatEmployeeRange(profile.size_range),
    industry: profile.industries[0] ?? null,
    subindustries: profile.subindustries,
    services: profile.services,
    companyType: profile.company_type,
    isRecruitingAgency: profile.is_recruiting_agency,
    websiteUrl: normalizeWebsiteUrl(profile.company_link),
    hirebase: {
      slug: profile.company_slug,
      logo: profile.company_logo,
      linkedinLink: profile.linkedin_link,
      jobBoard: profile.job_board,
      subindustries: profile.subindustries,
      totalOpenJobs: profile.sample_open_jobs > 0 ? profile.sample_open_jobs : null,
      syncedAt,
    },
    hirebaseProfile: profile,
    _primarySource: "hirebase",
  };
}

function profileFromEnrichmentCache(cache: CompanyEnrichmentCache): HirebaseCompanyProfile | null {
  if (cache.hirebaseProfile) return cache.hirebaseProfile;
  if (!cache.hirebase?.slug && !cache.description) return null;

  return {
    company_slug: cache.hirebase?.slug ?? "",
    company_name: cache.hirebase?.slug ?? "",
    company_logo: cache.hirebase?.logo ?? null,
    company_link: cache.websiteUrl ?? null,
    linkedin_link: cache.hirebase?.linkedinLink ?? null,
    description_summary: cache.description ?? null,
    job_board: cache.hirebase?.jobBoard ?? null,
    size_range: null,
    industries: cache.industry ? [cache.industry] : [],
    subindustries: cache.subindustries ?? cache.hirebase?.subindustries ?? [],
    services: cache.services ?? [],
    company_type: cache.companyType ?? null,
    is_recruiting_agency: cache.isRecruitingAgency ?? null,
    is_third_party_agency: null,
    sample_open_jobs: cache.hirebase?.totalOpenJobs ?? 0,
    sample_roles: [],
  };
}

export function getHirebaseProfileFromEnrichment(raw: unknown): HirebaseCompanyProfile | null {
  if (!raw || typeof raw !== "object") return null;
  return profileFromEnrichmentCache(raw as CompanyEnrichmentCache);
}

export async function persistHirebaseProfileOnTracked(
  trackedId: string,
  userId: string,
  profile: HirebaseCompanyProfile,
): Promise<CompanyEnrichmentCache> {
  const tracked = await prisma.trackedCompany.findFirst({
    where: { id: trackedId, userId },
    include: { companyIntel: true },
  });
  if (!tracked) throw new Error("Company not found.");

  const enrichment = enrichmentFromHirebaseProfile(profile);
  const now = new Date();

  if (tracked.companyIntelId) {
    await prisma.companyIntel.update({
      where: { id: tracked.companyIntelId },
      data: {
        enrichmentCache: enrichment,
        enrichmentFetchedAt: now,
        name: profile.company_name || tracked.companyIntel?.name,
        website: tracked.companyIntel?.website ?? normalizeWebsiteUrl(profile.company_link),
      },
    });
  }

  await prisma.trackedCompany.update({
    where: { id: trackedId },
    data: {
      enrichmentCache: enrichment,
      enrichmentFetchedAt: now,
      website: tracked.website ?? normalizeWebsiteUrl(profile.company_link),
      type: tracked.type ?? profile.industries[0] ?? null,
    },
  });

  return enrichment;
}

export function getHirebaseMetaFromEnrichment(raw: unknown): HirebaseEnrichmentMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const hirebase = (raw as CompanyEnrichmentCache).hirebase;
  if (!hirebase?.slug) return null;
  return hirebase;
}

/** Fetch Hirebase company profile and persist on shared CompanyIntel row. */
export async function hydrateIntelFromHirebase(
  intel: CompanyIntel,
  input?: { slugHint?: string | null; website?: string | null; force?: boolean },
): Promise<CompanyIntel> {
  if (!isHirebaseConfigured()) return intel;
  if (!input?.force && getHirebaseMetaFromEnrichment(intel.enrichmentCache)) return intel;

  try {
    const profile = await fetchHirebaseCompanyProfile({
      companyName: intel.name,
      slugHint: input?.slugHint ?? intel.slug,
      website: input?.website ?? intel.website,
    });
    const enrichment = enrichmentFromHirebaseProfile(profile);
    return prisma.companyIntel.update({
      where: { id: intel.id },
      data: {
        name: profile.company_name || intel.name,
        website: normalizeWebsiteUrl(profile.company_link) ?? intel.website,
        enrichmentCache: enrichment,
        enrichmentFetchedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[hydrateIntelFromHirebase]", err);
    return intel;
  }
}

export async function syncHirebaseCompanyFromCatalog(
  catalog: CatalogCompany
): Promise<HirebaseCompanySyncResult> {
  const base: HirebaseCompanySyncResult = {
    catalogSlug: catalog.slug,
    name: catalog.name,
    ok: false,
  };

  if (!isHirebaseConfigured()) {
    return { ...base, error: "HIREBASE_API_KEY is not configured." };
  }

  try {
    const profile = await fetchHirebaseCompanyProfile({
      companyName: catalog.name,
      slugHint: catalog.slug,
      website: catalog.website ?? null,
    });

    const intel = await findOrCreateCompanyIntel({
      name: catalog.name,
      slug: catalog.slug,
      website: normalizeWebsiteUrl(profile.company_link) ?? catalog.website ?? null,
      careersUrl: catalog.careersUrl ?? null,
    });

    const enrichment = enrichmentFromHirebaseProfile(profile);
    const now = new Date();

    await prisma.companyIntel.update({
      where: { id: intel.id },
      data: {
        name: profile.company_name || catalog.name,
        website: intel.website ?? normalizeWebsiteUrl(profile.company_link) ?? catalog.website ?? null,
        enrichmentCache: enrichment,
        enrichmentFetchedAt: now,
      },
    });

    return {
      ...base,
      ok: true,
      intelId: intel.id,
      hirebaseSlug: profile.company_slug,
      jobBoard: profile.job_board,
      totalOpenJobs: profile.sample_open_jobs > 0 ? profile.sample_open_jobs : null,
      linkedinLink: profile.linkedin_link,
      industries: profile.industries,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Hirebase sync failed.",
    };
  }
}

export type TrackedCompanyHirebaseRefreshResult =
  | { ok: true; enrichment: CompanyEnrichmentCache }
  | { ok: false; error: string };

function slugHintForTrackedCompany(
  tracked: TrackedCompany & { companyIntel?: CompanyIntel | null },
): string | null {
  const cachedRaw = tracked.enrichmentCache ?? tracked.companyIntel?.enrichmentCache;
  const fromEnrichment = getHirebaseMetaFromEnrichment(cachedRaw)?.slug?.trim();
  if (fromEnrichment) return fromEnrichment;

  const intelSlug = tracked.companyIntel?.slug?.trim();
  if (intelSlug) return intelSlug;

  const jobsCache = tracked.jobsCache;
  if (jobsCache && typeof jobsCache === "object" && !Array.isArray(jobsCache)) {
    const slug = (jobsCache as { hirebase_slug?: string | null }).hirebase_slug?.trim();
    if (slug) return slug;
  }

  return null;
}

/** Force-fetch Hirebase profile and persist on a tracked company (same path as company drawer). */
export async function refreshTrackedCompanyFromHirebase(
  tracked: TrackedCompany & { companyIntel?: CompanyIntel | null },
  userId: string,
): Promise<TrackedCompanyHirebaseRefreshResult> {
  if (!isHirebaseConfigured()) {
    return { ok: false, error: "Hirebase is not configured on this environment." };
  }

  try {
    const profile = await fetchHirebaseCompanyProfile({
      companyName: tracked.name,
      slugHint: slugHintForTrackedCompany(tracked),
      website: tracked.website ?? tracked.companyIntel?.website ?? null,
    });
    const enrichment = await persistHirebaseProfileOnTracked(tracked.id, userId, profile);
    return { ok: true, enrichment };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Hirebase refresh failed.",
    };
  }
}

export async function syncTop50HirebaseCompanies(): Promise<{
  synced: number;
  failed: number;
  results: HirebaseCompanySyncResult[];
}> {
  const results: HirebaseCompanySyncResult[] = [];

  for (const catalog of TOP_50_CATALOG) {
    const result = await syncHirebaseCompanyFromCatalog(catalog);
    results.push(result);
    await new Promise((r) => setTimeout(r, 150));
  }

  return {
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  };
}
